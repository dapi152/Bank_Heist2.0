(() => {
  const lines = {
    Raka: ['Akhirnya keluar juga. Kakiku pegel nungguin kamu.', 'Rencananya simpel: bank, brankas, kabur. Justru yang simpel itu yang bahaya.'],
    'Sir Bima': ['Hormat, orang asing! Aku Sir Bima, penjaga trotoar. Gajinya belum cair sejak 2019.', 'Cari bank? Gedung berpilar emas di timur. Aku tidak melihat apa-apa, aku sedang bertugas... tidur.'],
    'Mbah Sakti': ['Hmm... kartumu jelek. Tapi di ujungnya ada uang banyak.', 'Satpam itu jalannya muter-muter terus. Perhatikan polanya, baru melangkah.'],
    Sari: ['Sstt. Satpamnya jalan bolak-balik, polanya bisa ditebak.', 'Tahan Shift buat jongkok. Meja loket itu sahabatmu.', 'Brankasnya nggak selalu di ruangan yang sama. Periksa semuanya.'],
    'Pak Joko': ['Toko udah tutup semua, kecuali yang jual barang... nggak biasa.', 'Anakku bilang aku harus berhenti ngobrol sama orang asing. Dia ada benarnya sih.'],
    'Suster Ayu': ['Kamu pucat banget. Udah makan? Merampok itu butuh tenaga.', 'Kalau luka jangan ke aku ya. Aku nggak lihat apa-apa. Serius.']
  };
  const barks = {
    Raka: ['Psst, sini!', 'Cepetan dikit...', 'Aku laper.'],
    'Sir Bima': ['Demi kehormatan!', 'Siapa di sana?', 'Zzz... eh, jaga.'],
    'Mbah Sakti': ['Firasatku buruk.', 'Bintang berkata...', 'Anak muda...'],
    Sari: ['Sstt.', 'Awas satpam.', '...'],
    'Pak Joko': ['Paketku mana ya.', 'Dingin banget.', 'Aduh, pinggang.'],
    'Suster Ayu': ['Jaga kesehatan!', 'Malam yang sepi.', 'Hati-hati ya.']
  };
  npcs.forEach(n => { if (lines[n.name]) n.lines = lines[n.name]; });

  // ---- npc punya rutinitas sendiri ----
  Object.assign(barks, {
    Dimas: ['Wuuusss!', 'Kejar aku!', 'Layanganku!'],
    'Bu Tini': ['Gorengan! Gorengan!', 'Masih anget lho.', 'Cabe-nya gratis.'],
    'Pak Ujang': ['Kiri dikit... kiri.', 'Terus, terus...', 'Parkir, parkir.']
  });
  const role = {
    Raka: { sp: 20, r: 70, seek: true, greet: ['Nah, itu dia!', 'Sini, sini!'], emo: '♪' },
    'Sir Bima': { sp: 14, r: 40, sleepy: true, greet: ['Hormat padamu!'], emo: '!' },
    'Mbah Sakti': { sp: 11, r: 50, greet: ['Sudah kuduga kamu datang.'], emo: '*' },
    Sari: { sp: 15, r: 50, greet: ['...kamu lagi.'], emo: '?' },
    'Pak Joko': { sp: 18, r: 100, greet: ['Eh, Nak!', 'Malam, Nak.'], emo: '♪' },
    'Suster Ayu': { sp: 16, r: 90, greet: ['Halo! Jaga kesehatan ya.'], emo: '♥' },
    Dimas: { sp: 38, r: 130, greet: ['Kak! Kak!', 'Main yuk!'], emo: '♪' },
    'Bu Tini': { sp: 12, r: 40, greet: ['Gorengan, Kak?'], emo: '♪' },
    'Pak Ujang': { sp: 16, r: 90, greet: ['Parkir, Bang?'], emo: '?' }
  };
  const fear = ['Buronan!', 'Panggil polisi!', 'Jangan mendekat!'];
  const convos = [
    ['Eh, denger nggak? Katanya bank mau dirampok.', 'Ah hoaks. Satpamnya aja suka ketiduran.'],
    ['Malam ini dingin ya.', 'Iya, mending pulang bikin teh.'],
    ['Harga gorengan naik lagi lho.', 'Dunia memang kejam.'],
    ['Tadi kamu lihat orang bertopeng?', 'Paling cuma orang kedinginan.']
  ];
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const okPoint = (x, y) => {
    const tx = Math.floor(x / T), ty = Math.floor(y / T);
    return tx >= 0 && ty >= 0 && tx < city.w && ty < city.h && !city.solid[ty * city.w + tx] && isPedestrianWalkway(x, y);
  };
  const walkable = (x, y) => [[-4, -2], [4, -2], [-4, 3], [4, 3]].every(([a, b]) => okPoint(x + a, y + b));
  const place = (tx, ty) => {
    for (let r = 0; r < 8; r++) for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      const x = (tx + dx) * T + 8, y = (ty + dy) * T + 12;
      if (walkable(x, y)) return [x, y];
    }
    return null;
  };
  [
    { name: 'Dimas', at: [16, 9], look: { hair: '#2b2b2b', skin, top: '#e8c040', bot: '#3a5a9a' },
      lines: ['Kak! Kakak pencuri ya? Keren!', 'Jangan bilang Ibu, aku ngumpet main layangan.'] },
    { name: 'Bu Tini', at: [26, 13], look: { hair: '#4a2a2a', skin, top: '#c0508a', bot: '#5a3a2a' },
      lines: ['Gorengan, gorengan! Masih anget!', 'Dulu bank itu cuma warung. Sekarang gedungnya sombong.'] },
    { name: 'Pak Ujang', at: [40, 12], look: { hair: '#222', skin, top: '#f08030', bot: '#334466', x: 'cap' },
      lines: ['Parkir? Mobilmu nggak ada, ya gratis. Sekali ini aja.', 'Satpam bank galak. Aku pernah ditegur gara-gara bersiul.'] }
  ].forEach(e => {
    const p = place(...e.at);
    if (!p) return;
    npcs.push({ name: e.name, look: e.look, lines: e.lines, x: p[0], y: p[1], hx: p[0], hy: p[1], dir: 'down', t: 0, v: [0, 0], step: 0 });
  });
  const cp = place(12, 23);
  const cat = cp && { x: cp[0], y: cp[1], hx: cp[0], hy: cp[1], dir: 'left', dest: null, wait: 1, sayT: 0, run: false };

  const face = (n, t) => { n.dir = Math.abs(t.x - n.x) > Math.abs(t.y - n.y) ? (t.x > n.x ? 'right' : 'left') : (t.y > n.y ? 'down' : 'up'); };
  const goTo = (n, tx, ty, sp, dt) => {
    const dx = tx - n.x, dy = ty - n.y, m = Math.hypot(dx, dy) || 1, f = feet();
    const nx = n.x + dx / m * sp * dt, ny = n.y + dy / m * sp * dt;
    let moved = false;
    if (walkable(nx, n.y) && Math.hypot(nx - f.x, n.y - f.y) > 10) { n.x = nx; moved = true; }
    if (walkable(n.x, ny) && Math.hypot(n.x - f.x, ny - f.y) > 10) { n.y = ny; moved = true; }
    if (moved) { if (Math.abs(dx) > .5 || Math.abs(dy) > .5) n.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up'); n.step += dt; }
    return moved;
  };
  const say = (n, s, t) => { n.say = s; n.sayT = t || 2.2; };
  const emote = (n, c, t) => { n.emo = c; n.emoT = t || 2; };

  npcStep = function (n, dt) {
    const R = role[n.name] || { sp: 16, r: 80, greet: ['Halo!'], emo: '♪' };
    const f = feet(), d = Math.hypot(n.x - f.x, n.y - f.y);
    n.sayT = (n.sayT || 0) - dt; n.emoT = (n.emoT || 0) - dt; n.wait = (n.wait || 0) - dt;
    n.cd = (n.cd || 0) - dt; n.lookT = (n.lookT || 0) - dt;
    n.gap = (n.gap == null ? 1 + Math.random() * 3 : n.gap) - dt;
    if (n.late > 0 && (n.late -= dt) <= 0) say(n, n.next);
    if (talk && talk.n === n) { face(n, f); return; }
    if (d > 130) n.greeted = false;

    if (wanted > 0 && d < 80) {
      if (!n.scared) { n.scared = true; say(n, pick(fear)); emote(n, '!'); }
      goTo(n, n.x + (n.x - f.x), n.y + (n.y - f.y), 38, dt);
      n.sleep = false; n.chatT = 0; n.dest = null;
      return;
    }
    n.scared = false;

    if (n.chatT > 0) { n.chatT -= dt; if (n.partner) face(n, n.partner); return; }
    if (n.sleep) {
      if (d > 36) { emote(n, 'z', 1); return; }
      n.sleep = false; n.wait = 1.5; say(n, 'Hah?! Aku nggak tidur!'); emote(n, '!', 1.2);
    }
    if (d < 48 && !n.greeted) {
      n.greeted = true; n.dest = null; n.wait = 1.4; face(n, f);
      say(n, pick(R.greet)); emote(n, R.emo);
    }
    if (n.gap <= 0 && d < 90 && !(n.sayT > 0) && barks[n.name]) { say(n, pick(barks[n.name])); n.gap = 6 + Math.random() * 6; }
    if (d < 26) { face(n, f); return; }

    if (n.cd <= 0) for (const m of npcs) {
      if (m === n || m.cd > 0 || m.chatT > 0 || m.scared || m.sleep || Math.hypot(m.x - n.x, m.y - n.y) > 24) continue;
      const c = pick(convos);
      say(n, c[0]); m.late = 2.3; m.next = c[1];
      n.chatT = m.chatT = 5; n.partner = m; m.partner = n; n.cd = m.cd = 25; n.dest = m.dest = null;
      face(n, m); face(m, n);
      return;
    }

    if (n.wait > 0) {
      if (n.lookT <= 0) { n.lookT = .7 + Math.random() * 1.2; if (Math.random() < .5) n.dir = pick(['up', 'down', 'left', 'right']); }
      return;
    }
    if (R.seek && missionStep <= 1 && d > 34 && d < 170) n.dest = { x: f.x, y: f.y };
    if (!n.dest) {
      if (R.sleepy && Math.random() < .5) { n.sleep = true; n.dir = 'down'; return; }
      const a = Math.random() * 6.28, r = 20 + Math.random() * R.r;
      n.dest = { x: n.hx + Math.cos(a) * r, y: n.hy + Math.sin(a) * r * .6 };
    }
    if (Math.hypot(n.dest.x - n.x, n.dest.y - n.y) < 3 || !goTo(n, n.dest.x, n.dest.y, R.sp, dt)) {
      n.dest = null; n.wait = 1 + Math.random() * 3;
      if (Math.random() < .3) emote(n, R.emo, 1.6);
    }
  };

  function stepCat(dt) {
    const f = feet(), d = Math.hypot(cat.x - f.x, cat.y - f.y);
    cat.sayT -= dt; cat.wait -= dt; cat.run = false;
    if (d < 34) {
      if (cat.sayT <= 0 && Math.random() < dt * 2) { cat.say = 'Meong!'; cat.sayT = 1.4; }
      cat.run = goTo(cat, cat.x + (cat.x - f.x), cat.y + (cat.y - f.y), 60, dt);
    } else if (cat.wait <= 0) {
      if (!cat.dest) { const a = Math.random() * 6.28, r = 15 + Math.random() * 50; cat.dest = { x: cat.hx + Math.cos(a) * r, y: cat.hy + Math.sin(a) * r * .6 }; }
      if (Math.hypot(cat.dest.x - cat.x, cat.dest.y - cat.y) < 2) { cat.dest = null; cat.wait = 2 + Math.random() * 4; }
      else if (!(cat.run = goTo(cat, cat.dest.x, cat.dest.y, 18, dt))) cat.dest = null;
    }
  }
  function drawLife(now, dt) {
    if (where !== 'city') return;
    npcs.forEach(n => {
      if (!(n.emoT > 0) || scene === 'talk') return;
      const ch = n.emo === 'z' ? ['z', 'zZ', 'zZZ'][Math.floor(now / 500) % 3] : n.emo;
      const col = { '!': '#ee6a74', '♥': '#ff8fb0', z: '#9fb4ff' }[n.emo] || '#f0c24b';
      words(ch, Math.round(n.x - cam.x) + 6, Math.round(n.y - cam.y - 22 - Math.sin(now / 180) * 1.5), col, 'bold 9px monospace', 'left');
    });
    if (!cat) return;
    if (scene === 'play') stepCat(dt);
    const x = Math.round(cat.x - cam.x), y = Math.round(cat.y - cam.y), l = cat.dir === 'left', fr = cat.run && Math.floor(now / 120) % 2;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x - 4, y + 1, 9, 2);
    ctx.fillStyle = '#d98a3d'; ctx.fillRect(x - 3, y - 4, 7, 5);
    ctx.fillRect(l ? x - 5 : x + 2, y - 7, 4, 4);
    ctx.fillRect(l ? x - 5 : x + 4, y - 9, 1, 2); ctx.fillRect(l ? x - 2 : x + 1, y - 9, 1, 2);
    ctx.fillRect(l ? x + 4 : x - 5, y - 5 - (Math.sin(now / 160) > 0 ? 1 : 0), 2, 4);
    ctx.fillStyle = '#7a4a1e'; ctx.fillRect(x - 3, y, 2, 1 + (fr ? 1 : 0)); ctx.fillRect(x + 2, y, 2, 2 - (fr ? 1 : 0));
    ctx.fillStyle = '#141a24'; ctx.fillRect(l ? x - 4 : x + 4, y - 6, 1, 1);
    if (cat.sayT > 0 && scene !== 'talk') words(cat.say, x, y - 13, '#fff', 'bold 7px monospace', 'center');
  }

  const bits = [];
  let shake = 0, lastT = performance.now();
  const view = $('gameView');
  const burst = (x, y, col, n) => {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * 6.28, s = 20 + Math.random() * 50;
      bits.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 25, l: .5 + Math.random() * .5, col });
    }
  };

  const baseCaught = caught;
  caught = function (text) { shake = .5; baseCaught(text); };
  const baseWin = win;
  win = function () { baseWin(); burst(player.x + 4, player.y, '#f0c24b', 40); };

  // musik: bass + arpeggio, makin cepat kalau lagi panas
  const chords = [[220, 261.6, 329.6], [174.6, 220, 261.6], [196, 246.9, 293.7], [164.8, 207.7, 246.9]];
  startMusic = function () {
    if (!audioContext || musicNodes.length) return;
    const bus = audioContext.createGain();
    bus.gain.value = 1; bus.connect(audioContext.destination);
    musicNodes.push(bus);
    const note = (f, len, type, vol) => {
      const t = audioContext.currentTime, o = audioContext.createOscillator(), g = audioContext.createGain();
      o.type = type; o.frequency.value = f;
      g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.0008, t + len);
      o.connect(g); g.connect(bus); o.start(t); o.stop(t + len + .02);
    };
    let s = 0;
    const step = () => {
      if (!audioContext || !musicNodes.length) return;
      const c = chords[Math.floor(s / 8) % 4];
      if (s % 2 === 0) note(c[0] / 2, .28, 'triangle', .03);
      if (s % 4 !== 3) note(c[[0, 1, 2, 1][s % 4]] * 2, .12, 'square', .008);
      s++;
      musicTimer = setTimeout(step, wanted > 0 || suspicion > .4 ? 140 : 230);
    };
    step();
  };

  const goal = () => {
    if (where !== 'city') return null;
    if (missionStep === 0) return npcs[0];
    if (missionStep === 2) return doorOf(shopB);
    if (missionStep === 3) return doorOf(bankB);
    if (missionStep === 5 && hasLoot) return hideout;
    return null;
  };

  function overlay() {
    const now = performance.now(), dt = Math.min(.05, (now - lastT) / 1000);
    lastT = now;
    const play = scene === 'play';

    if (where === 'city') {
      ctx.fillStyle = 'rgba(6,10,28,.22)'; ctx.fillRect(0, 0, VW, VH);
      ctx.globalCompositeOperation = 'lighter';
      props.forEach(p => {
        if (p.k !== 'lamp') return;
        const sx = p.x * T + 8 - cam.x, sy = p.y * T - 6 - cam.y;
        if (sx < -40 || sx > VW + 40 || sy < -40 || sy > VH + 40) return;
        const g = ctx.createRadialGradient(sx, sy, 2, sx, sy, 34);
        g.addColorStop(0, 'rgba(255,200,90,.28)'); g.addColorStop(1, 'rgba(255,200,90,0)');
        ctx.fillStyle = g; ctx.fillRect(sx - 34, sy - 34, 68, 68);
      });
      ctx.globalCompositeOperation = 'source-over';
    }

    // vignette, jadi merah kalau penjaga curiga
    const red = where === 'bank' ? suspicion : 0;
    const vg = ctx.createRadialGradient(VW / 2, VH / 2, 80, VW / 2, VH / 2, 210);
    vg.addColorStop(0, 'rgba(0,0,0,0)');
    vg.addColorStop(1, red > .05 ? `rgba(120,0,10,${.25 + red * .5})` : 'rgba(0,0,0,.5)');
    ctx.fillStyle = vg; ctx.fillRect(0, 0, VW, VH);

    // lampu sirine di tepi layar saat jadi buronan
    if (where === 'city' && wanted > 0 && play) {
      const left = Math.sin(now / 170) > 0;
      ctx.fillStyle = left ? 'rgba(230,40,60,.22)' : 'rgba(50,90,255,.22)';
      ctx.fillRect(left ? 0 : VW - 8, 0, 8, VH);
    }

    if (play && player.moving && (where === 'city' || where === 'bank') && Math.random() < dt * 14 && !crouching()) {
      bits.push({ x: player.x + 4, y: player.y + 12, vx: (Math.random() - .5) * 10, vy: -6 - Math.random() * 6, l: .35, col: 'rgba(200,200,190,.5)' });
    }
    for (let i = bits.length - 1; i >= 0; i--) {
      const b = bits[i];
      b.l -= dt; b.x += b.vx * dt; b.y += b.vy * dt; b.vy += 60 * dt;
      if (b.l <= 0) { bits.splice(i, 1); continue; }
      ctx.fillStyle = b.col; ctx.fillRect(Math.round(b.x - cam.x), Math.round(b.y - cam.y), 2, 2);
    }

    if (where === 'city') npcs.forEach(n => {
      if (!(n.sayT > 0) || scene === 'talk') return;
      const w = n.say.length * 4.4 + 8, sx = Math.round(n.x - cam.x), sy = Math.round(n.y - cam.y - 28);
      ctx.fillStyle = 'rgba(14,20,30,.88)'; ctx.fillRect(sx - w / 2, sy - 9, w, 12);
      ctx.fillRect(sx - 1, sy + 3, 3, 2);
      words(n.say, sx, sy, '#e8edf2', 'bold 7px monospace', 'center');
    });

    drawLife(now, dt);

    const g = goal();
    if (g && play) {
      const sx = g.x - cam.x, sy = g.y - cam.y;
      const inside = sx > 14 && sx < VW - 14 && sy > 24 && sy < VH - 14;
      ctx.save();
      if (inside) { ctx.translate(sx, sy - 24 + Math.sin(now / 220) * 2); ctx.rotate(Math.PI / 2); }
      else {
        const a = Math.atan2(sy - VH / 2, sx - VW / 2);
        ctx.translate(clamp(VW / 2 + Math.cos(a) * 400, 14, VW - 14), clamp(VH / 2 + Math.sin(a) * 400, 14, VH - 14));
        ctx.rotate(a);
      }
      ctx.fillStyle = '#f0c24b'; ctx.strokeStyle = OUT; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(8, 0); ctx.lineTo(-6, -6); ctx.lineTo(-6, 6); ctx.closePath();
      ctx.stroke(); ctx.fill();
      ctx.restore();
    }

    if (shake > 0) {
      shake -= dt;
      view.style.translate = `${(Math.random() - .5) * 10}px ${(Math.random() - .5) * 10}px`;
    } else if (view.style.translate) view.style.translate = '';
  }

  const baseHud = hud;
  hud = function () { overlay(); baseHud(); };
})();

