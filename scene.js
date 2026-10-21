// Pixel-art stand-ins for gameplay, drawn behind the customizer's preview: an overworld hillside,
// the nether and the end, with a Minecraft-style hotbar on top. Everything here is drawn from
// flat colors at 1920×1080; no game textures are used.
(function () {
  'use strict';
  const W = 1920, H = 1080;
  const B = 48, P = 12; // one block, and one of its 4×4 texture pixels
  const COLS = W / B, ROWS = Math.ceil(H / B);

  const rng = seed => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  const pick = (r, a) => a[Math.floor(r() * a.length)];

  const GRASS = ['#5d9c3a', '#548f33', '#67a843', '#4f8730'];
  const DIRT = ['#866043', '#7a573c', '#946a4a', '#6c4c34'];
  const STONE = ['#7f7f7f', '#767676', '#898989', '#6e6e6e'];
  const LOG = ['#6a5131', '#5b452a', '#755a37'];
  const LEAVES = ['#3c7a22', '#34691d', '#468a2a', '#2f601a'];
  const NETHERRACK = ['#6e2b2b', '#5f2323', '#7d3333', '#552020', '#663030'];
  const GLOWSTONE = ['#f7d56c', '#e9b84c', '#fff0a6', '#c99a3a'];
  const LAVA = ['#d4561a', '#e8701f', '#f08a2a', '#c94a17', '#ffa23a'];
  const OBSIDIAN = ['#140f1f', '#1d1530', '#0f0b17', '#241a3a'];
  const PORTAL = ['#5a1fa8', '#7b2fd1', '#9b4cf0', '#6a25bd'];
  const ENDSTONE = ['#dbe0a4', '#d2d699', '#e4e8b4', '#c8cc8b', '#d8dc9f'];

  // A block with a little noise; `top` paints its first rows from another palette (grass on dirt).
  function block(ctx, r, bx, by, pal, top) {
    for (let j = 0; j < 4; j++) for (let i = 0; i < 4; i++) {
      const fromTop = top && j < top.rows && !(j === top.rows - 1 && r() < .5);
      ctx.fillStyle = pick(r, fromTop ? top.pal : pal);
      ctx.fillRect(bx * B + i * P, by * B + j * P, P, P);
    }
  }
  function bands(ctx, colors, y0, y1) {
    const h = (y1 - y0) / colors.length;
    colors.forEach((c, i) => { ctx.fillStyle = c; ctx.fillRect(0, Math.floor(y0 + i * h), W, Math.ceil(h) + 1); });
  }
  // Small bitmaps: one character per pixel, '.' is empty.
  function bitmap(ctx, rows, colors, x, y, px) {
    rows.forEach((row, j) => [...row].forEach((ch, i) => {
      if (ch === '.') return;
      ctx.fillStyle = colors[ch];
      ctx.fillRect(x + i * px, y + j * px, px, px);
    }));
  }

  function overworld(ctx) {
    const r = rng(42);
    bands(ctx, ['#6d9bf1', '#78a3f3', '#83acf5', '#8fb5f7', '#9cbff8', '#a9c8fa', '#b7d2fb', '#c4dbfc'], 0, H * .7);
    ctx.fillStyle = '#c4dbfc';
    ctx.fillRect(0, H * .7, W, H * .3);
    ctx.fillStyle = 'rgba(255,250,214,.35)';
    ctx.fillRect(1452, 84, 168, 168);
    ctx.fillStyle = '#fffbe2';
    ctx.fillRect(1488, 120, 96, 96);
    // flat blocky clouds
    ctx.fillStyle = 'rgba(255,255,255,.92)';
    [[120, 150, 9], [640, 96, 6], [980, 210, 11], [1720, 300, 5]].forEach(([x, y, n]) => {
      for (let i = 0; i < n; i++) {
        const w = 48 + Math.floor(r() * 4) * 24;
        ctx.fillRect(x + i * 40, y + (r() < .5 ? 0 : 24), w, 48);
      }
    });
    // distant hills, faded toward the sky
    for (let x = 0; x < COLS; x++) {
      const h = Math.round(9.6 + 2 * Math.sin(x * .19 + 2) + Math.sin(x * .07));
      for (let y = h; y < ROWS; y++) block(ctx, r, x, y, y === h ? ['#8db99a', '#86b394', '#94bfa0'] : ['#a1c4b0', '#9bbfab', '#a8c9b6']);
    }
    // the hill you're standing on
    const ground = x => Math.round(13.4 + 1.6 * Math.sin(x * .31 + .5) + 1.1 * Math.sin(x * .13 + 1.7));
    for (let x = 0; x < COLS; x++) {
      const h = ground(x);
      for (let y = h; y < ROWS; y++) {
        if (y === h) block(ctx, r, x, y, DIRT, { rows: 2, pal: GRASS });
        else if (y < h + 3) block(ctx, r, x, y, DIRT);
        else block(ctx, r, x, y, STONE);
      }
      // a few ores in the stone
      if (r() < .35) {
        const oy = h + 4 + Math.floor(r() * 4);
        const ore = pick(r, [['#2b2b2b', '#3a3a3a'], ['#d8af93', '#c49a7f'], ['#5decf5', '#3fc7d0']]);
        ctx.fillStyle = ore[0];
        ctx.fillRect(x * B + P, oy * B + P, P, P);
        ctx.fillStyle = ore[1];
        ctx.fillRect(x * B + 2 * P, oy * B + 2 * P, P, P);
      }
    }
    // oak trees
    [4, 15, 29, 36].forEach(x => {
      const h = ground(x);
      for (let y = h - 3; y < h; y++) block(ctx, r, x, y, LOG);
      for (let dy = -6; dy <= -4; dy++) for (let dx = -2; dx <= 2; dx++) {
        if (Math.abs(dx) === 2 && dy === -6 && r() < .6) continue;
        block(ctx, r, x + dx, h + dy, LEAVES);
      }
      for (let dx = -1; dx <= 1; dx++) block(ctx, r, x + dx, h - 7, LEAVES);
    });
  }

  function nether(ctx) {
    const r = rng(7);
    bands(ctx, ['#260907', '#2e0c09', '#370f0b', '#40120d', '#48150f', '#501811'], 0, H);
    // ceiling with glowstone
    for (let x = 0; x < COLS; x++) {
      const d = Math.round(2.4 + 1.4 * Math.sin(x * .5) + r() * 1.3);
      for (let y = 0; y < d; y++) block(ctx, r, x, y, NETHERRACK);
      if (r() < .2) {
        block(ctx, r, x, d, GLOWSTONE);
        if (r() < .5) block(ctx, r, x, d + 1, GLOWSTONE);
      }
    }
    // floor, dipping into a lava lake in the middle
    const LAVA_Y = 19;
    const floor = x => x >= 5 && x <= 8 ? 15 : Math.round(15 + 1.8 * Math.sin(x * .23 + 1) + (x > 15 && x < 30 ? 5.5 : 0) + Math.sin(x * .9) * .6);
    for (let x = 0; x < COLS; x++) {
      const h = floor(x);
      for (let y = Math.min(h, LAVA_Y); y < ROWS; y++) {
        if (y >= h) block(ctx, r, x, y, NETHERRACK);
        else block(ctx, r, x, y, LAVA, y === LAVA_Y ? { rows: 1, pal: ['#ffb347', '#ffc461'] } : null);
      }
    }
    // a lit portal on the ledge, left side
    const g = floor(5);
    for (let x = 5; x <= 8; x++) for (let y = g - 5; y < g; y++) {
      const edge = x === 5 || x === 8 || y === g - 5 || y === g - 1;
      block(ctx, r, x, y, edge ? OBSIDIAN : PORTAL);
    }
  }

  function end(ctx) {
    const r = rng(11);
    ctx.fillStyle = '#120c1b';
    ctx.fillRect(0, 0, W, H);
    for (let i = 0; i < 1100; i++) {
      ctx.fillStyle = pick(r, ['#1c1428', '#211830', '#170f21']);
      ctx.fillRect(Math.floor(r() * (W / P)) * P, Math.floor(r() * (H / P)) * P, P, P);
    }
    // obsidian pillars with crystals, behind the island
    [[6, 6], [12, 9], [25, 5], [33, 8]].forEach(([x, top]) => {
      for (let y = top; y < ROWS; y++) { block(ctx, r, x, y, OBSIDIAN); block(ctx, r, x + 1, y, OBSIDIAN); }
      ctx.fillStyle = '#3a2d4f';
      ctx.fillRect(x * B + 18, (top - 1) * B + 6, 60, 42);
      ctx.fillStyle = '#e27ddd';
      ctx.fillRect(x * B + 30, (top - 2) * B + 6, 36, 42);
      ctx.fillStyle = '#f6c3f2';
      ctx.fillRect(x * B + 38, (top - 2) * B + 14, 20, 20);
    });
    // the main island
    for (let x = 0; x < COLS; x++) {
      const t = Math.sin(Math.PI * Math.max(0, Math.min(1, (x + 2) / (COLS + 3))));
      const top = Math.round(17 - 3.4 * t + Math.sin(x * .7) * .5);
      for (let y = top; y < ROWS; y++) block(ctx, r, x, y, ENDSTONE);
    }
  }

  // Hotbar, hearts, food, XP bar and crosshair, at GUI scale 3.
  function gui(ctx) {
    const G = 3, bw = 182 * G, x0 = (W - bw) / 2, y0 = H - 22 * G;
    ctx.fillStyle = 'rgba(16,16,16,.62)';
    ctx.fillRect(x0, y0, bw, 22 * G);
    ctx.fillStyle = 'rgba(0,0,0,.7)';
    ctx.fillRect(x0, y0, bw, G);
    for (let i = 0; i < 9; i++) {
      const sx = x0 + (2 + i * 20) * G, sy = y0 + 2 * G;
      ctx.fillStyle = 'rgba(139,139,139,.32)';
      ctx.fillRect(sx, sy, 18 * G, 18 * G);
      ctx.fillStyle = 'rgba(0,0,0,.35)';
      ctx.fillRect(sx, sy, 18 * G, G);
      ctx.fillRect(sx, sy, G, 18 * G);
      ctx.fillStyle = 'rgba(255,255,255,.16)';
      ctx.fillRect(sx, sy + 17 * G, 18 * G, G);
      ctx.fillRect(sx + 17 * G, sy, G, 18 * G);
    }
    // selected slot
    const sel = x0 - G;
    ctx.fillStyle = '#000';
    ctx.fillRect(sel, y0 - G, 24 * G, 24 * G);
    ctx.clearRect(sel + 3 * G, y0 + 2 * G, 18 * G, 18 * G);
    ctx.fillStyle = 'rgba(139,139,139,.32)';
    ctx.fillRect(sel + 3 * G, y0 + 2 * G, 18 * G, 18 * G);
    ctx.fillStyle = '#e8e8e8';
    [[0, 0, 24, 1], [0, 23, 24, 1], [0, 0, 1, 24], [23, 0, 1, 24], [1, 1, 22, 1], [1, 22, 22, 1], [1, 1, 1, 22], [22, 1, 1, 22]].forEach(([x, y, w, h]) => {
      ctx.fillRect(sel + x * G, y0 - G + y * G, w * G, h * G);
    });

    // items: ender pearls, gold, obsidian, a bucket
    const slot = i => [x0 + (3 + i * 20) * G, y0 + 3 * G];
    const PEARL = ['..1111..', '.122221.', '12333321', '12344321', '12344321', '12333321', '.122221.', '..1111..'];
    const INGOT = ['........', '........', '...1111.', '..122221', '.1233321', '11111111', '........', '........'];
    const BLOCK = ['11111111', '12131211', '13121312', '11312121', '12121311', '13112131', '12131211', '11111111'];
    const BUCKET = ['........', '.1....1.', '12111121', '12333321', '.123321.', '.123321.', '..1221..', '..1111..'];
    bitmap(ctx, PEARL, { 1: '#0b3b33', 2: '#178069', 3: '#36c2a6', 4: '#0b2a24' }, ...slot(0), 2 * G);
    bitmap(ctx, INGOT, { 1: '#8a5a00', 2: '#f4d03f', 3: '#fff3a8' }, ...slot(1), 2 * G);
    bitmap(ctx, BLOCK, { 1: '#140f1f', 2: '#241a3a', 3: '#3b2a5c' }, ...slot(2), 2 * G);
    bitmap(ctx, BUCKET, { 1: '#3a3a3a', 2: '#d8d8d8', 3: '#9c9c9c' }, ...slot(3), 2 * G);
    // stack counts, in a 3×5 pixel font with a shadow
    const DIG = { 1: ['.1.', '11.', '.1.', '.1.', '111'], 6: ['.11', '1..', '111', '1.1', '111'], 8: ['111', '1.1', '111', '1.1', '111'], 2: ['11.', '..1', '.1.', '1..', '111'] };
    const count = (n, i) => {
      const s = String(n), [sx, sy] = slot(i);
      [...s].forEach((d, k) => {
        const x = sx + (17 - (s.length - k) * 4) * G, y = sy + 11 * G;
        bitmap(ctx, DIG[d], { 1: '#3f3f3f' }, x + G, y + G, G);
        bitmap(ctx, DIG[d], { 1: '#ffffff' }, x, y, G);
      });
    };
    count(16, 0); count(8, 1); count(12, 2);

    // XP bar, a third full
    const xy = y0 - 7 * G;
    ctx.fillStyle = '#000';
    ctx.fillRect(x0, xy, bw, 5 * G);
    ctx.fillStyle = '#2a2a2a';
    ctx.fillRect(x0 + G, xy + G, bw - 2 * G, 3 * G);
    ctx.fillStyle = '#80ff20';
    ctx.fillRect(x0 + G, xy + G, Math.round(bw * .34), 3 * G);

    // hearts on the left, food on the right
    const HEART = ['.00.00.', '0210110', '0111110', '0111130', '.01130.', '..010..', '...0...'];
    const FOOD = ['..000..', '.01110.', '0112110', '0111110', '.01110.', '..0110.', '...00..'];
    for (let i = 0; i < 10; i++) {
      bitmap(ctx, HEART, { 0: '#1a0000', 1: '#e3161b', 2: '#ffb0b0', 3: '#9c0d0d' }, x0 + i * 8 * G, xy - 10 * G, G);
      bitmap(ctx, FOOD, { 0: '#2a1608', 1: '#a5622c', 2: '#e2a368' }, x0 + bw - (i + 1) * 8 * G + G, xy - 10 * G, G);
    }

    // crosshair
    ctx.fillStyle = 'rgba(255,255,255,.85)';
    ctx.fillRect(W / 2 - 5 * G, H / 2 - Math.floor(G / 2), 11 * G, G);
    ctx.fillRect(W / 2 - Math.floor(G / 2), H / 2 - 5 * G, G, 11 * G);
  }

  const SCENES = { overworld, nether, end };
  const cache = {};
  window.MCSRScene = {
    names: Object.keys(SCENES),
    // A PNG data URL of the scene, drawn once and kept.
    url(name, withGui) {
      const key = name + (withGui ? '+gui' : '');
      if (!cache[key] && SCENES[name]) {
        const c = document.createElement('canvas');
        c.width = W;
        c.height = H;
        const ctx = c.getContext('2d');
        SCENES[name](ctx);
        if (withGui) gui(ctx);
        cache[key] = c.toDataURL('image/png');
      }
      return cache[key] || '';
    },
  };
})();
