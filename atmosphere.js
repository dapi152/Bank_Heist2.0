(() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const seg = (v, a, b) => v < a ? a - v : v > b ? v - b : 0;
  const lerp = (a, b, k) => a + (b - a) * k;
  const lk = (d, m) => clamp(1 - d / m, 0, 1);
  const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
  const B = n => buildings.find(b => b.name === n);
  const live = () => scene === 'play' || scene === 'talk';
  const Rc = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  let clock = 0, alarmT = 0, alarmAge = 0, gust = 0, gA = 99, gLen = 4, gustT = rnd(6, 12), gustDir = 1;
  const dK = doorOf(B('KAFE')), dN = doorOf(B('BIOSKOP')), dBank = doorOf(bankB);

  /* ================= SUARA ================= */
  let E = null, foot = 0, tvOn = true, nextCr = 0, tvNext = 4, sirPh = 0;
  const jb = { i: 0 };
  const midi = m => 440 * Math.pow(2, (m - 69) / 12);
  const TV = { x: 192, y: 40 };

  const CAFE_SONGS = [
    { n: 'Kopi Malam', bpm: 88, root: 57, wave: 'triangle', lv: .07,
      lead: [12, null, 15, 17, 19, null, 17, 15, 12, null, 10, 12, 15, null, null, null, 12, null, 17, 19, 22, null, 19, 17, 15, null, 12, 10, 12, null, null, null],
      bass: [0, null, null, null, 7, null, null, null, -2, null, null, null, 5, null, null, null] },
    { n: 'Koplo Santai', bpm: 124, root: 52, wave: 'square', lv: .022, dr: 'D.T.D.DTD.T.D.DT',
      lead: [12, 13, 16, 13, 12, null, 9, null, 8, 9, 12, 9, 8, null, null, null],
      bass: [0, null, 0, 7, 0, null, 7, null] },
    { n: 'Keroncong Senja', bpm: 96, root: 55, wave: 'triangle', lv: .06,
      lead: [12, 16, 19, 16, 12, 16, 19, 16, 10, 14, 17, 14, 10, 14, 17, 14, 7, 11, 14, 11, 7, 11, 14, 11, 12, 16, 19, 16, 12, 16, 19, 12],
      bass: [0, null, 7, null, -2, null, 5, null, -5, null, 2, null, 0, null, 7, null] }
  ];
  const CINE = { n: 'Tema Layar Lebar', bpm: 66, root: 50, wave: 'sawtooth', lv: .02,
    lead: [12, null, null, 15, null, null, 19, null, 17, null, null, 15, null, null, 12, null, 10, null, null, 14, null, null, 17, null, 15, null, null, 14, null, null, 10, null],
    bass: [0, null, null, null, null, null, null, null, -2, null, null, null, null, null, null, null] };

  function noiseBuf(c, brown) {
    const b = c.createBuffer(1, c.sampleRate * 3, c.sampleRate), d = b.getChannelData(0);
    let l = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (brown) { l = (l + .02 * w) / 1.02; d[i] = l * 3.5; } else d[i] = w;
    }
    return b;
  }
  function engine() {
    const c = audioContext;
    if (!c) return null;
    if (E && E.c === c) return E;
    if (!soundEnabled) return null;
    const out = c.createGain(); out.gain.value = 0; out.connect(c.destination);
    E = { c, out, white: noiseBuf(c), brown: noiseBuf(c, true) };
    const layer = (buf, type, f, q, lfo, depth) => {
      const s = c.createBufferSource(); s.buffer = buf; s.loop = true;
      const fl = c.createBiquadFilter(); fl.type = type; fl.frequency.value = f; fl.Q.value = q || .7;
      const am = c.createGain(), g = c.createGain(); g.gain.value = 0;
      s.connect(fl); fl.connect(am); am.connect(g); g.connect(out);
      if (lfo) {
        am.gain.value = 1 - depth;
        const o = c.createOscillator(), d = c.createGain(); o.frequency.value = lfo; d.gain.value = depth;
        o.connect(d); d.connect(am.gain); o.start();
      }
      s.start(); return { g, fl };
    };
    E.wind = layer(E.brown, 'lowpass', 520);
    E.traffic = layer(E.brown, 'lowpass', 240);
    E.babble = layer(E.white, 'bandpass', 850, .9, 3.1, .4);
    E.sizzle = layer(E.white, 'highpass', 4200, .5, 7, .35);
    E.heli = layer(E.white, 'bandpass', 150, 1.1, 12, .85);
    E.hum = layer(E.brown, 'lowpass', 650);
    [[60, 'sine', .5], [120, 'triangle', .18], [180, 'sine', .05]].forEach(([f, t, v]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = t; o.frequency.value = f; g.gain.value = v;
      o.connect(g); g.connect(E.hum.g); o.start();
    });
    E.cr = c.createGain(); E.cr.gain.value = 0; E.cr.connect(out);
    const so = c.createOscillator(), sf = c.createBiquadFilter(), sg = c.createGain();
    so.type = 'sawtooth'; so.frequency.value = 700; sf.type = 'lowpass'; sf.frequency.value = 1100; sg.gain.value = 0;
    so.connect(sf); sf.connect(sg); sg.connect(out); so.start();
    E.sir = { o: so, g: sg };
    const bus = () => {
      const g = c.createGain(), fl = c.createBiquadFilter(), p = c.createStereoPanner ? c.createStereoPanner() : null;
      fl.type = 'lowpass'; fl.frequency.value = 3000; g.gain.value = 0; g.connect(fl);
      if (p) { fl.connect(p); p.connect(out); } else fl.connect(out);
      return { g, fl, p, band: null, song: null };
    };
    E.cafe = bus(); E.cine = bus(); E.tv = bus();
    return E;
  }
  const env = (g, t, a, len, v) => {
    g.gain.setValueAtTime(.0001, t); g.gain.exponentialRampToValueAtTime(v, t + a);
    g.gain.exponentialRampToValueAtTime(.0001, t + len);
  };
  function tone(dest, f, t, len, type, v, f2) {
    const c = E.c, o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + len);
    env(g, t, .004, len, v); o.connect(g); g.connect(dest); o.start(t); o.stop(t + len + .03);
  }
  function puff(dest, t, len, type, f, q, v, f2) {
    const c = E.c, s = c.createBufferSource(), fl = c.createBiquadFilter(), g = c.createGain();
    s.buffer = E.white; fl.type = type; fl.frequency.setValueAtTime(f, t); fl.Q.value = q;
    if (f2) fl.frequency.exponentialRampToValueAtTime(f2, t + len);
    env(g, t, .006, len, v); s.connect(fl); fl.connect(g); g.connect(dest); s.start(t, Math.random() * 1.5, len + .05);
  }
  const SF = {
    teng: (d, t) => { tone(d, 1900, t, .16, 'square', .05); tone(d, 2650, t, .1, 'triangle', .04); },
    tok: (d, t) => tone(d, 720, t, .08, 'sine', .22, 380),
    ting: (d, t) => { tone(d, 2300, t, .35, 'sine', .08); tone(d, 3450, t, .2, 'sine', .04); },
    swish: (d, t) => puff(d, t, .22, 'bandpass', 1500, 1, .16, 2600),
    sret: (d, t) => puff(d, t, .18, 'bandpass', 2400, 1.2, .09, 1500),
    horn: (d, t) => { tone(d, 410, t, .28, 'square', .03); tone(d, 520, t, .28, 'square', .03); },
    klik: (d, t) => tone(d, 3200, t, .04, 'sine', .08, 2400),
    squeak: (d, t) => tone(d, 6200, t, .09, 'sine', .04, 8600),
    bump: (d, t) => { tone(d, 150, t, .12, 'sine', .3, 70); puff(d, t, .05, 'lowpass', 600, 1, .1); },
    kenton: (d, t) => tone(d, 340, t, .16, 'triangle', .25, 250),
    rattle: (d, t) => { puff(d, t, .9, 'bandpass', 500, 2, .22, 1400); puff(d, t + .86, .12, 'highpass', 2000, 1, .15); tone(d, 90, t + .9, .15, 'square', .06); }
  };
  function spat(x, y, max) {
    if (!E || where !== 'city') return null;
    const f = feet(), l = Math.pow(lk(dist(x, y, f.x, f.y), max), 2);
    if (l < .02) return null;
    const g = E.c.createGain(); g.gain.value = l;
    if (E.c.createStereoPanner) {
      const p = E.c.createStereoPanner(); p.pan.value = clamp((x - f.x) / 140, -1, 1);
      g.connect(p); p.connect(E.out);
    } else g.connect(E.out);
    return g;
  }
  function seq(name, x, y, max, offs) {
    const d = spat(x, y, max);
    if (d) offs.forEach(o => SF[name](d, E.c.currentTime + .01 + o));
  }
  const sound = (name, x, y, max) => seq(name, x, y, max || 260, [0]);

  function stepSound() {
    if (!E) return false;
    const c = E.c, t = c.currentTime + .005, d = c.createGain();
    foot ^= 1;
    const k = foot ? 1 : .93;
    let s = 'floor';
    if (where === 'city') { const f = feet(); s = ground(Math.floor(f.x / T), Math.floor(f.y / T)); }
    else if (where === 'bank') s = 'marble';
    d.gain.value = crouching() ? .45 : 1; d.connect(E.out);
    if (s === 'r') { tone(d, 98 * k, t, .09, 'sine', .22, 55); puff(d, t, .07, 'lowpass', 1000, .7, .09); }
    else if (s === 's') { puff(d, t, .05, 'bandpass', 2200 * k, 1.3, .13); tone(d, 190 * k, t, .04, 'sine', .08); }
    else if (s === 'g') { puff(d, t, .13, 'lowpass', 1300 * k, .6, .09); puff(d, t + .03, .09, 'bandpass', 4200, 1, .035); }
    else if (s === 'marble') {
      puff(d, t, .025, 'highpass', 3200, .8, .12); tone(d, 1850 * k, t, .07, 'sine', .07);
      tone(d, 1500 * k, t + .085, .09, 'sine', .035); puff(d, t + .085, .02, 'highpass', 3000, .8, .04);
    } else { tone(d, 135 * k, t, .06, 'sine', .18, 90); puff(d, t, .035, 'bandpass', 1600, 1, .07); }
    return true;
  }

  function band(bus, song) {
    const o = { alive: true, i: 0, timer: 0 }, ms = 60000 / song.bpm / 2;
    const run = () => {
      if (!o.alive || !E) return;
      const t = E.c.currentTime + .03, s = o.i++;
      const l = song.lead[s % song.lead.length], b = song.bass[s % song.bass.length], dr = song.dr ? song.dr[s % song.dr.length] : '.';
      if (l != null) tone(bus.g, midi(song.root + 12 + l), t, ms / 1000 * 1.6, song.wave, song.lv);
      if (b != null) tone(bus.g, midi(song.root + b), t, ms / 1000 * 1.9, 'triangle', .08);
      if (dr === 'D') tone(bus.g, 150, t, .13, 'sine', .14, 60);
      else if (dr === 'T') puff(bus.g, t, .05, 'bandpass', 2600, 1.2, .07);
      o.timer = setTimeout(run, ms);
    };
    run(); return o;
  }
  function setBand(bus, song) {
    if (bus.song === song) return;
    if (bus.band) { bus.band.alive = false; clearTimeout(bus.band.timer); }
    bus.band = song ? band(bus, song) : null; bus.song = song;
  }
  function nextSong() {
    jb.i = jb.i + 1 >= CAFE_SONGS.length ? -1 : jb.i + 1;
    toast(jb.i < 0 ? 'Jukebox dimatikan' : '♪ ' + CAFE_SONGS[jb.i].n);
    playSound('door');
  }

  const INDOOR = {
    bank: { hu: .55 }, cafe: { bb: .22, cv: .75, hu: .05 }, shop: { hu: .18 }, office: { hu: .25, bb: .04 },
    r_BIOSKOP: { nv: .6, hu: .1, bb: .03 }, r_PASAR: { bb: .32, hu: .05 }, r_HOTEL: { bb: .1, hu: .1 },
    r_BUKU: { hu: .1 }, r_APOTEK: { hu: .2 }, home: { hu: .06 }
  };
  function mix() {
    const e = engine();
    if (!e) return;
    const c = e.c, tt = c.currentTime, to = (g, v, k) => g.gain.setTargetAtTime(v, tt, k || .4);
    const on = ['play', 'talk', 'cipher', 'caught', 'crashed', 'heistchoice', 'storychoice', 'skinshop'].includes(scene);
    to(e.out, !soundEnabled ? 0 : on ? 1 : scene === 'pause' ? .3 : 0, .25);
    const f = feet();
    let tr = 0, wi = 0, cr = 0, hu = 0, bb = 0, sz = 0, cv = 0, nv = 0, tv = 0, hl = 0, sr = 0, cMuf = 3000, nMuf = 3000, cPan = 0, nPan = 0;
    if (where === 'city') {
      const rd = Math.min(...roadRows.map(([a, b]) => seg(f.y, a * T, (b + 1) * T)), ...roadCols.map(([a, b]) => seg(f.x, a * T, (b + 1) * T)));
      const near = lk(rd, 150), cars = trafficCars.reduce((s, k) => s + lk(dist(k.x, k.y, f.x, f.y), 120), 0);
      tr = (.08 + .45 * near + .1 * cars) * .6; wi = .08 + gust * .3;
      let gs = 0;
      for (let a = 0; a < 8; a++) gs += ground(Math.floor((f.x + Math.cos(a * .785) * 40) / T), Math.floor((f.y + Math.sin(a * .785) * 40) / T)) === 'g' ? 1 : 0;
      cr = alarmT > 0 ? 0 : gs / 8 * (1 - near) * .5;
      const kd = dist(dK.x, dK.y, f.x, f.y), nd = dist(dN.x, dN.y, f.x, f.y);
      cv = jb.i >= 0 ? Math.pow(lk(kd, 190), 1.6) * .5 : 0; cMuf = 350 + 3800 * lk(kd, 190); cPan = clamp((dK.x - f.x) / 150, -1, 1);
      nv = Math.pow(lk(nd, 190), 1.6) * .45; nMuf = 350 + 3200 * lk(nd, 190); nPan = clamp((dN.x - f.x) / 150, -1, 1);
      sz = Math.max(0, ...vendors.filter(v => v.sizzle).map(v => lk(dist(v.x, v.y, f.x, f.y), 120))) * .3;
      if (alarmT > 0) {
        hl = (heli.on ? lk(dist(heli.x, heli.y, f.x, f.y), 300) : 0) * .55;
        sr = lk(dist(dBank.x, dBank.y, f.x, f.y), 560) * .1 * Math.min(1, alarmT / 6);
      }
    } else {
      const r = INDOOR[where] || {};
      hu = r.hu || 0; bb = r.bb || 0; cv = r.cv || 0; nv = r.nv || 0; wi = .03; tr = .02;
      if (where === 'cafe') { cMuf = 7000; if (jb.i < 0) cv = 0; }
      if (where.startsWith('r_')) nMuf = 6000;
      if (where === 'home' && tvOn) tv = .25 + .6 * lk(dist(TV.x, TV.y, f.x, f.y), 260);
    }
    bb += tv * .45;
    to(e.traffic.g, tr); to(e.wind.g, wi); to(e.hum.g, hu); to(e.babble.g, bb); to(e.sizzle.g, sz); to(e.heli.g, hl); to(e.sir.g, sr, .3); to(e.cr, cr);
    to(e.cafe.g, cv); to(e.cine.g, nv); to(e.tv.g, tv);
    e.cafe.fl.frequency.setTargetAtTime(cMuf, tt, .3); e.cine.fl.frequency.setTargetAtTime(nMuf, tt, .3);
    if (e.cafe.p) { e.cafe.p.pan.setTargetAtTime(cPan, tt, .3); e.cine.p.pan.setTargetAtTime(nPan, tt, .3); }
    setBand(e.cafe, cv > .012 && jb.i >= 0 ? CAFE_SONGS[jb.i] : null);
    setBand(e.cine, nv > .012 ? CINE : null);
    sirPh += .016; e.sir.o.frequency.setTargetAtTime(640 + 260 * Math.abs(Math.sin(sirPh * 1.3)), tt, .05);
    e.traffic.fl.frequency.setTargetAtTime(where === 'city' ? 480 : 260, tt, .5);
    if (cr > .03 && tt > nextCr) {
      const f0 = pick([4300, 4650]);
      for (let i = 0; i < 3; i++) tone(e.cr, f0, tt + .01 + i * .045, .03, 'sine', .35);
      nextCr = tt + rnd(.25, .7);
    }
    if (tv > .05 && tt > tvNext) {
      [0, 4, 7, 12].forEach((s, i) => tone(e.tv.g, midi(72 + s), tt + .02 + i * .13, .25, 'square', .05));
      tvNext = tt + rnd(14, 24);
    }
    const mg = musicNodes[0];
    if (mg && mg.gain) mg.gain.setTargetAtTime(where === 'city' ? (alarmT > 0 ? 1 : .55) : where === 'bank' ? .85 : .12, tt, .6);
  }

  /* ================= DUNIA ================= */
  const sprites = [], vendors = [], shutters = [], wins = [], bats = [], bits = [], pax = [];
  const heli = { on: false, init: false, x: 0, y: 0, sx: 0, sy: 0, th: 0 };
  const lamps = props.filter(p => p.k === 'lamp');
  const free = (x, y) => x > 0 && y > 0 && x < city.w - 1 && y < city.h - 1 && !city.solid[y * city.w + x] && !props.some(p => p.x === x && p.y === y);
  function snap(tx, ty, want, w = 1) {
    for (let r = 0; r < 9; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      let ok = true;
      for (let i = 0; i < w; i++) if (!free(x + i, y) || ground(x + i, y) !== want) ok = false;
      if (ok) return [x, y];
    }
    return [tx, ty];
  }
  const add = (show, depth, draw) => { const s = { show, depth, draw }; sprites.push(s); return s; };
  const calm = () => alarmT <= 0;

  /* --- pedagang malam --- */
  function drawVendor(v) {
    const now = performance.now(), x = Math.round(v.x), y = Math.round(v.y);
    Rc('rgba(0,0,0,.3)', x - 10, y - 2, 22, 3);
    chibi(x - 6, y - 31, v.look, 'down', Math.floor(now / (v.k === 'nasi' ? 120 : 400)) % 2);
    if (v.k === 'sate') { const a = Math.round(Math.sin(now / 90) * 2); Rc('#d8c27a', x + 5, y - 20 + a, 6, 4); Rc('#8a6a3a', x + 4, y - 18 + a, 2, 1); }
    Rc(OUT, x - 10, y - 15, 20, 12); Rc('#8a5a34', x - 9, y - 14, 18, 10); Rc(v.col, x - 9, y - 14, 18, 3); Rc('#5d3d22', x - 9, y - 8, 18, 1);
    Rc('#1a1d24', x - 8, y - 4, 4, 4); Rc('#1a1d24', x + 5, y - 4, 4, 4); Rc('#6b727c', x - 7, y - 3, 2, 2); Rc('#6b727c', x + 6, y - 3, 2, 2);
    if (v.k === 'bakso') { Rc('#9aa3a8', x - 6, y - 19, 8, 5); Rc('#6b747a', x - 6, y - 16, 8, 1); }
    Rc(OUT, x - 11, y - 38, 22, 7);
    for (let i = 0; i < 5; i++) Rc(i % 2 ? '#f2ead0' : v.col, x - 10 + i * 4, y - 37, 4, 5);
    Rc('#5d3d22', x - 10, y - 32, 1, 17); Rc('#5d3d22', x + 9, y - 32, 1, 17);
    Rc('#ffd27a', x + 10, y - 24, 2, 3);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(x + 11, y - 22, 1, x + 11, y - 22, 20);
    g.addColorStop(0, 'rgba(255,190,90,.35)'); g.addColorStop(1, 'rgba(255,190,90,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 10, y - 42, 42, 42);
    ctx.globalCompositeOperation = 'source-over';
    v.p.forEach(p => { ctx.globalAlpha = Math.max(0, p.l / p.m) * p.a; Rc(p.c, Math.round(p.x), Math.round(p.y), p.s, p.s); });
    ctx.globalAlpha = 1;
    words(v.label, x, y - 41, '#f4e5ba', 'bold 5px monospace', 'center');
  }
  [['nasi', 22, 9, '#d9423a', 'NASI GORENG', { hair: '#222', skin, top: '#f2eee6', bot: '#3a3a4a', x: 'cap' }],
   ['sate', 42, 9, '#4b8a5a', 'SATE AYAM', { hair: '#333', skin, top: '#e8d9a0', bot: '#4a3a2a' }],
   ['bakso', 26, 27, '#e0b84a', 'BAKSO', { hair: '#222', skin, top: '#c0553f', bot: '#2a3a5a', x: 'cap' }]
  ].forEach(([k, tx, ty, col, label, look]) => {
    const [x, y] = snap(tx, ty, 's'); city.solid[y * city.w + x] = 1;
    const v = { k, x: x * T + 8, y: y * T + 15, col, label, look, p: [], snd: rnd(1, 4), sizzle: k !== 'bakso' };
    vendors.push(v); add(() => inView(v.x, v.y, 50), () => v.y, () => drawVendor(v));
  });

  /* --- bapak merokok di pos ronda --- */
  const [rx, ry] = snap(30, 29, 'g', 2); city.solid[ry * city.w + rx] = 1; city.solid[ry * city.w + rx + 1] = 1;
  const ronda = { x: rx * T, y: (ry + 1) * T, p: [], snd: rnd(8, 20), titir: 0 };
  add(() => inView(ronda.x, ronda.y, 50), () => ronda.y, () => {
    const x = ronda.x, y = ronda.y, now = performance.now();
    Rc('rgba(0,0,0,.28)', x + 1, y - 2, 33, 3);
    Rc(OUT, x, y - 8, 32, 8); Rc('#6a4a2a', x + 1, y - 7, 30, 5);
    Rc('#5d3d22', x + 1, y - 26, 2, 18); Rc('#5d3d22', x + 29, y - 26, 2, 18);
    chibi(x + 7, y - 22, { hair: '#222', skin, top: '#6a7a52', bot: '#2a3a5a', x: 'cap' }, 'down', 0);
    Rc('#7a5a3a', x, y - 9, 32, 5); Rc('#4a3220', x, y - 5, 32, 1);
    Rc('#f2eee6', x + 22, y - 13, 3, 4);
    Rc('#f4f0e0', x + 12, y - 14, 3, 1); Rc(Math.sin(now / 400) > 0 ? '#ff7a33' : '#c85a20', x + 15, y - 14, 1, 1);
    Rc(OUT, x - 4, y - 36, 40, 10); Rc('#a8523f', x - 3, y - 35, 38, 8); Rc('#7a3a2a', x - 3, y - 32, 38, 1); Rc('#7a3a2a', x - 3, y - 29, 38, 1);
    Rc('#5a3a1a', x + 26, y - 25, 3, 12); Rc('#2a1a0e', x + 27, y - 22, 1, 6);
    Rc('#ffd27a', x + 15, y - 25, 2, 2);
    ronda.p.forEach(p => { ctx.globalAlpha = Math.max(0, p.l / p.m) * .4; Rc('#cfd2c8', Math.round(p.x), Math.round(p.y), 2, 2); });
    ctx.globalAlpha = 1;
    if (!calm()) words('!', x + 12, y - 28, '#ee6a74', 'bold 9px monospace', 'center');
  });

  /* --- anak main kelereng --- */
  const [kx, ky] = snap(23, 29, 'g'), kid = { x: kx * T + 8, y: ky * T + 11, off: rnd(0, 5), fl: false, cyc: 0 };
  add(() => calm() && inView(kid.x, kid.y, 30), () => kid.y + 3, () => {
    const ph = (clock + kid.off) % 6, shot = ph > 4.6 && ph < 4.95 ? (ph - 4.6) / .35 : 0, hit = ph > 4.95 ? 3 : 0;
    const k = (x, shirt, hair) => {
      Rc('rgba(0,0,0,.25)', x - 4, kid.y + 1, 9, 2);
      Rc(OUT, x - 4, kid.y - 11, 8, 7); Rc(skin, x - 3, kid.y - 10, 6, 5); Rc(hair, x - 3, kid.y - 10, 6, 2);
      Rc(OUT, x - 4, kid.y - 5, 8, 6); Rc(shirt, x - 3, kid.y - 4, 6, 4); Rc('#2a3a5a', x - 3, kid.y, 6, 2);
    };
    k(kid.x - 12, '#e8c040', '#222'); k(kid.x + 12, '#4a8fc9', '#5a3a2a');
    Rc(skin, kid.x - 9, kid.y - 2, 4, 1);
    ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 1; ctx.strokeRect(kid.x - 5.5, kid.y - 1.5, 11, 6);
    Rc('#e0343a', kid.x - 1 + hit, kid.y + 1, 2, 2); Rc('#5fd8c0', kid.x + 2, kid.y + 2, 2, 2); Rc('#f0c24b', kid.x - 3, kid.y + 2, 2, 2);
    Rc('#ffffff', Math.round(kid.x - 8 + shot * 7), kid.y + 1, 2, 2);
    if (ph > 5 && kid.cyc % 3 === 0) words('Kena!', kid.x - 12, kid.y - 15, '#f0c24b', 'bold 6px monospace', 'center');
  });

  /* --- ibu menyapu depan toko --- */
  const dS = doorOf(shopB), sweep = { x: dS.x - 30, y: dS.y + 8, d: 1, last: 0 };
  add(() => calm() && inView(sweep.x, sweep.y, 30), () => sweep.y, () => {
    const sx = Math.sin(clock * 3), x = Math.round(sweep.x + sx * 8);
    chibi(x - 6, sweep.y - 16, { hair: '#4a2a2a', skin, top: '#c0508a', bot: '#5a3a2a' }, sx > 0 ? 'right' : 'left', Math.floor(clock * 6) % 2);
    const bx = x + (Math.cos(clock * 3) > 0 ? 6 : -7);
    Rc('#8a6a3a', bx, sweep.y - 12, 1, 12); Rc('#c8a050', bx - 2, sweep.y - 2, 5, 3);
    if (Math.abs(Math.cos(clock * 3)) > .85) { ctx.globalAlpha = .5; Rc('#bdb8a0', bx - 4 + Math.round(Math.random() * 8), sweep.y - 3, 2, 1); ctx.globalAlpha = 1; }
  });

  /* --- orang main HP sambil jalan (sering nabrak tiang) --- */
  const walker = { x: 6 * T, y: 13 * T + 13, d: 1, st: 'walk', t: 0, cool: 0 };
  const poles = lamps.filter(p => p.y === 13 && p.x < 20).map(p => p.x * T + 8);
  add(() => inView(walker.x, walker.y, 30), () => walker.y, () => {
    const x = Math.round(walker.x), dir = walker.d > 0 ? 'right' : 'left';
    chibi(x - 6, walker.y - 16, { hair: '#222', skin, top: '#3aa0a0', bot: '#2a3a5a' }, dir, walker.st === 'walk' && calm() ? Math.floor(clock * 5) % 2 : 0);
    const px = x + (walker.d > 0 ? 3 : -4);
    Rc('#cfe8ff', px, walker.y - 9, 2, 3);
    ctx.globalCompositeOperation = 'lighter';
    const g = ctx.createRadialGradient(px + 1, walker.y - 9, 0, px + 1, walker.y - 9, 9);
    g.addColorStop(0, 'rgba(120,190,255,.4)'); g.addColorStop(1, 'rgba(120,190,255,0)');
    ctx.fillStyle = g; ctx.fillRect(px - 9, walker.y - 18, 20, 20);
    ctx.globalCompositeOperation = 'source-over';
    if (walker.st === 'bump') { words('BUK!', x, walker.y - 24, '#f0c24b', 'bold 7px monospace', 'center'); words('*', x - 6 + Math.round(Math.sin(clock * 14) * 5), walker.y - 19, '#f0c24b', 'bold 8px monospace', 'center'); }
    else if (walker.st === 'wait') words('Aduh...', x, walker.y - 24, '#e8edf2', 'bold 6px monospace', 'center');
    else if (!calm()) words('!', x, walker.y - 22, '#ee6a74', 'bold 9px monospace', 'center');
  });

  /* --- kendaraan: ojol, angkot, becak --- */
  function addVeh(o) {
    const lane = (o.axis === 'h' ? roadRows : roadCols)[o.row][0] * T + o.lane;
    let x = o.at;
    for (let i = 0; i < 40; i++) {
      if (!trafficCars.some(c => c.axis === 'h' && c.y === lane && Math.abs(c.x - x) < 90)) break;
      x = (x + 83) % (city.w * T);
    }
    const car = Object.assign({ axis: 'h', x, y: lane, dir: o.dir, speed: o.speed, base: o.speed, px: x, cool: 0, pause: 0, seed: Math.random() }, o);
    trafficCars.push(car); return car;
  }
  [{ row: 0, lane: 14, dir: 1, at: 110, speed: 46, kind: 'ojol', color: '#2fa84f' },
   { row: 0, lane: 36, dir: -1, at: 420, speed: 44, kind: 'ojol', color: '#2fa84f' },
   { row: 1, lane: 36, dir: -1, at: 600, speed: 47, kind: 'ojol', color: '#2fa84f' },
   { row: 1, lane: 14, dir: 1, at: 250, speed: 45, kind: 'ojol', color: '#2fa84f' },
   { row: 0, lane: 14, dir: 1, at: 200, speed: 33, kind: 'angkot', color: '#e8a21c', stops: [416, 704] },
   { row: 1, lane: 36, dir: -1, at: 700, speed: 33, kind: 'angkot', color: '#2f8f5a', stops: [480, 128] }
  ].forEach(o => addVeh(Object.assign(o, { axis: 'h' })));

  const baseCar = drawTrafficCar;
  drawTrafficCar = function (car) {
    if (!car.kind) return baseCar(car);
    ctx.save(); ctx.translate(Math.round(car.x), Math.round(car.y));
    if (car.dir < 0) ctx.scale(-1, 1);
    Rc('rgba(0,0,0,.3)', -16, 3, 34, 4);
    if (car.kind === 'ojol') {
      const w = Math.floor(performance.now() / 70) % 2;
      Rc('#14171e', -10, 0, 6, 6); Rc('#14171e', 6, 0, 6, 6); Rc('#6b727c', -8 + w, 2, 2, 2); Rc('#6b727c', 8 + w, 2, 2, 2);
      Rc(OUT, -7, -4, 15, 6); Rc('#2a2f3a', -6, -3, 13, 4); Rc('#3a2f2a', -5, -5, 7, 2);
      Rc('#fff6c0', 11, -3, 2, 2); Rc('#e0343a', -8, -3, 1, 2);
      const jac = car.seed > .5 ? '#e87aa6' : '#2fa84f';
      Rc(OUT, -5, -13, 8, 9); Rc('#2fa84f', -4, -12, 6, 7);
      Rc(OUT, -4, -19, 8, 7); Rc('#2fa84f', -3, -18, 6, 5); Rc('#10301a', 1, -16, 3, 2);
      Rc('#2fa84f', 0, -9, 6, 2);
      if (car.seed > .5) { Rc(OUT, -10, -17, 7, 6); Rc(jac, -9, -16, 5, 4); Rc('#3a2a24', -9, -12, 5, 3); }
      else { Rc(OUT, -11, -16, 8, 8); Rc('#2fa84f', -10, -15, 6, 6); Rc('#fff', -8, -13, 2, 2); }
      ctx.globalCompositeOperation = 'lighter'; ctx.fillStyle = 'rgba(255,240,170,.13)';
      ctx.beginPath(); ctx.moveTo(13, -2); ctx.lineTo(48, -10); ctx.lineTo(48, 8); ctx.closePath(); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    } else {
      Rc('#14171e', -14, 5, 7, 6); Rc('#14171e', 8, 5, 7, 6);
      Rc(OUT, -19, -12, 39, 18); Rc(car.color, -18, -11, 37, 16); Rc('#f2ead0', -18, -2, 37, 2);
      Rc('#26394e', -16, -9, 26, 6);
      for (let i = 0; i < 4; i++) { Rc(car.pause > 0 || car.seed > .4 ? '#e8d7a0' : '#26394e', -15 + i * 6, -9, 5, 6); if ((car.seed * 10 + i) % 3 < 1.7) Rc('#6a4a3a', -14 + i * 6, -8, 3, 3); }
      Rc('#26394e', 11, -9, 7, 6); Rc('#fff0b7', 18, -4, 2, 3); Rc('#8b3d42', -19, -4, 1, 3);
      if (car.pause > 0) { Rc('#ff3a3a', -19, -6, 1, 4); Rc('#14100a', -5, -1, 10, 6); }
      Rc(OUT, -4, -15, 12, 4); Rc('#f4f0e0', -3, -14, 10, 2);
    }
    ctx.restore();
  };
  function spawnPax(car) {
    const top = car.dir > 0;
    for (let i = 0; i < 2; i++) pax.push({
      x: car.x + i * 7 - 4, y: car.y + (top ? -14 : 14), ty: top ? 9 * T + 12 : 13 * T + 6, t: 0, d: Math.random() < .5 ? 1 : -1,
      look: { hair: pick(['#222', '#4a2a2a', '#8a4b3a']), skin, top: pick(['#c0553f', '#4a8fc9', '#e0b84a', '#7a5aa8']), bot: '#2a3a5a' }
    });
  }
  add(() => pax.length > 0, () => pax.reduce((m, p) => Math.max(m, p.y), 0), () => pax.forEach(p => {
    ctx.globalAlpha = clamp((9 - p.t) / 2, 0, 1);
    chibi(Math.round(p.x) - 6, Math.round(p.y) - 16, p.look, Math.abs(p.y - p.ty) > 1 ? (p.ty < p.y ? 'up' : 'down') : p.d > 0 ? 'right' : 'left', Math.floor(p.t * 6) % 2);
  }));

  const becak = { x: 4 * T, y: 27 * T + 14, d: 1, rider: Math.random() < .5 };
  add(() => inView(becak.x, becak.y, 40), () => becak.y, () => {
    const now = performance.now(), sp = Math.floor(now / 160) % 2;
    ctx.save(); ctx.translate(Math.round(becak.x), Math.round(becak.y)); if (becak.d < 0) ctx.scale(-1, 1);
    Rc('rgba(0,0,0,.3)', -18, 0, 38, 3);
    Rc('#14171e', 11, -9, 9, 9); Rc('#14171e', -17, -9, 9, 9); Rc('#6b727c', 14 + sp, -6, 2, 3); Rc('#6b727c', -14 + sp, -6, 2, 3);
    Rc(OUT, -8, -13, 20, 8); Rc('#d9423a', -7, -12, 18, 6); Rc('#8a2a2a', -7, -8, 18, 2);
    Rc(OUT, -9, -20, 24, 7); Rc('#f0c24b', -8, -19, 22, 5); Rc('#c0553f', -8, -17, 22, 1);
    if (becak.rider) { Rc('#f0e2c0', 2, -16, 4, 3); Rc(skin, 3, -15, 2, 2); Rc('#c0508a', 1, -13, 6, 4); }
    Rc('#8a6a3a', -9, -9, 2, 4);
    Rc(OUT, -14, -22, 7, 6); Rc(skin, -13, -21, 5, 4); Rc('#6a7a52', -13, -22, 5, 2);
    Rc('#3a5a8a', -14, -16, 6, 6); Rc('#2a3a5a', -13 + sp * 2, -10, 3, 4);
    Rc('#ffd27a', 14, -19, 2, 2);
    ctx.restore();
  });

  /* --- jendela yang hidup --- */
  const mkWin = (x, y, h) => ({ x, y, w: 8, h, lit: Math.random() < .5, next: rnd(2, 40), sh: 0, col: pick(['#f4d27a', '#f0e2a0', '#f4d27a', '#8fd0ff']), pk: Math.random() < .55, pkAt: rnd(1, 8) });
  ['HOTEL', 'KANTOR', 'APOTEK'].forEach(n => {
    const b = B(n), fy = (b.y + b.h) * T - 48;
    for (let wy = b.y * T + 22; wy + 10 < fy - 6; wy += 16) for (let wx = b.x * T + 10; wx + 8 < (b.x + b.w) * T - 8; wx += 14) wins.push(mkWin(wx, wy, 10));
  });
  ['RUMAH', 'KAFE', 'BUKU', 'TOKO'].forEach(n => {
    const b = B(n), wy = b.y * T + (n === 'BUKU' ? 6 : 4);
    for (let wx = b.x * T + 10; wx + 8 < (b.x + b.w) * T - (n === 'RUMAH' ? 22 : 8); wx += 18) wins.push(mkWin(wx, wy, 8));
  });
  function drawWin(w, now) {
    if (!inView(w.x, w.y, 12)) return;
    const peek = !calm() && w.pk && alarmAge > w.pkAt, lit = w.lit || peek;
    Rc(OUT, w.x - 1, w.y - 1, w.w + 2, w.h + 2); Rc(lit ? w.col : '#1b2b3d', w.x, w.y, w.w, w.h);
    if (!lit) { Rc('rgba(255,255,255,.12)', w.x + w.w - 3, w.y, 2, w.h); return; }
    Rc('rgba(0,0,0,.28)', w.x + w.w / 2 | 0, w.y, 1, w.h); Rc('rgba(160,60,50,.55)', w.x, w.y, 2, w.h); Rc('rgba(160,60,50,.55)', w.x + w.w - 2, w.y, 2, w.h);
    if (peek) {
      const bob = Math.sin(now / 300 + w.x) > 0 ? 0 : 1;
      Rc('#2a1d1a', w.x + 3, w.y + 1 + bob, 2, 2); Rc('#2a1d1a', w.x + 2, w.y + 3 + bob, 4, w.h - 3 - bob); Rc(skin, w.x + 6, w.y + 4, 1, 1);
    } else if (w.sh > 0) {
      const px = w.x + 1 + (1 - w.sh / 2.4) * (w.w - 4);
      Rc('#2a1d1a', px + 1, w.y + 2, 2, 2); Rc('#2a1d1a', px, w.y + 4, 4, w.h - 4);
    }
    ctx.globalCompositeOperation = 'lighter'; Rc('rgba(255,190,90,.07)', w.x - 3, w.y - 3, w.w + 6, w.h + 6); ctx.globalCompositeOperation = 'source-over';
  }

  /* --- rolling door toko --- */
  ['TOKO', 'KAFE', 'PASAR', 'BUKU', 'BIOSKOP'].forEach(n => {
    const b = B(n), s = { b, x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T, p: 0, delay: 0 };
    shutters.push(s);
    add(() => s.p > .01 && inView(s.x, s.y, 40), () => s.y, () => {
      const x0 = Math.round(s.x) - 15, top = s.y - 36, h = Math.round(36 * s.p);
      Rc('#4b525a', x0 - 2, top - 3, 34, 3); Rc('#7e868e', x0, top, 30, h);
      for (let y = top + 2; y < top + h; y += 3) Rc('#5d656d', x0, y, 30, 1);
      Rc('#4b525a', x0 - 1, top + h - 2, 32, 3); if (h > 8) Rc('#e0b84a', x0 + 13, top + h - 5, 4, 2);
    });
  });
  const shutterOf = n => shutters.find(s => s.b.name === n);
  const closedDoor = n => { const s = shutterOf(n); return !!s && s.p > .6; };

  /* --- alarm: reaksi kota --- */
  let ticker = '';
  function raiseAlarm() {
    if (alarmT <= 0) {
      alarmAge = 0;
      shutters.forEach(s => { s.delay = rnd(.4, 6); });
      wins.forEach(w => { w.pk = Math.random() < .6; w.pkAt = rnd(1, 8); });
      ronda.titir = 1.5;
      ticker = ['PERAMPOKAN DI BANK PIXEL CITY, PELAKU BERTOPENG MASIH BURON',
        hasLoot ? 'BRANKAS DIKURAS, KERUGIAN ' + rp(REWARD).toUpperCase() : 'ALARM BANK BERBUNYI, PETUGAS SIAGA',
        'POLISI IMBAU WARGA TETAP DI DALAM RUMAH',
        'ALARM KOTA SUDAH ' + (alarmCount + 1) + ' KALI BERBUNYI MALAM INI',
        'PASAR, KAFE, DAN TOKO TUTUP LEBIH AWAL',
        'SAKSI: "CUMA LIHAT BAYANGAN LEWAT" - PAK JOKO',
        'HELIKOPTER POLISI MENYISIR JALAN UTAMA',
        'CUACA MALAM: CERAH BERANGIN, JANGKRIK MENDADAK DIAM'].join('   ///   ') + '   ///   ';
    }
    alarmT = Math.max(alarmT, hasLoot || wanted >= 3 ? 80 : 50);
  }

  /* --- ngengat, kelelawar, helikopter --- */
  function drawMoths(now) {
    lamps.forEach(p => {
      const lx = p.x * T + 8, ly = p.y * T - 14;
      if (!inView(lx, ly, 20)) return;
      for (let i = 0; i < 3; i++) {
        const a = clock * (2.2 + i * .7) + i * 2.1 + p.x, r = 5 + i * 3 + Math.sin(clock * 1.7 + i) * 2;
        const mx = Math.round(lx + Math.cos(a) * r), my = Math.round(ly + Math.sin(a * 1.3) * r * .6);
        if ((Math.floor(now / 60) + i) % 2) Rc('#f2edd0', mx - 1, my, 3, 1); else Rc('#f2edd0', mx, my - 1, 1, 2);
      }
    });
  }
  function drawBats(now) {
    const fl = Math.sin(now / 50) > 0 ? -2 : 1;
    bats.forEach(b => {
      const x = Math.round(b.x), y = Math.round(b.y);
      Rc('#0b0d16', x - 1, y, 3, 2); Rc('#0b0d16', x - 6, y + fl, 5, 1); Rc('#0b0d16', x + 2, y + fl, 5, 1);
      Rc('#0b0d16', x - 8, y + fl + 1, 2, 1); Rc('#0b0d16', x + 6, y + fl + 1, 2, 1); Rc('#0b0d16', x - 1, y - 1, 1, 1); Rc('#0b0d16', x + 1, y - 1, 1, 1);
    });
  }
  function drawBits() {
    bits.forEach(b => {
      if (!inView(b.x, b.y, 10)) return;
      const y = Math.round(b.y - b.z), x = Math.round(b.x);
      if (b.z > 1) Rc('rgba(0,0,0,.2)', x, Math.round(b.y), b.w, 1);
      if (b.k === 'koran') { const w = Math.max(1, Math.round(Math.abs(Math.cos(b.r)) * 6)); Rc('#d8d4c0', x, y, w, 4); if (w > 3) { Rc('#8a8a80', x + 1, y + 1, w - 2, 1); Rc('#8a8a80', x + 1, y + 3, w - 2, 1); } }
      else Rc(b.c, x, y, b.w, b.h);
    });
  }
  function drawHeli(now) {
    if (!heli.on) return;
    if (heli.want) {
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,255,225,.07)';
      ctx.beginPath(); ctx.moveTo(heli.x, heli.y + 4); ctx.lineTo(heli.sx - 32, heli.sy); ctx.lineTo(heli.sx + 32, heli.sy); ctx.closePath(); ctx.fill();
      ctx.save(); ctx.translate(heli.sx, heli.sy); ctx.scale(1, .6);
      const g = ctx.createRadialGradient(0, 0, 2, 0, 0, 34);
      g.addColorStop(0, 'rgba(255,255,235,.4)'); g.addColorStop(1, 'rgba(255,255,235,0)');
      ctx.fillStyle = g; ctx.fillRect(-34, -34, 68, 68); ctx.restore();
      ctx.globalCompositeOperation = 'source-over';
    }
    if (!inView(heli.x, heli.y, 40)) return;
    const x = Math.round(heli.x), y = Math.round(heli.y), fl = Math.floor(now / 40) % 2;
    Rc('rgba(0,0,0,.22)', x - 8, y + 30, 16, 4);
    Rc(OUT, x - 7, y - 4, 15, 9); Rc('#33445a', x - 6, y - 3, 13, 7); Rc('#9fd4e8', x + 2, y - 2, 4, 4);
    Rc('#2a3548', x - 16, y - 1, 11, 3); Rc('#2a3548', x - 17, y - 5, 2, 6);
    Rc('#c8ccd4', x - 12 + fl * 3, y - 7, 24 - fl * 6, 1); Rc('#8a8f99', x - 1, y - 6, 2, 2); Rc('#1a1d24', x - 6, y + 5, 13, 1);
    if (Math.floor(now / 400) % 2) Rc('#ee6a74', x - 17, y - 6, 2, 2); else Rc('#ffffff', x - 1, y + 4, 2, 1);
  }

  /* --- kafe & rumah --- */
  function cafeOverlay(now) {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    if (jb.i >= 0) {
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(296, 82, 2, 296, 82, 34);
      g.addColorStop(0, `hsla(${(now / 12) % 360},85%,60%,.32)`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.fillRect(256, 44, 64, 76); ctx.globalCompositeOperation = 'source-over';
      for (let i = 0; i < 3; i++) {
        const ph = (now / 1600 + i / 3) % 1;
        words('♪', Math.round(296 + Math.sin(ph * 6 + i) * 11), Math.round(62 - ph * 26), ['#f0c24b', '#5fd8c0', '#ee8fb0'][i], 'bold 9px monospace', 'center');
      }
    }
    if (target && target.k === 'jb') words(jb.i >= 0 ? '♪ ' + CAFE_SONGS[jb.i].n : 'jukebox mati', 296, 108, '#f4e5ba', 'bold 6px monospace', 'center');
    ctx.restore();
  }
  function homeOverlay(now) {
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    const x = TV.x - 17, y = TV.y - 14;
    Rc(OUT, x - 1, y - 1, 36, 26); Rc('#2a2d34', x, y, 34, 24); Rc('#2a2d34', x + 10, y + 24, 14, 2);
    if (tvOn) {
      const ch = Math.floor(now / 1700) % 4;
      if (ch === 0) { Rc('#1a3a8a', x + 2, y + 2, 30, 18); Rc('#c0242c', x + 2, y + 15, 30, 5); Rc('#e8edf2', x + 4, y + 17, 14, 1); Rc(skin, x + 14, y + 5, 5, 5); Rc('#2a2a3a', x + 12, y + 10, 9, 5); }
      else if (ch === 1) { Rc('#a05a7a', x + 2, y + 2, 30, 18); Rc(skin, x + 8, y + 6, 5, 5); Rc(skin, x + 21, y + 6, 5, 5); Rc('#3a2a3a', x + 7, y + 11, 7, 8); Rc('#2a3a5a', x + 20, y + 11, 7, 8); }
      else if (ch === 2) { Rc('#14161c', x + 2, y + 2, 30, 18); Rc('#e8c070', x + 4 + Math.floor(now / 90) % 20, y + 8, 6, 6); }
      else ['#e8e8e8', '#e8e830', '#30e8e8', '#30e830', '#e830e8', '#e83030', '#3030e8'].forEach((c, i) => Rc(c, x + 2 + i * 4.3, y + 2, 4.3, 18));
      ctx.globalCompositeOperation = 'lighter';
      const g = ctx.createRadialGradient(TV.x, TV.y + 10, 2, TV.x, TV.y + 10, 56);
      g.addColorStop(0, `rgba(140,180,255,${.2 + Math.random() * .05})`); g.addColorStop(1, 'rgba(140,180,255,0)');
      ctx.fillStyle = g; ctx.fillRect(TV.x - 56, TV.y - 46, 112, 112); ctx.globalCompositeOperation = 'source-over';
    } else Rc('#15181e', x + 2, y + 2, 30, 18);
    ctx.restore();
  }

  function overlay() {
    const now = performance.now();
    if (where === 'cafe') return cafeOverlay(now);
    if (where === 'home') return homeOverlay(now);
    if (where !== 'city') return;
    ctx.save(); ctx.translate(-cam.x, -cam.y);
    wins.forEach(w => drawWin(w, now));
    drawMoths(now); drawBits(); drawBats(now); drawHeli(now);
    ctx.restore();
  }
  function tickerDraw() {
    if (where !== 'city' || alarmT <= 0 || !ticker) return;
    const slide = clamp(alarmAge / .8, 0, 1) * clamp(alarmT / .8, 0, 1), y = VH - Math.round(10 * slide);
    Rc('rgba(8,10,20,.94)', 0, y, VW, 10); Rc('#c0242c', 0, y, 48, 10);
    if (Math.floor(clock * 2) % 2) Rc('#fff', 4, y + 4, 2, 2);
    words('BERITA', 10, y + 8, '#fff', 'bold 7px monospace');
    const cw = 4.2, off = clock * 38, n = ticker.length, st = Math.floor(off / cw), vis = Math.ceil((VW - 52) / cw) + 2;
    let s = '';
    for (let i = 0; i < vis; i++) s += ticker[(st + i) % n];
    words(s, 52 - (off % cw), y + 8, '#f4f0e0', 'bold 7px monospace');
  }

  /* ================= TICK ================= */
  let batT = rnd(8, 18), bitT = 0;
  const moveSmoke = (arr, dt) => {
    arr.forEach(p => { p.l -= dt; p.y -= p.vy * dt; p.x += (p.vx + gust * gustDir * 14) * dt; });
    for (let i = arr.length - 1; i >= 0; i--) if (arr[i].l <= 0) arr.splice(i, 1);
  };
  function tick(dt) {
    if (scene === 'menu' || scene === 'end') alarmT = 0;
    mix();
    if (!(live() || scene === 'caught' || scene === 'crashed')) return;
    clock += dt;
    if (alarmT > 0) { alarmT -= dt; alarmAge += dt; } else alarmAge = 0;
    if (gA < gLen) { gA += dt; gust = Math.sin(Math.min(1, gA / gLen) * Math.PI); }
    else { gust = 0; gustT -= dt; if (gustT <= 0) { gA = 0; gLen = rnd(3, 6); gustT = rnd(10, 22); gustDir = Math.random() < .5 ? -1 : 1; } }
    if (where !== 'city') return;
    const f = feet();

    shutters.forEach(s => {
      const want = alarmT > 0 && alarmAge > s.delay, prev = s.p;
      s.p = clamp(s.p + (want ? dt / 1.1 : -dt / 2), 0, 1);
      if ((want && prev < .02 && s.p >= .02) || (!want && prev > .98 && s.p <= .98)) sound('rattle', s.x, s.y, 320);
      if (prev < 1 && s.p >= 1) sound('bump', s.x, s.y, 300);
    });
    wins.forEach(w => {
      w.next -= dt;
      if (w.next <= 0) { w.lit = !w.lit; w.next = rnd(10, 50); if (w.lit && Math.random() < .4) w.sh = 2.4; }
      if (w.sh > 0) w.sh -= dt;
    });

    vendors.forEach(v => {
      moveSmoke(v.p, dt);
      if (inView(v.x, v.y, 60) && Math.random() < dt * (v.k === 'sate' ? 9 : 6)) v.p.push(v.k === 'sate'
        ? { x: v.x - 4 + rnd(-2, 2), y: v.y - 16, vx: rnd(-3, 3), vy: rnd(8, 14), l: 1.4, m: 1.4, c: '#8a8a8a', s: 3, a: .35 }
        : { x: v.x - 3 + rnd(-2, 2), y: v.y - 18, vx: rnd(-3, 3), vy: rnd(10, 16), l: 1.1, m: 1.1, c: '#e8ecee', s: 3, a: .3 });
      v.snd -= dt;
      if (v.snd <= 0) {
        if (v.k === 'nasi') { seq('teng', v.x, v.y, 260, [0, .13, .26, .46, .59]); v.snd = rnd(5, 9); }
        else if (v.k === 'sate') { seq('swish', v.x, v.y, 240, [0, .28, .56, .84, 1.12, 1.4]); v.snd = rnd(6, 10); }
        else { seq('tok', v.x, v.y, 260, [0, .22, .44]); seq('ting', v.x, v.y, 260, [.95]); v.snd = rnd(8, 13); }
      }
    });

    moveSmoke(ronda.p, dt);
    if (Math.random() < dt * .6) ronda.p.push({ x: ronda.x + 16, y: ronda.y - 16, vx: rnd(-2, 2), vy: 6, l: 2, m: 2 });
    ronda.snd -= dt;
    if (ronda.snd <= 0) { if (calm()) seq('kenton', ronda.x + 28, ronda.y - 16, 420, [0, .55, 1.1, 1.65]); ronda.snd = rnd(40, 70); }
    if (!calm()) { ronda.titir -= dt; if (ronda.titir <= 0) { seq('kenton', ronda.x + 28, ronda.y - 16, 460, [0, .1, .2, .3, .4, .5, .6, .7, .8]); ronda.titir = 9; } }

    const ph = (clock + kid.off) % 6;
    if (ph < (kid.lp || 0)) kid.cyc++;
    kid.lp = ph;
    if (!kid.fl && ph > 4.95 && ph < 5.3) { kid.fl = true; if (calm()) sound('klik', kid.x, kid.y, 200); }
    if (ph < 1) kid.fl = false;
    const sw = Math.sign(Math.sin(clock * 3));
    if (sw !== sweep.d) { sweep.d = sw; if (calm()) sound('sret', sweep.x, sweep.y, 180); }

    const w = walker; w.cool -= dt; w.t -= dt;
    if (calm()) {
      if (w.st === 'walk') {
        w.x += w.d * 14 * dt;
        const ahead = poles.some(px => { const g = w.d > 0 ? px - w.x : w.x - px; return g > 0 && g < 8; });
        if (ahead && w.cool <= 0) { w.st = 'bump'; w.t = .7; sound('bump', w.x, w.y, 220); }
        if (w.x < 2 * T || w.x > 17 * T) w.d *= -1;
      } else if (w.st === 'bump') { w.x -= w.d * 10 * dt; if (w.t <= 0) { w.st = 'wait'; w.t = 1.2; } }
      else if (w.t <= 0) { w.d *= -1; w.st = 'walk'; w.cool = 2.5; }
    }
    becak.x += becak.d * 15 * dt;
    if (becak.x > 22 * T) becak.d = -1; else if (becak.x < 3 * T) becak.d = 1;

    trafficCars.forEach(c => {
      if (c.kind === 'angkot') {
        c.cool -= dt;
        if (c.pause > 0) {
          c.pause -= dt;
          if (c.pause < 2.9 && !c.dropped) { c.dropped = true; spawnPax(c); }
          if (c.pause <= 0) { c.pause = 0; c.speed = c.base; if (calm()) sound('horn', c.x, c.y, 260); }
        } else if (c.cool <= 0 && c.stops.some(s => (c.px - s) * (c.x - s) <= 0 && Math.abs(c.x - s) < 40)) {
          c.pause = 4.2; c.speed = 0; c.cool = 8; c.dropped = false;
        }
      }
      c.px = c.x;
    });
    pax.forEach(p => {
      p.t += dt;
      if (Math.abs(p.y - p.ty) > 1) p.y += Math.sign(p.ty - p.y) * 22 * dt; else p.x += p.d * 14 * dt;
    });
    for (let i = pax.length - 1; i >= 0; i--) if (pax[i].t > 9) pax.splice(i, 1);

    batT -= dt;
    if (batT <= 0) {
      batT = rnd(18, 40);
      if (calm() && bats.length < 2) {
        const d = Math.random() < .5 ? 1 : -1, b = { x: d > 0 ? cam.x - 20 : cam.x + VW + 20, y0: cam.y + rnd(12, 90), vx: d * rnd(50, 75), ph: rnd(0, 6) };
        b.y = b.y0; bats.push(b); sound('squeak', b.x + d * 30, b.y0, 400);
      }
    }
    for (let i = bats.length - 1; i >= 0; i--) {
      const b = bats[i]; b.x += b.vx * dt; b.y = b.y0 + Math.sin(clock * 2.4 + b.ph) * 14;
      if (b.x < cam.x - 80 || b.x > cam.x + VW + 80) bats.splice(i, 1);
    }

    bitT -= dt;
    if (bitT <= 0 && bits.length < 12) {
      bitT = .3;
      const x = cam.x + rnd(-30, VW + 30), y = cam.y + rnd(-30, VH + 30), tx = Math.floor(x / T), ty = Math.floor(y / T);
      if (tx > 0 && ty > 0 && tx < city.w && ty < city.h && !city.solid[ty * city.w + tx]) {
        const r = Math.random(), k = isRoad(tx, ty) && r < .5 ? 'koran' : r < .45 ? 'daun' : r < .65 ? 'plastik' : r < .8 ? 'bungkus' : 'koran';
        bits.push({ k, x, y, z: 0, vx: 0, vy: 0, vz: 0, cvx: 0, r: rnd(0, 6), w: k === 'plastik' ? 3 : 2, h: k === 'plastik' ? 2 : 2, c: k === 'daun' ? pick(['#8a6a2a', '#6f8a3a', '#a0702a']) : k === 'plastik' ? '#cfd6dc' : '#e8b84a' });
      }
    }
    const wx = gust * gustDir * 55;
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      if (dist(b.x, b.y, cam.x + VW / 2, cam.y + VH / 2) > 280) { bits.splice(i, 1); continue; }
      if (b.z <= 0 && gust > .2 && Math.random() < dt * 1.5) b.vz = rnd(14, 34);
      b.vx = lerp(b.vx, (b.z > 0 || gust > .2 ? wx * (b.k === 'daun' ? 1.2 : 1) : 0) + b.cvx, dt * 2.2);
      b.cvx *= 1 - dt * 1.2; b.vy *= 1 - dt * .8;
      b.x += b.vx * dt; b.y += (b.vy + (b.z > 0 ? Math.sin(clock * 3 + b.r) * 4 : 0)) * dt;
      b.z += b.vz * dt; b.vz -= 70 * dt;
      if (b.z < 0) { b.z = 0; b.vz = 0; }
      if (b.z > 0) b.r += dt * 6;
      trafficCars.forEach(c => {
        if (c.speed > 0 && b.z < 6 && Math.abs(c.x - b.x) < 24 && Math.abs(c.y - b.y) < 20) {
          b.vz = rnd(40, 70);
          if (c.axis === 'h') b.cvx = c.dir * rnd(70, 110); else b.vy = c.dir * rnd(60, 100);
        }
      });
    }

    heli.want = alarmT > 0 && alarmAge > 3;
    if (heli.want && !heli.on) { heli.on = true; heli.init = false; }
    if (heli.on) {
      if (!heli.init) { heli.x = cam.x + VW + 120; heli.y = cam.y + 20; heli.sx = f.x; heli.sy = f.y; heli.init = true; }
      heli.th += dt * .45;
      const tx = heli.want ? f.x + Math.cos(heli.th) * 80 : cam.x + VW + 240, ty = heli.want ? f.y - 58 + Math.sin(heli.th * 1.3) * 22 : cam.y - 80;
      const k = 1 - Math.exp(-dt * (heli.want ? .9 : .5));
      heli.x = lerp(heli.x, tx, k); heli.y = lerp(heli.y, ty, k);
      heli.sx = lerp(heli.sx, f.x, 1 - Math.exp(-dt * 1.6)); heli.sy = lerp(heli.sy, f.y, 1 - Math.exp(-dt * 1.6));
      if (!heli.want && !inView(heli.x, heli.y, 60)) heli.on = false;
    }
  }

  /* ================= PASANG KE GAME ================= */
  const basePlay = playSound;
  playSound = function (kind) {
    if (kind === 'alert') raiseAlarm();
    if (kind === 'step' && E && soundEnabled && audioContext && stepSound()) return;
    basePlay(kind);
  };
  const baseUpdate = update;
  update = function (dt) {
    baseUpdate(dt);
    tick(dt);
    if (scene !== 'play') return;
    const f = feet();
    if (!target) {
      if (where === 'cafe' && dist(296, 98, f.x, f.y) < 30) { target = { k: 'jb' }; hint = '[E] Jukebox: ' + (jb.i < 0 ? 'nyalakan' : 'lagu berikutnya'); }
      else if (where === 'home' && dist(TV.x, TV.y, f.x, f.y) < 34) { target = { k: 'tv' }; hint = '[E] TV: ' + (tvOn ? 'matikan' : 'nyalakan'); }
    }
    if (target && (target.k === 'shop' || target.k === 'cafe' || (target.k === 'door' && target.b && target.b.name !== 'APOTEK')) && closedDoor(target.k === 'shop' ? 'TOKO' : target.k === 'cafe' ? 'KAFE' : target.b.name)) hint = 'Pintu gulung tertutup (alarm)';
  };
  const baseInteract = interact;
  interact = function () {
    if (target && target.k === 'jb') return nextSong();
    if (target && target.k === 'tv') { tvOn = !tvOn; toast(tvOn ? 'TV menyala' : 'TV dimatikan'); playSound('door'); return; }
    if (target && (target.k === 'shop' || target.k === 'cafe' || (target.k === 'door' && target.b)) && target.b !== B('APOTEK')) {
      const n = target.k === 'shop' ? 'TOKO' : target.k === 'cafe' ? 'KAFE' : target.b.name;
      if (closedDoor(n)) { toast('Pintu gulung sudah turun. Tutup karena alarm!'); return; }
    }
    baseInteract();
  };
  const baseDraw = draw;
  draw = function () {
    interactionEffects = interactionEffects.filter(e => !e.sp);
    if (where === 'city') sprites.forEach(s => { if (s.show()) interactionEffects.push({ x: 0, y: s.depth(), life: .001, maxLife: .001, color: '#000', sp: s }); });
    baseDraw();
  };
  const baseFx = drawInteractionEffect;
  drawInteractionEffect = e => e.sp ? e.sp.draw() : baseFx(e);
  const baseHud = hud;
  hud = function () { overlay(); baseHud(); tickerDraw(); };
  const baseReset = resetAll;
  resetAll = function () { alarmT = 0; alarmAge = 0; heli.on = false; bits.length = 0; bats.length = 0; pax.length = 0; baseReset(); };
  const unlock = () => {
    if (!soundEnabled) return;
    try {
      const A = window.AudioContext || window.webkitAudioContext;
      if (!audioContext && A) audioContext = new A();
      if (audioContext && audioContext.state === 'suspended') audioContext.resume();
    } catch (error) { console.warn('Audio belum bisa dinyalakan:', error); }
  };
  addEventListener('keydown', unlock); addEventListener('pointerdown', unlock);
})();