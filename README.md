# mcsr-overlay

OBS overlay for [MCSR Ranked](https://mcsrranked.com): rank badge, elo, PB, session stats and recent matches for any player.

**Live:** [orqz.github.io/mcsr-overlay](https://orqz.github.io/mcsr-overlay/) — open it, set it up, copy the URL into OBS. Nothing to download.

- `hud.html` — a small HUD with live run pace (see below)
- `index.html` — customizer with live preview; builds the overlay URL for you
- `overlay.html` — the overlay itself; every option is a URL param, e.g. `overlay.html?u=orq2&style=tooltip&layout=bar`

## HUD with live run pace

`hud.html` is one small pill: rank badge, elo, tier progress, session elo, PB and your last five results. While you're in a run, a second row opens under it and reacts to every split, comparing it with your own past runs:

- **Each split** (nether, bastion, fortress, blind, stronghold, end, finish) gets a verdict: best ever, great, good, okay or slow pace, plus how far ahead of or behind your average you are.
- **The track** has a dot per split, and the gap to the next dot fills toward your average time for it. It turns orange once you're past that average.
- **PB pace:** while you're ahead of your PB run's splits, a gold light runs around the edge and the PB slot shows how far ahead you are. It switches off as soon as the clock passes your PB run's next split.
- **Callouts** under the pill: the opponent when a match starts, each split, a new PB, then the match result with your elo counting up.

The live part needs a small helper that reads the files [SpeedRunIGT](https://github.com/RedLime/SpeedRunIGT) writes: the current world's `events.log`, and `~/speedrunigt/records/` for your averages, best splits and PB. Ranked worlds are compared with ranked worlds, RSG with RSG. The helper also serves the HUD, because Chrome (and so OBS) blocks a public site from reading `127.0.0.1`.

```bash
python3 live/mcsr-live.py
```

Python 3, nothing to install. On Linux, `live/mcsr-live.service` starts it on login. Then in OBS add a **Browser** source:

```
http://127.0.0.1:7477/hud.html?u=YourName&scale=1.4
```

Size it to 640×260 and leave the source's transform at 100% so the text stays sharp. Use `scale` to resize it instead. Other params: `bga` sets panel opacity (0–100, default 84), `live=0` shows stats only, and `demo` plays a fake run so you can see every animation (`demo=40` is faster). Without the helper, the HUD still shows your stats.

## Styles and layouts

Pick any style with any layout.

| Style | Look |
| --- | --- |
| `badge` (default) | The rank badge up front, no box, text shadow so it reads over gameplay |
| `tooltip` | A Minecraft item tooltip, in the Monocraft font |
| `banner` | Broadcast graphics with tier-colored rules |
| `clean` | A minimal flat panel |

Layouts: `card` (everything), `bar` (one line), `compact` (elo and session), `matches` (recent results).

## Options

All of these are in the customizer; each is also a URL param.

- **Show:** player head, flag, tier, leaderboard #, peak, tier progress, best/average time, W–L, winrate, streak, FF rate, matches played, opponent elo/heads, seed icons, time ago
- **Session:** session elo, session time, session streak, new-match popup, idle reset (`reset`, hours)
- **Progress:** rank goal (`goal=Diamond I`, or an elo number), rotating info line in compact (`rotate`, seconds)
- **Look:** display name (`label`), size and scale, width, align/anchor, font, color palettes, background/text/muted/accent/border/win/loss colors, opacity, fill (solid/gradient), texture (grid/dots/noise), corners, border, shadows

## OBS setup

1. Open the [live customizer](https://orqz.github.io/mcsr-overlay/) (or `index.html` locally), enter a username, pick a layout and style, click **Copy URL**.
2. In OBS: **Sources → + → Browser**, untick **Local file**, paste the URL.
3. Set the width/height to the size shown in the customizer.

Data comes from the public MCSR Ranked API and refreshes every 30s by default.

## Credits

Rank badges, seed/bastion icons, division thresholds and tier colors are MCSR Ranked's own. Tooltip style uses [Monocraft](https://github.com/IdreesInc/Monocraft) (OFL-1.1). Player heads from mc-heads.net. Built with [Claude Code](https://claude.com/claude-code). Not affiliated with MCSR Ranked or Mojang.
