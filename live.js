// live.js: the run you're in right now, shared by hud.html and overlay.html.
// It polls live/mcsr-live.py (or plays a made-up run) and grades every split against your own past runs.
(function () {
  'use strict';

  // Order on the track. Bastion and fortress can swap; each is judged on its own.
  const SPLITS = ['nether', 'bastion', 'fortress', 'blind', 'stronghold', 'end', 'finish'];
  const NAMES = { '': 'Overworld', nether: 'Nether', bastion: 'Bastion', fortress: 'Fortress', blind: 'Blind', stronghold: 'Stronghold', end: 'The End', finish: 'Finished' };
  const SHORT = { nether: 'nether', bastion: 'bastion', fortress: 'fortress', blind: 'blind', stronghold: 'stronghold', end: 'end', finish: 'finish' };
  // [word, color]; each page defines the colors as CSS variables (--best, --great, …)
  const VERDICTS = {
    pb:    ['New PB', 'best'],
    best:  ['Best ever', 'best'],
    great: ['Great pace', 'great'],
    good:  ['Good pace', 'good'],
    okay:  ['Okay pace', 'okay'],
    slow:  ['Slow pace', 'slow'],
    none:  ['Split', 'live'],
  };

  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const pad = n => String(n).padStart(2, '0');
  function fmt(ms) {
    if (ms == null) return '—';
    const s = Math.floor(ms / 1000), h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60);
    return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
  }
  const fmtD = ms => (ms < 0 ? '−' : '+') + fmt(Math.abs(ms));

  function judge(key, t, ref) {
    const r = ref && ref.splits && ref.splits[key];
    const pbRun = ref && ref.pb;
    const j = { key, t, avg: r ? r.median : null, best: r ? r.best : null, pb: pbRun ? pbRun.splits[key] : null };
    if (key === 'finish' && (!pbRun || t < pbRun.time)) j.v = 'pb';
    else if (!r || r.n < 3) j.v = 'none';
    else if (t < r.best) j.v = 'best';
    else {
      // how many of your runs were slower; the side of the average decides good vs okay
      const slower = r.times.filter(x => x > t).length / r.n;
      j.v = t <= r.median ? (slower >= .75 ? 'great' : 'good') : (slower >= .25 ? 'okay' : 'slow');
    }
    return j;
  }

  // ---------- the made-up run ----------
  // Great nether, slow bastion (drops PB pace), back on it by the fortress, best-ever stronghold, new PB.
  const DEMO = (() => {
    const M = s => Math.round(s * 1000);
    const spread = (med, best, n) => Array.from({ length: n }, (_, i) => Math.round(best + (med - best) * 2 * i / (n - 1))).sort((a, b) => a - b);
    const ref = {
      kind: 'ranked', runs: 22,
      pb: { time: M(1409), splits: { nether: M(311), bastion: M(366), fortress: M(807), blind: M(892), stronghold: M(1203), end: M(1274), finish: M(1409) } },
      splits: {},
    };
    [['nether', 251, 166, 22], ['bastion', 338, 200, 20], ['fortress', 665, 320, 11], ['blind', 982, 618, 9],
     ['stronghold', 1385, 1038, 8], ['end', 1387, 1274, 5], ['finish', 1441, 1409, 2]].forEach(([k, med, best, n]) => {
      ref.splits[k] = { n, median: M(med), best: M(best), times: spread(M(med), M(best), n) };
    });
    const run = { nether: M(226), bastion: M(372), fortress: M(600), blind: M(700), stronghold: M(1020), end: M(1150), finish: M(1330) };
    return { ref, run };
  })();

  // speed: game time per real time. onEnd(time) fires once a loop, when the finished run closes.
  function demoRun(speed, onEnd) {
    const RUN = DEMO.run, IDLE = 4000, AFTER = 14000;
    let t0 = Date.now(), loop = 0, scored = false;
    const span = () => IDLE + RUN.finish / speed + AFTER;
    const tick = () => {
      if (Date.now() - t0 > span()) { t0 = Date.now(); loop++; scored = false; }
      return Date.now() - t0;
    };
    return {
      game() { return Math.max(0, (tick() - IDLE) * speed); },
      state() {
        const w = tick(), g = Math.max(0, (w - IDLE) * speed);
        const splits = {};
        for (const k in RUN) if (g >= RUN[k]) splits[k] = RUN[k];
        const live = w >= IDLE && g < RUN.finish + 4000 * speed;
        if (!live && splits.finish != null && !scored) { scored = true; onEnd(RUN.finish); }
        return {
          ok: true, world: 'demo #' + loop, kind: 'ranked', live, splits, finished: splits.finish != null,
          match: { type: 'RANKED', opponent: 'Opponent', opponentElo: 494 }, ref: DEMO.ref,
        };
      },
    };
  }

  // ---------- the engine ----------
  // o: { url, demo (speed; 0 reads the helper), onSplit(j, ref, pb), onMatch(match), onEnd(finished), onDemoEnd(time), onChange() }
  function create(o) {
    const E = { data: null, world: null, judged: {}, pb: null, primed: false, announced: null, linger: 0, timer: null, stopped: true };
    const demo = o.demo ? demoRun(o.demo, t => o.onDemoEnd && o.onDemoEnd(t)) : null;

    function onLive(d) {
      if (!d || !d.ok) return;
      const wasLive = !!(E.data && E.data.live);
      const splits = d.splits || {};
      const fresh = [];
      if (d.world !== E.world) {
        // a new world: splits already in it (page reloaded mid-run) are judged quietly
        E.world = d.world;
        E.judged = {};
        E.pb = null;
        for (const k of SPLITS) if (splits[k] != null) E.judged[k] = judge(k, splits[k], d.ref);
      } else {
        for (const k of SPLITS) {
          if (splits[k] == null || E.judged[k]) continue;
          const j = E.judged[k] = judge(k, splits[k], d.ref);
          j.at = Date.now();
          const pbRun = d.ref && d.ref.pb;
          // PB pace: at or ahead of your PB run's time for this split
          if (k === 'finish') E.pb = null;
          else if (pbRun && j.pb != null) E.pb = j.t <= j.pb ? { d: j.t - j.pb } : null;
          fresh.push([j, E.pb ? E.pb.d : null]);
        }
      }
      E.data = d;
      fresh.forEach(([j, pb]) => o.onSplit && o.onSplit(j, d.ref, pb));
      // who you're playing, once, when the run starts (not when the page reloads mid-run)
      if (d.live && E.announced !== d.world) {
        E.announced = d.world;
        if (E.primed && d.match && d.match.opponent && o.onMatch) o.onMatch(d.match);
      }
      E.primed = true;
      if (wasLive && !d.live) {
        E.linger = Date.now() + (splits.finish != null ? 9000 : 2500);
        if (o.onEnd) o.onEnd(splits.finish != null);
      }
    }

    E.elapsed = () => demo ? demo.game() : E.data && E.data.clockStart ? Date.now() - E.data.clockStart : null;

    // Everything a page draws, worked out now: the latest split, the next one and how far toward it you are.
    E.view = () => {
      const d = E.data;
      const x = {
        on: !!(d && d.live) || Date.now() < E.linger, live: !!(d && d.live), judged: E.judged, ref: (d && d.ref) || {},
        match: d ? d.match : null, recent: null, nextIdx: -1, nextKey: null, target: null, now: null, from: 0, late: false, fill: 0, pb: null,
      };
      if (!d) return x;
      let far = -1;
      SPLITS.forEach((k, i) => {
        const j = E.judged[k];
        if (!j) return;
        far = i;
        if (!x.recent || j.t > x.recent.t) x.recent = j;
      });
      x.nextIdx = SPLITS.findIndex((k, i) => i > far && !E.judged[k]);
      x.nextKey = x.nextIdx >= 0 ? SPLITS[x.nextIdx] : null;
      const ref = x.ref;
      x.target = x.nextKey && ref.splits && ref.splits[x.nextKey] ? ref.splits[x.nextKey].median : null;
      x.now = E.elapsed();
      x.from = x.recent ? x.recent.t : 0;
      x.late = x.target != null && x.now != null && x.live && x.now > x.target;
      x.fill = x.target != null && x.now != null && x.target > x.from ? clamp((x.now - x.from) / (x.target - x.from), 0, 1) : 0;
      // once the clock passes your PB run's next split, you're off PB pace
      if (E.pb && x.nextKey && ref.pb && ref.pb.splits[x.nextKey] != null && x.now != null && x.now > ref.pb.splits[x.nextKey]) E.pb = null;
      x.pb = E.pb && x.on ? E.pb.d : null;
      return x;
    };

    async function poll() {
      clearTimeout(E.timer);
      let next = 1000;
      if (demo) {
        onLive(demo.state());
        next = 250;
      } else {
        try {
          const res = await fetch(o.url, { cache: 'no-store' });
          const d = await res.json();
          if (E.stopped) return;
          onLive(d);
        } catch (e) {
          // helper not running: no live run, try again in a bit
          if (E.data && E.data.live) E.data = Object.assign({}, E.data, { live: false });
          next = 5000;
        }
      }
      if (E.stopped) return;
      if (o.onChange) o.onChange();
      E.timer = setTimeout(poll, next);
    }
    E.start = () => { E.stopped = false; poll(); return E; };
    E.stop = () => { E.stopped = true; clearTimeout(E.timer); };
    return E;
  }

  // The longest the live part gets (six splits in, on PB pace), so a page can size itself for it.
  function sample() {
    const judged = {};
    SPLITS.slice(0, 6).forEach(k => { judged[k] = judge(k, DEMO.run[k], DEMO.ref); });
    return {
      on: true, live: true, judged, ref: DEMO.ref, match: null, recent: judged.end, nextIdx: 6, nextKey: 'finish',
      target: DEMO.ref.splits.finish.median, now: DEMO.run.end, from: DEMO.run.end, late: false, fill: 0, pb: DEMO.run.end - DEMO.ref.pb.splits.end,
    };
  }

  window.MCSRLive = { SPLITS, NAMES, SHORT, VERDICTS, judge, fmt, fmtD, create, sample };
})();