/* kota: tiap gedung punya wajah sendiri + detail jalan dan taman */
(() => {
  const baseDraw = drawBuilding;
  const look = {
    TOKO: { roof: '#3e6b66', wall: '#e3cf9a', awn: '#c0553f' },
    HOTEL: { roof: '#2f3a63', wall: '#c9b99a', awn: '#7a2f3a' },
    KAFE: { roof: '#8a4a35', wall: '#ecd9b4', awn: '#2f7a70' },
    KANTOR: { roof: '#4a5560', wall: '#7fa4c0', awn: '#2d3446' },
    BUKU: { roof: '#4d3325', wall: '#7a5640', awn: '#3f7a45' },
    APOTEK: { roof: '#cfd6d8', wall: '#eef1ec', awn: '#2f9a6a' },
    RUMAH: { roof: '#a8523f', wall: '#e0cba0', awn: '#3e6b66' },
    PASAR: { roof: '#d9a93a', wall: '#c8a878', awn: '#c0553f' },
    BIOSKOP: { roof: '#2a2238', wall: '#3a2f4d', awn: '#e0b84a' }
  };
  buildings.forEach(b => Object.assign(b, look[b.name]));
  const pal = ['#c0553f', '#e0b84a', '#4b8a5a', '#4a8fc9', '#a8523f'];

  drawBuilding = function (b) {
    if (b.bank) return baseDraw(b);
    const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T, fy = y + h - 48, dx = x + w / 2, rh = fy - y, n = b.name;
    const R = (c, a, d, e, f) => { ctx.fillStyle = c; ctx.fillRect(a, d, e, f); };
    const win = (wx, wy, ww, wh) => {
      R(OUT, wx - 1, wy - 1, ww + 2, wh + 2);
      R(hash(wx, wy) % 3 ? '#35506a' : '#e5c978', wx, wy, ww, wh);
      R('rgba(255,255,255,.3)', wx + ww - 3, wy, 2, wh);
    };
    const stripes = (a, d, ww, hh, c1, c2) => { for (let i = 0; i < ww; i += 6) R(i % 12 ? c2 : c1, a + i, d, Math.min(6, ww - i), hh); };
    const nearDoor = (wx, ww) => Math.abs(wx + ww / 2 - dx) < 14 + ww / 2;

    R('rgba(0,0,0,.22)', x + 4, y + h, w, 5); R(OUT, x - 1, y - 1, w + 2, h + 2);
    R(b.roof, x, y, w, rh);
    if (n === 'PASAR') stripes(x, y, w, rh, '#c0553f', '#f2ead0');
    else if (n === 'RUMAH' || n === 'BUKU' || n === 'TOKO' || n === 'KAFE') {
      for (let r = y + 7, i = 0; r < fy - 2; r += 7, i++) {
        R('rgba(0,0,0,.18)', x, r, w, 1);
        for (let c = x + (i % 2) * 6; c < x + w; c += 12) R('rgba(0,0,0,.18)', c, r - 7, 1, 7);
      }
      R('rgba(255,255,255,.16)', x, y + rh / 2 - 1, w, 2);
      if (n === 'RUMAH') { R(OUT, x + w - 14, y + 4, 8, 14); R('#8a5a4a', x + w - 13, y + 5, 6, 12); }
    } else {
      R('rgba(255,255,255,.2)', x, y, w, 3);
      if (n === 'BIOSKOP') for (let i = 6; i < w - 6; i += 12) R(hash(i, y) % 2 ? '#f0c24b' : '#ee6a74', x + i, y + rh / 2, 4, 4);
      else { R('#9aa3a8', x + 8, y + 8, 12, 8); R('#6b747a', x + 8, y + 14, 12, 2); R('#9aa3a8', x + w - 22, y + 8, 12, 8); R('#6b747a', x + w - 22, y + 14, 12, 2); }
      if (n === 'KANTOR') { R(OUT, dx, y - 10, 2, 12); R('#ee6a74', dx - 1, y - 12, 4, 3); }
    }
    R('rgba(0,0,0,.35)', x, fy - 2, w, 3);
    R(b.wall, x, fy + 1, w, 47);

    if (n === 'TOKO') {
      for (let wx = x + 6; wx + 18 < x + w - 4; wx += 24) {
        if (nearDoor(wx, 18)) continue;
        R(OUT, wx - 1, fy + 11, 20, 22); R('#5a8fa0', wx, fy + 12, 18, 20);
        for (let k = 0; k < 3; k++) R(pal[hash(wx, k) % 5], wx + 2 + k * 5, fy + 24, 4, 6);
      }
      stripes(x, fy + 6, w, 6, b.awn, '#f2ead0'); R('rgba(0,0,0,.25)', x, fy + 12, w, 1);
    } else if (n === 'HOTEL') {
      for (const row of [fy + 5, fy + 22]) for (let wx = x + 8; wx + 8 < x + w - 12; wx += 14) {
        if (row > fy + 20 && nearDoor(wx, 8)) continue;
        win(wx, row, 8, 10);
        if (row < fy + 20) R('#5a4938', wx - 2, row + 11, 12, 2);
      }
      R(OUT, x + w - 10, fy + 2, 7, 22); R('#ee6a74', x + w - 9, fy + 3, 5, 20);
      R('#fff', x + w - 8, fy + 6, 1, 12); R('#fff', x + w - 5, fy + 6, 1, 12); R('#fff', x + w - 8, fy + 11, 4, 1);
      R('#a8323a', dx - 6, y + h, 12, 4);
    } else if (n === 'KAFE') {
      for (const [a, e] of [[x + 6, dx - 12], [dx + 12, x + w - 6]]) {
        R(OUT, a - 1, fy + 14, e - a + 2, 20); R('#e5c978', a, fy + 15, e - a, 18);
        R('rgba(0,0,0,.35)', a + 3, fy + 26, 4, 5); R('rgba(0,0,0,.35)', a + 10, fy + 24, 4, 7);
      }
      stripes(x, fy + 5, w, 6, b.awn, '#f2ead0');
      for (let i = 0; i < w; i += 6) R(i % 12 ? '#f2ead0' : b.awn, x + i, fy + 11, 6, 2);
      for (const px of [dx - 14, dx + 9]) { R('#6a4a3a', px, y + h - 6, 5, 5); R('#3e8a4a', px - 1, y + h - 12, 7, 7); }
    } else if (n === 'KANTOR') {
      R('#6f95b3', x + 2, fy + 3, w - 4, 40);
      for (let c = x + 14; c < x + w - 2; c += 12) R('#2d3446', c, fy + 3, 1, 40);
      R('#2d3446', x + 2, fy + 15, w - 4, 1); R('#2d3446', x + 2, fy + 27, w - 4, 1);
      R('rgba(255,255,255,.2)', x + 6, fy + 3, 8, 40); R('rgba(255,255,255,.2)', x + w / 2 + 6, fy + 3, 5, 40);
      for (let c = x + 4; c < x + w - 10; c += 12) if (hash(c, y) % 3 === 0) R('#e5c978', c, fy + 17 + (hash(y, c) % 2) * 12, 9, 9);
      R('#2d3446', dx - 14, y + h - 24, 28, 3);
    } else if (n === 'BUKU') {
      for (let r = 8; r < 47; r += 8) R('rgba(0,0,0,.2)', x, fy + r, w, 1);
      for (let wx = x + 6; wx + 16 < x + w - 4; wx += 22) {
        if (nearDoor(wx, 16)) continue;
        R(OUT, wx - 1, fy + 10, 18, 24); R('#2b1f17', wx, fy + 11, 16, 22);
        for (const sy of [fy + 17, fy + 27]) { R('#a8794f', wx, sy + 5, 16, 1); for (let i = 0; i < 6; i++) R(pal[hash(wx + i, sy) % 5], wx + 1 + i * 2.5, sy, 2, 5); }
      }
      stripes(x, fy + 4, w, 5, b.awn, '#d9e8c8');
    } else if (n === 'APOTEK') {
      for (let wx = x + 6; wx + 14 < x + w - 18; wx += 20) {
        if (nearDoor(wx, 14)) continue;
        R(OUT, wx - 1, fy + 9, 16, 24); R('#9ad0d8', wx, fy + 10, 14, 22); R('rgba(255,255,255,.4)', wx + 9, fy + 10, 2, 22);
        R('#2f9a6a', wx + 3, fy + 22, 4, 4);
      }
      const cx = x + w - 14;
      R(OUT, cx - 3, fy + 5, 14, 16); R('#2f9a6a', cx + 2, fy + 6, 4, 14); R('#2f9a6a', cx - 2, fy + 11, 12, 4);
      stripes(x, fy + 2, w - 18, 4, b.awn, '#fff');
    } else if (n === 'RUMAH') {
      for (const wx of [x + 6, x + w - 18]) {
        win(wx, fy + 10, 12, 14);
        R('#3f7a45', wx - 4, fy + 9, 3, 16); R('#3f7a45', wx + 13, fy + 9, 3, 16);
        R('#6a4a3a', wx - 1, fy + 25, 14, 3);
        for (let i = 0; i < 4; i++) R(i % 2 ? '#ff8fb0' : '#f0c24b', wx + i * 3, fy + 23, 2, 2);
      }
      R('#b9b9b0', dx - 10, y + h, 20, 3);
    } else if (n === 'PASAR') {
      R('#3a2f25', x + 2, fy + 8, w - 4, 20); R('#7a5a3a', x + 2, fy + 28, w - 4, 10);
      for (let wx = x + 4; wx < x + w - 8; wx += 10) { R('#5a3f28', wx, fy + 21, 9, 7); R(pal[hash(wx, 5) % 5], wx + 1, fy + 19, 7, 4); }
      stripes(x - 2, fy, w + 4, 8, '#c0553f', '#f2ead0');
      for (let i = 0; i < w; i += 8) R(hash(i, y) % 2 ? '#ffe08a' : '#ffb347', x + i, fy + 10, 2, 2);
    } else if (n === 'BIOSKOP') {
      for (let wx = x + 5; wx + 12 < x + w - 4; wx += 16) {
        if (nearDoor(wx, 12)) continue;
        R(OUT, wx - 1, fy + 14, 14, 20); R(pal[hash(wx, 9) % 5], wx, fy + 15, 12, 18); R('rgba(255,255,255,.4)', wx + 2, fy + 18, 8, 3); R('rgba(0,0,0,.35)', wx + 2, fy + 25, 8, 5);
      }
      const mw = Math.min(w - 10, 56);
      R(OUT, dx - mw / 2 - 1, fy + 2, mw + 2, 10); R('#7a2f3a', dx - mw / 2, fy + 3, mw, 8);
      for (let i = 0; i < mw; i += 4) R(hash(i, x) % 2 ? '#fff2bf' : '#ee6a74', dx - mw / 2 + i, fy + 3, 2, 2);
    }

    R(OUT, dx - 7, y + h - 19, 14, 19);
    R(n === 'BIOSKOP' ? '#7a2f3a' : n === 'APOTEK' ? '#9ad0d8' : n === 'RUMAH' ? '#7a4a2e' : '#4a3322', dx - 6, y + h - 18, 12, 18);
    R('#e0b84a', dx + 3, y + h - 9, 2, 2);
    R(b.awn, dx - 11, y + h - 23, 22, 5);
    for (let s = dx - 11; s < dx + 11; s += 6) R('rgba(255,255,255,.35)', s, y + h - 23, 3, 5);
    ctx.font = 'bold 9px monospace';
    const sw = ctx.measureText(n).width + 8;
    R(OUT, dx - sw / 2 - 1, fy - 17, sw + 2, 16);
    R(n === 'APOTEK' ? '#2f9a6a' : n === 'PASAR' ? '#7a2f3a' : '#2d3446', dx - sw / 2, fy - 16, sw, 14);
    placeLabels.push({ s: n, x: dx, y: fy - 5, color: '#e8edf2', font: 'bold 9px monospace', align: 'center' });
  };

  // detail tanah: bunga, batu, genangan, tutup got
  function decorate() {
    const c = cityLayer.getContext('2d');
    const dot = (col, a, b, w, h) => { c.fillStyle = col; c.fillRect(a, b, w, h); };
    for (let ty = 0; ty < city.h; ty++) for (let tx = 0; tx < city.w; tx++) {
      if (city.solid[ty * city.w + tx]) continue;
      const x = tx * T, y = ty * T, g = ground(tx, ty), h = hash(tx * 7, ty * 13) % 100;
      if (g === 'g') {
        if (h < 6) { const col = ['#ff8fb0', '#f4ecd8', '#f0c24b', '#c79bf0'][h % 4]; dot('#4e8a4a', x + 6, y + 9, 1, 3); dot(col, x + 5, y + 7, 3, 3); dot(col, x + 10, y + 11, 2, 2); }
        else if (h < 9) { dot('#8a8f8a', x + 4, y + 10, 4, 3); dot('#b0b5b0', x + 4, y + 10, 4, 1); }
      } else if (g === 'r' && !isCrosswalkPoint(x + 8, y + 8)) {
        if (h < 3) { dot('#5f7a8c', x + 3, y + 6, 9, 3); dot('#8fb4c4', x + 5, y + 6, 3, 1); }
        else if (h < 5) { dot('#4a4e42', x + 4, y + 4, 8, 8); dot('#737865', x + 5, y + 5, 6, 6); dot('#4a4e42', x + 7, y + 5, 1, 6); dot('#4a4e42', x + 5, y + 8, 6, 1); }
        else if (h < 9) dot('rgba(0,0,0,.18)', x + h, y + 3, 5, 1);
      } else if (g === 's') {
        if (h < 4) dot('#7d7e62', x + 5, y + 5, 2, 2);
        else if (h < 7) { dot('#b8863f', x + 8, y + 9, 3, 2); dot('#8a5a2a', x + 9, y + 10, 1, 1); }
      }
    }
  }
  placeLabels.length = 0;
  buildCity();
  decorate();
})();

