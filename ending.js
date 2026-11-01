(() => {
  const baseFinish = finish, baseUpdate = update, baseDraw = draw, baseReset = resetAll;
  let esc = null;
  const REDUCE = !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const FONT_PX = '8px "Press Start 2P", monospace';

  /* ---------- helper kecil ---------- */
  const R = (c, x, y, w, h) => { ctx.fillStyle = c; ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h)); };
  const rnd = (a, b = 0) => (hash(a | 0, b | 0) % 997) / 997;
  const lerp = (a, b, t) => a + (b - a) * t;
  const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
  const mix = (a, b, t) => {
    const A = hex(a), B = hex(b);
    return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * t).toString(16).padStart(2, '0')).join('');
  };
  function makeLayer(fn) {
    const c = document.createElement('canvas'); c.width = VW; c.height = VH;
    const prev = ctx; ctx = c.getContext('2d');
    try { fn(); } finally { ctx = prev; }
    return c;
  }
  const layers = {};
  const layer = (name, fn) => layers[name] || (layers[name] = makeLayer(fn));

  /* ---------- suara kecil (WebAudio, hanya bila audio aktif) ---------- */
  function tone(fn) {
    if (!soundEnabled || !audioContext) return;
    try { fn(audioContext, audioContext.currentTime); } catch (error) { console.warn('Suara ending gagal:', error); }
  }
  function sirenBlip(vol) {
    if (vol < .04) return;
    tone((A, t) => {
      const o = A.createOscillator(), g = A.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(520, t);
      o.frequency.linearRampToValueAtTime(780, t + .7);
      o.frequency.linearRampToValueAtTime(520, t + 1.4);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(.05 * vol, t + .35);
      g.gain.linearRampToValueAtTime(.0001, t + 1.4);
      o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + 1.45);
    });
  }
  function drip() {
    tone((A, t) => {
      const o = A.createOscillator(), g = A.createGain();
      o.type = 'sine';
      o.frequency.setValueAtTime(980, t);
      o.frequency.exponentialRampToValueAtTime(380, t + .09);
      g.gain.setValueAtTime(.03, t);
      g.gain.exponentialRampToValueAtTime(.0001, t + .12);
      o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + .13);
    });
  }
  function engineHum(vol) {
    tone((A, t) => {
      const o = A.createOscillator(), g = A.createGain();
      o.type = 'sawtooth'; o.frequency.setValueAtTime(52, t);
      g.gain.setValueAtTime(.0001, t);
      g.gain.linearRampToValueAtTime(.012 * vol, t + .5);
      g.gain.linearRampToValueAtTime(.0001, t + 1.6);
      o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + 1.7);
    });
  }

  /* ---------- naskah ---------- */
  function buildSteps() {
    const helped = (sideQuestStep >= 2 ? 1 : 0) + (sideQuest2Step >= 2 ? 1 : 0);
    const bus = [
      'Dulu Ayah punya kios sembako kecil dekat pasar. Tiga puluh tahun ia membuka pintunya sebelum subuh.',
      'Waktu dagangan seret, ia meminjam ke bank itu. Jaminannya sertifikat kios, satu-satunya yang kami punya.',
      'Bunga naik, pembeli makin sepi. Di hari kios disegel, Ayah duduk di trotoar sampai malam tanpa bicara.',
      'Tiga bulan kemudian jantungnya berhenti. Dokter bilang sakitnya sudah lama. Ayah cuma tak mau menambah beban.',
      'Ibu menyusul setahun setelahnya. Biaya rumah sakit menghabiskan semuanya, dan tak ada lagi yang bisa dijual.',
      'Tiga kali aku mengetuk pintu bank itu minta keringanan. Tiga kali pula disuruh datang lagi minggu depan.',
      'Raka satu-satunya yang datang ke pemakaman. Dia yang bilang: kalau dunia tak memberi, jangan cuma berdiri di depan pintunya.',
      'Aku tidak bangga dengan malam ini. Tanganku masih gemetar. Tapi aku sudah terlalu lama jadi orang yang hanya bisa menunggu.',
      'Kalau Ayah tahu, mungkin dia akan marah. Atau mungkin dia hanya akan menungguku pulang sambil menyeduh teh, seperti dulu.'
    ];
    const extra = storyChoice === 'intel'
      ? 'Sari sempat berpesan: kabari aku kalau sudah aman. Mungkin suatu hari, kalau aku sudah berani menoleh ke belakang.'
      : storyChoice === 'solo'
        ? 'Kali ini aku memilih sendirian. Tak ada yang bisa kupercaya, dan tak ada yang perlu kuseret ke dalam masalahku.'
        : null;
    if (extra) bus.push(extra);
    if (helped) bus.push('Semoga warga yang kutolong malam ini tidak ikut dicurigai. Mereka hanya orang baik yang kebetulan bertemu aku.');
    bus.push('Kunci rumah kutinggalkan di bawah pot. Siapa pun yang menemukannya, semoga rumah itu lebih hangat dari saat kutinggal.');

    return [
      { k: 'card', bg: 'sewer', text: '02.47 · GORONG-GORONG', dur: 2.6 },
      { k: 'say', bg: 'sewer', who: 'KAMU', lines: [
        'Tutup got menutup di atas kepalaku. Gelap, lembap, dan bau yang tak mau pergi dari hidung.',
        'Di atas sana sirene dan sepatu berlari. Kalau aku bergerak sekarang, gema langkahku akan sampai ke permukaan.',
        'Tahan napas saat senter lewat. Lalu tunggu sampai sirene benar-benar menghilang.'
      ] },
      { k: 'hide', bg: 'sewer' },
      { k: 'say', bg: 'sewer', who: 'KAMU', lines: [
        'Sunyi. Sirenenya sudah jauh. Tinggal tetesan air dan detak jantungku sendiri.',
        'Tas ini masih di pelukanku. Berat, tapi anehnya tidak terasa seperti menang.',
        'Bus malam terakhir ke luar kota berangkat sebentar lagi. Ada tangga ke terminal di ujung lorong ini.'
      ] },
      { k: 'card', bg: 'terminal', text: '04.20 · TERMINAL ANTAR KOTA', dur: 2.4 },
      { k: 'say', bg: 'terminal', who: 'KAMU', lines: [
        'Terminal masih setengah tidur. Kondektur menguap dan tak melirik tas kumalku.',
        'Tiket sekali jalan, ke kota paling jauh yang masih punya kursi kosong. Kubayar tunai, pakai uang kecil dari saku, bukan dari tas itu.',
        'Bus melaju pelan, meninggalkan lampu-lampu kota yang selama ini kusebut rumah.'
      ] },
      { k: 'card', bg: 'bus', text: 'BUS MALAM · MENUJU KOTA FAJAR', dur: 2.6 },
      { k: 'say', bg: 'bus', who: 'KAMU (DALAM HATI)', lines: bus },
      { k: 'card', bg: 'arrive', text: '05.42 · KOTA FAJAR', dur: 2.6 },
      { k: 'say', bg: 'arrive', who: 'KAMU', lines: [
        'Matahari baru naik. Kota ini berbau roti hangat dan aspal yang masih basah embun.',
        'Tak ada yang mengenaliku di sini. Tak ada poster, tak ada sirene, tak ada yang menunggu di depan pintu.',
        'Di seberang terminal ada kios kecil dengan papan DISEWA. Pintunya mirip pintu kios Ayah dulu.',
        'Aku tak bisa mengembalikan yang sudah hilang. Tapi aku bisa memilih cara memakai sisa malam ini.',
        'Perampok itu tertinggal di bus. Mulai pagi ini, yang turun di Kota Fajar hanyalah anak seorang penjaga kios.',
        'Kulangkahkan kaki ke arah papan itu. Untuk pertama kalinya setelah sekian lama, tak ada yang kukejar dan tak ada yang mengejarku.'
      ] },
      { k: 'end', bg: 'arrive' }
    ];
  }

  /* ---------- alur ---------- */
  function announce(text) { const live = $('live'); if (live) live.textContent = text; }
  function startEsc() {
    police = null;
    for (const key in keys) delete keys[key];
    scene = 'escape';
    esc = {
      steps: buildSteps(), i: 0, t: 0, li: 0, chars: 0, clock: 0, t0: performance.now(),
      fadeA: 1, pending: null, hide: null, keyHold: false, ptrHold: false,
      siren: 1, sirT: .3, dripT: 1, dawn: 0, mcx: 112, mcMove: 0, busT: 0, engT: 0, endT: 0,
      cars: [], carT: 1.2
    };
    enter(0);
  }
  function enter(i) {
    const e = esc; e.i = i; e.t = 0; e.li = 0; e.chars = 0;
    const s = e.steps[i];
    if (s.k === 'hide') {
      const need = 12 + Math.min(alarmCount, 4) * 2;
      e.hide = { prog: 0, need, state: 'idle', wait: 2.2, st: 0, bx: 70, dir: 1, hit: false, flash: 0, msg: '', msgT: 0, breath: 1, gasp: false, px: 212, done: false, doneT: 0 };
    }
    if (s.k === 'card') announce(s.text);
    else if (s.k === 'say') announce(s.who + ': ' + s.lines[0]);
    else if (s.k === 'hide') announce('Tahan napas saat senter lewat, tunggu sirene menjauh.');
    else if (s.k === 'end') announce('Tamat.');
    if (s.k === 'say' && s.bg === 'bus') e.dawn = 0;
    if (s.k === 'say' && s.bg === 'arrive') e.mcx = 56;
    if (s.k === 'say' && s.bg === 'terminal') e.mcx = 112;
  }
  function go(i) {
    const e = esc;
    if (i >= e.steps.length) return done();
    if (e.steps[i].bg !== e.steps[e.i].bg) e.pending = i;
    else enter(i);
  }
  function advance() { go(esc.i + 1); }
  function press() {
    const e = esc;
    if (!e || e.pending !== null || performance.now() - e.t0 < 350) return;
    const s = e.steps[e.i];
    if (s.k === 'say') {
      const line = s.lines[e.li];
      if (e.chars < line.length) { e.chars = line.length; return; }
      if (e.li < s.lines.length - 1) {
        e.li++; e.chars = 0;
        announce(s.who + ': ' + s.lines[e.li]);
      } else advance();
    } else if (s.k === 'end' && e.endT > 2.4) done();
  }
  function done() {
    esc = null;
    baseFinish();
    decorateEnding();
  }
  function decorateEnding() {
    const loud = heistMode === 'loud';
    const helped = (sideQuestStep >= 2 ? 1 : 0) + (sideQuest2Step >= 2 ? 1 : 0);
    const parts = [
      'Bus itu membawamu ke Kota Fajar. Kamu tak menyentuh uang itu selama tiga hari, lalu menyewa kios kecil bertuliskan DISEWA dan mulai hidup yang tak tertulis di poster mana pun.'
    ];
    parts.push(storyChoice === 'intel'
      ? 'Seminggu kemudian, sebuah pesan singkat dari nomor tak dikenal masuk: "Sehat?" Kamu tersenyum untuk pertama kalinya setelah sangat lama.'
      : storyChoice === 'solo'
        ? 'Tak ada yang tahu alamatmu. Itu aman, dan juga sepi.'
        : 'Tak ada yang tahu siapa kamu. Itu aman, dan kadang sepi.');
    if (helped) parts.push('Kamu berharap warga yang pernah kamu bantu tidak pernah ikut terseret.');
    parts.push(loud
      ? 'Berita pagi di kota lama masih membahas alarm yang meraung semalaman.'
      : 'Di kota lama, wajah dan namamu perlahan memudar dari berita.');
    const kicker = document.querySelector('.ending-kicker');
    if (kicker) kicker.textContent = 'EPILOG · KOTA FAJAR';
    let p = $('endingEpilogue');
    if (!p) {
      p = document.createElement('p');
      p.id = 'endingEpilogue'; p.className = 'ending-story';
      p.style.cssText = 'margin-top:-6px;color:#f0d79a;font-style:italic';
      $('endingText').insertAdjacentElement('afterend', p);
    }
    p.textContent = parts.join(' ');
  }

  /* ---------- update ---------- */
  function tickHide(dt) {
    const e = esc, h = e.hide;
    const want = e.keyHold || e.ptrHold;
    if (h.gasp && h.breath > .3) h.gasp = false;
    const holding = want && h.breath > .02 && !h.gasp && !h.done;
    if (want && h.breath <= .02) h.gasp = true;
    h.breath = clamp(h.breath + (holding ? -dt / 3 : dt / 2.2), 0, 1);
    h.msgT = Math.max(0, h.msgT - dt); h.flash = Math.max(0, h.flash - dt);
    if (h.done) { h.doneT += dt; e.siren = Math.max(0, e.siren - dt); if (h.doneT > 1.1 && e.pending === null) advance(); return; }
    if (h.state === 'idle') {
      h.wait -= dt;
      if (h.wait <= 0) { h.state = 'warn'; h.st = 0; }
    } else if (h.state === 'warn') {
      h.st += dt;
      if (h.st >= 1) { h.state = 'sweep'; h.st = 0; h.hit = false; h.dir = Math.random() < .5 ? 1 : -1; }
    } else {
      h.st += dt;
      const p = clamp(h.st / 1.9, 0, 1);
      h.bx = h.dir > 0 ? lerp(70, 300, p) : lerp(300, 70, p);
      if (!holding && !h.hit && Math.abs(h.bx - (h.px + 8)) < 28) {
        h.hit = true; h.prog = Math.max(0, h.prog - 2.5); h.flash = .6;
        h.msg = 'NAPASMU TERDENGAR! -2 DTK'; h.msgT = 1.6; playSound('door');
      }
      if (h.st >= 1.9) { h.state = 'idle'; h.wait = 3 + Math.random() * 2.2; }
    }
    if (!holding) h.prog = Math.min(h.need, h.prog + dt);
    e.siren = clamp(1 - h.prog / h.need, 0, 1);
    if (h.prog >= h.need) { h.done = true; h.msg = ''; announce('Sirene sudah menghilang.'); playSound('success'); }
  }
  function tickEsc(dt) {
    const e = esc; e.clock += dt; e.t += dt;
    const s = e.steps[e.i];
    if (e.pending !== null) {
      e.fadeA = Math.min(1, e.fadeA + dt * 2.8);
      if (e.fadeA >= 1) { const n = e.pending; e.pending = null; enter(n); }
    } else if (e.fadeA > 0) e.fadeA = Math.max(0, e.fadeA - dt * 2.2);
    if (e.pending !== null) return;
    if (s.k === 'card' && e.t >= s.dur) advance();
    else if (s.k === 'say') {
      e.chars = Math.min(s.lines[e.li].length, e.chars + dt * 44);
      if (s.bg === 'bus') e.dawn += (((e.li + (e.chars / s.lines[e.li].length)) / s.lines.length) - e.dawn) * Math.min(1, dt * 2);
    } else if (s.k === 'hide') tickHide(dt);
    else if (s.k === 'end') e.endT += dt;
    if (s.bg === 'bus') {
      e.busT += dt;
      e.engT -= dt;
      if (e.engT <= 0) { engineHum(1); e.engT = 1.6; }
      // mobil dari arah berlawanan: muncul dari kanan, melaju cepat ke kiri
      e.carT -= dt;
      if (e.carT <= 0) {
        e.cars.push({ x: VW + 40, v: 230 + Math.random() * 90, van: Math.random() < .3,
          col: ['#6a8fa8', '#a8604a', '#c9b070', '#7a9a70', '#8a6a9a', '#b8b8c0'][Math.floor(Math.random() * 6)] });
        e.carT = 2.4 + Math.random() * 3.6;
        tone((A, t) => {
          const o = A.createOscillator(), g = A.createGain();
          o.type = 'sawtooth'; o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(70, t + 1.1);
          g.gain.setValueAtTime(.0001, t); g.gain.linearRampToValueAtTime(.018, t + .35); g.gain.linearRampToValueAtTime(.0001, t + 1.1);
          o.connect(g); g.connect(A.destination); o.start(t); o.stop(t + 1.15);
        });
      }
      e.cars.forEach(c => { c.x -= c.v * dt; });
      e.cars = e.cars.filter(c => c.x > -80);
    }
    if ((s.bg === 'terminal' || s.bg === 'arrive') && s.k === 'say') {
      const a0 = s.bg === 'terminal' ? 112 : 56, a1 = s.bg === 'terminal' ? 176 : 206;
      const target = lerp(a0, a1, e.li / Math.max(1, s.lines.length - 1));
      const d = target - e.mcx;
      e.mcMove = Math.abs(d) > .6 ? 1 : 0;
      e.mcx += Math.sign(d) * Math.min(Math.abs(d), dt * 26);
    } else e.mcMove = 0;
    if (s.bg === 'sewer') {
      e.sirT -= dt; e.dripT -= dt;
      if (e.sirT <= 0) { sirenBlip(e.siren); e.sirT = 2.1; }
      if (e.dripT <= 0) { drip(); e.dripT = 1.3 + Math.random() * 1.8; }
    }
  }
  update = function (dt) {
    if (scene === 'escape' && esc) { tickEsc(dt); return; }
    baseUpdate(dt);
  };

  /* ---------- gambar: gorong-gorong ---------- */
  function sewerStatic() {
    R('#060b11', 0, 0, VW, VH);
    for (let y = 0; y < 150; y += 8) {
      const off = ((y / 8) & 1) * 12;
      for (let x = -off; x < VW; x += 24) {
        const n = rnd(x + 1000, y);
        R(n > .7 ? '#1b2a35' : n > .35 ? '#16222c' : '#121c25', x, y, 23, 7);
      }
    }
    for (let i = 0; i < 6; i++) R(`rgba(0,0,0,${.55 - i * .09})`, 0, i * 8, VW, 8);
    R('#2b3d48', 0, 34, VW, 8); R('#3b5260', 0, 34, VW, 2); R('#1a2830', 0, 40, VW, 2);
    for (let x = 30; x < VW; x += 74) { R('#3b4f5b', x, 31, 6, 14); R('#1a2830', x + 1, 33, 1, 1); R('#1a2830', x + 4, 42, 1, 1); }
    for (let i = 0; i < 9; i++) { const x = 90 + i * 27 + rnd(i, 7) * 10; R('#3a2a22', x, 42, 1, 6 + rnd(i, 3) * 18); }
    R('#26323b', 0, 150, VW, 30); R('#3b4a56', 0, 150, VW, 3); R('#141c23', 0, 178, VW, 3);
    for (let i = 0; i < 14; i++) R('#1c2830', rnd(i, 11) * VW, 156 + rnd(i, 5) * 18, 6 + rnd(i, 9) * 14, 1);
    R('#0b2430', 0, 181, VW, 34);
    R('#091016', 0, 215, VW, 25); R('#16232c', 0, 215, VW, 2);
    for (let i = 0; i < 10; i++) R('#101a22', rnd(i, 21) * VW, 222 + rnd(i, 4) * 12, 10 + rnd(i, 8) * 16, 3);
    // tangga
    R('#4b5a63', 50, 6, 2, 144); R('#4b5a63', 62, 6, 2, 144);
    for (let y = 14; y < 148; y += 10) R('#3d4a52', 52, y, 10, 2);
  }
  function drawSewer(e) {
    const h = e.hide, now = e.clock, lvl = e.siren;
    ctx.drawImage(layer('sewer', sewerStatic), 0, 0);
    // air
    for (let i = 0; i < 9; i++) {
      const x = (i * 53 + now * (10 + i * 3)) % (VW + 14) - 14;
      R('#1d4a58', x, 185 + i * 3, 12, 1);
    }
    // tetesan dari pipa
    const dp = (now * .8) % 1;
    if (dp < .9) R('#9fd0e0', 172, 44 + dp * 140, 1, 2);
    else R('#2a6a7c', 169 + (dp - .9) * 30, 184, 5 - (dp - .9) * 30, 1);
    // cahaya dari lubang got
    const flick = REDUCE ? 0 : Math.sin(now * 6) > 0 ? 1 : 0;
    const col = lvl > .05 ? (flick ? '255,50,60' : '70,120,255') : '190,210,235';
    const a = .07 + .11 * lvl;
    ctx.fillStyle = `rgba(${col},${a})`;
    ctx.beginPath(); ctx.moveTo(44, 0); ctx.lineTo(70, 0); ctx.lineTo(118, 152); ctx.lineTo(10, 152); ctx.closePath(); ctx.fill();
    R(`rgba(${col},${a * 1.4})`, 12, 152, 104, 10);
    R(`rgba(${col},${a})`, 28 + Math.sin(now * 2) * 3, 188, 60, 2);
    R('#d8e6f2', 44, 0, 26, 3);
    // senter
    if (h && !h.done) {
      if (h.state === 'warn') {
        if ((now * 6 | 0) % 2 === 0) words('?', 57, 20, '#f0c24b', 'bold 12px monospace', 'center');
        R('rgba(255,250,210,.16)', 50, 0, 14, 6);
      } else if (h.state === 'sweep') {
        ctx.fillStyle = 'rgba(255,250,210,.20)';
        ctx.beginPath(); ctx.moveTo(50, 4); ctx.lineTo(64, 4); ctx.lineTo(h.bx + 34, 174); ctx.lineTo(h.bx - 34, 174); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,235,.16)';
        ctx.beginPath(); ctx.moveTo(54, 4); ctx.lineTo(60, 4); ctx.lineTo(h.bx + 14, 172); ctx.lineTo(h.bx - 14, 172); ctx.closePath(); ctx.fill();
        R('rgba(255,250,210,.22)', h.bx - 32, 150, 64, 24);
      }
    }
    // pemain
    const py = 143, holding = h && !h.done && (e.keyHold || e.ptrHold) && h.breath > .02 && !h.gasp;
    robber(h ? h.px : 212, py + (holding ? 1 : 0), 'left', 0, true, true, equippedSkin);
    if (holding) words('...', (h ? h.px : 212) + 2, py - 4, '#9fd0e0');
    if (h && !h.done && (h.breath < .98 || holding)) {
      R('#000', h.px - 2, py - 11, 20, 4); R(h.gasp ? '#ee6a74' : '#9fd0e0', h.px - 1, py - 10, 18 * h.breath, 2);
    }
    // vignette
    const g = ctx.createRadialGradient(160, 120, 70, 160, 120, 230);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.65)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
    if (h && h.flash > 0) R(`rgba(200,20,30,${h.flash * .35})`, 0, 0, VW, VH);
    // HUD sembunyi
    if (h && e.steps[e.i].k === 'hide') {
      plate('SEMBUNYI SAMPAI AMAN', 4, 4, '#f0e2a0');
      const label = lvl > .66 ? 'DEKAT' : lvl > .33 ? 'MENJAUH' : lvl > .04 ? 'HAMPIR HILANG' : 'HILANG';
      words('SIRENE: ' + label, VW / 2, 18, lvl > .5 ? '#f4a1a7' : lvl > .2 ? '#f0c24b' : '#8fe3a0', 'bold 7px monospace', 'center');
      R('#000', 88, 21, 144, 8);
      R(mix('#ee6a74', '#8fe3a0', h.prog / h.need), 89, 22, 142 * (h.prog / h.need), 6);
      if (h.msgT > 0) plate(h.msg, null, 118, '#f4a1a7');
      if (h.state === 'warn') plate('SENTER! TAHAN NAPAS!', null, VH - 34, '#f0c24b');
      if (!h.done) plate('TAHAN [E] / SENTUH LAYAR = TAHAN NAPAS', null, VH - 18, '#8fd6e8');
      else plate('AMAN... SIRENE SUDAH HILANG', null, VH - 18, '#8fe3a0');
    }
  }

  /* ---------- gambar: terminal ---------- */
  function terminalStatic() {
    R('#0a1020', 0, 0, VW, 150);
    for (let i = 0; i < 40; i++) R(`rgba(255,255,255,${.25 + rnd(i, 2) * .5})`, rnd(i, 1) * VW, 4 + rnd(i, 3) * 34, 1, 1);
    for (let x = 0; x < VW; x += 22) { const hh = 16 + rnd(x, 4) * 30; R('#0e1628', x, 78 - hh, 18, hh + 72); }
    R('#1c2433', 0, 44, VW, 14); R('#2c3850', 0, 44, VW, 2); R('#10151f', 0, 56, VW, 2);
    [34, 150, 270].forEach(x => { R('#252f44', x, 58, 8, 94); R('#111827', x + 6, 58, 2, 94); });
    for (let x = 14; x < VW; x += 44) { R('#ffe9a8', x, 58, 12, 2); R('rgba(255,233,168,.10)', x - 6, 60, 24, 70); }
    R('#191f2c', 0, 152, VW, 88); R('#2a3346', 0, 152, VW, 2);
    for (let x = 0; x < VW; x += 40) R('#bda24a', x + 6, 196, 22, 2);
    R('#3a2f26', 18, 138, 56, 4); R('#2b221b', 22, 142, 3, 12); R('#2b221b', 66, 142, 3, 12);
    R('#0f1320', 8, 64, 34, 26); R('#2c3850', 8, 64, 34, 1);
    // bus
    R('#8e332e', 182, 88, 132, 6);
    R('#b8433c', 182, 92, 132, 54);
    R('#e8e2d0', 182, 128, 132, 3);
    for (let i = 0; i < 6; i++) R(i === 3 ? '#1b1f2b' : '#f3dc8a', 222 + i * 14, 99, 11, 15);
    R('#f3dc8a', 192, 99, 20, 40); R('#1b1f2b', 192, 99, 1, 40); R('#1b1f2b', 211, 99, 1, 40);
    R('#0a0c10', 200, 140, 16, 16); R('#0a0c10', 280, 140, 16, 16);
    R('#3a3f4d', 204, 144, 8, 8); R('#3a3f4d', 284, 144, 8, 8);
    R('#fff3b0', 308, 128, 6, 6); R('rgba(255,243,176,.12)', 270, 120, 50, 30);
    R('#05070b', 230, 92, 54, 6);
  }
  function drawTerminal(e) {
    ctx.drawImage(layer('terminal', terminalStatic), 0, 0);
    words('KOTA FAJAR', 257, 97, '#ffb454', 'bold 6px monospace', 'center');
    words('TERMINAL ANTAR KOTA', 160, 53, '#f0c24b', 'bold 6px monospace', 'center');
    words('04:20', 25, 80, '#8fd6e8', 'bold 7px monospace', 'center');
    const step = e.mcMove ? Math.floor(e.clock * 8) % 2 : 0;
    const bob = e.mcMove ? 0 : Math.round(Math.sin(e.clock * 2) * .6);
    robber(e.mcx, 150 + bob, 'right', step, false, true, equippedSkin);
    const g = ctx.createRadialGradient(160, 130, 90, 160, 130, 240);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.5)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  /* ---------- gambar: bus ---------- */
  // posisi tengah tiap kursi (pemain di kursi pertama)
  const BUS_SEATS = [53, 123, 193, 263], SEAT_TOP = 119;
  function busFrame() {
    // langit-langit + lampu + papan tujuan + rel pegangan
    R('#161d2c', 0, 0, VW, 14); R('#222c40', 0, 12, VW, 2);
    [[26, 76], [214, 80]].forEach(([x, w]) => { R('#0b111d', x - 1, 3, w + 2, 6); R('#efe8cc', x, 4, w, 4); R('#fffbe6', x, 4, w, 1); });
    R('#05070b', 128, 1, 64, 11); R('#2c3850', 128, 1, 64, 1);
    R('#8c98a8', 16, 12, 288, 2); R('#cfd8e3', 16, 12, 288, 1);
    // dinding kiri & kanan
    R('#1b2436', 0, 14, 16, 162); R('#2a364e', 14, 14, 2, 162); R('#10161f', 0, 14, 2, 162);
    R('#1b2436', 304, 14, 16, 162); R('#2a364e', 304, 14, 2, 162); R('#10161f', 318, 14, 2, 162);
    // rangka jendela: atas, 2 tiang pemisah, ambang bawah
    R('#212b40', 16, 14, 288, 6); R('#33405c', 16, 14, 288, 1); R('#0b111d', 16, 20, 288, 2);
    [105, 205].forEach(x => {
      R('#212b40', x, 20, 10, 120); R('#2f3c58', x, 20, 2, 120); R('#0b111d', x + 8, 20, 2, 120);
      R('#0b111d', x - 2, 22, 2, 116); R('#0b111d', x + 10, 22, 2, 116);
    });
    R('#0b111d', 16, 138, 288, 2); R('#2a364e', 16, 140, 288, 6); R('#46556f', 16, 140, 288, 1); R('#151c2b', 16, 146, 288, 1);
    // panel dinding di bawah jendela
    R('#1a2233', 0, 147, VW, 29);
    for (let x = 4; x < VW; x += 12) { R('#131a28', x, 149, 2, 20); R('#222d44', x + 2, 149, 1, 20); }
    R('#0f1520', 0, 170, VW, 6); R('#2a364e', 0, 170, VW, 1);
    // lantai karet bergaris
    R('#121824', 0, 176, VW, 64); R('#1d2638', 0, 176, VW, 2);
    for (let y = 184; y < VH; y += 6) R('#0e131d', 0, y, VW, 2);
    R('#7d6f2a', 0, 206, VW, 2);
    // tiang pegangan vertikal
    R('#6f7b8c', 157, 14, 4, 176); R('#cfd8e3', 157, 14, 1, 176); R('#3a4454', 160, 14, 1, 176);
    R('#0b111d', 153, 188, 12, 3); R('#3a4454', 154, 187, 10, 1);
  }
  // semua kursi (dilihat dari belakang). Digambar SETELAH penumpang supaya mereka terlihat duduk.
  function busSeat() {
    BUS_SEATS.forEach(cx => {
      const x = cx - 14, t = SEAT_TOP;
      R('#0b111d', x - 1, t + 1, 30, 34); R('#0b111d', x + 1, t, 26, 1);        // outline sandaran
      R('#33466a', x, t + 1, 28, 33); R('#4a6290', x + 1, t + 1, 26, 2);       // sandaran + highlight
      R('#2b3b5e', x + 13, t + 4, 2, 26); R('#26355a', x + 1, t + 28, 26, 6);   // jahitan tengah + bayangan bawah
      R('#1b2740', x - 3, t + 10, 3, 26); R('#0b111d', x - 4, t + 10, 1, 26);   // bantalan samping
      R('#1b2740', x + 28, t + 10, 3, 26); R('#0b111d', x + 31, t + 10, 1, 26);
      R('#0b111d', x - 3, t + 35, 34, 2); R('#3a4f78', x - 2, t + 37, 32, 8);   // bibir dudukan
      R('#243252', x - 2, t + 43, 32, 2);
      R('#10151f', x + 11, t + 45, 6, 22); R('#10151f', x + 4, t + 66, 20, 3);  // kaki kursi
      R('rgba(0,0,0,.25)', x - 4, t + 69, 36, 3);                               // bayangan lantai
    });
  }
  // penumpang lain, dilihat dari belakang
  function busPerson(cx, y, dx, hair, top, long) {
    const skin = '#c89a7a';
    R('#0b111d', cx - 11, y + 9, 22, 8); R(top, cx - 10, y + 10, 20, 7);       // bahu
    R(skin, cx - 2 + dx, y + 8, 5, 3);                                         // leher
    R('#0b111d', cx - 7 + dx, y - 1, 15, 12); R(hair, cx - 6 + dx, y, 13, 10); // kepala + rambut
    R(skin, cx - 7 + dx, y + 5, 1, 3); R(skin, cx + 7 + dx, y + 5, 1, 3);      // telinga
    if (long) { R(hair, cx - 7 + dx, y + 8, 3, 7); R(hair, cx + 5 + dx, y + 8, 3, 7); R(hair, cx - 3 + dx, y - 4, 6, 3); }
    else R('rgba(255,255,255,.12)', cx - 4 + dx, y + 1, 5, 1);
  }
  function drawBus(e) {
    // suasana tetap malam; langit hanya sedikit menerang di akhir perjalanan
    const d = clamp(e.dawn, 0, 1) * .4, s = e.busT;
    const top = mix('#050816', '#2e3560', d), bot = mix('#0e1730', '#6a5a86', d);
    ctx.save(); ctx.beginPath(); ctx.rect(16, 20, 288, 120); ctx.clip(); ctx.translate(0, -4);
    for (let i = 0; i < 10; i++) R(mix(top, bot, i / 9), 16, 14 + i * 13.6, 288, 14);
    for (let i = 0; i < 30; i++) R(`rgba(255,255,255,${(.8 - d) * (.3 + rnd(i, 8) * .6)})`, 18 + rnd(i, 1) * 284, 16 + rnd(i, 2) * 40, 1, 1);
    // bulan sabit
    R('#f4ecd8', 262, 24, 9, 9); R(top, 266, 22, 8, 8);
    // gedung kota malam, 3 lapis parallax (jauh = pelan, dekat = cepat)
    const skyline = (speed, spacing, seed, hMin, hVar, wMin, wVar, base, cWall, cWin, winP) => {
      const off = s * speed, first = Math.floor(off / spacing), n = Math.ceil(288 / spacing) + 2;
      for (let i = 0; i < n; i++) {
        const idx = first + i, x = 16 + i * spacing - (off % spacing) - spacing;
        const w = wMin + Math.floor(rnd(idx + seed, 6) * wVar), hh = hMin + Math.floor(rnd(idx + seed, 5) * hVar);
        if (x + w < 16 || x > 304) continue;
        const cx = Math.max(16, x), cw = Math.min(304, x + w) - cx;
        R(cWall, cx, base - hh, cw, hh);
        R('rgba(255,255,255,.06)', cx, base - hh, cw, 1);
        if (rnd(idx + seed, 7) > .6) { const ax = Math.max(16, Math.min(300, x + w / 2)); R(cWall, ax, base - hh - 6, 1, 6); if (Math.floor(s * 1.5 + idx) % 2) R('#ee6a74', ax, base - hh - 7, 1, 1); }
        for (let wy = base - hh + 4; wy < base - 4; wy += 6) for (let wx = 2; wx < w - 3; wx += 5) {
          const px = x + wx; if (px < 16 || px > 301) continue;
          if (rnd(idx * 31 + wx + seed, wy) > winP) R(rnd(idx + wx, wy + 3) > .8 ? '#8fd0ff' : cWin, px, wy, 2, 3);
        }
      }
    };
    skyline(4, 26, 100, 40, 36, 18, 10, 124, mix('#0b1226', '#2a2c4c', d), '#7a6a40', .6);
    skyline(9, 22, 200, 30, 50, 14, 10, 126, mix('#0a1020', '#252844', d), '#d8b85a', .5);
    skyline(16, 28, 300, 22, 52, 16, 12, 128, mix('#070b16', '#1e2038', d), '#f2d27a', .42);
    // pohon / siluet dekat
    for (let k = 0; k < 6; k++) {
      const x = 16 + ((k * 70 - s * 38) % 420 + 420) % 420 - 40;
      if (x < 6 || x > 302) continue;
      const hh = 10 + rnd(k, 9) * 10;
      R('#05080f', x, 130 - hh, 6, hh); R('#05080f', x - 3, 130 - hh + 3, 12, hh - 6);
    }
    // jalan
    R('#10151d', 16, 128, 288, 22); R('#3b4452', 16, 128, 288, 2);
    for (let x = ((-s * 220) % 36 + 36) % 36 - 36; x < 304; x += 36) {
      const a = Math.max(16, x), b = Math.min(304, x + 16);
      if (b > a) R('#cdb85a', a, 140, b - a, 2);
    }
    // mobil dari arah berlawanan (lajur jauh, melaju ke kiri, lampu depan menghadap kiri)
    let flash = 0;
    (e.cars || []).forEach(c => {
      const x = Math.round(c.x), w = c.van ? 34 : 26, top = c.van ? 122 : 125;
      if (x + w < 16 || x - 70 > 304) return;
      ctx.save(); ctx.beginPath(); ctx.rect(16, 14, 288, 136); ctx.clip();
      ctx.fillStyle = 'rgba(255,243,176,.16)';
      ctx.beginPath(); ctx.moveTo(x, 132); ctx.lineTo(x - 70, 124); ctx.lineTo(x - 70, 140); ctx.closePath(); ctx.fill();
      R('rgba(255,243,176,.10)', x - 50, 134, 50, 4);
      R('rgba(0,0,0,.35)', x, 138, w, 2);
      R('#0a0c10', x + 3, 135, 5, 4); R('#0a0c10', x + w - 8, 135, 5, 4);
      R(c.col, x, 129, w, 7);
      R(c.van ? c.col : mix(c.col, '#000000', .35), x + (c.van ? 0 : 6), top, c.van ? w : w - 13, c.van ? 7 : 4);
      R('#9ec8e0', x + (c.van ? 2 : 8), top + 1, c.van ? 6 : 4, 3); R('#9ec8e0', x + (c.van ? 10 : 14), top + 1, c.van ? 6 : 4, 3);
      R('#fff3b0', x - 1, 131, 2, 3); R('#e0343a', x + w - 1, 131, 2, 3);
      ctx.restore();
      flash = Math.max(flash, clamp(1 - Math.abs(x - 90) / 170, 0, 1));
    });
    // tiang listrik + kabel
    const spacing = 120, px0 = (((-s * 120) % spacing) + spacing) % spacing;
    for (let x = px0 - spacing; x < 330; x += spacing) {
      if (x > 14 && x < 304) { R('#04070c', x, 66, 3, 66); R('#04070c', x - 7, 70, 17, 2); }
      for (let wx = 0; wx < spacing; wx += 4) {
        const wxx = x + wx; if (wxx < 16 || wxx > 304) continue;
        const sag = Math.sin(Math.PI * wx / spacing) * 6;
        R('#05080f', wxx, 71 + sag, 4, 1);
      }
    }
    // cahaya lampu mobil berlawanan menyapu kaca jendela
    if (flash > 0) R(`rgba(255,240,190,${.09 * flash})`, 16, 14, 288, 134);
    ctx.restore();
    ctx.drawImage(layer('busFrame', busFrame), 0, 0);
    // pantulan kaca jendela
    R('rgba(255,255,255,.035)', 36, 22, 14, 116); R('rgba(255,255,255,.025)', 54, 22, 5, 116);
    R('rgba(255,255,255,.03)', 140, 22, 12, 116); R('rgba(255,255,255,.03)', 236, 22, 10, 116);
    // penumpang lain (satu tidur, satu duduk diam)
    const sway = Math.round(Math.sin(s * .9) * 1.5);
    busPerson(193, 108 + (sway > 0 ? 1 : 0), sway, '#1d1612', '#5a4a6a', false);
    busPerson(263, 106, 0, '#3b2a4a', '#4a6a5a', true);
    // pemain duduk di kursi paling depan, membelakangi kita dan menatap jendela
    const bump = Math.floor(s * 7) % 5 === 0 ? 1 : 0;
    robber(46, 107 + bump, 'up', 0, false, true, equippedSkin);
    [[53, 107 + bump], [193, 108 + (sway > 0 ? 1 : 0)], [263, 106]].forEach(([cx, y]) => { R('rgba(255,240,190,.20)', cx - 6, y, 13, 11); R('rgba(255,240,190,.35)', cx - 5, y, 11, 1); });
    ctx.drawImage(layer('busSeat', busSeat), 0, 0);
    // papan tujuan LED (berkedip pelan) + tali pegangan bergoyang
    words('KOTA FAJAR', 160, 9, Math.floor(s * 1.4) % 4 ? '#ffb454' : '#c07a20', 'bold 6px monospace', 'center');
    [38, 84, 134, 182, 236, 282].forEach((x, i) => {
      const sw = Math.round(Math.sin(s * 2.2 + i * 1.3) * 1);
      R('#2b3447', x + 1 + sw, 14, 1, 7);
      R('#7aa0c8', x - 2 + sw, 21, 6, 1); R('#7aa0c8', x - 2 + sw, 21, 1, 6);
      R('#7aa0c8', x + 3 + sw, 21, 1, 6); R('#7aa0c8', x - 2 + sw, 26, 6, 1);
    });
    // cahaya lampu kabin
    R('rgba(255,240,190,.05)', 26, 14, 76, 40); R('rgba(255,240,190,.05)', 214, 14, 80, 40);
    // sorot lampu jalan lewat
    const lp = (s % 5) / 5; if (lp < .22) R(`rgba(255,220,150,${.10 * Math.sin(lp / .22 * Math.PI)})`, 0, 0, VW, VH);
    const g = ctx.createRadialGradient(160, 120, 80, 160, 120, 240);
    g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
  }

  /* ---------- gambar: kota baru ---------- */
  function arriveStatic() {
    const top = '#5a5f9a', bot = '#f6b27a';
    for (let i = 0; i < 12; i++) R(mix(top, bot, i / 11), 0, i * 12, VW, 12);
    R('rgba(255,226,168,.25)', 190, 80, 80, 80);
    R('#ffe2a8', 226, 106, 20, 20); R('#ffe2a8', 222, 110, 28, 12);
    for (let i = 0; i < 5; i++) R('rgba(255,210,190,.5)', rnd(i, 40) * 240, 18 + i * 14, 40 + rnd(i, 41) * 50, 3);
    for (let x = 0; x < VW; x += 20) { const hh = 24 + rnd(x, 12) * 44; R('#8a7aa0', x, 150 - hh, 17, hh); }
    for (let x = 6; x < VW; x += 26) {
      const hh = 36 + rnd(x, 13) * 52; R('#3d3558', x, 156 - hh, 22, hh);
      for (let wy = 160 - hh; wy < 150; wy += 7) for (let wx = 3; wx < 20; wx += 6) if (rnd(x + wx, wy) > .62) R('#ffd98a', x + wx, wy, 3, 3);
    }
    R('#3d3558', 120, 40, 10, 116); R('#4a4268', 118, 38, 14, 4); R('#3d3558', 124, 26, 2, 14);
    R('#7a728a', 0, 164, VW, 76); R('#8d8498', 0, 164, VW, 3); R('#6a6278', 0, 200, VW, 3);
    for (let x = 0; x < VW; x += 48) R('#968ca2', x + 8, 214, 28, 2);
    // bus (bagian belakang, kiri)
    R('#8e332e', 0, 116, 78, 5); R('#b8433c', 0, 120, 78, 52); R('#e8e2d0', 0, 154, 78, 3);
    R('#f3dc8a', 8, 126, 12, 14); R('#f3dc8a', 28, 126, 12, 14); R('#f3dc8a', 48, 126, 12, 14);
    R('#2a1214', 62, 126, 12, 40); R('#0a0c10', 14, 166, 16, 16); R('#3a3f4d', 18, 170, 8, 8);
    // kios DISEWA
    R('#6a4a35', 228, 124, 82, 44); R('#3d2a1e', 232, 140, 40, 28);
    for (let i = 0; i < 8; i++) R(i % 2 ? '#e0b84a' : '#c0553f', 224 + i * 11, 116, 11, 10);
    R('#f2ead0', 276, 130, 30, 16); R('#c0343a', 278, 132, 26, 1); R('#c0343a', 278, 143, 26, 1);
    R('#2b1d14', 224, 126, 3, 42); R('#2b1d14', 310, 126, 3, 42);
    // kerikil & burung dara
    for (let i = 0; i < 14; i++) R('#605870', rnd(i, 50) * VW, 176 + rnd(i, 51) * 56, 2, 1);
  }
  function drawArrive(e) {
    ctx.drawImage(layer('arrive', arriveStatic), 0, 0);
    if ((e.clock * 1.4 | 0) % 2 === 0) R('#ff4a4a', 124, 24, 3, 3);
    words('DISEWA', 291, 141, '#c0343a', 'bold 7px monospace', 'center');
    // tukang sapu
    const sweep = Math.sin(e.clock * 3);
    chibi(150, 156, { hair: '#2a2a33', skin: '#c99a76', top: '#4a8fc9', bot: '#2e3a52' }, 'left', sweep > 0 ? 1 : 0);
    R('#6b4f33', 143 + sweep * 2, 160, 1, 14); R('#c9b27a', 140 + sweep * 2, 172, 6, 2);
    // burung dara
    for (let i = 0; i < 3; i++) { const bx = 184 + i * 14 + Math.sin(e.clock + i) * 3; R('#8d8d98', bx, 188 + i * 3, 4, 2); R('#6a6a78', bx + 3, 187 + i * 3, 2, 1); }
    // pemain turun dari bus lalu berjalan ke kios
    robber(e.mcx, 156, 'right', e.mcMove ? Math.floor(e.clock * 8) % 2 : 0, false, true, equippedSkin);
    R('rgba(255,170,100,.08)', 0, 0, VW, VH);
  }

  /* ---------- gambar: overlay ---------- */
  function drawCard(e, s) {
    const a = clamp(Math.min(e.t / .45, (s.dur - e.t) / .45), 0, 1);
    R(`rgba(0,0,0,${.6 * a})`, 0, 94, VW, 40);
    R(`rgba(240,194,75,${.7 * a})`, 0, 94, VW, 1); R(`rgba(240,194,75,${.7 * a})`, 0, 133, VW, 1);
    words(s.text, VW / 2, 118, `rgba(240,226,160,${a})`, FONT_PX, 'center');
  }
  function drawSay(e, s) {
    const y0 = VH - 64;
    ctx.fillStyle = 'rgba(14,20,30,.94)'; ctx.fillRect(8, y0, VW - 16, 56);
    ctx.strokeStyle = '#5fd8c0'; ctx.lineWidth = 1; ctx.strokeRect(8.5, y0 + .5, VW - 17, 55);
    words(s.who, 16, y0 + 12, '#5fd8c0');
    const full = e.chars >= s.lines[e.li].length;
    words(full ? '[E]/TAP lanjut' : '[E]/TAP lewati', VW - 16, y0 + 12, '#8d9bab', 'bold 8px monospace', 'right');
    let left = Math.floor(e.chars);
    wrap(s.lines[e.li], 56).forEach((l, i) => {
      const part = l.slice(0, Math.max(0, left)); left -= l.length + 1;
      if (part) words(part, 16, y0 + 25 + i * 11, '#e8edf2');
    });
  }
  function drawEnd(e) {
    const a = clamp(e.endT / 1.8, 0, 1);
    R(`rgba(0,0,0,${a})`, 0, 0, VW, VH);
    if (e.endT > 1.4) {
      const b = clamp((e.endT - 1.4) / .8, 0, 1);
      words('TAMAT', VW / 2, 108, `rgba(240,226,160,${b})`, '14px "Press Start 2P", monospace', 'center');
      const sub = heistMode === 'loud'
        ? 'Kota lama masih ribut soal alarm semalam.'
        : 'Kota lama masih mencari hantu yang tak pernah mereka lihat.';
      words(sub, VW / 2, 132, `rgba(200,212,222,${b})`, 'bold 7px monospace', 'center');
      if (e.endT > 2.4 && (e.clock * 2 | 0) % 2 === 0) words('[E]/TAP lihat epilog', VW / 2, 190, '#8fd6e8', 'bold 8px monospace', 'center');
    }
  }
  function drawEsc() {
    const e = esc;
    textQueue = [];
    ctx = mainCtx;
    ctx.clearRect(0, 0, VW, VH);
    const s = e.steps[e.i];
    if (s.bg === 'sewer') drawSewer(e);
    else if (s.bg === 'terminal') drawTerminal(e);
    else if (s.bg === 'bus') drawBus(e);
    else drawArrive(e);
    if (s.k === 'card') drawCard(e, s);
    else if (s.k === 'say') drawSay(e, s);
    else if (s.k === 'end') drawEnd(e);
    if (e.fadeA > 0) R(`rgba(0,0,0,${e.fadeA})`, 0, 0, VW, VH);
    renderText();
  }
  draw = function () {
    if (scene === 'escape' && esc) { drawEsc(); return; }
    baseDraw();
  };

  /* ---------- input ---------- */
  const isAct = c => c === 'KeyE' || c === 'Space' || c === 'Enter';
  addEventListener('keydown', ev => {
    if (scene !== 'escape' || !esc || !isAct(ev.code)) return;
    ev.preventDefault();
    const s = esc.steps[esc.i];
    if (s.k === 'hide') esc.keyHold = true;
    else if (!ev.repeat) press();
  });
  addEventListener('keyup', ev => { if (esc && isAct(ev.code)) esc.keyHold = false; });
  addEventListener('blur', () => { if (esc) esc.keyHold = esc.ptrHold = false; });
  $('gameView').addEventListener('pointerdown', ev => {
    if (scene !== 'escape' || !esc || ev.target.closest('button')) return;
    const s = esc.steps[esc.i];
    if (s.k === 'hide') esc.ptrHold = true; else press();
  });
  const release = () => { if (esc) esc.ptrHold = false; };
  addEventListener('pointerup', release); addEventListener('pointercancel', release);

  /* ---------- pasang ---------- */
  finish = function () { if (!esc) startEsc(); };
  resetAll = function () { esc = null; baseReset(); };
})();