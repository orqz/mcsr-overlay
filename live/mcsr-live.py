#!/usr/bin/env python3
"""mcsr-live: serves the HUD and overlay plus the live run state SpeedRunIGT writes to disk.

It also answers /api/skin?uuid=<uuid> (your Minecraft skin's texture URL, from
Mojang) for the face next to your name in stats.html.

SpeedRunIGT keeps ~/speedrunigt/latest_world.json pointing at the world you're
in and appends every split to <world>/speedrunigt/events.log as
"<event> <rta ms> <igt ms>". Finished worlds land in ~/speedrunigt/records/,
which is where your average and best splits come from.

The HUD and overlay are served from here (not GitHub Pages) because Chrome
blocks public sites from reading 127.0.0.1, and OBS's browser source is Chrome.

    python3 live/mcsr-live.py
    OBS Browser source: http://127.0.0.1:7477/hud.html?u=<your name>
                    or: http://127.0.0.1:7477/overlay.html?u=<your name>&style=<any style>

Standard library only. It only ever reads your game files.
"""
import argparse
import base64
import json
import os
import statistics
import subprocess
import threading
import time
import urllib.parse
import urllib.request
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

try:  # your own endpoints, if you keep a live/stream_extras.py next to this file
    import stream_extras as extras
except ImportError:
    extras = None

ROOT = Path(__file__).resolve().parent.parent
IGT_DIR = Path.home() / 'speedrunigt'
RECENT = 40  # runs per split that count towards the average

# key, events.log names (first found wins), record timeline name
SPLITS = [
    ('nether', ('rsg.enter_nether',), 'enter_nether'),
    ('bastion', ('rsg.enter_bastion',), 'enter_bastion'),
    ('fortress', ('rsg.enter_fortress',), 'enter_fortress'),
    ('blind', ('rsg.first_portal',), 'nether_travel'),
    ('stronghold', ('rsg.enter_stronghold',), 'enter_stronghold'),
    ('end', ('rsg.enter_end',), 'enter_end'),
    ('finish', ('rsg.credits', 'rsg.kill_dragon'), None),  # records use final_igt
]
# Practice maps start you next to the portal; anything this early isn't a real split.
MIN_SPLIT_MS = 20_000


def read_json(path):
    try:
        return json.loads(Path(path).read_text(encoding='utf-8'))
    except (OSError, ValueError):
        return None


def read_text(path):
    try:
        return Path(path).read_text(encoding='utf-8', errors='replace')
    except OSError:
        return None


def kind_of(world_name):
    return 'ranked' if str(world_name).startswith('mcsrranked') else 'rsg'


# ---------- history: averages, best splits and PB from finished worlds ----------

def record_splits(rec):
    tl = {t.get('name'): t.get('igt') for t in rec.get('timelines') or []}
    out = {}
    for key, _, name in SPLITS:
        ms = (rec.get('retimed_igt') or rec.get('final_igt')) if key == 'finish' and rec.get('is_completed') else tl.get(name)
        if isinstance(ms, (int, float)) and ms >= MIN_SPLIT_MS:
            out[key] = int(ms)
    # without a nether entry the later splits came from a practice map
    if 'nether' not in out:
        out = {}
    return out


def usable(rec, kind):
    name = str(rec.get('world_name') or '')
    if rec.get('is_coop') or rec.get('category') not in (None, 'ANY'):
        return False
    if kind == 'ranked':
        # Ranked turns cheats on once the match is over, so that flag means nothing here
        return name.startswith('mcsrranked')
    return (rec.get('run_type') == 'random_seed' and not rec.get('is_cheat_allowed')
            and 'practice' not in name.lower())