/* isi dalam gedung: hotel, toko buku, apotek, pasar, bioskop */
(() => {
  const keepLayer = officeLayer, keepSolid = office.solid.slice();
  const rooms = {}, keys_ = new Set();
  let cur = null, boost = 0, lastR = performance.now();
  const pal = ['#c0553f', '#e0b84a', '#4b8a5a', '#4a8fc9', '#a8523f', '#7a5aa8', '#e8dcc0'];
  const inRoom = () => keys_.has(where);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const crate = (P, x, y, w, h, c, top) => { P(OUT, x - 1, y - 1, w + 2, h + 2); P(c, x, y, w, h); P(top, x, y, w, 3); };
  const plant = (P, x, y) => { P('#6a4a3a', x + 2, y + 8, 12, 8); P('#3e8a4a', x, y - 2, 16, 12); P('#5aa860', x + 3, y, 5, 4); };
  const folk = (hair, top, bot) => ({ hair, skin, top, bot });
  const talkTo = (who, lines) => startStoryBeat(who, lines, saveProgress);
  const pay = (cost, who, ok) => {
    if (money < cost) { talkTo(who, ['Waduh, uangmu kurang. Rp ' + cost + ' ya.']); return; }
    money -= cost; playSound('buy'); saveProgress();
    talkTo(who, ok);
  };

  function makeRoom(name, o, deco) {
    const c = document.createElement('canvas'); c.width = 320; c.height = 240;
    const g = c.getContext('2d'), solid = new Uint8Array(300);
    const P = (col, x, y, w, h) => { g.fillStyle = col; g.fillRect(x, y, w, h); };
    const S = (tx, ty, tw, th) => { for (let j = ty; j < ty + th; j++) for (let i = tx; i < tx + tw; i++) solid[j * 20 + i] = 1; };
    for (let ty = 4; ty < 15; ty++) for (let tx = 0; tx < 20; tx++) o.floor(P, tx, ty);
    P(o.wall, 0, 0, 320, 64); P(o.trim, 0, 56, 320, 8); P('rgba(0,0,0,.28)', 0, 64, 320, 6);
    P(o.wall, 0, 0, 16, 240); P(o.wall, 304, 0, 16, 240); P(o.wall, 0, 224, 144, 16); P(o.wall, 176, 224, 144, 16);
    P('#3a2a1c', 144, 224, 32, 16); P('rgba(255,235,170,.18)', 144, 208, 32, 16);
    S(0, 0, 20, 4); S(0, 0, 1, 15); S(19, 0, 1, 15); S(0, 14, 9, 1); S(11, 14, 9, 1);
    const spots = [], folks = [];
    deco({ P, S, spots, folks });
    rooms[name] = { key: 'r_' + name, name, layer: c, solid, spots, folks };
    keys_.add('r_' + name);
  }

  makeRoom('HOTEL', { floor: (P, x, y) => P((x + y) % 2 ? '#d8cfc0' : '#c9bfae', x * 16, y * 16, 16, 16), wall: '#5a2f3a', trim: '#e0b84a' }, ({ P, S, spots, folks }) => {
    P('#8a2a38', 128, 160, 64, 64); P('#e0b84a', 128, 160, 64, 2); P('#e0b84a', 128, 160, 2, 64); P('#e0b84a', 190, 160, 2, 64);
    crate(P, 96, 96, 128, 32, '#6a4a30', '#8a6a48'); P('#e0b84a', 150, 91, 6, 4); S(6, 6, 8, 2);
    P('#3a2530', 112, 14, 96, 36);
    for (let i = 0; i < 8; i++) { P('#e0b84a', 118 + i * 11, 22, 3, 6); P('#e0b84a', 118 + i * 11, 36, 3, 6); }
    P('#aaa8a0', 240, 10, 48, 50); P('#777', 264, 10, 1, 50); P('#ee6a74', 262, 5, 4, 3);
    P(OUT, 24, 10, 64, 42); P('#2a7a9a', 25, 11, 62, 40); P('#f08030', 36, 24, 6, 3); P('#f08030', 60, 34, 6, 3); P('#f4ecd8', 48, 40, 5, 2);
    crate(P, 32, 144, 64, 24, '#7a2f3a', '#9a4a55'); S(2, 9, 4, 2); P('#6a4a30', 48, 176, 32, 8);
    crate(P, 240, 168, 32, 20, '#3a5a8a', '#5a7aaa'); S(15, 10, 2, 2);
    plant(P, 16, 64); plant(P, 288, 64); S(1, 4, 1, 1); S(18, 4, 1, 1);
    spots.push(
      { x: 160, y: 134, r: 36, hint: () => '[E] Sewa kamar Rp 300', act: () => {
        if (money < 300) { talkTo('Resepsionis', ['Kamar terakhir Rp 300, Kak.', 'Tidur di lobi juga Rp 300. Prinsip kami: semua ada harganya.']); return; }
        money -= 300; wanted = 0; alarmCount = Math.max(0, alarmCount - 1); playSound('buy'); saveProgress();
        talkTo('Resepsionis', ['Satu kamar untuk tamu misterius. Tanpa tanya-tanya, itu layanan kami.', 'Kamu tidur nyenyak. Polisi lupa wajahmu dan kota sedikit lebih tenang.']);
      } },
      { x: 264, y: 76, r: 28, hint: () => '[E] Pakai lift', act: () => toast('Lift: SEDANG RUSAK sejak 2019.') },
      { x: 56, y: 76, r: 28, hint: () => '[E] Lihat ikan', act: () => toast('Ikan badut menatapmu. Dia tahu rencanamu.') }
    );
    folks.push({ x: 160, y: 92, dir: 'down', look: folk('#2a1a1a', '#7a2f3a', '#222') }, { x: 64, y: 162, dir: 'down', look: folk('#b9bac4', '#3a5a8a', '#222') },
      { x: 200, y: 200, dir: 'right', x0: 140, x1: 260, sp: 16, look: folk('#222', '#e0b84a', '#4a2f2f') });
  });

  makeRoom('BUKU', { floor: (P, x, y) => { P('#8a5f3c', x * 16, y * 16, 16, 16); P('#7a5232', x * 16, y * 16 + 15, 16, 1); P('#7a5232', x * 16 + (y % 2 ? 4 : 11), y * 16, 1, 15); }, wall: '#3a2418', trim: '#6b4a35' }, ({ P, S, spots, folks }) => {
    const books = (x, y, w, rows) => { for (let r = 0; r < rows; r++) { P('#5a3a28', x, y + r * 18 + 14, w, 3); for (let b = x + 2; b < x + w - 2; b += 3) P(pal[hash(b, y + r) % 7], b, y + r * 18 + 1 + hash(b, r) % 3, 2, 13); } };
    P('#4a3022', 16, 6, 288, 52); books(18, 6, 284, 3);
    for (const bx of [32, 112]) { P(OUT, bx - 1, 79, 34, 114); P('#4a3022', bx, 80, 32, 112); books(bx + 1, 82, 30, 6); }
    S(2, 5, 2, 7); S(7, 5, 2, 7);
    crate(P, 208, 80, 80, 32, '#7a5a3a', '#a87a4a'); S(13, 5, 5, 2);
    crate(P, 224, 160, 64, 28, '#7a5a3a', '#a87a4a'); S(14, 10, 4, 2); P('#f0c24b', 240, 152, 6, 8);
    P('#5a2f3a', 96, 200, 128, 20); plant(P, 288, 196); S(18, 12, 1, 1);
    spots.push(
      { x: 248, y: 120, r: 34, hint: () => '[E] Ngobrol dengan kasir', act: () => talkTo('Pak Pustaka', ['Buku di sini nggak boleh dicoret. Kecuali sandi, itu seni.', 'Kalau mau belajar, baca di meja. Gratis. Kami bukan bank.']) },
      { x: 256, y: 198, r: 32, hint: () => '[E] Baca buku di meja', act: () => talkTo('Buku', [pick(['"Pola Satpam untuk Pemula": jalannya selalu persegi. Cari celah di tikungan.', '"Seni Berjongkok": tahan Shift, jarak pandang penjaga turun hampir setengah.', '"Kode Brankas 101": 1-26 huruf besar, -1 sampai -26 huruf kecil, 0 spasi.', '"Bank Kota": brankasnya pindah ruangan tiap malam. Periksa semua ruangan.'])]) },
      { x: 90, y: 160, r: 30, hint: () => '[E] Cari buku', act: () => toast(pick(['"Memasak dengan Cinta": halaman 3 sobek.', '"Kucing Bijak": sampulnya bergigi.', '"Panduan Jadi Kaya": cuma satu halaman, isinya "kerja".'])) }
    );
    folks.push({ x: 248, y: 78, dir: 'down', look: folk('#3a2a1a', '#3f7a45', '#222') }, { x: 90, y: 200, dir: 'right', x0: 70, x1: 170, sp: 12, look: folk('#e8821f', '#4a8fc9', '#223') });
  });

  makeRoom('APOTEK', { floor: (P, x, y) => P((x + y) % 2 ? '#e8f0ea' : '#d4e4da', x * 16, y * 16, 16, 16), wall: '#cfe8dc', trim: '#2f9a6a' }, ({ P, S, spots, folks }) => {
    P('#b8d4c8', 16, 6, 288, 50);
    for (const row of [10, 32]) for (let x = 20; x < 300; x += 7) { P(pal[hash(x, row) % 7], x, row, 4, 10); P('#fff', x, row, 4, 2); }
    P('#2f9a6a', 156, 12, 8, 24); P('#2f9a6a', 148, 20, 24, 8);
    crate(P, 64, 112, 192, 28, '#9ad0d8', '#fff'); S(4, 7, 12, 2);
    crate(P, 32, 176, 64, 14, '#2a5a8a', '#4a7aaa'); S(2, 11, 4, 1);
    crate(P, 256, 176, 16, 20, '#c9ced0', '#e8edf0'); S(16, 11, 1, 1);
    plant(P, 16, 64); plant(P, 288, 64); S(1, 4, 1, 1); S(18, 4, 1, 1);
    spots.push(
      { x: 160, y: 152, r: 40, hint: () => '[E] Beli P3K Rp 120', act: () => {
        if (money >= 120) wanted = Math.max(0, wanted - 2);
        pay(120, 'Apoteker', ['Satu P3K. Kalau luka karena "jatuh", kami nggak tanya jatuh dari mana.', 'Wajahmu terasa lebih santai. Polisi sedikit lupa.']);
      } },
      { x: 264, y: 206, r: 26, hint: () => '[E] Timbang badan', act: () => toast('Berat badan: 58 kg. Berat dosa: tidak terukur.') }
    );
    folks.push({ x: 160, y: 108, dir: 'down', look: folk('#2a1a1a', '#f2f4f8', '#2f9a6a') }, { x: 56, y: 184, dir: 'right', look: folk('#b9bac4', '#8a4a6a', '#333') },
      { x: 200, y: 214, dir: 'left', x0: 110, x1: 240, sp: 13, look: folk('#e8821f', '#4a8fc9', '#223') });
  });

  makeRoom('PASAR', { floor: (P, x, y) => P((x * 3 + y * 5) % 7 ? '#9a8c70' : '#8a7c60', x * 16, y * 16, 16, 16), wall: '#7a6a52', trim: '#c0553f' }, ({ P, S, spots, folks }) => {
    for (let i = 0; i < 320; i += 12) P(i % 24 ? '#f2ead0' : '#c0553f', i, 0, 12, 30);
    for (let i = 0; i < 320; i += 10) P(hash(i, 3) % 2 ? '#ffe08a' : '#ffb347', i, 34 + (i % 20 ? 3 : 0), 3, 3);
    const stall = (x, w, tops) => { crate(P, x, 96, w, 32, '#7a5a3a', '#a87a4a'); for (let i = 0; i < w - 6; i += 9) { P(tops[(i / 9 | 0) % tops.length], x + 3 + i, 100, 7, 6); P('rgba(255,255,255,.3)', x + 3 + i, 100, 7, 2); } };
    stall(32, 80, ['#4b8a5a', '#c0553f', '#6ab05a']); stall(128, 80, ['#f08030', '#c0343a', '#f0d040']); stall(224, 64, ['#9fc4d8', '#c9dde8']);
    S(2, 6, 5, 2); S(8, 6, 5, 2); S(14, 6, 4, 2);
    crate(P, 16, 192, 32, 32, '#8a6a42', '#a8844f'); S(1, 12, 2, 2); crate(P, 256, 192, 32, 32, '#5a4a38', '#7a6a52'); S(16, 12, 2, 2);
    spots.push(
      { x: 72, y: 138, r: 36, hint: () => '[E] Ngobrol dengan Bu Sayur', act: () => talkTo('Bu Sayur', ['Bayam, kangkung, wortel! Segar langsung dari kebun belakang rumah.', 'Dengar-dengar bank buka 24 jam. Uangnya nggak pernah istirahat, kayak saya.']) },
      { x: 168, y: 138, r: 36, hint: () => '[E] Beli gorengan Rp 60', act: () => { if (money >= 60) boost = 40; pay(60, 'Pak Gorengan', ['Gorengan panas! Rasanya bikin kakimu ringan.', 'Kamu lari lebih kencang beberapa saat.']); } },
      { x: 256, y: 138, r: 34, hint: () => '[E] Tanya Pak Ikan', act: () => talkTo('Pak Ikan', ['Ikan ini segar. Kalau tidak, saya tidak akan tersenyum.', 'Katanya kemarin ada yang beli kepala ikan buat kode rahasia. Dunia aneh.']) }
    );
    folks.push({ x: 72, y: 92, dir: 'down', look: folk('#4a2a2a', '#4b8a5a', '#333') }, { x: 168, y: 92, dir: 'down', look: folk('#222', '#f08030', '#334') }, { x: 256, y: 92, dir: 'down', look: folk('#b9bac4', '#4a8fc9', '#223') },
      { x: 90, y: 176, dir: 'right', x0: 50, x1: 240, sp: 15, look: folk('#e8821f', '#c0508a', '#5a3a2a') }, { x: 220, y: 200, dir: 'left', x0: 80, x1: 230, sp: 11, look: folk('#2b2b2b', '#e8c040', '#3a5a9a') });
  });

  makeRoom('BIOSKOP', { floor: (P, x, y) => P((x + y) % 2 ? '#4a1a28' : '#561f30', x * 16, y * 16, 16, 16), wall: '#1f1a2e', trim: '#e0b84a' }, ({ P, S, spots, folks }) => {
    P(OUT, 60, 4, 200, 56); P('#101018', 64, 8, 192, 50); P('#8a1a2a', 64, 8, 12, 50); P('#8a1a2a', 244, 8, 12, 50);
    for (const px of [20, 272]) { P(OUT, px - 1, 13, 30, 42); P(pal[hash(px, 1) % 5], px, 14, 28, 40); P('rgba(255,255,255,.4)', px + 4, 20, 20, 4); }
    for (const ty of [6, 8, 10]) for (const tx of [2, 3, 4, 5, 6, 7, 12, 13, 14, 15, 16, 17]) {
      P(OUT, tx * 16, ty * 16 + 1, 16, 15); P('#7a1f2c', tx * 16 + 1, ty * 16 + 5, 14, 10); P('#9a2a3a', tx * 16 + 1, ty * 16 + 2, 14, 5);
    }
    S(2, 6, 6, 1); S(12, 6, 6, 1); S(2, 8, 6, 1); S(12, 8, 6, 1); S(2, 10, 6, 1); S(12, 10, 6, 1);
    crate(P, 16, 192, 64, 24, '#7a5a3a', '#a87a4a'); S(1, 12, 4, 2);
    P('#ee6a74', 24, 170, 18, 20); P('#fff', 26, 172, 14, 4); P('#f0c24b', 28, 162, 10, 8);
    spots.push(
      { x: 160, y: 150, r: 34, hint: () => '[E] Nonton film Rp 100', act: () => { if (money >= 100) boost = 25; pay(100, 'LAYAR', ['Lampu padam. Film aksi tentang perampok bank dimulai.', 'Tokoh utamanya ketahuan karena nggak jongkok. Kamu mencatat dalam hati.', 'Film selesai. Kamu merasa lebih pintar dan sedikit lebih segar.']); } },
      { x: 96, y: 206, r: 34, hint: () => '[E] Beli popcorn Rp 40', act: () => pay(40, 'Penjual', ['Popcorn karamel! Jangan makan di dalam bank, bunyinya bikin satpam curiga.']) }
    );
    folks.push({ x: 48, y: 188, dir: 'down', look: folk('#2a1a1a', '#ee6a74', '#222') }, { x: 56, y: 122, dir: 'up', look: folk('#8a4b3a', '#4a8fc9', '#222') },
      { x: 220, y: 122, dir: 'up', look: folk('#222', '#e0b84a', '#222') }, { x: 208, y: 154, dir: 'up', look: folk('#b9bac4', '#8a4a6a', '#222') });
  });

  const restore = () => { officeLayer = keepLayer; office.solid.set(keepSolid); cur = null; };
  function enter(name) {
    const r = rooms[name];
    cur = r; officeLayer = r.layer; office.solid.set(r.solid);
    where = r.key; player.x = 9 * T + 8; player.y = 11 * T; player.dir = 'up';
    for (const k in keys) delete keys[k];
    playSound('door');
  }
  function leave() {
    const d = doorOf(buildings.find(b => b.name === cur.name));
    restore(); where = 'city'; player.x = d.x - 4; player.y = d.y - 4; player.dir = 'down';
    playSound('door'); saveProgress();
  }

  const baseMove = movePlayer;
  movePlayer = function (dt) { if (boost > 0) boost -= dt; baseMove(boost > 0 ? dt * 1.3 : dt); };

  const baseInteract = interact;
  interact = function () {
    if (target && target.k === 'door' && rooms[target.b.name]) return enter(target.b.name);
    if (target && target.k === 'rx') return target.spot ? target.spot.act() : leave();
    baseInteract();
  };

  const baseUpdate = update;
  update = function (dt) {
    if (!inRoom() && officeLayer !== keepLayer) restore();
    if (!inRoom() || scene !== 'play') {
      baseUpdate(dt);
      if (scene === 'play' && target && target.k === 'door' && rooms[target.b.name]) hint = '[E] Masuk ' + target.b.name.toLowerCase();
      return;
    }
    toastT -= dt; updateInteractionEffects(dt);
    movePlayer(dt);
    footstepTimer -= dt;
    if (player.moving && footstepTimer <= 0) { playSound('step'); footstepTimer = .34; }
    if (wanted > 0) wanted = Math.max(0, wanted - dt * .5);
    hint = ''; target = null;
    const f = feet();
    if (Math.hypot(160 - f.x, 224 - f.y) < 22) { target = { k: 'rx' }; hint = '[E] Keluar'; return; }
    let best = 1e9;
    cur.spots.forEach(s => {
      const d = Math.hypot(s.x - f.x, s.y - f.y);
      if (d < s.r && d < best) { best = d; target = { k: 'rx', spot: s }; hint = s.hint(); }
    });
  };

  function roomsOverlay() {
    const now = performance.now(), dt = Math.min(.05, (now - lastR) / 1000);
    lastR = now;
    if (boost > 0 && scene === 'play') {
      ctx.fillStyle = OUT; ctx.fillRect(6, VH - 40, 42, 8);
      ctx.fillStyle = '#f0c24b'; ctx.fillRect(7, VH - 39, Math.min(40, boost), 6);
    }
    if (!inRoom()) return;
    if (cur.name === 'BIOSKOP') {
      for (let i = 0; i < 6; i++) {
        ctx.fillStyle = `hsl(${(now / 30 + i * 45) % 360},55%,${28 + ((now / 260 + i) % 3 | 0) * 8}%)`;
        ctx.fillRect(76 + i * 28, 12, 28, 42);
      }
      ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(76 + (now / 40) % 150, 20, 14, 14);
    }
    cur.folks.forEach(fk => {
      if (fk.sp && scene === 'play') {
        fk.x += (fk.dir === 'right' ? 1 : -1) * fk.sp * dt;
        if (fk.x > fk.x1) fk.dir = 'left'; else if (fk.x < fk.x0) fk.dir = 'right';
      }
      chibi(Math.round(fk.x - 6), Math.round(fk.y - 16), fk.look, fk.dir, fk.sp ? Math.floor(now / 160) % 2 : 0);
    });
  }
  const baseHud = hud;
  hud = function () { roomsOverlay(); baseHud(); };
})();