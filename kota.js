(() => {
  const rnd = (a, b) => a + Math.random() * (b - a);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const dist = (a, b, c, d) => Math.hypot(a - c, b - d);
  const inView = (x, y, m = 40) => x > cam.x - m && x < cam.x + VW + m && y > cam.y - m && y < cam.y + VH + m;
  const Rc = (c, a, b, w, h) => { ctx.fillStyle = c; ctx.fillRect(a, b, w, h); };
  const live = () => scene === 'play' || scene === 'talk';
  const npcBy = n => npcs.find(x => x.name === n);
  const say = (n, s, t = 2.4) => { n.say = s; n.sayT = t; };
  const emo = (n, c, t = 2) => { n.emo = c; n.emoT = t; };
  const lay = cityLayer.getContext('2d'), CW = city.w * T;
  const sq = [];
  const add = (show, depth, draw) => sq.push({ show, depth, draw });

  const spot = (tx, ty, want) => {
    for (let r = 0; r < 12; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = tx + dx, y = ty + dy;
      if (x > 0 && y > 0 && x < city.w - 1 && y < city.h - 1 && !city.solid[y * city.w + x] && (!want || ground(x, y) === want) && !props.some(p => p.x === x && p.y === y)) return [x, y];
    }
    return [tx, ty];
  };
  const dry = (x, y) => [[-4, -2], [4, -2], [-4, 3], [4, 3]].every(([a, b]) => {
    const tx = Math.floor((x + a) / T), ty = Math.floor((y + b) / T);
    return tx > 0 && ty > 0 && tx < city.w - 1 && ty < city.h - 1 && !city.solid[ty * city.w + tx] && ground(tx, ty) !== 'r';
  });
  function beep(f, len, type, v, x, y, max) {
    if (!soundEnabled || !audioContext) return;
    let g = v || .03;
    if (x != null) { const p = feet(); g *= Math.max(0, 1 - dist(x, y, p.x, p.y) / (max || 300)); if (g < .002) return; }
    try {
      const t = audioContext.currentTime, o = audioContext.createOscillator(), n = audioContext.createGain();
      o.type = type || 'square'; o.frequency.value = f;
      n.gain.setValueAtTime(g, t); n.gain.exponentialRampToValueAtTime(.0005, t + len);
      o.connect(n); n.connect(audioContext.destination); o.start(t); o.stop(t + len + .02);
    } catch (e) { /* audio belum siap */ }
  }
  const later = (fn, ms) => setTimeout(fn, ms);

  /* ================= KERETA ================= */
  const RY = 31, RP = RY * T;
  const cross = [[14, 16], [34, 36]];
  for (let i = props.length - 1; i >= 0; i--) if (props[i].y >= RY && props[i].y <= RY + 1) props.splice(i, 1);
  const railRows = on => { for (let x = 0; x < city.w; x++) for (const y of [RY, RY + 1]) city.solid[y * city.w + x] = on ? 1 : 0; };
  railRows(false);
  lay.fillStyle = '#5a554c'; lay.fillRect(0, RP, CW, 2 * T);
  for (let x = 0; x < CW; x += 7) { lay.fillStyle = '#4a3626'; lay.fillRect(x, RP + 2, 3, 2 * T - 4); }
  cross.forEach(([a, b]) => {
    lay.fillStyle = '#3b3d45'; lay.fillRect(a * T, RP, (b - a + 1) * T, 2 * T);
    lay.fillStyle = '#8a8a80'; lay.fillRect((a - 1) * T, RP, T, 2 * T); lay.fillRect((b + 1) * T, RP, T, 2 * T);
    lay.fillStyle = 'rgba(255,255,255,.25)'; for (let y = RP + 3; y < RP + 2 * T; y += 6) { lay.fillRect(a * T + 3, y, 2, 3); lay.fillRect((b + 1) * T - 5, y, 2, 3); }
  });
  lay.fillStyle = '#aab2b6'; lay.fillRect(0, RP + 7, CW, 2); lay.fillRect(0, RP + 23, CW, 2);
  lay.fillStyle = '#e4eaed'; lay.fillRect(0, RP + 7, CW, 1); lay.fillRect(0, RP + 23, CW, 1);

  const train = { st: 'idle', t: rnd(14, 24), x: 0, dir: 1, gate: 0, bell: 0, len: 46 + 5 * 38 };
  const eject = () => {
    const f = feet();
    if (f.y > RP - 4 && f.y < RP + 2 * T + 4) {
      player.y = (f.y < RP + T ? RP - 14 : RP + 2 * T + 8);
      toast('Warga menarikmu menjauh dari rel!'); playSound('door');
    }
    npcs.forEach(n => { if (n.y > RP - 4 && n.y < RP + 2 * T + 4) n.y = n.y < RP + T ? RP - 12 : RP + 2 * T + 10; });
  };
  function tickTrain(dt) {
    const closing = train.st === 'warn' || train.st === 'pass';
    train.gate = Math.max(0, Math.min(1, train.gate + (closing ? dt / 1.2 : -dt / 1.2)));
    if (closing) {
      train.bell -= dt;
      if (train.bell <= 0) {
        train.bell = .42; train.tog = !train.tog;
        const cx = cross[feet().x < 25 * T ? 0 : 1], bx = (cx[0] + cx[1] + 1) / 2 * T;
        beep(train.tog ? 1180 : 940, .22, 'square', .05, bx, RP + T, 360);
      }
    }
    if (train.st === 'idle') { train.t -= dt; if (train.t <= 0) { train.st = 'warn'; train.t = 5; } }
    else if (train.st === 'warn') {
      train.t -= dt;
      if (train.t <= 0) {
        train.st = 'pass'; train.dir = Math.random() < .5 ? 1 : -1; train.x = train.dir > 0 ? -train.len : CW;
        eject(); railRows(true);
        beep(196, .9, 'sawtooth', .06, train.dir > 0 ? 0 : CW, RP, 900); later(() => beep(233, .8, 'sawtooth', .05, 0, RP, 1), 900);
      }
    } else if (train.st === 'pass') {
      train.x += train.dir * 150 * dt;
      train.rum = (train.rum || 0) - dt;
      if (train.rum <= 0) { train.rum = .16; beep(60 + Math.random() * 20, .15, 'sawtooth', .05, train.x + train.len / 2, RP, 700); }
      if (train.dir > 0 ? train.x > CW + 20 : train.x < -train.len - 20) { train.st = 'idle'; train.t = rnd(40, 70); railRows(false); }
    }
  }
  const baseSpeed = trafficSpeed;
  trafficSpeed = function (car) {
    const v = baseSpeed(car);
    if (car.axis !== 'v' || train.gate < .3) return v;
    const before = car.dir > 0 ? RP - car.y : car.y - (RP + 2 * T);
    return before > -4 && before < 70 ? 0 : v;
  };
  function drawTrain() {
    const y = RP + 2, x0 = Math.round(train.x), d = train.dir;
    if (train.st === 'pass') {
      for (let i = 0; i < 6; i++) {
        const w = i === 0 ? 46 : 36, off = i === 0 ? 0 : 46 + (i - 1) * 38 + 2;
        const x = d > 0 ? x0 + train.len - off - w : x0 + off;
        Rc('rgba(0,0,0,.3)', x, y + 26, w, 4);
        Rc(OUT, x - 1, y - 1, w + 2, 28);
        Rc(i === 0 ? '#2d5a8a' : i % 2 ? '#7a2f3a' : '#c0553f', x, y, w, 26);
        Rc('rgba(255,255,255,.2)', x, y, w, 3); Rc('#e0b84a', x, y + 17, w, 2);
        if (i === 0) {
          Rc('#9fd0e8', d > 0 ? x + w - 14 : x + 4, y + 5, 10, 8);
          Rc('#e8ecee', d > 0 ? x + w - 3 : x, y + 14, 3, 6);
          ctx.globalCompositeOperation = 'lighter';
          const hx = d > 0 ? x + w : x, g = ctx.createRadialGradient(hx, y + 15, 1, hx + d * 30, y + 15, 40);
          g.addColorStop(0, 'rgba(255,240,170,.5)'); g.addColorStop(1, 'rgba(255,240,170,0)');
          ctx.fillStyle = g; ctx.fillRect(hx - 40, y - 20, 80, 70);
          ctx.globalCompositeOperation = 'source-over';
        } else for (let k = 4; k < w - 8; k += 11) { Rc(OUT, x + k - 1, y + 5, 9, 8); Rc(hash(i, k) % 4 ? '#f0c24b' : '#35506a', x + k, y + 6, 7, 6); }
        for (const wx of [6, w - 12]) { Rc('#1a1d24', x + wx, y + 22, 7, 6); Rc('#6b727c', x + wx + 2, y + 24, 3, 2); }
      }
    }
    cross.forEach(([a, b]) => {
      const open = 1 - train.gate, blink = train.gate > .2 && Math.floor(performance.now() / 420) % 2;
      const arm = (px, py, dir) => {
        ctx.save(); ctx.translate(px, py); ctx.rotate(dir * (Math.PI / 2) * open);
        for (let i = 0; i < 48; i += 8) Rc(i % 16 ? '#f2f2f2' : '#d9423a', dir > 0 ? -i - 8 : i, -2, 8, 4);
        ctx.restore();
        Rc(OUT, px - 3, py - 8, 6, 12); Rc('#555', px - 2, py - 7, 4, 10);
        Rc(blink ? '#ff3b3b' : '#5a1a1a', px - 2, py - 7, 4, 3); Rc(blink ? '#5a1a1a' : '#ff3b3b', px - 2, py - 3, 4, 3);
      };
      arm(a * T - 4, RP - 1, -1); arm((b + 1) * T + 4, RP + 2 * T + 3, 1);
    });
  }
  add(() => true, () => RP + 2 * T, drawTrain);

  /* ================= BERITA & GOSIP ================= */
  const headline = () => {
    if (hasLoot || missionStep >= 5) return ['BANK DIBOBOL!', 'Polisi memburu pelaku. Saksi menyebut seseorang dengan tas berat.'];
    if (alarmCount >= 3) return ['ALARM BANK BERBUNYI LAGI', 'Warga resah. Pihak bank bilang itu "gangguan teknis". Tiga kali.'];
    if (alarmCount > 0) return ['ALARM BANK SEMPAT MENYALA', 'Penyebab belum diketahui. Satpam kota minta warga tetap tenang.'];
    if (sideQuestStep >= 2) return ['KURIR MISTERIUS ANTAR PAKET', 'Warga heran: paket sampai tepat waktu, tanpa ongkos kirim.'];
    return pick([['MALAM TENANG DI PIXEL CITY', 'Harga gorengan naik lagi. Warga menyiapkan protes (kecil).'], ['KUCING ORANYE JADI SELEBRITI', 'Dilihat ratusan orang, tidak ada yang berhasil memeluknya.']]);
  };
  const [kx, ky] = spot(20, 13, 's');
  city.solid[ky * city.w + kx] = 1;
  const kios = { x: kx * T + 8, y: ky * T + 15 };
  add(() => inView(kios.x, kios.y, 40), () => kios.y, () => {
    const x = kios.x, y = kios.y;
    Rc('rgba(0,0,0,.3)', x - 11, y - 2, 24, 3);
    Rc(OUT, x - 11, y - 20, 22, 18); Rc('#c9b99a', x - 10, y - 19, 20, 16);
    for (let i = 0; i < 4; i++) { Rc('#f2ead0', x - 9 + i * 5, y - 12, 4, 6); Rc('#222', x - 8 + i * 5, y - 10, 2, 1); }
    Rc('#2d3446', x - 12, y - 25, 24, 6); Rc('#d9423a', x - 10, y - 24, 6, 4); Rc('#e0b84a', x - 3, y - 24, 6, 4); Rc('#4b8a5a', x + 4, y - 24, 6, 4);
    Rc('#222', x + 6, y - 17, 4, 3);
  });

  const rumorText = {
    alarm: ['Alarm bank bunyi tadi. Kamu dengar?', 'Katanya ada yang main-main di bank.'],
    buron: ['Ada buronan lewat sini. Ngeri.', 'Polisi cari orang yang mirip yang barusan lewat...'],
    loot: ['Ada yang bawa tas berat dari arah bank.', 'Tas hitam itu kok isinya kayak duit.']
  };
  const react = {
    alarm: ['Alarm tadi bikin jantungan!', 'Bank lagi ribut, ya?'],
    buron: ['Itu kamu yang dicari polisi, ya?', 'Jangan dekat-dekat, aku nggak lihat apa-apa!'],
    loot: ['Tasmu kelihatan berat...', 'Aku nggak akan bilang siapa-siapa. Mungkin.']
  };
  const learn = (n, type) => {
    if (n.rum && n.rum.type === type) return;
    n.rum = { type, t: 150, said: false };
    if (!n.baseLines) n.baseLines = n.lines;
    n.lines = [pick(react[type])].concat(n.baseLines || []);
  };
  const forget = n => { n.rum = null; if (n.baseLines) { n.lines = n.baseLines; n.baseLines = null; } };
  let pA = alarmCount, pW = wanted > 0, pL = hasLoot;
  function tickGossip(dt) {
    const f = feet();
    if (alarmCount > pA) { npcs.slice().sort(() => Math.random() - .5).slice(0, 3).forEach(n => learn(n, 'alarm')); }
    if (wanted > 0 && !pW) npcs.forEach(n => { if (dist(n.x, n.y, f.x, f.y) < 120) learn(n, 'buron'); });
    if (hasLoot && !pL) npcs.forEach(n => { if (dist(n.x, n.y, f.x, f.y) < 90) learn(n, 'loot'); });
    pA = alarmCount; pW = wanted > 0; pL = hasLoot;
    npcs.forEach(n => {
      if (!n.rum) return;
      if ((n.rum.t -= dt) <= 0) { forget(n); return; }
      n.gcd = (n.gcd || 0) - dt;
      if (!n.rum.said && dist(n.x, n.y, f.x, f.y) < 56 && !(n.sayT > 0)) { n.rum.said = true; say(n, pick(react[n.rum.type])); emo(n, '!'); }
      if (n.gcd > 0) return;
      for (const m of npcs) {
        if (m === n || m.rum || dist(m.x, m.y, n.x, n.y) > 26) continue;
        learn(m, n.rum.type); say(n, pick(rumorText[n.rum.type]), 3); emo(n, '?'); n.gcd = 10; break;
      }
    });
  }

  /* ================= DRAMA WARGA ================= */
  const dramas = [
    { cast: ['Pak Joko', 'Suster Ayu'], title: 'cinta', lines: [[0, 'Ayu... jam berapa kamu selesai jaga?', '♥'], [1, 'Pelan-pelan, Mas. Nanti ada yang dengar.', '♥'], [0, 'Aku bawakan bunga. Sedikit layu.', '♪'], [1, 'Layu pun aku mau. Besok ya.', '♥']],
      caught: [[0, 'Eh! Aku cuma tanya jam!', '!'], [1, 'Iya! Jam! Hanya jam!', '!']], mediate: ['Kamu pura-pura nggak lihat apa-apa.', 'Mereka tersipu dan diam-diam menyelipkan uang tutup mulut.'] },
    { cast: ['Pak Ujang', 'Pak Joko'], title: 'pagar', lines: [[0, 'Pagarmu masuk wilayahku dua jengkal!', '!'], [1, 'Dua jengkal punyamu! Jengkalku lebih pendek!', '!'], [0, 'Itu alasan paling konyol tahun ini!', '!'], [1, 'Ukur saja pakai meteran, kalau berani!', '!']],
      caught: [[0, 'Nah, ada saksi! Pagar siapa yang maju?', '?'], [1, 'Jangan libatkan orang luar!', '!']], mediate: ['Kamu usulkan pagarnya digeser sejengkal masing-masing.', 'Keduanya diam, lalu mengangguk. Satu masalah selesai.'] },
    { cast: ['Bu Tini', 'Dimas'], title: 'gorengan', lines: [[1, 'Bu, gorengannya kok kecil banget?', '?'], [0, 'Itu karena kamu makan dua sebelum bayar!', '!'], [1, 'Aku cuma mencicip, Bu!', '!'], [0, 'Mencicip dua? Dengan tangan dua-duanya?', '!']],
      caught: [[1, 'Kak! Bilang ke Ibu aku nggak curang!', '!'], [0, 'Anak ini bohong kayak bernapas!', '!']], mediate: ['Kamu bayarkan gorengan Dimas. Bu Tini tersenyum lebar.', 'Dimas janji nggak mencicip lagi (bohong).'] }
  ];
  const dr = { def: null, t: rnd(30, 50), st: 'wait', i: 0, tt: 0, at: null, caught: false };
  const stage = (n, x, y, dt) => {
    n.drama = true; n.cd = 60; n.sleep = false;
    if (dist(n.x, n.y, x, y) > 14) { n.wait = 0; n.dest = { x, y }; return false; }
    n.dest = null; n.wait = 2; return true;
  };
  const endDrama = () => {
    dr.def && dr.def.cast.forEach(nm => { const n = npcBy(nm); if (n) { n.drama = false; n.cd = 0; n.dest = null; n.wait = 1; } });
    dr.def = null; dr.st = 'wait'; dr.t = rnd(40, 80);
  };
  function tickDrama(dt) {
    const f = feet();
    if (dr.st === 'wait') {
      dr.t -= dt;
      if (dr.t > 0 || wanted > 0 || scene !== 'play') return;
      const opts = dramas.filter(d => d.cast.every(nm => { const n = npcBy(nm); return n && !n.scared && !n.sleep && dist(n.x, n.y, f.x, f.y) < 260; }));
      if (!opts.length) { dr.t = 8; return; }
      dr.def = pick(opts); dr.st = 'gather'; dr.tt = 14; dr.i = 0; dr.caught = false;
      const a = npcBy(dr.def.cast[0]), b = npcBy(dr.def.cast[1]);
      const [sx, sy] = spot(Math.round((a.x + b.x) / 2 / T), Math.round((a.y + b.y) / 2 / T), 's');
      dr.at = { x: sx * T + 8, y: sy * T + 12 };
      return;
    }
    const [a, b] = dr.def.cast.map(npcBy);
    if (!a || !b || wanted > 0) return endDrama();
    const ra = stage(a, dr.at.x - 14, dr.at.y, dt), rb = stage(b, dr.at.x + 14, dr.at.y, dt);
    if (dr.st === 'gather') {
      dr.tt -= dt;
      if (ra && rb) { dr.st = 'act'; dr.tt = 0; a.dir = 'right'; b.dir = 'left'; }
      else if (dr.tt <= 0) endDrama();
      return;
    }
    if (dr.st === 'act') {
      dr.tt -= dt;
      const near = dist(a.x, a.y, f.x, f.y) < 36 || dist(b.x, b.y, f.x, f.y) < 36;
      if (near && !dr.caught && dr.i > 0) {
        dr.caught = true; dr.def.caught.forEach(([w, s, e], k) => later(() => { const n = npcBy(dr.def ? dr.def.cast[w] : ''); if (n) { say(n, s); emo(n, e); } }, k * 1200));
        dr.tt = 6; dr.i = 99; return;
      }
      if (dr.tt > 0) return;
      if (dr.i >= dr.def.lines.length && dr.i < 99) { dr.st = 'cool'; dr.tt = 5; return; }
      if (dr.i >= 99) { dr.st = 'cool'; dr.tt = 3; return; }
      const [w, s, e] = dr.def.lines[dr.i++], n = w ? b : a;
      say(n, s, 2.6); emo(n, e, 2.4); (w ? a : b).dir = w ? 'right' : 'left'; dr.tt = 2.9;
    } else { dr.tt -= dt; if (dr.tt <= 0) endDrama(); }
  }

  /* ================= HEWAN ================= */
  const pets = [];
  const pet = (k, tx, ty, want, o) => { const [x, y] = spot(tx, ty, want); pets.push(Object.assign({ k, x: x * T + 8, y: y * T + 12, hx: x * T + 8, hy: y * T + 12, dir: 'left', wait: rnd(0, 3), dest: null, say: '', sayT: 0, z: 0, fly: 0 }, o)); };
  pet('dog', 22, 28, 'g', { sp: 22, r: 60 }); pet('dog', 46, 9, 's', { sp: 22, r: 50 });
  for (let i = 0; i < 5; i++) pet('pigeon', 24 + i, 9, 's', { off: rnd(0, 6) });
  pet('chick', 6, 30, 'g', { sp: 10, r: 36 }); pet('chick', 8, 30, 'g', { sp: 10, r: 36 }); pet('chick', 48, 30, 'g', { sp: 10, r: 36 });
  let ratT = rnd(10, 20);
  const bark = p => { beep(210, .09, 'square', .05, p.x, p.y, 260); later(() => beep(160, .1, 'square', .05, p.x, p.y, 260), 110); };
  function tickPets(dt) {
    const f = feet(), cr = crouching();
    pets.forEach(p => {
      p.sayT -= dt; p.wait -= dt;
      const d = dist(p.x, p.y, f.x, f.y);
      if (p.k === 'pigeon') {
        if (p.fly > 0) { p.fly -= dt; p.z = Math.min(34, p.z + 60 * dt); p.x += p.vx * dt; if (p.fly <= 0) { p.z = 0; p.x = p.hx + rnd(-8, 8); } return; }
        if (d < 34 && live()) { p.fly = rnd(5, 9); p.vx = rnd(-40, 40); beep(400 + rnd(0, 200), .06, 'sawtooth', .02, p.x, p.y, 200); }
        return;
      }
      if (p.k === 'dog') {
        if (d < 80 && !cr && live() && p.sayT <= 0) { say(p, pick(['GUK!', 'GUK GUK!', 'WOF!']), 1.2); bark(p); }
        const chase = d < 70 && !cr && wanted <= 0;
        if (chase && d > 18) { goStep(p, f.x, f.y, 36, dt); return; }
      }
      if (p.k === 'chick' && d < 30 && p.sayT <= 0 && live()) { say(p, 'Kluk!', 1); beep(520, .05, 'triangle', .02, p.x, p.y, 160); }
      if (p.wait > 0) return;
      if (!p.dest) { const a = Math.random() * 6.28, r = rnd(10, p.r); p.dest = { x: p.hx + Math.cos(a) * r, y: p.hy + Math.sin(a) * r * .7 }; }
      if (dist(p.x, p.y, p.dest.x, p.dest.y) < 3 || !goStep(p, p.dest.x, p.dest.y, p.sp, dt)) { p.dest = null; p.wait = rnd(1, 4); }
    });
    ratT -= dt;
    if (ratT <= 0 && live() && where === 'city') {
      ratT = rnd(12, 26);
      const rows = [9, 13, 23, 27], ry = pick(rows) * T + rnd(4, 11), dir = Math.random() < .5 ? 1 : -1;
      pets.push({ k: 'rat', x: cam.x + (dir > 0 ? -10 : VW + 10), y: ry, dir: dir > 0 ? 'right' : 'left', life: (VW + 30) / 55, say: '', sayT: 0 });
      later(() => beep(1500, .07, 'triangle', .02, cam.x + VW / 2, ry, 400), 500);
    }
    for (let i = pets.length - 1; i >= 0; i--) {
      const p = pets[i];
      if (p.k !== 'rat') continue;
      p.x += (p.dir === 'right' ? 1 : -1) * 55 * dt; p.life -= dt;
      if (p.life <= 0) pets.splice(i, 1);
    }
  }
  function goStep(p, tx, ty, sp, dt) {
    const dx = tx - p.x, dy = ty - p.y, m = Math.hypot(dx, dy) || 1, nx = p.x + dx / m * sp * dt, ny = p.y + dy / m * sp * dt;
    let moved = false;
    if (dry(nx, p.y)) { p.x = nx; moved = true; }
    if (dry(p.x, ny)) { p.y = ny; moved = true; }
    if (Math.abs(dx) > .5) p.dir = dx < 0 ? 'left' : 'right';
    return moved;
  }
  function drawPet(p) {
    const x = Math.round(p.x), y = Math.round(p.y), l = p.dir === 'left', now = performance.now();
    if (p.k === 'dog') {
      const run = (now / 140 | 0) % 2;
      Rc('rgba(0,0,0,.3)', x - 6, y - 1, 13, 2);
      Rc('#8a6a42', x - 5, y - 8, 11, 6); Rc('#8a6a42', l ? x - 8 : x + 4, y - 11, 5, 5);
      Rc('#222', l ? x - 8 : x + 8, y - 9, 1, 1); Rc('#5a3e22', l ? x - 8 : x + 5, y - 12, 2, 2);
      Rc('#8a6a42', l ? x + 5 : x - 8, y - 9 - (Math.sin(now / 120) > 0 ? 1 : 0), 3, 2);
      Rc('#5a3e22', x - 4, y - 2, 2, run ? 2 : 1); Rc('#5a3e22', x + 3, y - 2, 2, run ? 1 : 2);
    } else if (p.k === 'chick') {
      Rc('rgba(0,0,0,.25)', x - 3, y - 1, 7, 2);
      Rc('#f2ead0', x - 3, y - 6, 6, 5); Rc('#f2ead0', l ? x - 5 : x + 3, y - 8, 3, 3); Rc('#d9423a', l ? x - 5 : x + 4, y - 9, 2, 1);
      Rc('#e8a21c', l ? x - 6 : x + 6, y - 7, 1, 1); Rc('#e8a21c', x - 1, y - 1, 1, 2); Rc('#e8a21c', x + 1, y - 1, 1, 2);
    } else if (p.k === 'pigeon') {
      const z = Math.round(p.z), fl = p.fly > 0 && (now / 70 | 0) % 2;
      Rc('rgba(0,0,0,.2)', x - 3, y - 1, 6, 1);
      Rc('#8f98a8', x - 3, y - 5 - z, 6, 4); Rc('#6a7388', x - 3 + (fl ? -2 : 0), y - 6 - z - (fl ? 2 : 0), 6 + (fl ? 4 : 0), 2);
      Rc('#aab4c8', x + (l ? -4 : 3), y - 7 - z, 3, 3); Rc('#e8a21c', x + (l ? -5 : 5), y - 6 - z, 1, 1);
    } else if (p.k === 'rat') {
      const leg = (now / 60 | 0) % 2;
      Rc('#5a5a62', x - 3, y - 3, 6, 3); Rc('#5a5a62', p.dir === 'right' ? x + 3 : x - 5, y - 4, 2, 2);
      Rc('#c9a0a0', p.dir === 'right' ? x - 6 : x + 3, y - 2, 3, 1); Rc('#222', x - 2 + leg, y, 1, 1); Rc('#222', x + 1 - leg, y, 1, 1);
    }
    if (p.sayT > 0) words(p.say, x, y - 16, '#fff', 'bold 6px monospace', 'center');
  }
  const syncPets = () => {
    for (let i = sq.length - 1; i >= 0; i--) if (sq[i].pet) sq.splice(i, 1);
    pets.forEach(p => sq.push({ pet: 1, show: () => inView(p.x, p.y, 20), depth: () => p.y, draw: () => drawPet(p) }));
  };

  /* ================= BENDA KOTA ================= */
  const objs = [];
  const put = (k, tx, ty, want, o) => { const [x, y] = spot(tx, ty, want); if (k !== 'can') city.solid[y * city.w + x] = 1; const ob = Object.assign({ k, x: x * T + 8, y: y * T + 15, cd: 0, used: false }, o); objs.push(ob); return ob; };
  put('bench', 9, 13, 's'); put('bench', 22, 27, 's'); put('bench', 44, 13, 's'); put('bench', 31, 23, 's');
  put('can', 6, 9, 's'); put('can', 28, 23, 's'); put('can', 41, 9, 's');
  put('atm', 38, 23, 's'); put('phone', 29, 9, 's'); put('mail', 12, 13, 's'); put('mail', 33, 27, 's');
  put('pulsa', 17, 14, 's'); put('halte', 13, 27, 's');
  const kobj = {
    bench: { h: () => '[E] Duduk sebentar', r: 24, act: o => { if (o.cd > 0) return toast('Kamu sudah cukup istirahat.'); o.cd = 40; wanted = Math.max(0, wanted - 1); talkTo('BANGKU', ['Kamu duduk. Angin malam lewat, lampu jalan berdengung.', 'Beberapa menit tenang. Kota terasa lupa padamu.']); } },
    can: { h: () => '[E] Tendang kaleng', r: 18, act: o => { o.kick = .5; o.x = Math.min(o.x + 24, CW - 16); o.cd = 1; beep(720, .08, 'triangle', .05, o.x, o.y, 300); later(() => beep(540, .1, 'triangle', .04, o.x, o.y, 300), 120); toast(pick(['Klontang! Seekor kucing menoleh.', 'Klontang! Hampir kena tiang.', 'Klontang... gol!'])); } },
    atm: { h: () => '[E] Cek ATM', r: 24, act: () => talkTo('ATM', ['Selamat malam. Saldo tabunganmu: Rp ' + money + '.', money > 5000 ? 'Layar berkedip: "Transaksi mencurigakan terdeteksi."' : 'Layar berkedip: "Saldo cukup untuk bermimpi."']) },
    phone: { h: () => '[E] Angkat telepon umum', r: 22, act: () => talkTo('TELEPON', [pick(['Tuut... tuut... "Nomor yang Anda tuju sedang dicari polisi."', 'Tuut... "Maaf, koin Anda habis. Seperti uang Anda."', 'Terdengar suara sinis: "Halo? ... Kamu salah sambung. Atau salah hidup."'])]) },
    mail: { h: o => o.used ? '[E] Periksa kotak surat' : '[E] Buka kotak surat', r: 20, act: o => { if (o.used) return toast('Kotak suratnya kosong. Cuma debu.'); o.used = true; money += 20; saveProgress(); toast('Ada uang receh terselip di surat: +Rp 20'); } },
    pulsa: { h: () => '[E] Beli pulsa Rp 20', r: 24, act: () => { if (money < 20) return toast('Uang receh pun kurang.'); money -= 20; saveProgress(); playSound('buy'); talkTo('KIOS PULSA', ['Pulsa Rp 20 masuk. Cukup buat satu SMS: "Aku baik-baik saja."']); } },
    halte: { h: () => '[E] Tunggu angkot', r: 24, act: () => talkTo('HALTE', ['Kamu duduk menunggu angkot yang entah kapan datang.', 'Jadwalnya "kalau sempat". Tulisan itu ada di papan resmi.']) }
  };
  function drawObj(o) {
    const x = Math.round(o.x), y = Math.round(o.y);
    if (o.k === 'bench') { Rc('rgba(0,0,0,.25)', x - 12, y - 2, 25, 3); Rc(OUT, x - 11, y - 12, 23, 11); Rc('#8a5a34', x - 10, y - 11, 21, 3); Rc('#8a5a34', x - 10, y - 7, 21, 3); Rc('#3a3a42', x - 10, y - 4, 2, 4); Rc('#3a3a42', x + 8, y - 4, 2, 4); }
    else if (o.k === 'can') {
      const cx = x - Math.round(Math.max(0, o.kick || 0) * 48);
      Rc('rgba(0,0,0,.25)', cx - 3, y - 1, 7, 2); Rc('#c0c8cc', cx - 2, y - 5, 4, 5); Rc('#d9423a', cx - 2, y - 4, 4, 2); Rc('#6b727c', cx - 2, y - 5, 4, 1);
    } else if (o.k === 'atm') { Rc('rgba(0,0,0,.3)', x - 8, y - 2, 17, 3); Rc(OUT, x - 8, y - 22, 17, 21); Rc('#4a5560', x - 7, y - 21, 15, 19); Rc('#5fd8c0', x - 5, y - 19, 11, 6); Rc('#222', x - 4, y - 10, 9, 3); Rc('#e0b84a', x - 4, y - 5, 9, 2); Rc('#5fd8c0', x - 5, y - 24, 11, 3); }
    else if (o.k === 'phone') { Rc('rgba(0,0,0,.3)', x - 6, y - 2, 13, 3); Rc(OUT, x - 6, y - 24, 13, 23); Rc('#c0343a', x - 5, y - 23, 11, 21); Rc('#9fd0e8', x - 4, y - 21, 9, 7); Rc('#222', x - 3, y - 12, 7, 5); Rc('#f2ead0', x - 4, y - 24, 9, 2); }
    else if (o.k === 'mail') { Rc('rgba(0,0,0,.3)', x - 5, y - 2, 11, 3); Rc(OUT, x - 5, y - 17, 11, 15); Rc('#2f5fa0', x - 4, y - 16, 9, 7); Rc('#2f5fa0', x - 3, y - 9, 7, 7); Rc('#222', x - 3, y - 13, 7, 1); Rc('#5a5a62', x - 1, y - 4, 3, 4); if (!o.used) Rc('#ff3b3b', x + 3, y - 16, 2, 2); }
    else if (o.k === 'pulsa') { Rc('rgba(0,0,0,.3)', x - 11, y - 2, 23, 3); Rc(OUT, x - 11, y - 20, 22, 18); Rc('#e8c040', x - 10, y - 19, 20, 16); Rc('#222', x - 8, y - 15, 16, 8); Rc('#fff', x - 7, y - 14, 14, 2); Rc('#c0343a', x - 10, y - 24, 20, 5); Rc('#f2ead0', x - 8, y - 23, 3, 3); Rc('#f2ead0', x - 2, y - 23, 3, 3); Rc('#f2ead0', x + 4, y - 23, 3, 3); }
    else if (o.k === 'halte') { Rc('rgba(0,0,0,.25)', x - 14, y - 2, 29, 3); Rc(OUT, x - 14, y - 26, 29, 4); Rc('#3f7a8a', x - 13, y - 25, 27, 2); Rc('#5a5a62', x - 13, y - 22, 2, 20); Rc('#5a5a62', x + 12, y - 22, 2, 20); Rc('#9fd0e8', x - 11, y - 21, 22, 12); Rc('rgba(255,255,255,.4)', x - 8, y - 21, 3, 12); Rc('#8a5a34', x - 10, y - 8, 20, 3); }
  }
  objs.forEach(o => add(() => inView(o.x, o.y, 30), () => o.y, () => drawObj(o)));
  function tickObjs(dt) { objs.forEach(o => { if (o.cd > 0) o.cd -= dt; if (o.kick > 0) o.kick -= dt; }); }

  /* ================= PENJUAL KELILING ================= */
  const lagu = [
    ['Receh, receh, jangan pelit,', 'Malam kota penuh bisik...'],
    ['Satu lagu buat Abang,', 'Dua lagu buat Kakak!'],
    ['Katanya bank dijaga ketat,', 'Tapi satpam suka ngopi.'],
    ['Lampu kota menyala sendu,', 'Aku nyanyi biar nggak ngantuk.']
  ];
  const tips = ['Pak satpam bank itu jalannya persegi. Hafalkan sudutnya.', 'Kalau ada yang bilang brankas gampang, jangan percaya.', 'Katanya sekring di dinding bawah bisa matiin kamera. Sebentar doang.', 'Jongkok itu bukan malu. Itu strategi.'];
  const roam = [
    { k: 'bakso', row: 13, x0: 3, x1: 52, col: '#e0b84a', name: 'Tukang Bakso', cost: 40, look: { hair: '#222', skin, top: '#c0553f', bot: '#2a3a5a', x: 'cap' } },
    { k: 'nasgor', row: 27, x0: 3, x1: 52, col: '#d9423a', name: 'Tukang Nasi Goreng', cost: 35, look: { hair: '#222', skin, top: '#f2eee6', bot: '#3a3a4a', x: 'cap' } },
    { k: 'ngamen', row: 9, x0: 3, x1: 52, col: '#4a8fc9', name: 'Pengamen', cost: 10, look: { hair: '#4a2a2a', skin, top: '#4b8a5a', bot: '#2a2a3a' } }
  ].map((v, i) => Object.assign(v, { x: rnd(v.x0, v.x1) * T, y: v.row * T + 14, dir: i % 2 ? 1 : -1, stop: 0, nextStop: rnd(8, 16), snd: rnd(1, 3), line: 0 }));
  function tickRoam(dt) {
    roam.forEach(v => {
      v.nextStop -= dt;
      if (v.stop > 0) { v.stop -= dt; if (v.k === 'ngamen' && v.stop > 0) { v.snd -= dt; if (v.snd <= 0) { v.snd = .5; beep(pick([330, 392, 440, 494]), .3, 'triangle', .04, v.x, v.y, 280); if (Math.random() < .35) { v.say = lagu[v.line % lagu.length][Math.random() < .5 ? 0 : 1]; v.sayT = 3; } } } v.sayT = (v.sayT || 0) - dt; return; }
      v.x += v.dir * 15 * dt;
      if (v.x < v.x0 * T) v.dir = 1; if (v.x > v.x1 * T) v.dir = -1;
      v.snd -= dt;
      if (v.snd <= 0) {
        if (v.k === 'bakso') { for (let i = 0; i < 3; i++) later(() => beep(310, .06, 'sine', .08, v.x, v.y, 340), i * 200); v.snd = rnd(4, 7); }
        else if (v.k === 'nasgor') { for (let i = 0; i < 3; i++) later(() => beep(640, .05, 'triangle', .06, v.x, v.y, 320), i * 160); v.snd = rnd(5, 8); }
        else v.snd = rnd(3, 6);
      }
      if (v.nextStop <= 0) { v.stop = rnd(8, 12); v.nextStop = rnd(18, 30); v.line++; v.snd = .3; }
      v.sayT = (v.sayT || 0) - dt;
    });
  }
  roam.forEach(v => add(() => inView(v.x, v.y, 40), () => v.y, () => {
    const x = Math.round(v.x), y = Math.round(v.y), now = performance.now(), walking = v.stop <= 0;
    Rc('rgba(0,0,0,.3)', x - 10, y - 2, 22, 3);
    chibi(x - 6 - (v.k === 'ngamen' ? 0 : 8) * (v.dir > 0 ? -1 : 1), y - 31, v.look, v.dir > 0 ? 'right' : 'left', walking ? (now / 260 | 0) % 2 : 0);
    if (v.k === 'ngamen') { Rc('#8a5a34', x + 2, y - 15, 7, 5); Rc('#f2ead0', x + 8, y - 17, 1, 8); }
    else {
      const cx = x + (v.dir > 0 ? 6 : -22);
      Rc(OUT, cx - 1, y - 16, 18, 12); Rc('#8a5a34', cx, y - 15, 16, 9); Rc(v.col, cx, y - 15, 16, 3);
      Rc('#1a1d24', cx + 2, y - 5, 4, 4); Rc('#1a1d24', cx + 10, y - 5, 4, 4);
      if (v.k === 'bakso') { Rc('#9aa3a8', cx + 3, y - 20, 8, 5); if (walking && (now / 300 | 0) % 2) Rc('#e8ecee', cx + 5, y - 24, 2, 3); }
      else Rc('#cfd2c8', cx + 3, y - 19, 10, 4);
    }
    if (v.sayT > 0 && v.say) words(v.say, x, y - 38, '#f4e5ba', 'bold 6px monospace', 'center');
  }));

  /* ================= ATAP & GORONG-GORONG ================= */
  const keep = officeLayer;
  const rooms = {};
  const mkScene = (key, build) => {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const g = c.getContext('2d'), solid = new Uint8Array(300);
    const P = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const S = (tx, ty, tw, th) => { for (let j = ty; j < ty + th; j++) for (let i = tx; i < tx + tw; i++) solid[j * 20 + i] = 1; };
    const spots = [];
    build({ P, S, spots });
    S(0, 0, 20, 4); S(0, 0, 1, 15); S(19, 0, 1, 15); S(0, 14, 20, 1);
    rooms[key] = { key, layer: c, solid, spots };
  };
  const talkTo = (who, lines) => startStoryBeat(who, lines, saveProgress);

  mkScene('k_roof', ({ P, S, spots }) => {
    P('#0d1230', 0, 0, 320, 64);
    for (let i = 0; i < 40; i++) P(hash(i, 3) % 3 ? '#8a95c4' : '#fff', hash(i, 7) % 320, hash(i, 11) % 40, 1, 1);
    P('#f4ecd8', 262, 8, 14, 14); P('#0d1230', 267, 8, 9, 12);
    for (let x = 0; x < 320; x += 24) { const h = 16 + hash(x, 5) % 30; P('#1a2150', x, 60 - h, 22, h); for (let w = 0; w < h - 6; w += 8) if (hash(x, w) % 3) P('#e0b84a', x + 4 + (w % 16), 60 - h + 4 + w, 3, 3); }
    P('#2a2a34', 0, 56, 320, 8);
    for (let ty = 4; ty < 15; ty++) for (let tx = 0; tx < 20; tx++) P((tx + ty) % 2 ? '#6b6b72' : '#62626a', tx * 16, ty * 16, 16, 16);
    P('#8a8a92', 0, 60, 320, 4); P('#4a4a52', 0, 224, 320, 16); P('#8a8a92', 0, 220, 320, 4); P('#4a4a52', 0, 0, 16, 240); P('#4a4a52', 304, 0, 16, 240);
    const box = (x, y, w, h, c) => { P(OUT, x - 1, y - 1, w + 2, h + 2); P(c, x, y, w, h); P('rgba(255,255,255,.25)', x, y, w, 3); };
    box(64, 96, 48, 32, '#9aa3a8'); P('#444', 70, 104, 14, 14); P('#444', 90, 104, 14, 14); S(4, 6, 3, 2);
    box(208, 100, 48, 32, '#9aa3a8'); P('#444', 214, 108, 14, 14); P('#444', 234, 108, 14, 14); S(13, 6, 3, 2);
    box(256, 150, 32, 48, '#5a6a8a'); P('#3a4a6a', 256, 156, 32, 3); P('#3a4a6a', 256, 170, 32, 3); S(16, 9, 2, 3);
    box(32, 168, 56, 8, '#8a5a34'); P('#5a3a1a', 36, 176, 4, 10); P('#5a3a1a', 80, 176, 4, 10); S(2, 10, 4, 1);
    box(144, 80, 12, 12, '#3a3a42'); P('#c9ced0', 148, 70, 4, 12); P('#c9ced0', 140, 66, 20, 3); S(9, 5, 1, 1);
    P('#9a9aa2', 150, 100, 2, 2);
    P('#3a3a42', 48, 120, 2, 40); P('#3a3a42', 208, 140, 2, 20);
    spots.push(
      { x: 40, y: 206, r: 30, hint: () => '[E] Turun tangga darurat', act: () => exitRoom('k_roof') },
      { x: 152, y: 112, r: 30, hint: () => '[E] Pakai teropong', act: () => talkTo('TEROPONG', ['Dari atap hotel seluruh kota kelihatan. Bank berpilar emas di timur, lampunya menyala.', alarmCount > 0 ? 'Helikopter patroli melintas beberapa kali. Mereka sedang mencari sesuatu.' : 'Kota tenang. Satu-dua polisi patroli di jalan besar.', pick(tips)]) },
      { x: 60, y: 176, r: 30, hint: () => '[E] Duduk di bangku atap', act: () => { wanted = Math.max(0, wanted - 1); talkTo('ATAP', ['Kamu duduk memandang lampu kota. Dari sini nggak ada yang mengejarmu.']); } },
      { x: 72, y: 150, r: 28, hint: () => '[E] Cek jemuran', act: () => toast('Kaos bertuliskan "BUKAN PENCURI". Mencurigakan.') }
    );
  });

  mkScene('k_sewer', ({ P, S, spots }) => {
    for (let ty = 0; ty < 15; ty++) for (let tx = 0; tx < 20; tx++) P((tx + ty) % 2 ? '#2f3a3a' : '#283232', tx * 16, ty * 16, 16, 16);
    for (let y = 0; y < 64; y += 8) for (let x = (y / 8 % 2) * 8; x < 320; x += 16) { P('#3a4848', x, y, 15, 7); P('#202a2a', x, y + 7, 16, 1); }
    P('#1a2020', 0, 56, 320, 8);
    P('#1d4a52', 0, 96, 320, 48); P('#2a6a72', 0, 96, 320, 3);
    S(0, 6, 9, 3); S(11, 6, 9, 3);
    P('#6a5a3a', 144, 96, 32, 48); for (let y = 98; y < 144; y += 8) P('#4a3a22', 144, y, 32, 1);
    for (let i = 0; i < 3; i++) { const lx = 48 + i * 112; P(OUT, lx - 9, 8, 18, 56); P('#5a5a62', lx - 8, 8, 2, 56); P('#5a5a62', lx + 6, 8, 2, 56); for (let y = 12; y < 60; y += 8) P('#8a8a92', lx - 6, y, 12, 2); P('#12161a', lx - 7, 62, 14, 2); }
    P('#3a4848', 16, 200, 24, 8); P(OUT, 224, 176, 32, 22); P('#8a5a34', 225, 177, 30, 20); P('#e0b84a', 238, 183, 4, 6); S(14, 11, 2, 2);
    P('#4a5a5a', 24, 160, 40, 6); P('#4a5a5a', 272, 150, 6, 40); P('#6b727c', 24, 160, 40, 2);
    const names = ['GANG BARAT', 'PASAR TENGAH', 'DEKAT BANK'];
    [0, 1, 2].forEach(i => spots.push({ x: 48 + i * 112, y: 76, r: 26, hint: () => '[E] Naik ke ' + names[i], act: () => exitRoom('k_sewer', i) }));
    spots.push({ x: 240, y: 206, r: 30, hint: () => rooms.k_sewer.stash ? '[E] Periksa peti' : '[E] Buka peti tua', act: () => {
      if (rooms.k_sewer.stash) return toast('Petinya kosong. Tinggal sarang laba-laba.');
      rooms.k_sewer.stash = true; money += 150; saveProgress(); playSound('buy'); talkTo('PETI TUA', ['Di dalam peti tua: gulungan uang lama yang masih laku.', 'Kamu dapat Rp 150. Entah milik siapa.']);
    } });
  });

  const manholes = [spot(8, 9, 's'), spot(26, 23, 's'), spot(52, 23, 's')].map(([x, y]) => ({ x: x * T + 8, y: y * T + 10 }));
  manholes.forEach(m => { lay.fillStyle = '#16181c'; lay.fillRect(m.x - 7, m.y - 5, 14, 10); lay.fillStyle = '#5a5f66'; lay.fillRect(m.x - 6, m.y - 4, 12, 8); lay.fillStyle = '#7a8088'; for (let i = -4; i <= 4; i += 4) lay.fillRect(m.x + i, m.y - 4, 1, 8); });
  const hotelB = buildings.find(b => b.name === 'HOTEL');
  const lx = hotelB.x * T, hBase = (hotelB.y + hotelB.h) * T, lt = hBase - 5 * T;
  lay.fillStyle = '#12161a'; lay.fillRect(lx - 1, lt, 12, 5 * T + 4);
  lay.fillStyle = '#8a8a92'; lay.fillRect(lx + 1, lt + 2, 2, 5 * T); lay.fillRect(lx + 9, lt + 2, 2, 5 * T);
  for (let y = lt + 8; y < hBase; y += 8) { lay.fillStyle = '#aab2b6'; lay.fillRect(lx + 3, y, 6, 2); }
  lay.fillStyle = '#5a5f66'; lay.fillRect(lx - 2, lt - 1, 16, 4);
  const ladder = { x: lx - 4, y: hBase - 2 * T };
  let cur = null, origin = null;
  function toRoom(key, from) {
    const r = rooms[key]; cur = r; origin = from;
    officeLayer = r.layer; office.solid.set(r.solid);
    where = key; player.x = key === 'k_roof' ? 40 : 52 + (from || 0) * 112 - 4; player.y = key === 'k_roof' ? 190 : 82; player.dir = 'down';
    for (const k in keys) delete keys[k]; playSound('door');
  }
  function exitRoom(key, i) {
    officeLayer = keep; office.solid.set(keepSolid());
    cur = null; where = 'city';
    const p = key === 'k_roof' ? { x: ladder.x - 8, y: ladder.y + 12 } : { x: manholes[i].x - 4, y: manholes[i].y + 14 };
    player.x = p.x; player.y = p.y; player.dir = 'down'; playSound('door'); saveProgress();
  }
  const baseSolid = office.solid.slice();
  const keepSolid = () => baseSolid;

  /* ================= PEMASANGAN ================= */
  const inMine = () => where === 'k_roof' || where === 'k_sewer';
  const baseUpdate = update;
  let plen = -1;
  update = function (dt) {
    if (inMine() && scene === 'play') {
      toastT -= dt; updateInteractionEffects(dt); movePlayer(dt);
      footstepTimer -= dt;
      if (player.moving && footstepTimer <= 0) { playSound('step'); footstepTimer = .34; }
      if (wanted > 0) wanted = Math.max(0, wanted - dt * .5);
      hint = ''; target = null;
      const f = feet(); let best = 1e9;
      cur.spots.forEach(s => { const d = dist(s.x, s.y, f.x, f.y); if (d < s.r && d < best) { best = d; target = { k: 'kx', fn: s.act }; hint = s.hint(); } });
      return;
    }
    baseUpdate(dt);
    if (inMine()) { officeLayer = cur.layer; office.solid.set(cur.solid); return; }
    if (where !== 'city' || !live()) return;
    tickTrain(dt); tickGossip(dt); tickPets(dt); tickObjs(dt); tickRoam(dt); tickDrama(dt);
    if (pets.length !== plen) { plen = pets.length; syncPets(); }
    if (scene !== 'play' || target) return;
    const f = feet(); let best = 1e9;
    const offer = (d, r, h, fn) => { if (d < r && d < best) { best = d; target = { k: 'kx', fn }; hint = h; } };
    objs.forEach(o => offer(dist(o.x, o.y - 6, f.x, f.y), kobj[o.k].r, kobj[o.k].h(o), () => kobj[o.k].act(o)));
    offer(dist(kios.x, kios.y - 6, f.x, f.y), 26, '[E] Baca koran & dengar radio', () => { const h = headline(); talkTo('RADIO & KORAN', ['Radio kios: "' + h[0].toLowerCase().replace(/^./, c => c.toUpperCase()) + '..."', h[1]]); });
    offer(dist(ladder.x, ladder.y, f.x, f.y), 26, '[E] Naik tangga darurat hotel', () => toRoom('k_roof'));
    manholes.forEach(m => offer(dist(m.x, m.y, f.x, f.y), 16, '[E] Turun ke gorong-gorong', () => toRoom('k_sewer', manholes.indexOf(m))));
    roam.forEach(v => offer(dist(v.x, v.y - 8, f.x, f.y), 28, v.k === 'ngamen' ? '[E] Beri tip Rp 10' : '[E] Beli ' + (v.k === 'bakso' ? 'bakso' : 'nasi goreng') + ' Rp ' + v.cost, () => buy(v)));
    if (dr.st === 'act') dr.def.cast.map(npcBy).forEach(n => offer(dist(n.x, n.y, f.x, f.y), 30, '[E] Lerai mereka', () => mediate()));
  };
  function buy(v) {
    if (money < v.cost) return talkTo(v.name, ['Waduh, uangmu kurang, Nak.']);
    money -= v.cost; saveProgress(); playSound('buy');
    if (v.k === 'ngamen') return talkTo(v.name, ['Makasih, Bang! Aku kasih satu rahasia gratis.', pick(tips)]);
    wanted = Math.max(0, wanted - 1);
    talkTo(v.name, [v.k === 'bakso' ? 'Bakso panas! Kuahnya bikin lupa polisi.' : 'Nasi goreng spesial, pedasnya jujur.', 'Kamu kenyang dan sedikit lebih tenang.']);
  }
  function mediate() {
    const def = dr.def; if (!def) return;
    money += 30; saveProgress();
    talkTo(def.cast.join(' & '), def.mediate.concat('Kamu dapat Rp 30 sebagai tanda terima kasih.'));
    def.cast.map(npcBy).forEach(n => { emo(n, '♥', 3); n.cd = 0; });
    endDrama();
  }
  const baseInteract = interact;
  interact = function () {
    if (target && target.k === 'kx') return target.fn();
    baseInteract();
  };
  const baseDraw = draw;
  draw = function () {
    interactionEffects = interactionEffects.filter(e => !e.sq);
    if (where === 'city') sq.forEach(s => { if (s.show()) interactionEffects.push({ x: 0, y: s.depth(), life: .001, maxLife: .001, color: '#000', sq: s }); });
    baseDraw();
  };
  const baseFx = drawInteractionEffect;
  drawInteractionEffect = e => e.sq ? e.sq.draw() : baseFx(e);

  const poster = (x, y) => {
    Rc(OUT, x - 1, y - 1, 11, 14); Rc('#f2ead0', x, y, 9, 12);
    Rc('#222', x + 1, y + 1, 7, 2); Rc(skin, x + 2, y + 3, 5, 5); Rc('#222', x + 2, y + 4, 1, 1); Rc('#222', x + 5, y + 4, 1, 1);
    Rc('#222', x + 2, y + 9, 5, 1); Rc('#c0343a', x + 1, y + 10, 7, 1);
  };
  const lamps = props.filter(p => p.k === 'lamp').sort((a, b) => (a.x * 7 + a.y * 3) % 11 - (b.x * 7 + b.y * 3) % 11);
  lamps.forEach((p, i) => add(() => i < [0, 2, 4, 6][Math.min(3, alarmCount)] && inView(p.x * T, p.y * T, 30), () => p.y * T + 16, () => poster(p.x * T + 9, p.y * T - 4)));

  const baseHud = hud;
  let lastK = performance.now();
  hud = function () {
    const now = performance.now(), dt = Math.min(.05, (now - lastK) / 1000); lastK = now;
    if (inMine()) {
      if (cur === rooms.k_roof) {
        for (let i = 0; i < 5; i++) { const sw = Math.sin(now / 600 + i) * 2; Rc(['#c0553f', '#4a8fc9', '#e0b84a', '#4b8a5a', '#f2ead0'][i], 52 + i * 7 + sw, 124 + Math.abs(sw), 5, 9); }
        const t = Math.floor(now / 500) % 2; Rc(t ? '#ff3b3b' : '#5a1a1a', 148, 62, 3, 3);
        if (alarmCount > 0 && (now / 1500 | 0) % 3 === 0) { Rc('rgba(255,255,255,.7)', (now / 20) % 360 - 20, 24, 8, 3); }
      } else {
        for (let i = 0; i < 6; i++) Rc('rgba(160,220,230,.18)', (i * 60 + now / 25) % 340 - 10, 100 + (i % 3) * 14, 24, 2);
        const rx = 80 + (now / 40) % 200; Rc('#5a5a62', rx, 182, 6, 3); Rc('#c9a0a0', rx - 3, 183, 3, 1);
        words('JALAN TIKUS', 160, 172, '#5fd8c0', 'bold 7px monospace', 'center');
      }
    }
    baseHud();
  };
  const baseReset = resetAll;
  resetAll = function () {
    baseReset();
    railRows(false); train.st = 'idle'; train.t = rnd(14, 24); train.gate = 0;
    npcs.forEach(forget); pA = alarmCount; pW = false; pL = false;
    if (dr.def) endDrama();
    objs.forEach(o => { o.used = false; o.cd = 0; }); rooms.k_sewer.stash = false;
    if (inMine() || officeLayer !== keep) { officeLayer = keep; office.solid.set(baseSolid); cur = null; }
  };
  syncPets();
})();