class History:
    """Re-reads the records folder only when it changes."""

    def __init__(self):
        self.key = None
        self.runs = []  # newest first: {world, kind, date, splits}

    def refresh(self):
        folder = IGT_DIR / 'records'
        try:
            files = list(folder.glob('*.json'))
            key = (len(files), max((f.stat().st_mtime_ns for f in files), default=0))
        except OSError:
            files, key = [], None
        if key == self.key:
            return
        by_world = {}
        for f in files:
            rec = read_json(f)
            if not isinstance(rec, dict):
                continue
            kind = kind_of(rec.get('world_name'))
            if not usable(rec, kind):
                continue
            splits = record_splits(rec)
            if not splits:
                continue
            run = {'world': rec.get('world_name'), 'kind': kind, 'date': rec.get('date') or 0, 'splits': splits}
            # leaving and rejoining a world writes another record; keep the furthest one
            old = by_world.get(run['world'])
            if not old or len(splits) >= len(old['splits']):
                by_world[run['world']] = run
        self.runs = sorted(by_world.values(), key=lambda r: r['date'], reverse=True)
        self.key = key

    def reference(self, kind, exclude_world=None):
        runs = [r for r in self.runs if r['kind'] == kind and r['world'] != exclude_world]
        done = [r for r in runs if 'finish' in r['splits']]
        pb = min(done, key=lambda r: r['splits']['finish'], default=None)
        splits = {}
        for key, _, _ in SPLITS:
            times = [r['splits'][key] for r in runs if key in r['splits']][:RECENT]
            if times:
                splits[key] = {
                    'n': len(times),
                    'median': int(statistics.median(times)),
                    'best': min(times),
                    'times': sorted(times),
                }
        return {
            'kind': kind,
            'runs': len(runs),
            'pb': {'time': pb['splits']['finish'], 'date': pb['date'], 'splits': pb['splits']} if pb else None,
            'splits': splits,
        }


# ---------- the run you're in right now ----------

def world_state(game_dir):
    """'world' / 'menu' / None (unknown), from State Output or Hermes when installed."""
    wp = read_text(game_dir / 'wpstateout.txt')
    if wp is not None:
        return 'world' if wp.strip().startswith('inworld') else 'menu'
    hermes = read_json(game_dir / 'hermes' / 'state.json')
    if isinstance(hermes, dict):
        return 'world' if hermes.get('world') else 'menu'
    return None


MATCH_START = 'Re-activating match recording'  # MCSR Ranked logs this as the countdown ends
_log_starts = {}  # world path -> match start (ms) found in latest.log


def created(path):
    """When a file was created (seconds), or 0 if the system won't say."""
    born = getattr(os.stat(path), 'st_birthtime', 0)  # Windows and macOS
    if not born:
        try:  # Linux keeps it too, but Python only gets it through stat(1)
            born = int(subprocess.run(['stat', '-c', '%W', str(path)], capture_output=True, text=True).stdout.strip() or 0)
        except (OSError, ValueError):
            born = 0
    return born


def log_match_start(game_dir, log_path):
    """When the Ranked countdown ended for this world, from the game's latest.log (1s precision)."""
    key = str(log_path)
    if key in _log_starts:
        return _log_starts[key]
    try:
        born = created(log_path)
        log = game_dir / 'logs' / 'latest.log'
        with open(log, 'rb') as f:
            f.seek(max(0, log.stat().st_size - 1_000_000))
            text = f.read().decode('utf-8', 'replace')
    except (OSError, ValueError):
        return None
    if not born:
        return None
    day = time.localtime(born)
    for line in text.splitlines():
        if MATCH_START not in line or not line.startswith('['):
            continue
        try:
            h, m, sec = (int(x) for x in line[1:9].split(':'))
        except ValueError:
            continue
        t = time.mktime((day.tm_year, day.tm_mon, day.tm_mday, h, m, sec, 0, 0, -1))
        if t < born - 3600:
            t += 86400  # past midnight
        if born - 1 <= t <= born + 600:  # this world's countdown, not an earlier match
            _log_starts[key] = int((t + .5) * 1000)  # middle of that second
            return _log_starts[key]
    return None


def clock_start(world, events, mtime, log_path):
    """Wall-clock run start (RTA), or None when it can't be known.

    Exact once a split is logged: mtime is when the last line was written, so
    start = mtime - that line's RTA. Until then, Ranked's countdown-end line in the
    game log gives it to the second. The "common.view_seed 0 0" line doesn't count:
    it's written a few seconds before the countdown ends. Practice maps get no clock.
    """
    if not events or not mtime or 'practice' in world.name.lower():
        return None
    name, rta, _ = events[-1]
    if name != 'common.view_seed' and rta > 0:
        return mtime - rta
    if kind_of(world.name) == 'ranked':
        return log_match_start(world.parent.parent, log_path)
    return None


def live_state(history):
    latest = read_json(IGT_DIR / 'latest_world.json') or {}
    world_path = latest.get('world_path')
    if not world_path:
        return {'ok': True, 'world': None, 'live': False}
    world = Path(world_path)
    game_dir = world.parent.parent  # <game dir>/saves/<world>
    log = world / 'speedrunigt' / 'events.log'
    text = read_text(log) or ''
    try:
        mtime = log.stat().st_mtime_ns // 1_000_000
    except OSError:
        mtime = None

    events, splits, left = [], {}, False
    for line in text.splitlines():
        parts = line.split()
        if len(parts) < 3:
            continue
        try:
            name, rta, igt = parts[0], int(parts[1]), int(parts[2])
        except ValueError:
            continue
        events.append((name, rta, igt))
        if name == 'common.leave_world':
            left = True
        elif name == 'common.rejoin_world':
            left = False
    for key, names, _ in SPLITS:
        for n in names:
            hit = next((e for e in events if e[0] == n), None)
            if hit:
                splits[key] = hit[2] or hit[1]
                break

    state = world_state(game_dir)
    finished = 'finish' in splits
    if state is None:  # no state mod: trust the log, and give up on it after 2h of silence
        state = 'menu' if left or not mtime or time.time() * 1000 - mtime > 7_200_000 else 'world'
    live = state == 'world' and not left and bool(events)

    session = read_json(world / 'ranked_session.json') or {}
    opp = session.get('player') or {}
    kind = kind_of(world.name)
    history.refresh()
    return {
        'ok': True,
        'world': world.name,
        'kind': kind,
        'live': live,
        'finished': finished,
        'splits': splits,
        'clockStart': clock_start(world, events, mtime, log),
        'match': {
            'type': session.get('matchType'),
            'opponent': opp.get('nickname'),
            'opponentElo': opp.get('eloRate'),
            'opponentStatus': opp.get('status'),
        } if session else None,
        'ref': history.reference(kind, exclude_world=world.name),
        'now': int(time.time() * 1000),
    }


# ---------- skin faces for stats.html ----------

class Skins:
    """Skin texture URL for a Minecraft UUID, from Mojang's session server, cached for 10 minutes."""

    def __init__(self):
        self.cache = {}

    def get(self, uuid):
        uuid = ''.join(c for c in uuid.lower() if c in '0123456789abcdef')
        if len(uuid) != 32:
            return {'ok': False, 'error': 'bad uuid'}
        at, url = self.cache.get(uuid, (0, None))
        if time.time() - at > 600:
            try:
                with urllib.request.urlopen(f'https://sessionserver.mojang.com/session/minecraft/profile/{uuid}', timeout=5) as r:
                    prop = json.loads(r.read())['properties'][0]['value']
                url = json.loads(base64.b64decode(prop))['textures']['SKIN']['url'].replace('http://', 'https://')
            except (OSError, ValueError, KeyError, IndexError):
                pass  # keep the last good one
            self.cache[uuid] = (time.time(), url)
        return {'ok': url is not None, 'url': url}


# ---------- http ----------

class Handler(SimpleHTTPRequestHandler):
    history = History()
    skins = Skins()
    lock = threading.Lock()

    def __init__(self, *a, **kw):
        super().__init__(*a, directory=str(ROOT), **kw)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Private-Network', 'true')
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(204)
        self.send_header('Access-Control-Allow-Methods', 'GET')
        self.end_headers()

    def send_json(self, body):
        data = json.dumps(body).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers()
        self.wfile.write(data)

    def do_GET(self):
        path, _, query = self.path.partition('?')
        if path == '/api/live':
            with self.lock:
                try:
                    body = live_state(self.history)
                except Exception as e:  # never take the overlay down over one bad read
                    body = {'ok': False, 'error': str(e)}
            return self.send_json(body)
        if path == '/api/skin':
            uuid = urllib.parse.parse_qs(query).get('uuid', [''])[0]
            with self.lock:
                return self.send_json(self.skins.get(uuid))
        if extras and extras.handle(self, path, query):
            return
        if path == '/':
            self.send_response(302)
            self.send_header('Location', '/hud.html' + (self.path[1:] if self.path.startswith('/?') else ''))
            self.end_headers()
            return
        if any(p.startswith('.') for p in path.split('/')):
            self.send_error(404)
            return
        super().do_GET()

    def log_message(self, *a):
        pass


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument('--port', type=int, default=7477)
    ap.add_argument('--host', default='127.0.0.1')
    ap.add_argument('--igt-dir', type=Path, help='SpeedRunIGT folder (default: ~/speedrunigt)')
    ap.add_argument('--dump', action='store_true', help='print the live state once and exit')
    args = ap.parse_args()
    if args.igt_dir:
        global IGT_DIR
        IGT_DIR = args.igt_dir.expanduser()
    if args.dump:
        print(json.dumps(live_state(History()), indent=2))
        return
    server = ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'mcsr-live on http://{args.host}:{args.port}/hud.html?u=<your name> (or /overlay.html?u=<your name>&style=…)', flush=True)
    server.serve_forever()


if __name__ == '__main__':
    main()
