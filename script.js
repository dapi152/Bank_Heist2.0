const levels = [
  [[1,-12,-1,-18,-13]],
  [[2,-18,-1,-14,-11,-1,-19]],
  [[2,-21,-19,0,13,-1,-12,-1,-13]]
];
const REWARD = 50000000, MAX_LIVES = 3;

const $ = id => document.getElementById(id);
const cv = $('c'), mainCtx = cv.getContext('2d');
const textCanvas = $('text'), textCtx = textCanvas.getContext('2d');
let ctx = mainCtx;
const T = 16, VW = 320, VH = 240, OUT = '#141a24';
let textQueue = [], placeLabels = [];
function resizeTextCanvas() {
  const rect = cv.getBoundingClientRect(), dpr = window.devicePixelRatio || 1;
  textCanvas.width = Math.round(rect.width * dpr);
  textCanvas.height = Math.round(rect.height * dpr);
}
window.addEventListener('resize', resizeTextCanvas);
resizeTextCanvas();
const rp = n => 'Rp ' + new Intl.NumberFormat('id-ID').format(Math.round(n));
const hash = (x, y) => ((x * 73856093) ^ (y * 19349663)) >>> 0;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const SAVE_KEY = 'bank-heist-save-v1';
const STATS_KEY = 'bank-heist-stats-v1';
const ENDING_TITLES = ['MATA-MATA KOTA', 'SERIGALA SENDIRIAN', 'HANTU SENYAP', 'AKSI BESAR', 'PERAMPOK PROFESIONAL', 'KABUR TIPIS!'];
const seenEndings = new Set();
try {
  JSON.parse(localStorage.getItem(STATS_KEY) || '[]').forEach(title => { if (ENDING_TITLES.includes(title)) seenEndings.add(title); });
} catch (error) { console.warn('Stats could not be loaded:', error); }
function recordEnding(title) {
  const isNew = !seenEndings.has(title);
  seenEndings.add(title);
  try { localStorage.setItem(STATS_KEY, JSON.stringify(Array.from(seenEndings))); }
  catch (error) { console.warn('Stats could not be saved:', error); }
  return isNew;
}
function saveProgress() {
  let saveWhere = where, saveX = player.x, saveY = player.y;
  if (typeof where === 'string' && where.startsWith('r_')) {
    const building = buildings.find(item => 'r_' + item.name === where);
    saveWhere = 'city';
    if (building) { const door = doorOf(building); saveX = door.x - 4; saveY = door.y - 4; }
  }
  const data = {
    version: 2,
    where: ['home', 'city', 'shop', 'cafe', 'office', 'bank'].includes(saveWhere) ? saveWhere : 'home',
    x: saveX, y: saveY, money, missionStep, wanted,
    inventory, vaultOpen, hasLoot, soundEnabled, sideQuestStep, sideQuest2Step, alarmCount,
    equippedSkin, ownedSkins: Array.from(ownedSkins), storyChoice, heistMode, vaultRoom
  };
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    hasSaveData = true;
  } catch (error) {
    console.warn('Progress could not be saved:', error);
    if (!saveProgress.warned) { saveProgress.warned = true; toast('Progres gagal disimpan di browser.'); }
  }
}
function startMusic() {
  if (!audioContext || musicNodes.length) return;
  const notes = [110, 130.81, 98, 146.83];
  [0, 1].forEach((voice, index) => {
    const oscillator = audioContext.createOscillator(), gain = audioContext.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[index];
    gain.gain.value = index === 0 ? .008 : .004;
    oscillator.connect(gain); gain.connect(audioContext.destination);
    oscillator.start();
    musicNodes.push(oscillator, gain);
  });
  musicTimer = setInterval(() => {
    if (!audioContext || !musicNodes.length) return;
    musicStep = (musicStep + 1) % notes.length;
    musicNodes[0].frequency.setTargetAtTime(notes[musicStep], audioContext.currentTime, .8);
    musicNodes[2].frequency.setTargetAtTime(notes[(musicStep + 2) % notes.length] * 1.5, audioContext.currentTime, 1);
  }, 2600);
}
function stopMusic() {
  musicRun++;
  if (musicTimer) { clearInterval(musicTimer); clearTimeout(musicTimer); }
  musicTimer = null;
  musicNodes.forEach(node => {
    if (typeof node.stop === 'function') {
      try { node.stop(); } catch (error) { if (error.name !== 'InvalidStateError') console.warn('Audio node could not stop:', error); }
    }
    node.disconnect();
  });
  musicNodes = [];
}
function loadProgress() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) { hasSaveData = false; return; }
    const data = JSON.parse(raw);
    hasSaveData = true;
    if (!data || typeof data !== 'object') throw new Error('Save data is not an object');
    if (['home', 'city', 'shop', 'cafe', 'office', 'bank'].includes(data.where)) where = data.where;
    if (Number.isFinite(data.x) && Number.isFinite(data.y)) {
      player.x = clamp(data.x, 0, (world().w - 1) * T);
      player.y = clamp(data.y, 0, (world().h - 1) * T);
    }
    if (Number.isFinite(data.money)) money = Math.max(0, data.money);
    if (Number.isInteger(data.missionStep)) missionStep = clamp(data.missionStep, 0, missionObjectives.length);
    if (Number.isFinite(data.wanted)) wanted = clamp(data.wanted, 0, 5);
    if (Number.isInteger(data.sideQuestStep)) sideQuestStep = clamp(data.sideQuestStep, 0, 3);
    if (Number.isInteger(data.sideQuest2Step)) sideQuest2Step = clamp(data.sideQuest2Step, 0, 2);
    if (Number.isInteger(data.alarmCount)) alarmCount = Math.max(0, data.alarmCount);
    if (['intel', 'solo'].includes(data.storyChoice)) storyChoice = data.storyChoice;
    if (['stealth', 'loud'].includes(data.heistMode)) heistMode = data.heistMode;
    if (data.inventory && typeof data.inventory === 'object') {
      inventory.lockpick = data.inventory.lockpick === true;
      inventory.disguise = data.inventory.disguise === true;
      inventory.smoke = data.inventory.smoke === true;
      inventory.diversion = data.inventory.diversion === true;
    }
    vaultOpen = data.vaultOpen === true;
    hasLoot = data.hasLoot === true;
    if (Number.isInteger(data.vaultRoom) && data.vaultRoom >= 0 && data.vaultRoom < 4 && data.vaultRoom !== vaultRoom) { vaultRoom = data.vaultRoom; if (typeof buildBank === 'function') { try { buildBank(true); } catch (e) { console.warn(e); } } }
    if (missionStep === 5 && !hasLoot) missionStep = missionObjectives.length;
    else if (missionStep === 4 && hasLoot && where !== 'bank') missionStep = 5;
    if (typeof data.soundEnabled === 'boolean') soundEnabled = data.soundEnabled;
    if (Array.isArray(data.ownedSkins)) {
      ownedSkins.clear(); ownedSkins.add('classic');
      data.ownedSkins.filter(id => playerSkins.some(skin => skin.id === id)).forEach(id => ownedSkins.add(id));
    }
    if (ownedSkins.has(data.equippedSkin)) equippedSkin = data.equippedSkin;
  } catch (error) {
    hasSaveData = false;
    console.warn('Saved progress could not be loaded:', error);
    try { localStorage.removeItem(SAVE_KEY); }
    catch (storageError) { console.warn('Corrupt progress could not be cleared:', storageError); }
    toast('Data simpanan rusak; permainan dimulai baru.');
  }
}
function playSound(kind) {
  if (!soundEnabled) return;
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audioContext = audioContext || new AudioCtor();
    if (audioContext.state === 'suspended') audioContext.resume().catch(error => console.warn('Audio could not resume:', error));
    if (!musicNodes.length) startMusic();
    const now = audioContext.currentTime;
    const tones = kind === 'buy' ? [660, 880] : kind === 'alert' ? [220, 165]
      : kind === 'door' ? [440] : kind === 'step' ? [115] : [520];
    tones.forEach((frequency, index) => {
      const oscillator = audioContext.createOscillator();
      const gain = audioContext.createGain();
      oscillator.type = kind === 'alert' ? 'sawtooth' : kind === 'step' ? 'triangle' : 'square';
      oscillator.frequency.setValueAtTime(frequency, now + index * .08);
      gain.gain.setValueAtTime(kind === 'step' ? .012 : .035, now + index * .08);
      gain.gain.exponentialRampToValueAtTime(.001, now + index * .08 + .09);
      oscillator.connect(gain); gain.connect(audioContext.destination);
      oscillator.start(now + index * .08); oscillator.stop(now + index * .08 + .1);
    });
  } catch (error) {
    console.warn('Audio feedback could not play:', error);
  }
}
function setMissionStep(step) {
  if (step <= missionStep) return;
  missionStep = Math.min(step, missionObjectives.length);
  toast(missionStep >= missionObjectives.length ? 'Misi selesai! Kamu berhasil kabur.' : 'Tujuan baru: ' + missionObjectives[missionStep]);
  playSound('success');
  saveProgress();
}
function buyOrEquipSkin(skin) {
  if (!skin) return;
  if (ownedSkins.has(skin.id)) {
    equippedSkin = skin.id;
    toast(skin.name + ' dipakai.');
    playSound('success');
  } else if (money < skin.price) {
    toast('Uangmu belum cukup untuk skin ' + skin.name + '.');
  } else {
    money -= skin.price;
    ownedSkins.add(skin.id);
    equippedSkin = skin.id;
    toast('Skin ' + skin.name + ' berhasil dibeli dan dipakai!');
    playSound('buy');
  }
  saveProgress();
  renderSkinOptions();
}
function renderSkinOptions() {
  const list = $('skinOptions');
  list.replaceChildren();
  const supplies = [
    { id: 'lockpick', name: 'Alat pembuka', price: 400, description: 'Tambahan 30 detik untuk kode brankas.' },
    { id: 'disguise', name: 'Penyamaran', price: 350, description: 'Mengurangi jarak pandang penjaga.' },
    { id: 'smoke', name: 'Bom asap', price: 450, description: 'Sekali pakai untuk menghilangkan kecurigaan.' },
    { id: 'diversion', name: 'Umpan pengalih', price: 600, description: 'Tekan F untuk menahan penjaga terdekat selama 5 detik.' }
  ];
  supplies.forEach(item => {
    const row = document.createElement('div'), copy = document.createElement('span'), detail = document.createElement('small');
    const button = document.createElement('button');
    row.className = 'skin-option'; copy.textContent = item.name;
    detail.textContent = inventory[item.id] ? 'Sudah dimiliki' : rp(item.price) + ' · ' + item.description;
    copy.append(detail); button.textContent = inventory[item.id] ? 'DIMILIKI' : 'BELI';
    button.disabled = inventory[item.id] || money < item.price;
    button.addEventListener('click', () => {
      if (money < item.price || inventory[item.id]) return;
      money -= item.price; inventory[item.id] = true;
      playSound('buy'); toast(item.name + ' dibeli.');
      if (item.id === 'lockpick' && missionStep === 2) setMissionStep(3);
      saveProgress(); renderSkinOptions();
    });
    row.append(copy, button); list.append(row);
  });
  playerSkins.forEach(skin => {
    const row = document.createElement('div'), copy = document.createElement('span'), detail = document.createElement('small');
    const button = document.createElement('button'), owned = ownedSkins.has(skin.id);
    row.className = 'skin-option'; copy.textContent = skin.name;
    detail.textContent = owned ? skin.id === equippedSkin ? 'Sedang dipakai' : 'Sudah dimiliki' : rp(skin.price);
    button.textContent = owned ? skin.id === equippedSkin ? 'DIPAKAI' : 'PAKAI' : 'BELI';
    button.classList.toggle('equipped', owned && skin.id === equippedSkin);
    button.disabled = owned && skin.id === equippedSkin || !owned && money < skin.price;
    button.addEventListener('click', () => buyOrEquipSkin(skin));
    row.append(copy, button); list.append(row);
  });
}
function openShopMenu() {
  renderSkinOptions();
  scene = 'skinshop';
  $('skinShop').hidden = false;
  playSound('door');
}
function closeShopMenu() {
  $('skinShop').hidden = true;
  scene = 'play';
}
function togglePause() {
  if (scene === 'play' || scene === 'talk') {
    pauseReturnScene = scene;
    $('pauseMenu').hidden = false;
    scene = 'pause';
    saveProgress();
  } else if (scene === 'pause') {
    $('pauseMenu').hidden = true;
    scene = pauseReturnScene;
  }
}
function showMainMenu() {
  saveProgress();
  $('pauseMenu').hidden = true;
  $('skinShop').hidden = true;
  $('mainMenu').hidden = false;
  refreshLobby();
  scene = 'menu';
}
function addInteractionEffect(x, y, color) {
  interactionEffects.push({ x, y, color, life: .7, maxLife: .7 });
}
function updateInteractionEffects(dt) {
  interactionEffects = interactionEffects.filter(effect => {
    effect.life -= dt;
    return effect.life > 0;
  });
}
function startPoliceChase() {
  if (wanted <= 0) return;
  if (!police) {
    const startX = clamp(Math.floor(player.x / T) - 5, 1, city.w - 2);
    const startY = clamp(Math.floor(player.y / T), 1, city.h - 2);
    let spawn = null;
    for (let radius = 0; radius < 12 && !spawn; radius++) {
      for (let oy = -radius; oy <= radius && !spawn; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const x = (startX + ox) * T + 8, y = (startY + oy) * T + 8;
          const tile = Math.floor(y / T) * city.w + Math.floor(x / T);
          if (isPedestrianWalkway(x, y) && city.solid[tile] === 0 && !isRoad(Math.floor(x / T), Math.floor(y / T))) {
            spawn = { x, y }; break;
          }
        }
      }
    }
    police = spawn ? { ...spawn, path: [], pathTimer: 0, step: 0 } : null;
    if (police) playSound('alert');
  }
}
function findPolicePath(startX, startY, endX, endY) {
  const start = { x: Math.floor(startX / T), y: Math.floor(startY / T) };
  const end = { x: Math.floor(endX / T), y: Math.floor(endY / T) };
  const queue = [start], previous = new Map(), keyOf = (x, y) => y * city.w + x;
  previous.set(keyOf(start.x, start.y), -1);
  let destination = null;
  for (let cursor = 0; cursor < queue.length; cursor++) {
    const current = queue[cursor], key = keyOf(current.x, current.y);
    if (current.x === end.x && current.y === end.y) { destination = key; break; }
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dy]) => {
      const x = current.x + dx, y = current.y + dy, nextKey = keyOf(x, y);
      if (x < 0 || y < 0 || x >= city.w || y >= city.h || previous.has(nextKey)) return;
      if (!isPedestrianWalkway(x * T + 8, y * T + 8) || city.solid[nextKey] === 1) return;
      previous.set(nextKey, key); queue.push({ x, y });
    });
  }
  if (destination === null) return [];
  const path = [];
  for (let key = destination; key !== keyOf(start.x, start.y); key = previous.get(key)) {
    path.push({ x: (key % city.w) * T + 8, y: Math.floor(key / city.w) * T + 8 });
  }
  return path.reverse();
}
function updatePolice(dt) {
  if (where !== 'city' || wanted <= 0) { police = null; return; }
  startPoliceChase();
  if (!police) return;
  police.pathTimer -= dt;
  if (police.pathTimer <= 0) {
    const px = player.x + 4, py = player.y + 6;
    let destination = null;
    for (let radius = 0; radius <= 6 && !destination; radius++) {
      for (let oy = -radius; oy <= radius && !destination; oy++) {
        for (let ox = -radius; ox <= radius; ox++) {
          const x = Math.floor(px / T) + ox, y = Math.floor(py / T) + oy;
          const tile = y * city.w + x;
          if (x >= 0 && y >= 0 && x < city.w && y < city.h &&
              isPedestrianWalkway(x * T + 8, y * T + 8) && city.solid[tile] === 0) {
            destination = { x: x * T + 8, y: y * T + 8 }; break;
          }
        }
      }
    }
    police.path = destination ? findPolicePath(police.x, police.y, destination.x, destination.y) : [];
    police.pathTimer = .55;
  }
  const next = police.path[0];
  if (next) {
    const dx = next.x - police.x, dy = next.y - police.y, distance = Math.hypot(dx, dy);
    if (distance < 2) police.path.shift();
    else {
      const step = Math.min(distance, (22 + wanted * 3) * dt);
      police.x += dx / distance * step; police.y += dy / distance * step; police.step += dt;
    }
  }
  if (Math.hypot(police.x - (player.x + 4), police.y - (player.y + 6)) < 14) {
    money = Math.floor(money * .8);
    wanted = 0; police = null; hasLoot = false;
    where = 'home'; player.x = 10 * T; player.y = 10 * T;
    if (missionStep > 3 && missionStep < missionObjectives.length) missionStep = 3;
    vaultOpen = false; lv = 0; qi = 0;
    toast('Polisi menangkapmu! Sebagian uang hilang, hasil rampokan terlepas, brankas dikunci lagi.');
    playSound('alert'); saveProgress();
  }
}

const patrolRoutes = [
  [[9, 28], [14, 28]],
  [[19, 28], [24, 28]],
  [[40, 14], [45, 14]]
].map(route => route.map(([x, y]) => ({ x: x * T + 8, y: y * T + 8 })));
const cityPatrols = [];
function syncCityPatrols() {
  const required = Math.min(patrolRoutes.length, 1 + Math.ceil(alarmCount / 2));
  while (cityPatrols.length < required) {
    const route = patrolRoutes[cityPatrols.length];
    cityPatrols.push({ x: route[0].x, y: route[0].y, route, i: 1, wait: Math.random(), step: 0 });
  }
}
function updateCityPatrols(dt) {
  syncCityPatrols();
  cityPatrols.forEach(officer => {
    if (officer.wait > 0) { officer.wait -= dt; return; }
    const next = officer.route[officer.i], dx = next.x - officer.x, dy = next.y - officer.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 2) {
      officer.i = (officer.i + 1) % officer.route.length;
      officer.wait = .35 + Math.random() * .8;
      return;
    }
    const step = Math.min(distance, 18 * dt);
    officer.x += dx / distance * step;
    officer.y += dy / distance * step;
    officer.step += dt;
  });
}

let where = 'home', scene = 'menu';
let vaultOpen = false, hasLoot = false, vaultRoom = 0;
let fuseT = 0, fuseUsed = false, noiseT = 0;
const noiseRings = [];
let suspicion = 0, bannerT = 0, bannerText = '', toastT = 0, toastText = '';
let shown = 0, hint = '', target = null, talk = null;
let money = 1200, missionStep = 0, wanted = 0;
const inventory = { lockpick: false, disguise: false, smoke: false, diversion: false };
let sideQuestStep = 0, sideQuest2Step = 0, alarmCount = 0, equippedSkin = 'classic', hasSaveData = false;
let storyChoice = null, heistMode = null;
let pauseReturnScene = 'play';
const ownedSkins = new Set(['classic']);
const playerSkins = [
  { id: 'classic', name: 'Perampok Klasik', price: 0, coat: '#2b2d35', accent: '#e0343a', scarf: '#1e2026' },
  { id: 'crimson', name: 'Crimson Runner', price: 1500, coat: '#733641', accent: '#f1c15b', scarf: '#302126' },
  { id: 'neon', name: 'Neon Courier', price: 3000, coat: '#27645b', accent: '#65e2c0', scarf: '#172c30' },
  { id: 'royal', name: 'Midnight Royal', price: 6000, coat: '#354b83', accent: '#e1bd62', scarf: '#20263d' }
];
let soundEnabled = true, audioContext = null, police = null, saveTimer = 5;
let musicNodes = [], musicTimer = null, musicStep = 0, footstepTimer = 0, musicRun = 0, smokeT = 0;
let interactionEffects = [];
const missionObjectives = [
  'Keluar dari rumah dan temui Raka.',
  'Bicara dengan Raka di trotoar.',
  'Beli perlengkapan di kasir toko.',
  'Masuk bank dan buka brankas.',
  'Kabur dari bank sambil menghindari polisi.',
  'Pergi ke gang di selatan kota (dekat rumah), turun ke gorong-gorong dan bersembunyi sampai keadaan aman. Setelah itu kabur naik bus ke kota lain.'
];
const FUSE = { x: 5 * T + 8, y: 18 * T + 8 };
const hideout = { x: 12 * T + 8, y: 27 * T + 8 };
function refreshLobby() {
  $('lobbyMoney').textContent = rp(money);
  $('lobbyMission').textContent = missionStep >= missionObjectives.length
    ? 'Semua misi selesai'
    : missionStep === 0 ? 'Mulai dari rumah'
      : missionObjectives[missionStep];
  $('lobbyHeat').textContent = alarmCount === 0 ? 'AMAN'
    : alarmCount < 3 ? 'WASPADA · ' + alarmCount
      : 'TINGGI · ' + alarmCount;
  $('lobbyHeat').style.color = alarmCount === 0 ? '#8fe3a0' : alarmCount < 3 ? '#f0c24b' : '#ee6a74';
  $('lobbyEndings').textContent = seenEndings.size + '/' + ENDING_TITLES.length;
  const finished = missionStep >= missionObjectives.length;
  $('continueGame').hidden = finished;
  $('continueGame').disabled = !hasSaveData;
  $('newGame').textContent = finished ? 'MULAI DARI AWAL' : 'MULAI PETUALANGAN';
}
const sideQuest2Objectives = ['Bicara dengan Bu Tini untuk tugas sampingan kedua.', 'Antarkan gorengan ke Pak Ujang dekat bank.'];
const sideQuestObjectives = ['Bicara dengan Pak Joko untuk mengambil tugas sampingan.', 'Antarkan paket ke Sari di dekat rumah.'];
let cityLayer, bankLayer, decor = [];
const cam = { x: 0, y: 0 };
const keys = {};
const player = { x: 10 * T, y: 10 * T, dir: 'down', moving: false, t: 0 };
const crouching = () => !!(keys.ShiftLeft || keys.ShiftRight);

/* ---------- peta kota ---------- */
const city = { w: 56, h: 36, solid: new Uint8Array(56 * 36) };
const bank = { w: 29, h: 19, solid: new Uint8Array(29 * 19) };
const cafe = { w: 21, h: 19, solid: new Uint8Array(21 * 19) };
const office = { w: 20, h: 15, solid: new Uint8Array(20 * 15) };
const home = { w: 20, h: 15, solid: new Uint8Array(20 * 15) };
const shop = { w: 20, h: 15, solid: new Uint8Array(20 * 15) };
let cafeLayer, cafeDecor = [], officeLayer, officeDecor = [], homeLayer, homeDecor = [], shopLayer, shopDecor = [];
const roadRows = [[10, 12], [24, 26]], roadCols = [[14, 16], [34, 36]];
const trafficCars = [
  { axis: 'h', x: -30, y: roadRows[0][0] * T + 14, dir: 1, speed: 38, color: '#648da0' },
  { axis: 'h', x: 300, y: roadRows[0][0] * T + 14, dir: 1, speed: 44, color: '#a66a54' },
  { axis: 'h', x: 690, y: roadRows[0][0] * T + 14, dir: 1, speed: 35, color: '#d1b56e' },
  { axis: 'h', x: 150, y: roadRows[0][0] * T + 36, dir: -1, speed: 41, color: '#718b68' },
  { axis: 'h', x: 510, y: roadRows[0][0] * T + 36, dir: -1, speed: 36, color: '#9a759f' },
  { axis: 'h', x: 70, y: roadRows[1][0] * T + 14, dir: 1, speed: 40, color: '#bd6855' },
  { axis: 'h', x: 420, y: roadRows[1][0] * T + 14, dir: 1, speed: 34, color: '#7b9d9e' },
  { axis: 'h', x: 790, y: roadRows[1][0] * T + 36, dir: -1, speed: 43, color: '#d1b56e' },
  { axis: 'h', x: 320, y: roadRows[1][0] * T + 36, dir: -1, speed: 37, color: '#648da0' },
  { axis: 'v', x: roadCols[0][0] * T + 14, y: 80, dir: 1, speed: 32, color: '#9a759f' },
  { axis: 'v', x: roadCols[1][0] * T + 36, y: 290, dir: -1, speed: 35, color: '#bd6855' },
  { axis: 'v', x: roadCols[1][0] * T + 14, y: 510, dir: 1, speed: 29, color: '#718b68' }
];
let trafficTime = 0;
const trafficCycle = 18;
const intersectionCols = roadCols.map(([x]) => x * T);
const intersectionRows = roadRows.map(([y]) => y * T);
function trafficPhase() { return trafficTime % trafficCycle; }
function signalState(axis) {
  const phase = trafficPhase();
  if (axis === 'h') return phase < 7 ? 'green' : phase < 8 ? 'yellow' : 'red';
  return phase < 9 ? 'red' : phase < 16 ? 'green' : phase < 17 ? 'yellow' : 'red';
}
function signalAllows(axis) {
  const phase = trafficPhase();
  return axis === 'h' ? phase < 7 : phase >= 9 && phase < 16;
}
const within = (v, rs) => rs.some(([a, b]) => v >= a && v <= b);
const isRoad = (x, y) => within(y, roadRows) || within(x, roadCols);
function isCrosswalkPoint(x, y) {
  return roadRows.some(([rowStart, rowEnd]) => roadCols.some(([colStart]) => {
    const roadX = colStart * T, roadY = rowStart * T;
    const horizontalCrossing = (
      (x >= roadX - 38 && x <= roadX - 6) ||
      (x >= roadX + 54 && x <= roadX + 86)
    ) && y >= roadY && y <= (rowEnd + 1) * T;
    const verticalCrossing = x >= roadX && x <= roadX + 48 && (
      (y >= roadY - 36 && y <= roadY - 4) ||
      (y >= (rowEnd + 1) * T + 4 && y <= (rowEnd + 1) * T + 36)
    );
    return horizontalCrossing || verticalCrossing;
  }));
}
function isPedestrianWalkway(x, y) {
  const tx = Math.floor(x / T), ty = Math.floor(y / T);
  if (isRoad(tx, ty)) return isCrosswalkPoint(x, y);
  return ground(tx, ty) === 's';
}
const SIDEWALK_W = 2; // lebar trotoar (tile) di kedua sisi jalan
function bandGap(v, bands) {
  let m = 99;
  for (let i = 0; i < bands.length; i++) {
    const a = bands[i][0], b = bands[i][1], d = v < a ? a - v : v > b ? v - b : 0;
    if (d < m) m = d;
  }
  return m;
}
function ground(x, y) {
  if (isRoad(x, y)) return 'r';
  return Math.min(bandGap(x, roadCols), bandGap(y, roadRows)) <= SIDEWALK_W ? 's' : 'g';
}

const mk = (x, y, w, h, name, roof, wall, awn, extra) => ({ x, y, w, h, name, roof, wall, awn, ...extra });
const buildings = [
  mk(2, 2, 6, 6, 'TOKO', '#3e6b66', '#cdbf9b', '#c0553f', { store: true }),
  mk(19, 1, 6, 7, 'HOTEL', '#4b5f86', '#c8c2ae', '#c0553f'),
  mk(26, 2, 6, 6, 'KAFE', '#a8523f', '#d6c3a0', '#3e6b66'),
  mk(39, 1, 8, 7, 'KANTOR', '#3e6b66', '#c4c8bc', '#4b5f86'),
  mk(48, 3, 6, 5, 'BUKU', '#4b5f86', '#d9c9a6', '#c0553f'),
  mk(1, 15, 6, 7, 'APOTEK', '#3e6b66', '#d8d6c8', '#4a8fc9'),
  mk(8, 16, 4, 6, 'RUMAH', '#a8523f', '#cdbf9b', '#3e6b66', { home: true }),
  mk(19, 15, 6, 7, 'PASAR', '#c0553f', '#d9c9a6', '#e0b84a'),
  mk(26, 16, 6, 6, 'BIOSKOP', '#4b5f86', '#c4c8bc', '#a8523f'),
  mk(40, 15, 12, 7, 'BANK', '#6f7d86', '#dcd3b6', '#e0b84a', { bank: true })
];
const bankB = buildings[buildings.length - 1];
const homeB = buildings.find(b => b.home);
const shopB = buildings.find(b => b.store);
buildings.forEach(b => {
  for (let y = b.y; y < b.y + b.h; y++) for (let x = b.x; x < b.x + b.w; x++) city.solid[y * city.w + x] = 1;
});

const props = [];
for (let y = 0; y < city.h; y++) {
  for (let x = 0; x < city.w; x++) {
    const i = y * city.w + x;
    if (city.solid[i]) continue;
    const g = ground(x, y), h = hash(x, y) % 100;
    if (g === 'g' && h < (y > 27 ? 14 : 6) && ground(x, y - 1) !== 's' && ground(x - 1, y) !== 's' && ground(x + 1, y) !== 's') {
      props.push({ k: 'tree', x, y });
      city.solid[i] = 1;
    }
    else if (g === 's' && [9, 13, 23, 27].includes(y) && x % 8 === 4) props.push({ k: 'lamp', x, y });
    else continue;
  }
}

const skin = '#f3c9a0';
const npcs = [
  { name: 'Raka', tx: 10, ty: 9, look: { hair: '#8a4b3a', skin, top: '#2c4a94', bot: '#1c2a55', cape: '#a8393b' },
    lines: ['Kota ini ramai ya. Kamu kelihatan agak mencurigakan, lho.', 'Kalau cari bank, jalan terus ke timur lalu ke blok kanan tengah.'] },
  { name: 'Sir Bima', tx: 19, ty: 13, look: { hair: '#b9bac4', skin, top: '#b9bac4', bot: '#8a8c98', x: 'helm' },
    lines: ['Berhenti! ...bercanda, aku ksatria paruh waktu.', 'Bank itu gedung besar berpilar emas. Tinggal ikuti jalan ke kanan.'] },
  { name: 'Mbah Sakti', tx: 31, ty: 9, look: { hair: '#5b3a7a', skin, top: '#5b3a7a', bot: '#3a2650', x: 'hat' },
    lines: ['Aku melihat masa depanmu... ada banyak uang dan satpam.', 'Banknya di timur. Jangan bilang siapa-siapa.'] },
  { name: 'Sari', tx: 8, ty: 23, look: { hair: '#e8821f', skin, top: '#2a2e36', bot: '#1a1c22', x: 'mask' },
    lines: ['Sstt. Satpam di dalam bank jalan bolak-balik tanpa henti.', 'Tahan Shift untuk jongkok. Sembunyi di balik meja loket.', 'Brankasnya ada di salah satu ruangan. Periksa semuanya.'] },
  { name: 'Pak Joko', tx: 37, ty: 16, look: { hair: '#8a4b3a', skin, top: '#3f7a45', bot: '#2c5a33' },
    lines: ['Toko-toko tutup semua, sudah malam.', 'Bank buka 24 jam kok. Lurus saja ke kanan.'] },
  { name: 'Suster Ayu', tx: 30, ty: 27, look: { hair: '#f0c24b', skin, top: '#f2f4f8', bot: '#4a8fc9', x: 'nurse' },
    lines: ['Hati-hati di jalan ya.', 'Bank ada di blok sebelah kanan. Gedungnya paling besar.'] }
];
const dirs = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];
npcs.forEach(n => {
  n.x = n.hx = n.tx * T + 8; n.y = n.hy = n.ty * T + 12;
  n.dir = 'down'; n.t = Math.random() * 2; n.v = [0, 0]; n.step = 0;
});

/* ---------- interior bank ---------- */
const guards = [
  { pts: [[2, 9], [26, 9]] },
  { pts: [[26, 15], [2, 15]] },
  { pts: [[11, 10], [17, 10], [17, 14], [11, 14]] }
];
guards.forEach(g => { g.pts = g.pts.map(([x, y]) => [x * T + 8, y * T + 14]); });
const bankCameras = [
  { x: 14 * T + 8, y: 8 * T + 14, base: Math.PI / 2, ph: 0 },
  { x: 27 * T + 8, y: 13 * T + 14, base: Math.PI, ph: 2 }
].map(camera => ({ ...camera, ang: camera.base, t: 0 }));
function resetGuards() {
  guards.forEach((g, index) => {
    let route = g.pts;
    if (index < 2) {
      const upperLane = index === 0;
      const firstRow = upperLane ? 8 + Math.floor(Math.random() * 2) : 15 + Math.floor(Math.random() * 2);
      const secondRow = upperLane ? (firstRow === 8 ? 9 : 8) : (firstRow === 15 ? 16 : 15);
      const left = 2 * T + 8, right = 26 * T + 8;
      route = upperLane
        ? [[left, firstRow * T + 14], [right, firstRow * T + 14], [right, secondRow * T + 14], [left, secondRow * T + 14]]
        : [[right, firstRow * T + 14], [left, firstRow * T + 14], [left, secondRow * T + 14], [right, secondRow * T + 14]];
    }
    g.route = Math.random() < .5 ? route.slice().reverse() : route.slice();
    g.i = Math.floor(Math.random() * g.route.length);
    g.x = g.route[g.i][0]; g.y = g.route[g.i][1];
    g.ang = 0; g.wait = Math.random() * 1.5; g.speed = 27 + Math.random() * 16;
    g.distracted = 0; g.t = 0; g.curious = 0; g.invest = null; g.seenT = 0; g.lastSeen = null;
  });
}
const cafePeople = [
  { x: 3 * T + 8, y: 7 * T + 8, seatX: 3 * T + 8, queueX: 17 * T + 8, delay: 1, timer: 1, state: 'eating', hasMeal: true, look: { hair: '#372a26', skin, top: '#5f8fa0', bot: '#28394c' }, dir: 'down' },
  { x: 10 * T + 8, y: 7 * T + 8, seatX: 10 * T + 8, queueX: 18 * T + 8, delay: 3.5, timer: 3.5, state: 'eating', hasMeal: true, look: { hair: '#a8523f', skin, top: '#e0b84a', bot: '#303744' }, dir: 'down' },
  { x: 17 * T + 8, y: 7 * T + 8, seatX: 17 * T + 8, queueX: 19 * T + 8, delay: 6, timer: 6, state: 'eating', hasMeal: true, look: { hair: '#35262a', skin, top: '#6aa86a', bot: '#28394c' }, dir: 'down' }
];
const cafeStaff = { x: 16 * T + 8, y: 13 * T + 8, look: { hair: '#5a3426', skin, top: '#f2eee6', bot: '#a71924', x: 'cap' } };
const officeWorkers = [
  {
    x: 7 * T, y: 8 * T + 8, look: { hair: '#6e4934', skin, top: '#4a8fc9', bot: '#243650' },
    dir: 'up', state: 'working', typeT: 0
  },
  {
    x: 11 * T, y: 8 * T + 8, look: { hair: '#a8523f', skin, top: '#6aa86a', bot: '#344238' },
    dir: 'up', state: 'working', typeT: 0, breakTimer: 10, route: [], routeIndex: 0
  }
];

function buildBank(keepRoom) {
  if (!keepRoom) vaultRoom = Math.floor(Math.random() * 4);
  const W = bank.w;
  for (let y = 0; y < bank.h; y++) {
    for (let x = 0; x < W; x++) {
      const wall = y === 0 || x === 0 || x === 28 || (y === 18 && x !== 14) ||
        (y === 7 && ![3, 10, 17, 24].includes(x)) || (y > 0 && y < 7 && [7, 14, 21].includes(x));
      bank.solid[y * W + x] = wall ? 1 : 0;
    }
  }
  const walls = bank.solid.slice();
  decor = [];
  const put = (x, y, w, h, k) => {
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) bank.solid[(y + j) * W + x + i] = 1;
    decor.push({ k, x, y, w, h });
  };
  const others = ['kantor', 'arsip', 'gudang'].sort(() => Math.random() - .5);
  for (let k = 0, o = 0; k < 4; k++) {
    const rx = 1 + 7 * k, type = k === vaultRoom ? 'vault' : others[o++ % 3];
    if (type === 'vault') put(rx + 5, 1, 1, 1, 'plant');
    if (type === 'kantor') { put(rx, 1, 2, 1, 'desk'); put(rx + 4, 3, 2, 1, 'desk'); put(rx + 5, 1, 1, 1, 'plant'); }
    if (type === 'arsip') { put(rx, 1, 6, 1, 'shelf'); put(rx + 1, 3, 2, 1, 'shelf'); put(rx + 4, 4, 2, 1, 'shelf'); }
    if (type === 'gudang') { put(rx, 1, 2, 1, 'crate'); put(rx + 4, 2, 2, 1, 'crate'); put(rx + 1, 4, 1, 1, 'crate'); }
  }
  put(3, 12, 7, 1, 'counter'); put(19, 12, 7, 1, 'counter');
  [[1, 8], [27, 8], [1, 17], [27, 17]].forEach(([x, y]) => put(x, y, 1, 1, 'plant'));
  const vx = (1 + 7 * vaultRoom + 2);
  for (let j = 1; j <= 2; j++) for (let i = 0; i < 2; i++) bank.solid[j * W + vx + i] = 1;

  bankLayer = document.createElement('canvas');
  bankLayer.width = W * T; bankLayer.height = bank.h * T;
  ctx = bankLayer.getContext('2d');
  for (let y = 0; y < bank.h; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      if (walls[y * W + x]) {
        ctx.fillStyle = '#3a3d55'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#51567a'; ctx.fillRect(px, py, T, 3);
        ctx.fillStyle = '#2a2c40'; ctx.fillRect(px, py + 13, T, 3);
      } else if (y >= 1 && y <= 7) {
        ctx.fillStyle = '#9a7550'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#84613f'; ctx.fillRect(px, py + 7, T, 1);
        if (y === 7) { ctx.fillStyle = '#6a4a2c'; ctx.fillRect(px, py, T, 2); }
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#bdb59f' : '#cdc5b0'; ctx.fillRect(px, py, T, T);
      }
    }
  }
  drawBankInteriorDetails(W);
  ctx.fillStyle = '#a7833f'; ctx.fillRect(11 * T, 10 * T, 7 * T, 5 * T);
  ctx.fillStyle = '#6b2f3a'; ctx.fillRect(11 * T + 3, 10 * T + 3, 7 * T - 6, 5 * T - 6);
  ctx.fillStyle = '#a98241';
  for (let i = 0; i < 5; i++) {
    ctx.fillRect(11 * T + 6 + i * 18, 10 * T + 6, 2, 4);
    ctx.fillRect(11 * T + 6 + i * 18, 15 * T - 10, 2, 4);
  }
  ctx.fillStyle = 'rgba(238,202,120,.35)';
  for (let i = 0; i < 4; i++) ctx.fillRect(11 * T + 12 + i * 22, 10 * T + 14 + (i % 2) * 20, 3, 3);
  ctx.strokeStyle = 'rgba(235,207,137,.42)'; ctx.lineWidth = 1;
  ctx.strokeRect(11 * T + 8.5, 10 * T + 8.5, 7 * T - 17, 5 * T - 17);
  ctx.fillStyle = '#a98241'; ctx.fillRect(14 * T + 2, 12 * T + 2, 12, 12);
  ctx.fillStyle = '#6b2f3a'; ctx.fillRect(14 * T + 4, 12 * T + 4, 8, 8);
  ctx.fillStyle = '#e0b84a'; ctx.fillRect(14 * T + 7, 12 * T + 5, 2, 6);
  ctx.fillRect(14 * T + 5, 12 * T + 7, 6, 2);
  ctx.fillStyle = '#2f6f4f'; ctx.fillRect(14 * T, 18 * T, T, T);
  words('EXIT', 14 * T + 8, 18 * T + 11, '#fff', 'bold 6px monospace', 'center');
  decor.forEach(drawDecor);
  ctx = mainCtx;
}

function buildCafe() {
  const W = cafe.w, H = cafe.h;
  cafe.solid.fill(0);
  cafeDecor = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const edge = x === 0 || x === W - 1 || y <= 1 || (y === H - 1 && x !== 9 && x !== 10 && x !== 11);
      cafe.solid[y * W + x] = edge ? 1 : 0;
    }
  }
  const addFurniture = (x, y, w, h, kind) => {
    cafeDecor.push({ x, y, w, h, kind });
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) cafe.solid[ty * W + tx] = 1;
    }
  };
  [[1, 2], [8, 2], [15, 2]].forEach(([x, y]) => addFurniture(x, y, 5, 3, 'booth'));
  addFurniture(1, 8, 4, 2, 'table');
  addFurniture(8, 8, 4, 2, 'table');
  addFurniture(15, 8, 4, 2, 'table');
  addFurniture(1, 13, 6, 3, 'booth');
  addFurniture(14, 12, 6, 3, 'counter');
  addFurniture(17, 4, 3, 2, 'jukebox');

  cafeLayer = document.createElement('canvas');
  cafeLayer.width = W * T; cafeLayer.height = H * T;
  ctx = cafeLayer.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      if (y < 2) {
        ctx.fillStyle = '#ded7c8'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#5a4940'; ctx.fillRect(px, py + 14, T, 2);
        if (y === 1 && x % 3 === 1) {
          ctx.fillStyle = '#9e1d26'; ctx.fillRect(px, py + 4, T, 4);
          ctx.fillStyle = '#f1e8d9'; ctx.fillRect(px, py + 8, T, 4);
        }
      } else {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#e5e0d7' : '#aaa7a5';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(55,45,40,.14)';
        ctx.fillRect(px, py, T, 1); ctx.fillRect(px, py, 1, T);
      }
    }
  }
  ctx.fillStyle = '#332b2b'; ctx.fillRect(0, 2 * T - 2, W * T, 3);
  ctx.fillStyle = '#f5eee1'; ctx.fillRect(0, 2 * T - 5, W * T, 3);
  ctx.fillStyle = '#a51f28'; ctx.fillRect(0, 2 * T + 2, W * T, 4);
  [[2, 3, '#e0b84a'], [9, 3, '#5f8fa0'], [16, 3, '#5b9b5e']].forEach(([tx, ty, color]) => {
    const px = tx * T, py = ty * T;
    ctx.fillStyle = '#28252a'; ctx.fillRect(px - 2, py - 2, 40, 34);
    ctx.fillStyle = '#f0e8dc'; ctx.fillRect(px, py, 36, 30);
    ctx.fillStyle = color; ctx.fillRect(px + 2, py + 2, 32, 3);
    ctx.fillStyle = '#c0202a'; ctx.fillRect(px + 2, py + 6, 32, 2);
    ctx.fillStyle = '#5c9ba1'; ctx.fillRect(px + 4, py + 10, 28, 15);
    ctx.fillStyle = '#c8e1d5'; ctx.fillRect(px + 6, py + 11, 2, 12);
    ctx.fillRect(px + 28, py + 11, 2, 12);
    ctx.fillStyle = '#b51f28'; ctx.fillRect(px + 1, py + 25, 34, 5);
  });
  cafeDecor.forEach(drawCafeFurniture);
  drawCafeEntrance();
  drawCafeWallArt();
  ctx = mainCtx;
}

function updateCafe(dt) {
  cafePeople.forEach(person => {
    if (person.route) {
      const point = person.route[person.routeIndex];
      const dx = point.x - person.x, dy = point.y - person.y, distance = Math.hypot(dx, dy);
      if (distance < 1) {
        person.x = point.x; person.y = point.y; person.routeIndex++;
        if (person.routeIndex >= person.route.length) {
          person.route = null;
          person.state = person.nextState;
          person.timer = person.nextTimer;
        }
        return;
      }
      person.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      const step = Math.min(distance, 34 * dt);
      person.x += dx / distance * step;
      person.y += dy / distance * step;
      person.step = (person.step || 0) + dt;
      return;
    }

    person.timer -= dt;
    if (person.timer > 0) return;
    const aisleX = 19 * T + 8, aisleY = 7 * T + 8, counterY = 11 * T + 8;
    if (person.state === 'eating') {
      person.state = 'walkingToCounter';
      person.hasMeal = false;
      person.route = [
        { x: person.x, y: aisleY },
        { x: aisleX, y: aisleY },
        { x: aisleX, y: counterY },
        { x: person.queueX, y: counterY }
      ];
      person.routeIndex = 0;
      person.nextState = 'ordering';
      person.nextTimer = 2.4;
    } else if (person.state === 'ordering') {
      person.state = 'walkingToSeat';
      person.hasMeal = true;
      person.route = [
        { x: person.queueX, y: counterY },
        { x: aisleX, y: counterY },
        { x: aisleX, y: aisleY },
        { x: person.seatX, y: aisleY }
      ];
      person.routeIndex = 0;
      person.nextState = 'eating';
      person.nextTimer = 4 + person.delay;
    }
  });
}

function drawCafeMeal(person) {
  if (!person.hasMeal) return;
  const x = person.seatX, y = 8 * T + 5;
  ctx.fillStyle = '#3a3030'; ctx.fillRect(x - 7, y, 14, 5);
  ctx.fillStyle = '#f4eee3'; ctx.fillRect(x - 6, y + 1, 12, 3);
  ctx.fillStyle = '#a61f28'; ctx.fillRect(x - 3, y + 2, 6, 1);
  ctx.fillStyle = '#e0b84a'; ctx.fillRect(x + 9, y - 2, 4, 6);
  ctx.fillStyle = '#fff0bf'; ctx.fillRect(x + 10, y - 1, 2, 2);
}

function drawCafeGuest(person, index, now) {
  const step = person.route ? Math.floor((person.step || 0) * 8) % 2 : Math.floor(now / 650 + index) % 2;
  const y = person.state === 'eating' ? person.y - 2 : person.y;
  chibi(person.x - 6, y - 16, person.look, person.dir, step);
  if (person.state === 'eating') {
    const bite = Math.floor(now / 450 + index) % 2;
    ctx.fillStyle = '#e0b84a'; ctx.fillRect(person.x + 4, y - 7 - bite, 3, 2);
    ctx.fillStyle = '#f4eee3'; ctx.fillRect(person.x + 5, y - 8 - bite, 2, 1);
  } else if (person.state === 'ordering') {
    ctx.fillStyle = '#29252a'; ctx.fillRect(person.x - 5, y - 27, 12, 8);
    ctx.fillStyle = '#f4eee3'; ctx.fillRect(person.x - 4, y - 26, 10, 6);
    words('...', person.x + 1, y - 21, '#a71924', 'bold 6px monospace', 'center');
  }
}

function drawCafeFurniture(item) {
  const x = item.x * T, y = item.y * T, w = item.w * T, h = item.h * T;
  if (item.kind === 'booth') {
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 3, y + h - 2, w - 1, 8);
    ctx.fillStyle = '#29252a'; ctx.fillRect(x, y + 5, w, h - 3);
    ctx.fillStyle = '#a71924'; ctx.fillRect(x + 2, y + 2, w - 4, h - 5);
    ctx.fillStyle = '#e3433e'; ctx.fillRect(x + 3, y + 3, w - 6, 3);
    ctx.fillStyle = '#6b141d'; ctx.fillRect(x + 4, y + h - 7, w - 8, 2);
    ctx.fillStyle = '#29252a'; ctx.fillRect(x - 2, y + h - 5, w + 4, 5);
    ctx.fillStyle = '#eee7dc'; ctx.fillRect(x + 6, y + h - 4, w - 12, 2);
  } else if (item.kind === 'table') {
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(x + 4, y + 8, w - 4, h - 2);
    ctx.fillStyle = '#29252a'; ctx.fillRect(x + 5, y + 5, w - 10, h - 2);
    ctx.fillStyle = '#ece7de'; ctx.fillRect(x + 7, y + 3, w - 14, h - 7);
    ctx.fillStyle = '#c8c3bd'; ctx.fillRect(x + 9, y + 5, w - 18, 2);
    ctx.fillStyle = '#a71d27'; ctx.fillRect(x + 2, y + h - 4, w - 4, 3);
    ctx.fillStyle = '#4e4039'; ctx.fillRect(x + 7, y + h - 1, 3, 5);
    ctx.fillRect(x + w - 10, y + h - 1, 3, 5);
    ctx.fillStyle = '#f8f1e6'; ctx.fillRect(x + w / 2 - 3, y + 8, 6, 3);
    ctx.fillStyle = '#bf2730'; ctx.fillRect(x + w / 2 - 1, y + 8, 2, 3);
  } else if (item.kind === 'counter') {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 3, y + h - 3, w, 7);
    ctx.fillStyle = '#29252a'; ctx.fillRect(x, y + 4, w, h - 2);
    ctx.fillStyle = '#a71924'; ctx.fillRect(x + 2, y + 7, w - 4, h - 9);
    ctx.fillStyle = '#e1473d'; ctx.fillRect(x + 3, y + 8, w - 6, 3);
    ctx.fillStyle = '#333238'; ctx.fillRect(x - 2, y + 1, w + 4, 7);
    ctx.fillStyle = '#d2d0cc'; ctx.fillRect(x, y, w, 5);
    ctx.fillStyle = '#f2eee6'; ctx.fillRect(x + 4, y + 1, w - 8, 2);
    [x + 12, x + w - 18].forEach(px => {
      ctx.fillStyle = '#4b3c36'; ctx.fillRect(px, y - 5, 8, 6);
      ctx.fillStyle = '#e3c57c'; ctx.fillRect(px + 1, y - 4, 6, 3);
    });
    ctx.fillStyle = '#525c61'; ctx.fillRect(x + 18, y - 7, 22, 8);
    ctx.fillStyle = '#81c3c2'; ctx.fillRect(x + 20, y - 6, 18, 5);
  } else if (item.kind === 'jukebox') {
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 4, y + h - 2, w - 2, 5);
    ctx.fillStyle = '#28242a'; ctx.fillRect(x + 2, y, w - 4, h);
    ctx.fillStyle = '#b87b38'; ctx.fillRect(x + 4, y + 2, w - 8, h - 4);
    ctx.fillStyle = '#f5d36c'; ctx.fillRect(x + 7, y + 4, w - 14, 3);
    ctx.fillStyle = '#a91d27'; ctx.fillRect(x + 6, y + 8, w - 12, h - 13);
    ctx.fillStyle = '#e3b74b'; ctx.fillRect(x + 10, y + 10, w - 20, h - 18);
    ctx.fillStyle = '#f4e5ba'; ctx.fillRect(x + 12, y + 11, w - 24, h - 20);
    ctx.fillStyle = '#5d5c62'; ctx.fillRect(x + 7, y + h - 6, w - 14, 2);
  }
}

function drawCafeEntrance() {
  const x = 9 * T, y = 17 * T;
  ctx.fillStyle = '#33272a'; ctx.fillRect(x, y, 3 * T, T);
  ctx.fillStyle = '#a51f28'; ctx.fillRect(x + 3, y + 2, 3 * T - 6, T - 2);
  ctx.fillStyle = '#f2e8da'; ctx.fillRect(x + 6, y + 3, 3, T - 4);
  ctx.fillRect(x + 3 * T - 9, y + 3, 3, T - 4);
  ctx.fillStyle = '#f2c65e'; ctx.fillRect(x + T + 1, y + 7, 2, 4);
}

function drawCafeWallArt() {
  [[1, 0], [7, 0], [13, 0], [17, 0], [1, 6], [13, 6]].forEach(([tx, ty], index) => {
    const x = tx * T, y = ty * T;
    ctx.fillStyle = '#29252a'; ctx.fillRect(x, y, 38, 20);
    ctx.fillStyle = '#eee5d8'; ctx.fillRect(x + 2, y + 2, 34, 16);
    ctx.fillStyle = ['#e3b84d', '#4f99a0', '#ba2630'][index % 3];
    ctx.fillRect(x + 5, y + 5, 28, 3);
    ctx.fillStyle = '#fff4dc'; ctx.fillRect(x + 8, y + 10, 22, 2);
    ctx.fillStyle = '#29252a'; ctx.fillRect(x + 12, y + 13, 14, 2);
  });
}

function buildOffice() {
  const W = office.w, H = office.h;
  office.solid.fill(0);
  officeDecor = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      office.solid[y * W + x] = x === 0 || x === W - 1 || y <= 1 || (y === H - 1 && ![9, 10, 11].includes(x)) ? 1 : 0;
    }
  }
  const addOfficeFurniture = (x, y, w, h, kind) => {
    officeDecor.push({ x, y, w, h, kind });
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) office.solid[ty * W + tx] = 1;
    }
  };
  addOfficeFurniture(1, 4, 2, 2, 'bookcase');
  addOfficeFurniture(3, 4, 1, 1, 'printer');
  addOfficeFurniture(4, 4, 1, 1, 'plant');
  addOfficeFurniture(1, 6, 1, 2, 'filing');
  addOfficeFurniture(3, 6, 2, 1, 'cabinet');
  addOfficeFurniture(13, 4, 1, 2, 'watercooler');
  addOfficeFurniture(14, 4, 1, 2, 'filing');
  addOfficeFurniture(16, 6, 1, 1, 'plant');
  addOfficeFurniture(6, 6, 2, 2, 'desk');
  addOfficeFurniture(10, 6, 2, 2, 'desk');

  officeLayer = document.createElement('canvas');
  officeLayer.width = W * T; officeLayer.height = H * T;
  ctx = officeLayer.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      if (y < 2) {
        ctx.fillStyle = '#4a4846'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#77716a'; ctx.fillRect(px + 1, py + 1, T - 2, 2);
        ctx.fillStyle = '#2e3036'; ctx.fillRect(px, py + 14, T, 2);
      } else {
        ctx.fillStyle = '#ae8961'; ctx.fillRect(px, py, T, T);
        ctx.fillStyle = '#9e7953'; ctx.fillRect(px, py + 15, T, 1);
        if (y % 2 === 0) {
          ctx.fillStyle = '#b18b61'; ctx.fillRect(px + (x % 2) * 8, py + 4, 1, 6);
          ctx.fillStyle = 'rgba(235,202,155,.16)'; ctx.fillRect(px + 3, py + 2, 4, 1);
        } else {
          ctx.fillStyle = '#a17c56'; ctx.fillRect(px + ((x + 1) % 2) * 8, py + 4, 1, 6);
        }
      }
    }
  }
  drawOfficeRug();
  drawOfficeWindows();
  drawOfficeFurniture();
  drawOfficeEntrance();
  drawOfficeNoticeboard();
  ctx = mainCtx;
}

function buildHome() {
  const W = home.w, H = home.h;
  home.solid.fill(0);
  homeDecor = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      home.solid[y * W + x] = x === 0 || x === W - 1 || y <= 2 ||
        (y === H - 1 && ![9, 10, 11].includes(x)) ? 1 : 0;
    }
  }
  const addFurniture = (x, y, w, h, kind) => {
    homeDecor.push({ x, y, w, h, kind });
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) home.solid[ty * W + tx] = 1;
    }
  };
  addFurniture(2, 5, 4, 2, 'workdesk');
  addFurniture(3, 7, 1, 1, 'chair');
  addFurniture(7, 5, 2, 3, 'dresser');
  addFurniture(16, 4, 1, 2, 'plant');
  addFurniture(13, 7, 4, 3, 'bed');
  addFurniture(5, 10, 2, 3, 'table');
  addFurniture(15, 10, 1, 1, 'chair');
  addFurniture(13, 11, 4, 2, 'desk');
  addFurniture(11, 12, 1, 1, 'bin');

  homeLayer = document.createElement('canvas');
  homeLayer.width = W * T; homeLayer.height = H * T;
  ctx = homeLayer.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      if (y < 3) {
        ctx.fillStyle = y % 2 ? '#d9c8aa' : '#cbb99c';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(112,86,63,.18)';
        ctx.fillRect(px + 3, py, 1, T);
        ctx.fillRect(px + 11, py, 1, T);
        ctx.fillStyle = '#735d49';
        ctx.fillRect(px, py + 15, T, 1);
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#57585a' : '#626263';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(20,22,24,.3)';
        ctx.fillRect(px, py, T, 1);
        ctx.fillRect(px, py, 1, T);
      }
    }
  }
  ctx.fillStyle = '#4c3d34'; ctx.fillRect(0, 3 * T - 2, W * T, 4);
  ctx.fillStyle = '#eee1c9'; ctx.fillRect(2 * T, 2 * T + 2, 4 * T, 25);
  ctx.fillStyle = '#443d36'; ctx.fillRect(2 * T + 3, 2 * T + 5, 4 * T - 6, 18);
  ctx.fillStyle = '#79b8c5'; ctx.fillRect(2 * T + 6, 2 * T + 8, 4 * T - 12, 12);
  ctx.fillStyle = '#d8e5d7';
  ctx.fillRect(2 * T + 21, 2 * T + 8, 2, 12);
  ctx.fillRect(2 * T + 6, 2 * T + 13, 4 * T - 12, 2);
  ctx.fillStyle = '#9b7954'; ctx.fillRect(2 * T - 2, 2 * T + 26, 4 * T + 4, 3);
  drawHomeFurniture();
  drawHomeEntrance();
  ctx = mainCtx;
}

function drawHomeFurniture() {
  homeDecor.forEach(item => {
    const x = item.x * T, y = item.y * T, w = item.w * T, h = item.h * T;
    ctx.fillStyle = 'rgba(0,0,0,.24)';
    ctx.fillRect(x + 2, y + h - 1, w - 2, 3);
    if (item.kind === 'workdesk' || item.kind === 'desk') {
      ctx.fillStyle = '#4c3527'; ctx.fillRect(x, y + 5, w, h - 5);
      ctx.fillStyle = '#a47a4b'; ctx.fillRect(x + 2, y + 4, w - 4, 4);
      ctx.fillStyle = '#d3b77f'; ctx.fillRect(x + 3, y + 4, w - 6, 1);
      ctx.fillStyle = '#725137'; ctx.fillRect(x + 3, y + 10, w - 6, h - 13);
      ctx.fillStyle = '#d8c394'; ctx.fillRect(x + w - 15, y + 1, 9, 8);
      ctx.fillStyle = '#404449'; ctx.fillRect(x + w - 13, y + 3, 5, 1);
      ctx.fillRect(x + w - 13, y + 6, 5, 1);
      if (item.kind === 'workdesk') {
        ctx.fillStyle = '#31343a'; ctx.fillRect(x + 5, y - 1, 12, 11);
        ctx.fillStyle = '#74b9c8'; ctx.fillRect(x + 7, y + 1, 8, 6);
        ctx.fillStyle = '#c9e5dd'; ctx.fillRect(x + 8, y + 2, 2, 1);
        ctx.fillStyle = '#716044'; ctx.fillRect(x + 10, y + 10, 3, 3);
        ctx.fillStyle = '#e7e1d1'; ctx.fillRect(x + w - 30, y - 2, 9, 8);
        ctx.fillStyle = '#a95147'; ctx.fillRect(x + w - 28, y, 4, 1);
      }
    } else if (item.kind === 'dresser') {
      ctx.fillStyle = '#41322a'; ctx.fillRect(x, y, w, h);
      ctx.fillStyle = '#9a7650'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
      for (let row = 0; row < 3; row++) {
        const dy = y + 4 + row * 14;
        ctx.fillStyle = '#51443b'; ctx.fillRect(x + 3, dy, w - 6, 11);
        ctx.fillStyle = '#b48c5b'; ctx.fillRect(x + 6, dy + 2, w - 12, 1);
        ctx.fillStyle = '#d2bd91'; ctx.fillRect(x + w / 2 - 1, dy + 5, 3, 2);
      }
    } else if (item.kind === 'bed') {
      ctx.fillStyle = '#4a3b31'; ctx.fillRect(x, y + 3, w, h - 4);
      ctx.fillStyle = '#d6c9a8'; ctx.fillRect(x + 3, y + 5, w - 6, h - 11);
      ctx.fillStyle = '#f0e6ce'; ctx.fillRect(x + 5, y + 7, w - 10, h - 16);
      ctx.fillStyle = '#a99776'; ctx.fillRect(x + 5, y + h - 14, w - 10, 2);
      ctx.fillStyle = '#c6b997'; ctx.fillRect(x + 6, y + 7, 15, 11);
      ctx.fillStyle = '#eee4ce'; ctx.fillRect(x + 8, y + 8, 11, 8);
      ctx.fillStyle = '#7a6852'; ctx.fillRect(x + w - 5, y + 5, 2, h - 11);
    } else if (item.kind === 'table') {
      ctx.fillStyle = '#5a4535'; ctx.fillRect(x + 3, y + 5, w - 6, h - 5);
      ctx.fillStyle = '#c2a778'; ctx.fillRect(x, y + 3, w, 4);
      ctx.fillStyle = '#e7dfc8'; ctx.fillRect(x + 7, y + 1, 13, 12);
      ctx.fillStyle = '#9a8a6f'; ctx.fillRect(x + 9, y + 4, 9, 1);
      ctx.fillRect(x + 9, y + 7, 7, 1);
      ctx.fillStyle = '#e9e2d1'; ctx.fillRect(x + w - 21, y + 10, 12, 9);
      ctx.fillStyle = '#a75347'; ctx.fillRect(x + w - 19, y + 12, 8, 1);
    } else if (item.kind === 'chair') {
      ctx.fillStyle = '#41352e'; ctx.fillRect(x + 3, y + 2, 10, 8);
      ctx.fillStyle = '#907250'; ctx.fillRect(x + 4, y + 3, 8, 5);
      ctx.fillStyle = '#554338'; ctx.fillRect(x + 3, y + 9, 10, 4);
      ctx.fillStyle = '#302a27'; ctx.fillRect(x + 5, y + 13, 2, 3);
      ctx.fillRect(x + 10, y + 13, 2, 3);
    } else if (item.kind === 'plant') {
      ctx.fillStyle = '#deddd7'; ctx.fillRect(x + 3, y + 12, 11, 13);
      ctx.fillStyle = '#8c7659'; ctx.fillRect(x + 4, y + 23, 9, 2);
      ctx.fillStyle = '#4c7046'; ctx.fillRect(x + 6, y + 2, 3, 12);
      ctx.fillRect(x + 2, y + 5, 6, 5); ctx.fillRect(x + 8, y + 7, 7, 4);
      ctx.fillStyle = '#78945c'; ctx.fillRect(x + 7, y + 1, 4, 5);
      ctx.fillStyle = '#b9c38c'; ctx.fillRect(x + 9, y + 2, 2, 2);
    } else if (item.kind === 'bin') {
      ctx.fillStyle = '#6d7474'; ctx.fillRect(x + 2, y + 3, 12, 14);
      ctx.fillStyle = '#aab0ad'; ctx.fillRect(x + 4, y + 5, 8, 1);
      ctx.fillStyle = '#42494b'; ctx.fillRect(x + 1, y + 2, 14, 2);
      ctx.fillStyle = '#d5d8d3'; ctx.fillRect(x + 5, y + 9, 6, 1);
    }
  });
}

function drawHomeEntrance() {
  const x = 9 * T, y = 14 * T;
  ctx.fillStyle = '#49372b'; ctx.fillRect(x + 8, y + 2, 2 * T, 14);
  ctx.fillStyle = '#94713f'; ctx.fillRect(x + 10, y + 4, 2 * T - 4, 12);
  ctx.fillStyle = '#d6b869'; ctx.fillRect(x + 2 * T - 8, y + 9, 2, 2);
  ctx.fillStyle = '#66533d'; ctx.fillRect(x + 5, y + 15, 2 * T - 10, 1);
}

function buildShop() {
  const W = shop.w, H = shop.h;
  shop.solid.fill(0);
  shopDecor = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      shop.solid[y * W + x] = x === 0 || x === W - 1 || y <= 2 ||
        (y === H - 1 && ![9, 10, 11].includes(x)) ? 1 : 0;
    }
  }
  const addShelf = (x, y, w, h, kind) => {
    shopDecor.push({ x, y, w, h, kind });
    for (let ty = y; ty < y + h; ty++) {
      for (let tx = x; tx < x + w; tx++) shop.solid[ty * W + tx] = 1;
    }
  };
  addShelf(1, 3, 4, 2, 'cooler');
  addShelf(6, 3, 5, 2, 'wallShelf');
  addShelf(13, 3, 5, 2, 'wallShelf');
  addShelf(2, 7, 2, 4, 'aisle');
  addShelf(6, 7, 2, 4, 'aisle');
  addShelf(12, 7, 2, 4, 'aisle');
  addShelf(16, 7, 2, 4, 'aisle');
  addShelf(15, 11, 3, 2, 'checkout');

  shopLayer = document.createElement('canvas');
  shopLayer.width = W * T; shopLayer.height = H * T;
  ctx = shopLayer.getContext('2d');
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const px = x * T, py = y * T;
      if (y < 3) {
        ctx.fillStyle = y % 2 ? '#e8deca' : '#d8cbb4';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(120,92,62,.18)';
        ctx.fillRect(px + 3, py, 1, T);
        ctx.fillRect(px + 12, py, 1, T);
      } else {
        ctx.fillStyle = (x + y) % 2 ? '#c9c4b8' : '#d5d0c5';
        ctx.fillRect(px, py, T, T);
        ctx.fillStyle = 'rgba(77,71,61,.18)';
        ctx.fillRect(px, py, T, 1);
        ctx.fillRect(px, py, 1, T);
      }
    }
  }
  ctx.fillStyle = '#493b31'; ctx.fillRect(0, 3 * T - 3, W * T, 4);
  ctx.fillStyle = '#a83135'; ctx.fillRect(0, 3 * T + 2, W * T, 3);
  ctx.fillStyle = '#f2e9d6'; ctx.fillRect(2 * T, 2 * T + 2, 4 * T, 24);
  ctx.fillStyle = '#413a34'; ctx.fillRect(2 * T + 3, 2 * T + 5, 4 * T - 6, 17);
  ctx.fillStyle = '#82c2cf'; ctx.fillRect(2 * T + 6, 2 * T + 8, 4 * T - 12, 11);
  ctx.fillStyle = '#d9ebe3';
  ctx.fillRect(2 * T + 21, 2 * T + 8, 2, 11);
  ctx.fillRect(2 * T + 6, 2 * T + 12, 4 * T - 12, 2);
  shopDecor.forEach(drawShopFurniture);
  drawShopSigns();
  drawShopEntrance();
  ctx = mainCtx;
}

function drawShopFurniture(item) {
  const x = item.x * T, y = item.y * T, w = item.w * T, h = item.h * T;
  ctx.fillStyle = 'rgba(0,0,0,.25)';
  ctx.fillRect(x + 2, y + h - 1, w - 2, 3);
  if (item.kind === 'cooler' || item.kind === 'wallShelf') {
    ctx.fillStyle = '#38383a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = item.kind === 'cooler' ? '#626a6b' : '#80694f';
    ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    for (let row = 0; row < 2; row++) {
      const sy = y + 4 + row * 13;
      ctx.fillStyle = item.kind === 'cooler' ? '#b9c4c2' : '#d3c5a5';
      ctx.fillRect(x + 3, sy + 8, w - 6, 2);
      for (let bx = x + 5; bx < x + w - 7; bx += 10) {
        const colors = ['#b34236', '#e0aa43', '#478b88', '#668b4c', '#3f7294'];
        ctx.fillStyle = colors[Math.floor((bx + sy) / 10) % colors.length];
        ctx.fillRect(bx, sy, 6, 7);
        ctx.fillStyle = 'rgba(255,245,220,.55)';
        ctx.fillRect(bx + 1, sy + 1, 2, 1);
        if (item.kind === 'cooler') {
          ctx.fillStyle = '#e8e4d7'; ctx.fillRect(bx, sy + 6, 6, 2);
        }
      }
    }
    if (item.kind === 'cooler') {
      ctx.fillStyle = '#dae0d8'; ctx.fillRect(x + w - 6, y + 3, 2, h - 6);
      ctx.fillStyle = '#87bbc5'; ctx.fillRect(x + w - 4, y + 4, 1, 8);
    }
  } else if (item.kind === 'aisle') {
    ctx.fillStyle = '#47403a'; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = '#a59070'; ctx.fillRect(x + 2, y + 2, w - 4, h - 4);
    for (let row = 0; row < 4; row++) {
      const sy = y + 4 + row * 14;
      ctx.fillStyle = '#58483b'; ctx.fillRect(x + 3, sy + 10, w - 6, 2);
      const colors = ['#c44938', '#e2b64f', '#4f8e83', '#5278a0', '#78964c'];
      for (let bx = x + 4; bx < x + w - 7; bx += 10) {
        ctx.fillStyle = colors[(row + bx) % colors.length];
        ctx.fillRect(bx, sy, 6, 9);
        ctx.fillStyle = 'rgba(255,255,255,.4)';
        ctx.fillRect(bx + 1, sy + 1, 2, 1);
      }
    }
  } else if (item.kind === 'checkout') {
    ctx.fillStyle = '#3a3633'; ctx.fillRect(x, y + 3, w, h - 3);
    ctx.fillStyle = '#98734e'; ctx.fillRect(x + 2, y + 4, w - 4, h - 6);
    ctx.fillStyle = '#dbbf88'; ctx.fillRect(x + 2, y + 4, w - 4, 3);
    ctx.fillStyle = '#5a4030'; ctx.fillRect(x + 5, y + 10, w - 10, h - 15);
    ctx.fillStyle = '#303b3e'; ctx.fillRect(x + 6, y - 3, 10, 10);
    ctx.fillStyle = '#66c4c5'; ctx.fillRect(x + 8, y - 1, 6, 5);
    ctx.fillStyle = '#d7d2c5'; ctx.fillRect(x + w - 16, y + 1, 9, 7);
    ctx.fillStyle = '#b83b39'; ctx.fillRect(x + w - 14, y + 3, 5, 1);
    ctx.fillStyle = '#e2bd5d'; ctx.fillRect(x + 20, y - 3, 6, 6);
  }
}

function drawShopSigns() {
  [[4, 6], [9, 6], [15, 6]].forEach(([tx, ty], i) => {
    const x = tx * T, y = ty * T;
    ctx.fillStyle = '#9f282e'; ctx.fillRect(x, y, 24, 8);
    ctx.fillStyle = '#f1dfc8'; ctx.fillRect(x + 2, y + 2, 20, 4);
    ctx.fillStyle = '#b43334'; ctx.font = 'bold 4px monospace';
    ctx.textAlign = 'center'; ctx.fillText(i === 0 ? 'SALE' : i === 1 ? 'NEW' : 'SALE', x + 12, y + 6);
    ctx.textAlign = 'left';
  });
  const x = 18 * T, y = 8 * T;
  ctx.fillStyle = '#3d3935'; ctx.fillRect(x, y, 7, 22);
  ctx.fillStyle = '#bd3434'; ctx.fillRect(x + 2, y + 2, 3, 9);
  ctx.fillStyle = '#ded6c5'; ctx.fillRect(x + 2, y + 12, 3, 7);
}

function drawShopEntrance() {
  const x = 9 * T, y = 14 * T;
  ctx.fillStyle = '#49372b'; ctx.fillRect(x + 8, y + 2, 2 * T, 14);
  ctx.fillStyle = '#8e693b'; ctx.fillRect(x + 10, y + 4, 2 * T - 4, 12);
  ctx.fillStyle = '#dbbd69'; ctx.fillRect(x + 2 * T - 8, y + 9, 2, 2);
  ctx.fillStyle = '#66533d'; ctx.fillRect(x + 5, y + 15, 2 * T - 10, 1);
}

function drawOfficeRug() {
  const x = 6 * T, y = 5 * T + 8, w = 8 * T, h = 4 * T;
  ctx.fillStyle = 'rgba(0,0,0,.16)'; ctx.fillRect(x + 2, y + 3, w, h);
  ctx.fillStyle = '#455b57'; ctx.fillRect(x, y, w, h);
  ctx.fillStyle = '#63766b'; ctx.fillRect(x + 3, y + 3, w - 6, h - 6);
  ctx.fillStyle = '#a8895c';
  ctx.fillRect(x + 5, y + 5, w - 10, 1);
  ctx.fillRect(x + 5, y + h - 6, w - 10, 1);
  ctx.fillRect(x + 5, y + 5, 1, h - 10);
  ctx.fillRect(x + w - 6, y + 5, 1, h - 10);
  ctx.fillStyle = 'rgba(212,196,152,.16)';
  for (let px = x + 12; px < x + w - 8; px += 16) {
    ctx.fillRect(px, y + 8, 1, h - 16);
  }
}

function updateOffice(dt) {
  officeWorkers.forEach((worker, index) => {
    worker.typeT += dt;
    if (index === 0) return;
    if (worker.state === 'working') {
      worker.breakTimer -= dt;
      if (worker.breakTimer <= 0) {
        worker.route = [
          { x: 13 * T + 8, y: 8 * T + 8 },
          { x: 13 * T + 8, y: 6 * T + 8 }
        ];
        worker.routeIndex = 0;
        worker.state = 'walkingToWater';
      }
      return;
    }
    if (worker.state === 'drinking') {
      worker.breakTimer -= dt;
      if (worker.breakTimer <= 0) {
        worker.route = [
          { x: 13 * T + 8, y: 8 * T + 8 },
          { x: 11 * T, y: 8 * T + 8 }
        ];
        worker.routeIndex = 0;
        worker.state = 'walkingBack';
      }
      return;
    }
    const point = worker.route[worker.routeIndex];
    const dx = point.x - worker.x, dy = point.y - worker.y, distance = Math.hypot(dx, dy);
    if (distance < 1) {
      worker.x = point.x; worker.y = point.y; worker.routeIndex++;
      if (worker.routeIndex >= worker.route.length) {
        worker.route = [];
        if (worker.state === 'walkingToWater') {
          worker.state = 'drinking'; worker.breakTimer = 1.5;
        } else {
          worker.state = 'working'; worker.breakTimer = 12;
        }
      }
      return;
    }
    const step = Math.min(distance, 30 * dt);
    const nx = worker.x + dx / distance * step, ny = worker.y + dy / distance * step;
    if (!solidAt(nx - 4, ny - 2) && !solidAt(nx + 4, ny - 2) &&
        !solidAt(nx - 4, ny + 3) && !solidAt(nx + 4, ny + 3)) {
      worker.x = nx; worker.y = ny;
      worker.dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
    }
  });
}

function drawOfficeWindows() {
  [5, 9, 13].forEach(x => {
    const px = x * T, py = 2;
    ctx.fillStyle = '#302f34'; ctx.fillRect(px - 1, py, 28, 22);
    ctx.fillStyle = '#755333'; ctx.fillRect(px + 2, py + 2, 24, 18);
    ctx.fillStyle = '#76b7d2'; ctx.fillRect(px + 4, py + 4, 20, 13);
    ctx.fillStyle = '#c8e8ef'; ctx.fillRect(px + 6, py + 5, 2, 10);
    ctx.fillStyle = '#4d86a5'; ctx.fillRect(px + 4, py + 15, 20, 2);
    ctx.fillStyle = '#d9b475'; ctx.fillRect(px - 1, py + 20, 28, 2);
    ctx.fillStyle = '#342d2c'; ctx.fillRect(px + 13, py + 3, 2, 15);
  });
}

function drawOfficeFurniture() {
  officeDecor.forEach(item => {
    const x = item.x * T, y = item.y * T, w = item.w * T, h = item.h * T;
    const visualH = item.kind === 'bookcase' || item.kind === 'filing' ? 24 : h;
    ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(x + 2, y + visualH - 1, w - 2, 2);
    if (item.kind === 'plant') {
      ctx.fillStyle = '#8d552e'; ctx.fillRect(x + 5, y + 11, 7, 5);
      ctx.fillStyle = '#b8753c'; ctx.fillRect(x + 6, y + 11, 5, 1);
      ctx.fillStyle = '#315d37'; ctx.fillRect(x + 3, y + 4, 10, 8);
      ctx.fillRect(x + 1, y + 7, 6, 5); ctx.fillRect(x + 10, y + 6, 5, 6);
      ctx.fillStyle = '#57934d'; ctx.fillRect(x + 5, y + 2, 6, 7);
      ctx.fillStyle = '#a3c764'; ctx.fillRect(x + 7, y + 4, 2, 2);
    } else if (item.kind === 'watercooler') {
      ctx.fillStyle = '#34363b'; ctx.fillRect(x + 3, y + 11, 10, 13);
      ctx.fillStyle = '#d7d4cb'; ctx.fillRect(x + 4, y + 13, 8, 9);
      ctx.fillStyle = '#8c8d89'; ctx.fillRect(x + 5, y + 15, 6, 3);
      ctx.fillStyle = '#4b92d4'; ctx.fillRect(x + 5, y + 2, 6, 9);
      ctx.fillStyle = '#82c0ed'; ctx.fillRect(x + 6, y + 3, 2, 5);
      ctx.fillStyle = '#34363b'; ctx.fillRect(x + 5, y + 20, 2, 2); ctx.fillRect(x + 9, y + 20, 2, 2);
    } else if (item.kind === 'bookcase' || item.kind === 'filing') {
      const cabinetH = 24;
      ctx.fillStyle = '#30251d'; ctx.fillRect(x, y, w, cabinetH);
      ctx.fillStyle = item.kind === 'filing' ? '#55585e' : '#79502a'; ctx.fillRect(x + 2, y + 2, w - 4, cabinetH - 4);
      if (item.kind === 'bookcase') {
        [y + 3, y + 13].forEach((by, row) => {
          ['#38668a', '#ae4430', '#d0a148', '#55794d', '#53608e', '#be6b32'].forEach((color, i) => {
            const bx = x + 3 + i * 4;
            if (bx + 3 < x + w - 1) {
              ctx.fillStyle = color; ctx.fillRect(bx, by, 3, 7);
              ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(bx, by, 1, 2);
            }
          });
          ctx.fillStyle = '#bd9352'; ctx.fillRect(x + 1, by + 7, w - 2, 2);
          if (!row) {
            ctx.fillStyle = '#30251d'; ctx.fillRect(x + 2, by + 10, w - 4, 1);
          }
        });
      } else {
        ctx.fillStyle = '#777b80'; ctx.fillRect(x + 2, y + 4, w - 4, 10);
        ctx.fillStyle = '#383b41'; ctx.fillRect(x + 3, y + 6, w - 6, 1);
        ctx.fillStyle = '#d9d8d3'; ctx.fillRect(x + w / 2 - 2, y + 9, 4, 2);
        ctx.fillStyle = '#777b80'; ctx.fillRect(x + 2, y + 18, w - 4, 10);
        ctx.fillStyle = '#383b41'; ctx.fillRect(x + 3, y + 20, w - 6, 1);
        ctx.fillStyle = '#d9d8d3'; ctx.fillRect(x + w / 2 - 2, y + 23, 4, 2);
      }
    } else if (item.kind === 'desk') {
        const deskW = 27, deskX = x + w / 2 - deskW / 2, deskY = y + 9;
        ctx.fillStyle = 'rgba(0,0,0,.2)'; ctx.fillRect(deskX + 2, deskY + 20, deskW, 3);
        ctx.fillStyle = '#33251a'; ctx.fillRect(deskX, deskY, deskW, 18);
        ctx.fillStyle = '#9a6327'; ctx.fillRect(deskX + 2, deskY + 2, deskW - 4, 8);
        ctx.fillStyle = '#d3a95e'; ctx.fillRect(deskX + 3, deskY + 2, deskW - 6, 2);
        ctx.fillStyle = '#70461f'; ctx.fillRect(deskX + 2, deskY + 10, deskW - 4, 6);
        ctx.fillStyle = '#d6a34f'; ctx.fillRect(deskX + 5, deskY + 12, 3, 2);
        ctx.fillRect(deskX + deskW - 8, deskY + 12, 3, 2);
        const monitorX = deskX + deskW / 2 - 5;
        ctx.fillStyle = '#242a30'; ctx.fillRect(monitorX, deskY - 7, 10, 7);
        ctx.fillStyle = item.x < 10 ? '#73b6d4' : '#c34e48'; ctx.fillRect(monitorX + 1, deskY - 6, 8, 5);
        ctx.fillStyle = 'rgba(255,255,255,.45)'; ctx.fillRect(monitorX + 2, deskY - 6, 2, 1);
        ctx.fillStyle = '#35383c'; ctx.fillRect(monitorX + 4, deskY, 2, 3);
        ctx.fillRect(monitorX + 2, deskY + 3, 6, 1);
        ctx.fillStyle = '#d6d3ca'; ctx.fillRect(deskX + deskW - 10, deskY + 4, 5, 4);
        ctx.fillStyle = '#666a6d'; ctx.fillRect(deskX + deskW - 10, deskY + 5, 4, 1);
        ctx.fillRect(deskX + deskW - 10, deskY + 7, 4, 1);
    } else if (item.kind === 'printer' || item.kind === 'cabinet') {
      ctx.fillStyle = '#303136'; ctx.fillRect(x, y + 2, w, h - 3);
      ctx.fillStyle = item.kind === 'printer' ? '#bdbab1' : '#65421f'; ctx.fillRect(x + 3, y + 4, w - 6, h - 8);
      if (item.kind === 'printer') {
        ctx.fillStyle = '#777b7c'; ctx.fillRect(x + 3, y + 4, w - 6, 5);
        ctx.fillStyle = '#292b2f'; ctx.fillRect(x + 5, y + 5, w - 10, 3);
        ctx.fillStyle = '#e6e3d9'; ctx.fillRect(x + 3, y + 9, w - 6, 2);
        ctx.fillStyle = '#9fd0dc'; ctx.fillRect(x + 4, y + 12, 3, 2);
      } else {
        ctx.fillStyle = '#30251d'; ctx.fillRect(x + 4, y + 6, w - 8, 1);
        ctx.fillStyle = '#d6a34f'; ctx.fillRect(x + w / 2 - 1, y + 9, 2, 3);
      }
    }
  });
}

function drawOfficeEntrance() {
  const x = 9 * T, y = 14 * T;
  ctx.fillStyle = '#30251d'; ctx.fillRect(x + 8, y + 7, 2 * T, 9);
  ctx.fillStyle = '#633f22'; ctx.fillRect(x + 10, y + 9, 2 * T - 4, 7);
  ctx.fillStyle = '#9c6b35'; ctx.fillRect(x + 13, y + 10, 2, 5);
  ctx.fillStyle = '#d6a34f'; ctx.fillRect(x + 2 * T - 1, y + 12, 2, 2);
  ctx.fillStyle = '#36565b'; ctx.fillRect(x + 5, y + 15, 2 * T - 10, 2);
  ctx.fillStyle = '#75b8ba'; ctx.fillRect(x + 8, y + 15, 2 * T - 16, 1);
}

function drawOfficeNoticeboard() {
  const x = 16 * T, y = 3 * T;
  ctx.fillStyle = '#343236'; ctx.fillRect(x, y, 2 * T, T);
  ctx.fillStyle = '#b8a98d'; ctx.fillRect(x + 2, y + 2, 2 * T - 4, T - 4);
  ctx.fillStyle = '#e5dfd2'; ctx.fillRect(x + 4, y + 4, 2 * T - 8, T - 8);
  [[x + 7, y + 7, '#d66a59'], [x + 21, y + 7, '#6da18a']].forEach(([px, py, color]) => {
    ctx.fillStyle = color; ctx.fillRect(px, py, 5, 6);
    ctx.fillStyle = '#f6e8c7'; ctx.fillRect(px + 1, py + 2, 3, 1);
  });
}

function drawOfficeWorker(worker) {
  const working = worker.state === 'working';
  const x = Math.round(worker.x - 6), y = Math.round(worker.y - 16 + (working ? Math.floor(worker.typeT * 4) % 2 : 0));
  const walking = worker.state === 'walkingToWater' || worker.state === 'walkingBack';
  const step = walking ? Math.floor(worker.typeT * 8) % 2 : Math.floor(worker.typeT * 5) % 2;
  chibi(x, y, worker.look, worker.dir, step);
  if (worker.state === 'working') {
    ctx.fillStyle = worker.typeT % .8 < .4 ? '#f3c9a0' : '#d2a27f';
    ctx.fillRect(x + 2, y + 12, 2, 1);
    ctx.fillRect(x + 8, y + 12, 2, 1);
  } else if (worker.state === 'drinking') {
    ctx.fillStyle = '#f4eee1'; ctx.fillRect(x + 11, y + 7, 3, 4);
    ctx.fillStyle = '#75b8d2'; ctx.fillRect(x + 11, y + 9, 3, 2);
  }
}

function drawBankInteriorDetails(width) {
  for (let y = 8; y < 18; y++) {
    for (let x = 1; x < width - 1; x++) {
      if ((x + y) % 2) continue;
      const px = x * T, py = y * T;
      ctx.fillStyle = 'rgba(106,84,55,.12)';
      ctx.fillRect(px + 2, py + 2, 1, 1);
      ctx.fillRect(px + 13, py + 13, 1, 1);
    }
  }
  ctx.fillStyle = '#6a4a2f'; ctx.fillRect(T, 7 * T - 4, (width - 2) * T, 4);
  ctx.fillStyle = '#d2ad62'; ctx.fillRect(T, 7 * T - 6, (width - 2) * T, 2);
  [4, 11, 18, 25].forEach(x => {
    const px = x * T;
    ctx.fillStyle = '#342b2b'; ctx.fillRect(px + 3, 2, 10, 4);
    ctx.fillStyle = '#e0b85f'; ctx.fillRect(px + 4, 3, 8, 2);
    ctx.fillStyle = 'rgba(255,225,155,.10)'; ctx.fillRect(px - 5, 6, 26, 96);
  });
  [2, 26].forEach(x => {
    const px = x * T;
    ctx.fillStyle = '#302c38'; ctx.fillRect(px + 2, 2 * T, 12, 12);
    ctx.fillStyle = '#5b657a'; ctx.fillRect(px + 4, 2 * T + 2, 8, 6);
    ctx.fillStyle = '#59d8c0'; ctx.fillRect(px + 5, 2 * T + 3, 2, 2);
    ctx.fillStyle = '#e0b84a'; ctx.fillRect(px + 9, 2 * T + 3, 2, 2);
  });
  [3, 10, 17, 24].forEach(x => {
    const px = x * T;
    ctx.fillStyle = '#c29a55'; ctx.fillRect(px + 2, 7 * T - 2, 12, 5);
    ctx.fillStyle = '#f1d89b'; ctx.fillRect(px + 4, 7 * T - 1, 8, 2);
  });
}

function drawDecor(d) {
  for (let j = 0; j < d.h; j++) {
    for (let i = 0; i < d.w; i++) {
      const x = (d.x + i) * T, y = (d.y + j) * T;
      if (d.k === 'counter') {
        ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x, y + 11, T, 5);
        ctx.fillStyle = OUT; ctx.fillRect(x, y + 2, T, 14);
        ctx.fillStyle = '#63452f'; ctx.fillRect(x + 1, y + 4, T - 2, 10);
        ctx.fillStyle = '#99754a'; ctx.fillRect(x + 1, y + 2, T - 2, 3);
        ctx.fillStyle = '#d7bb7e'; ctx.fillRect(x + 1, y + 2, T - 2, 1);
        ctx.fillStyle = '#3a312d'; ctx.fillRect(x + 3, y + 6, 10, 5);
        ctx.fillStyle = '#47737a'; ctx.fillRect(x + 4, y + 6, 8, 3);
        ctx.fillStyle = '#9fd0dc'; ctx.fillRect(x + 5, y + 7, 5, 1);
        ctx.fillStyle = '#d5b374'; ctx.fillRect(x + 4, y + 12, 2, 1); ctx.fillRect(x + 10, y + 12, 2, 1);
      } else if (d.k === 'desk') {
        ctx.fillStyle = OUT; ctx.fillRect(x, y + 2, T, 14);
        ctx.fillStyle = '#8a6a44'; ctx.fillRect(x + 1, y + 3, T - 2, 11);
        if (i === 0) { ctx.fillStyle = OUT; ctx.fillRect(x + 4, y + 3, 8, 6); ctx.fillStyle = '#7fe0c9'; ctx.fillRect(x + 5, y + 4, 6, 4); }
      } else if (d.k === 'shelf') {
        ctx.fillStyle = OUT; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#5a4030'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ['#c0553f', '#4a8fc9', '#e0b84a', '#6aa86a'].forEach((c, n) => {
          ctx.fillStyle = c; ctx.fillRect(x + 2 + n * 3, y + 2, 2, 5); ctx.fillRect(x + 3 + n * 3, y + 9, 2, 5);
        });
      } else if (d.k === 'crate') {
        ctx.fillStyle = OUT; ctx.fillRect(x, y, T, T);
        ctx.fillStyle = '#a8793f'; ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
        ctx.fillStyle = '#7a5528'; ctx.fillRect(x + 1, y + 7, T - 2, 2); ctx.fillRect(x + 7, y + 1, 2, T - 2);
      } else if (d.k === 'plant') {
        ctx.fillStyle = '#a8523f'; ctx.fillRect(x + 4, y + 9, 8, 7);
        ctx.fillStyle = '#3f7a45'; ctx.fillRect(x + 2, y + 2, 12, 8);
        ctx.fillStyle = '#5c9a55'; ctx.fillRect(x + 4, y + 1, 5, 4);
      }
    }
  }
}

function drawCameraSprite(camera) {
  const x = Math.round(camera.x), y = Math.round(camera.y - 8);
  ctx.fillStyle = OUT; ctx.fillRect(x - 4, y - 3, 8, 6);
  ctx.fillStyle = '#8d9bab'; ctx.fillRect(x - 3, y - 2, 6, 4);
  ctx.fillStyle = Math.floor(performance.now() / 400) % 2 ? '#ee6a74' : '#5a2a30';
  ctx.fillRect(x + Math.round(Math.cos(camera.ang) * 2) - 1, y + Math.round(Math.sin(camera.ang) * 2) - 1, 2, 2);
}
function drawDisguise(x, y) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = OUT; ctx.fillRect(x + 1, y - 2, 12, 3);
  ctx.fillStyle = '#e0b84a'; ctx.fillRect(x + 2, y - 1, 10, 1);
}
function drawSmokeCloud() {
  const t = performance.now() / 200;
  ctx.globalAlpha = Math.min(.55, smokeT * .4);
  ctx.fillStyle = '#cfd3dc';
  for (let i = 0; i < 9; i++) {
    const a = i * .7 + t * .3, r = 6 + (i % 3) * 5;
    ctx.fillRect(Math.round(player.x + 4 + Math.cos(a) * r) - 3, Math.round(player.y + 2 + Math.sin(a) * r * .7) - 3, 6, 6);
  }
  ctx.globalAlpha = 1;
}
function drawVault() {
  const x = (1 + 7 * vaultRoom + 2) * T, y = T;
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 34, 34);
  if (!vaultOpen) {
    ctx.fillStyle = '#7b8591'; ctx.fillRect(x, y, 32, 32);
    ctx.fillStyle = '#a0aab5'; ctx.fillRect(x + 3, y + 3, 26, 26);
    ctx.fillStyle = '#d9b84a'; ctx.fillRect(x + 14, y + 7, 4, 18); ctx.fillRect(x + 7, y + 14, 18, 4);
    return;
  }
  ctx.fillStyle = '#16181f'; ctx.fillRect(x, y, 32, 32);
  ctx.fillStyle = '#7b8591'; ctx.fillRect(x - 7, y, 6, 32);
  if (hasLoot) return;
  ctx.fillStyle = '#e0b84a'; ctx.fillRect(x + 4, y + 23, 11, 5); ctx.fillRect(x + 16, y + 23, 11, 5); ctx.fillRect(x + 10, y + 18, 11, 5);
  ctx.fillStyle = '#fff2b0'; ctx.fillRect(x + 5, y + 24, 4, 1); ctx.fillRect(x + 11, y + 19, 4, 1);
  ctx.fillStyle = '#3f8a4f'; ctx.fillRect(x + 4, y + 6, 10, 10); ctx.fillRect(x + 18, y + 8, 9, 9);
  words('$', x + 9, y + 14, '#cfe9d0', 'bold 8px monospace', 'center');
  ctx.fillStyle = '#5fd8c0'; ctx.fillRect(x + 15, y + 15, 2, 2);
  ctx.fillStyle = '#ee6a74'; ctx.fillRect(x + 12, y + 17, 2, 2);
}

/* ---------- gambar kota ---------- */
function groundTile(tx, ty) {
  const x = tx * T, y = ty * T, g = ground(tx, ty), h = hash(tx, ty) % 100;
  if (g === 'r') {
    ctx.fillStyle = '#737865'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = 'rgba(255,255,255,.035)';
    if (h < 24) ctx.fillRect(x + h % 13, y + (h >> 2) % 13, 2, 1);
    ctx.fillStyle = '#b9b78c';
    if ((ty === 11 || ty === 25) && !within(tx, roadCols) && tx % 2 === 0) ctx.fillRect(x + 2, y + 7, 12, 2);
    if ((tx === 15 || tx === 35) && !within(ty, roadRows) && ty % 2 === 0) ctx.fillRect(x + 7, y + 2, 2, 12);
  } else if (g === 's') {
    ctx.fillStyle = '#a9aa8a'; ctx.fillRect(x, y, T, T);
    ctx.fillStyle = '#979878'; ctx.fillRect(x, y + 7, T, 1);
    ctx.fillRect(x + (ty % 2 ? 4 : 11), y, 1, 7); ctx.fillRect(x + (ty % 2 ? 11 : 4), y + 8, 1, 8);
    if (h < 9) { ctx.fillStyle = '#c2c29e'; ctx.fillRect(x + 3, y + 3, 2, 2); }
  } else {
    ctx.fillStyle = '#6d8b4c'; ctx.fillRect(x, y, T, T);
    if (h < 22) { ctx.fillStyle = '#84a35a'; ctx.fillRect(x + h % 11 + 2, y + h % 9 + 3, 2, 2); ctx.fillRect(x + h % 7 + 6, y + h % 5 + 9, 2, 1); }
    if (h > 94) { ctx.fillStyle = '#ecd98e'; ctx.fillRect(x + 5, y + 6, 2, 2); }
  }
}

function drawCrosswalks() {
  ctx.fillStyle = '#e5e2cc';
  roadRows.forEach(([rowStart]) => {
    const roadY = rowStart * T;
    roadCols.forEach(([colStart]) => {
      const roadX = colStart * T;
      [-38, 54].forEach(offset => {
        const x = roadX + offset;
        for (let stripe = 0; stripe < 5; stripe++) ctx.fillRect(x, roadY + 4 + stripe * 8, 32, 3);
      });
    });
  });
  roadCols.forEach(([colStart]) => {
    const roadX = colStart * T;
    roadRows.forEach(([rowStart, rowEnd]) => {
      [rowStart * T - 36, (rowEnd + 1) * T + 4].forEach(y => {
        for (let stripe = 0; stripe < 5; stripe++) ctx.fillRect(roadX + 4 + stripe * 8, y, 3, 32);
      });
    });
  });
}

function drawBuilding(b) {
  const x = b.x * T, y = b.y * T, w = b.w * T, h = b.h * T, fy = y + h - 48, dx = x + w / 2;
  ctx.fillStyle = 'rgba(0,0,0,.22)'; ctx.fillRect(x + 4, y + h, w, 5);
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
  ctx.fillStyle = b.roof; ctx.fillRect(x, y, w, h - 48);
  ctx.fillStyle = 'rgba(0,0,0,.18)';
  for (let r = y + 7, i = 0; r < fy - 2; r += 7, i++) {
    ctx.fillRect(x, r, w, 1);
    for (let c = x + (i % 2) * 6; c < x + w; c += 12) ctx.fillRect(c, r - 7, 1, 7);
  }
  ctx.fillStyle = 'rgba(255,255,255,.12)'; ctx.fillRect(x, y, w, 3);
  ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(x, fy - 2, w, 3);
  ctx.fillStyle = b.wall; ctx.fillRect(x, fy + 1, w, 47);
  if (b.bank) {
    for (let c = x + 10; c < x + w - 8; c += 22) {
      if (Math.abs(c + 3 - dx) < 16) continue;
      ctx.fillStyle = '#efe6c6'; ctx.fillRect(c, fy + 3, 6, 45);
      ctx.fillStyle = '#b9ae88'; ctx.fillRect(c + 4, fy + 3, 2, 45);
    }
    words('$', dx, y + 38, '#e0b84a', 'bold 30px monospace', 'center');
  } else {
    for (let wx = x + 8; wx + 10 < x + w - 4; wx += 20) {
      if (Math.abs(wx + 5 - dx) < 14) continue;
      ctx.fillStyle = OUT; ctx.fillRect(wx - 2, fy + 6, 14, 17);
      ctx.fillStyle = '#26394e'; ctx.fillRect(wx - 1, fy + 7, 12, 14);
      ctx.fillStyle = hash(wx, y) % 3 === 0 ? '#e5c978' : '#35506a';
      ctx.fillRect(wx, fy + 8, 10, 12);
      ctx.fillStyle = '#8fb4c4'; ctx.fillRect(wx + 1, fy + 9, 4, 4);
      ctx.fillStyle = 'rgba(255,255,255,.32)'; ctx.fillRect(wx + 7, fy + 8, 2, 12);
      ctx.fillStyle = '#5a4938'; ctx.fillRect(wx - 2, fy + 22, 14, 2);
    }
  }
  ctx.fillStyle = OUT; ctx.fillRect(dx - 7, y + h - 19, 14, 19);
  ctx.fillStyle = b.bank ? '#b9ae88' : '#4a3322'; ctx.fillRect(dx - 6, y + h - 18, 12, 18);
  ctx.fillStyle = '#e0b84a'; ctx.fillRect(dx + 3, y + h - 9, 2, 2);
  ctx.fillStyle = b.awn; ctx.fillRect(dx - 11, y + h - 23, 22, 5);
  ctx.fillStyle = 'rgba(255,255,255,.35)';
  for (let s = dx - 11; s < dx + 11; s += 6) ctx.fillRect(s, y + h - 23, 3, 5);
  if (b.bank) { ctx.fillStyle = '#b9b9b0'; ctx.fillRect(dx - 20, y + h, 40, 3); }
  ctx.font = 'bold 9px monospace';
  const sw = ctx.measureText(b.name).width + 8;
  ctx.fillStyle = OUT; ctx.fillRect(dx - sw / 2 - 1, fy - 17, sw + 2, 16);
  ctx.fillStyle = b.bank ? '#e0b84a' : '#2d3446'; ctx.fillRect(dx - sw / 2, fy - 16, sw, 14);
  placeLabels.push({ s: b.name, x: dx, y: fy - 5, color: b.bank ? '#2a2010' : '#e8edf2', font: 'bold 9px monospace', align: 'center' });
}

function drawTree(tx, ty) {
  const bx = tx * T + 8, by = ty * T + 16;
  ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(bx - 9, by - 3, 18, 4);
  ctx.fillStyle = '#4a3426'; ctx.fillRect(bx - 2, by - 9, 4, 9);
  ctx.fillStyle = '#1b3324'; ctx.fillRect(bx - 14, by - 25, 28, 18); ctx.fillRect(bx - 11, by - 31, 22, 26);
  ctx.fillStyle = '#2f5a3a'; ctx.fillRect(bx - 13, by - 24, 26, 16); ctx.fillRect(bx - 10, by - 30, 20, 24);
  ctx.fillStyle = '#4e8a4a'; ctx.fillRect(bx - 11, by - 26, 12, 8); ctx.fillRect(bx - 8, by - 29, 10, 5);
  ctx.fillStyle = '#86b95c'; ctx.fillRect(bx - 8, by - 25, 5, 3);
  ctx.fillStyle = '#a5cb69'; ctx.fillRect(bx + 2, by - 27, 4, 3);
  ctx.fillStyle = '#235036'; ctx.fillRect(bx - 11, by - 13, 5, 3);
}
function drawLamp(tx, ty) {
  const x = tx * T + 7, y = ty * T;
  const pulse = .12 + (Math.sin(performance.now() / 700 + tx * 3) + 1) * .035;
  const glow = ctx.createRadialGradient(x, y - 14, 1, x, y - 14, 20);
  glow.addColorStop(0, `rgba(255,230,142,${pulse})`);
  glow.addColorStop(1, 'rgba(255,230,142,0)');
  ctx.fillStyle = glow; ctx.fillRect(x - 20, y - 34, 40, 40);
  ctx.fillStyle = '#2d3446'; ctx.fillRect(x, y - 12, 2, 28); ctx.fillRect(x - 3, y - 18, 8, 8);
  ctx.fillStyle = '#fff2bf'; ctx.fillRect(x - 2, y - 17, 6, 6);
  ctx.fillStyle = '#d4a84f'; ctx.fillRect(x - 3, y - 19, 8, 2);
}

function drawTrafficCar(car) {
  ctx.save();
  ctx.translate(car.x, car.y);
  const angle = car.axis === 'v' ? car.dir * Math.PI / 2 : car.dir < 0 ? Math.PI : 0;
  ctx.rotate(angle);
  ctx.fillStyle = 'rgba(0,0,0,.32)'; ctx.fillRect(-16, -5, 34, 13);
  ctx.fillStyle = '#222a35'; ctx.fillRect(-13, 4, 7, 6); ctx.fillRect(7, 4, 7, 6);
  ctx.fillStyle = OUT; ctx.fillRect(-18, -8, 36, 16);
  ctx.fillStyle = car.color; ctx.fillRect(-16, -7, 32, 12);
  ctx.fillStyle = 'rgba(255,255,255,.28)'; ctx.fillRect(-13, -6, 24, 2);
  ctx.fillStyle = '#26394e'; ctx.fillRect(-9, -7, 18, 9);
  ctx.fillStyle = '#9fc4cf'; ctx.fillRect(-7, -6, 6, 5); ctx.fillRect(1, -6, 6, 5);
  ctx.fillStyle = '#fff0b7'; ctx.fillRect(15, -5, 2, 3); ctx.fillRect(15, 2, 2, 3);
  ctx.fillStyle = '#8b3d42'; ctx.fillRect(-17, -5, 2, 3); ctx.fillRect(-17, 2, 2, 3);
  ctx.fillStyle = '#d8d7c5'; ctx.fillRect(-2, 2, 4, 2);
  ctx.restore();
}

function drawTrafficLights() {
  intersectionRows.forEach(roadY => intersectionCols.forEach(roadX => {
    const lights = [
      { x: roadX - 8, y: roadY - 8, axis: 'h' },
      { x: roadX + 56, y: roadY + 56, axis: 'v' }
    ];
    lights.forEach(light => {
      ctx.fillStyle = 'rgba(0,0,0,.24)'; ctx.fillRect(light.x - 2, light.y + 10, 6, 3);
      ctx.fillStyle = '#303744'; ctx.fillRect(light.x, light.y + 6, 2, 10);
      ctx.fillStyle = OUT; ctx.fillRect(light.x - 3, light.y - 5, 8, 12);
      ctx.fillStyle = '#4b5360'; ctx.fillRect(light.x - 2, light.y - 4, 6, 10);
      const state = signalState(light.axis);
      const colors = state === 'green'
        ? ['#692f35', '#a77a32', '#62d18b']
        : state === 'yellow'
          ? ['#692f35', '#ffcf59', '#365c47']
          : ['#ef5960', '#80622c', '#365c47'];
      colors.forEach((color, i) => {
        ctx.fillStyle = color;
        ctx.fillRect(light.x - 1, light.y - 3 + i * 3, 4, 2);
      });
    });
  }));
}

function drawCityAtmosphere(now) {
  const signAt = n => { const b = buildings.find(item => item.name === n); return { x: b.x * T + 16, y: b.y * T + 15 }; };
  const signs = [
    { ...signAt('TOKO'), w: 36, color: '#65e2c0', label: '24H' },
    { ...signAt('KAFE'), w: 38, color: '#ef6d74', label: 'OPEN' },
    { ...signAt('BIOSKOP'), w: 54, color: '#e2b84c', label: 'FILM' }
  ];
  signs.forEach((sign, index) => {
    if (sign.x + sign.w < cam.x || sign.x > cam.x + VW || sign.y < cam.y - 12 || sign.y > cam.y + VH) return;
    const flicker = (Math.floor(now / 180 + index * 19) % 23 === 0) ? .35 : 1;
    ctx.globalAlpha = flicker;
    ctx.fillStyle = sign.color;
    ctx.fillRect(sign.x - 3, sign.y - 3, sign.w + 6, 1);
    ctx.fillRect(sign.x - 3, sign.y + 11, sign.w + 6, 1);
    ctx.fillRect(sign.x - 3, sign.y - 3, 1, 15);
    ctx.fillRect(sign.x + sign.w + 2, sign.y - 3, 1, 15);
    ctx.fillStyle = '#101923';
    ctx.fillRect(sign.x, sign.y, sign.w, 9);
    ctx.fillStyle = sign.color;
    words(sign.label, sign.x + sign.w / 2, sign.y + 7, sign.color, 'bold 7px monospace', 'center');
    ctx.globalAlpha = 1;
  });

  [19, 29, 46].forEach((tileX, drainIndex) => {
    const x = tileX * T + 8, y = 12 * T + 8;
    if (x < cam.x - 10 || x > cam.x + VW + 10 || y < cam.y - 18 || y > cam.y + VH + 10) return;
    ctx.fillStyle = '#4e514c';
    ctx.fillRect(x - 5, y + 2, 10, 2);
    ctx.fillStyle = '#929386';
    ctx.fillRect(x - 4, y + 2, 1, 2); ctx.fillRect(x, y + 2, 1, 2); ctx.fillRect(x + 4, y + 2, 1, 2);
    for (let puff = 0; puff < 3; puff++) {
      const phase = (now / 650 + puff * .37 + drainIndex * .21) % 1;
      const rise = Math.floor(phase * 11);
      ctx.globalAlpha = (1 - phase) * .18;
      ctx.fillStyle = '#d4d5c7';
      ctx.fillRect(x + Math.sin(phase * 6 + puff) * 3 - 1, y - rise, 3, 3);
    }
    ctx.globalAlpha = 1;
  });
}

function drawPoliceOfficer(officer) {
  const look = { hair: '#24354b', skin: '#edc39e', top: '#31588a', bot: '#202d45', x: 'cap' };
  chibi(officer.x - 6, officer.y - 16, look, 'down', Math.floor(officer.step * 7) % 2);
  ctx.fillStyle = '#56c8ff'; ctx.fillRect(officer.x - 5, officer.y - 16, 2, 2);
  ctx.fillStyle = '#f05d69'; ctx.fillRect(officer.x - 1, officer.y - 16, 2, 2);
  ctx.fillStyle = '#e6dfb5'; ctx.fillRect(officer.x - 2, officer.y - 6, 3, 2);
}

function trafficSpeed(car) {
  const length = car.axis === 'h' ? city.w * T : city.h * T;
  let speed = car.speed;
  const lane = car.axis === 'h' ? car.y : car.x;
  let nearestGap = Infinity;
  trafficCars.forEach(other => {
    if (other === car || other.axis !== car.axis || other.dir !== car.dir) return;
    if (Math.abs((other.axis === 'h' ? other.y : other.x) - lane) > 2) return;
    const position = car.axis === 'h' ? car.x : car.y;
    const otherPosition = car.axis === 'h' ? other.x : other.y;
    const gap = ((otherPosition - position) * car.dir + length) % length;
    if (gap > 0 && gap < nearestGap) nearestGap = gap;
  });
  if (nearestGap < 54) speed = Math.min(speed, Math.max(0, (nearestGap - 42) * 1.5));

  if (!signalAllows(car.axis)) {
    const intersections = car.axis === 'h' ? intersectionCols : intersectionRows;
    const position = car.axis === 'h' ? car.x : car.y;
    let stopGap = Infinity;
    intersections.forEach(start => {
      const stopLine = car.axis === 'h'
        ? car.dir > 0 ? start - 60 : start + 108
        : car.dir > 0 ? start - 58 : start + 106;
      const gap = ((stopLine - position) * car.dir + length) % length;
      if (gap < stopGap) stopGap = gap;
    });
    if (stopGap < 56) speed = Math.min(speed, Math.max(0, (stopGap - 5) * 1.5));
  }
  return speed;
}

function updateTraffic(dt) {
  trafficTime += dt;
  const worldWidth = city.w * T, worldHeight = city.h * T;
  trafficCars.forEach(car => {
    const speed = trafficSpeed(car);
    if (car.axis === 'h') {
      car.x += car.dir * speed * dt;
      if (car.dir > 0 && car.x > worldWidth + 24) car.x = -24;
      else if (car.dir < 0 && car.x < -24) car.x = worldWidth + 24;
    } else {
      car.y += car.dir * speed * dt;
      if (car.dir > 0 && car.y > worldHeight + 24) car.y = -24;
      else if (car.dir < 0 && car.y < -24) car.y = worldHeight + 24;
    }
  });
}

function playerHitByTraffic() {
  const px = player.x + 4, py = player.y + 6;
  return trafficCars.find(car => {
    const dx = Math.abs(px - car.x), dy = Math.abs(py - car.y);
    return car.axis === 'h' ? dx < 23 && dy < 13 : dx < 13 && dy < 23;
  });
}

function crash(car) {
  scene = 'crashed';
  bannerText = car && car.kind === 'ojol' ? 'TERTABRAK MOTOR!' : car && car.kind === 'angkot' ? 'TERTABRAK ANGKOT!' : 'TERTABRAK MOBIL!';
  bannerT = 1.8;
  player.moving = false;
}

function buildCity() {
  cityLayer = document.createElement('canvas');
  cityLayer.width = city.w * T; cityLayer.height = city.h * T;
  ctx = cityLayer.getContext('2d');
  for (let y = 0; y < city.h; y++) for (let x = 0; x < city.w; x++) groundTile(x, y);
  drawCrosswalks();
  buildings.forEach(drawBuilding);
  ctx = mainCtx;
}

/* ---------- karakter ---------- */
function chibi(x, y, o, dir, step) {
  x = Math.round(x); y = Math.round(y);
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(x + 2, y + 15, 8, 2);
  ctx.fillStyle = OUT; ctx.fillRect(x + 2, y + 10, 8, 6);
  if (o.cape) { ctx.fillStyle = o.cape; ctx.fillRect(x, y + 10, 3, 5); ctx.fillRect(x + 9, y + 10, 3, 5); }
  ctx.fillStyle = o.top; ctx.fillRect(x + 3, y + 10, 6, 4);
  ctx.fillStyle = o.skin; ctx.fillRect(x + 2, y + 11, 1, 2); ctx.fillRect(x + 9, y + 11, 1, 2);
  ctx.fillStyle = o.bot; ctx.fillRect(x + 4, y + 14, 2, 2 - step); ctx.fillRect(x + 6, y + 14, 2, 1 + step);
  ctx.fillStyle = OUT; ctx.fillRect(x + 1, y, 10, 10);
  ctx.fillStyle = dir === 'up' ? o.hair : o.skin; ctx.fillRect(x + 2, y + 1, 8, 8);
  ctx.fillStyle = o.hair; ctx.fillRect(x + 2, y + 1, 8, 3);
  if (dir !== 'up') {
    ctx.fillRect(x + 2, y + 4, 1, 2); ctx.fillRect(x + 9, y + 4, 1, 2);
    const ex = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    ctx.fillStyle = OUT; ctx.fillRect(x + 4 + ex, y + 5, 1, 2); ctx.fillRect(x + 7 + ex, y + 5, 1, 2);
  }
  if (o.x === 'mask') { ctx.fillStyle = '#2a2e36'; ctx.fillRect(x + 2, y + 7, 8, 2); }
  if (o.x === 'helm') { ctx.fillStyle = '#a8393b'; ctx.fillRect(x, y, 2, 5); ctx.fillRect(x + 1, y - 1, 3, 2); }
  if (o.x === 'hat') {
    ctx.fillStyle = OUT; ctx.fillRect(x, y, 12, 3); ctx.fillRect(x + 3, y - 3, 6, 4);
    ctx.fillStyle = o.hair; ctx.fillRect(x + 1, y + 1, 10, 2); ctx.fillRect(x + 4, y - 2, 4, 3);
  }
  if (o.x === 'nurse') { ctx.fillStyle = '#fff'; ctx.fillRect(x + 2, y, 8, 3); ctx.fillStyle = '#4a8fc9'; ctx.fillRect(x + 5, y + 1, 2, 1); }
  if (o.x === 'cap') { ctx.fillStyle = OUT; ctx.fillRect(x + 1, y, 10, 4); ctx.fillStyle = o.hair; ctx.fillRect(x + 2, y, 8, 3); }
}
const guardLook = { hair: '#1b3560', skin: '#e0b48e', top: '#2e5a9c', bot: '#1d2f4d', x: 'cap' };

function robber(x, y, dir, step, crouch, loot, skinId) {
  const skin = playerSkins.find(item => item.id === skinId) || playerSkins[0];
  x = Math.round(x); y = Math.round(y + (crouch ? 3 : 0));
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(x + 2, y + 16, 10, 2);
  ctx.fillStyle = OUT; ctx.fillRect(x + 1, y + 9, 12, 7);
  ctx.fillStyle = skin.coat; ctx.fillRect(x + 2, y + 9, 10, 6);
  ctx.fillStyle = skin.accent; ctx.fillRect(x + 2, y + 13, 10, 1);
  ctx.fillStyle = '#d4d4cc'; ctx.fillRect(x + 5, y + 10, 1, 4); ctx.fillRect(x + 8, y + 10, 1, 4);
  ctx.fillStyle = skin.scarf; ctx.fillRect(x + 3, y + 15, 3, 3 - step); ctx.fillRect(x + 8, y + 15, 3, 2 + step);
  ctx.fillStyle = OUT; ctx.fillRect(x + 1, y, 12, 10);
  ctx.fillStyle = skin.scarf; ctx.fillRect(x + 2, y + 1, 10, 8);
  ctx.fillStyle = skin.coat; ctx.fillRect(x + 3, y + 2, 3, 1);
  if (dir !== 'up') {
    const ex = dir === 'left' ? -1 : dir === 'right' ? 1 : 0;
    ctx.fillStyle = skin.accent;
    ctx.fillRect(x + 4 + ex, y + 4, 2, 2); ctx.fillRect(x + 8 + ex, y + 4, 2, 2);
    ctx.fillStyle = skin.scarf;
    ctx.fillRect(x + 4 + ex, y + 7, 6, 1); ctx.fillRect(x + 5 + ex, y + 8, 4, 1);
  }
  if (loot) {
    ctx.fillStyle = OUT; ctx.fillRect(x + 9, y + 9, 8, 8);
    ctx.fillStyle = '#3f8a4f'; ctx.fillRect(x + 10, y + 10, 6, 6);
    ctx.fillStyle = '#cfe9d0'; ctx.fillRect(x + 12, y + 11, 2, 4);
  }
}

/* ---------- logika ---------- */
const world = () => where === 'city' ? city : where === 'bank' ? bank : where === 'cafe' ? cafe : where === 'home' ? home : where === 'shop' ? shop : office;
function solidAt(px, py) {
  const w = world(), tx = Math.floor(px / T), ty = Math.floor(py / T);
  if (tx < 0 || ty < 0 || tx >= w.w || ty >= w.h) return true;
  return w.solid[ty * w.w + tx] === 1;
}
function blocked(x, y) {
  if (solidAt(x, y) || solidAt(x + 7, y) || solidAt(x, y + 5) || solidAt(x + 7, y + 5)) return true;
  return where === 'city' && npcs.some(n => Math.abs(n.x - (x + 4)) < 8 && Math.abs(n.y - (y + 6)) < 6);
}
const doorOf = b => ({ x: (b.x + b.w / 2) * T, y: (b.y + b.h) * T + 6 });
const feet = () => ({ x: player.x + 4, y: player.y + 6 });

function movePlayer(dt) {
  let mx = (keys.KeyD || keys.ArrowRight ? 1 : 0) - (keys.KeyA || keys.ArrowLeft ? 1 : 0);
  let my = (keys.KeyS || keys.ArrowDown ? 1 : 0) - (keys.KeyW || keys.ArrowUp ? 1 : 0);
  player.moving = !!(mx || my);
  if (!player.moving) return;
  if (mx && my) { mx *= .707; my *= .707; }
  player.dir = Math.abs(mx) > Math.abs(my) ? (mx > 0 ? 'right' : 'left') : (my > 0 ? 'down' : 'up');
  const sp = (where === 'city' ? 64 : crouching() ? 28 : 54) * (hasLoot ? .88 : 1) * dt;
  if (!blocked(player.x + mx * sp, player.y)) player.x += mx * sp;
  if (!blocked(player.x, player.y + my * sp)) player.y += my * sp;
  player.t += dt;
}

function npcStep(n, dt) {
  const f = feet();
  if (Math.hypot(n.x - f.x, n.y - f.y) < 26 || (talk && talk.n === n)) return;
  n.t -= dt;
  if (n.t <= 0) {
    n.t = 1 + Math.random() * 2;
    n.v = dirs[Math.floor(Math.random() * 5)];
    if (n.v[0]) n.dir = n.v[0] > 0 ? 'right' : 'left';
    else if (n.v[1]) n.dir = n.v[1] > 0 ? 'down' : 'up';
  }
  if (!n.v[0] && !n.v[1]) return;
  const nx = n.x + n.v[0] * 14 * dt, ny = n.y + n.v[1] * 14 * dt;
  const blockedByCity = where === 'city' && (
    !isPedestrianWalkway(nx - 4, ny - 2) || !isPedestrianWalkway(nx + 4, ny - 2) ||
    !isPedestrianWalkway(nx - 4, ny + 3) || !isPedestrianWalkway(nx + 4, ny + 3)
  );
  if (blockedByCity || solidAt(nx - 4, ny - 2) || solidAt(nx + 4, ny - 2) ||
      solidAt(nx - 4, ny + 3) || solidAt(nx + 4, ny + 3) ||
      Math.abs(nx - n.hx) > 48 || Math.abs(ny - n.hy) > 32) { n.v = [0, 0]; return; }
  n.x = nx; n.y = ny; n.step += dt;
}

function guardStep(g, dt) {
  if (g.distracted > 0) { g.distracted = Math.max(0, g.distracted - dt); return; }
  if (g.curious > 0) { g.curious -= dt; return; }
  if (g.invest) {
    const iv = g.invest, dx = iv.x - g.x, dy = iv.y - g.y, d = Math.hypot(dx, dy);
    if (d < 6) { iv.w += dt; if (iv.w > 2) g.invest = null; return; }
    const nx = g.x + dx / d * g.speed * 1.15 * dt, ny = g.y + dy / d * g.speed * 1.15 * dt;
    let moved = false;
    if (!solidAt(nx, g.y)) { g.x = nx; moved = true; }
    if (!solidAt(g.x, ny)) { g.y = ny; moved = true; }
    if (!moved) { g.invest = null; return; }
    g.ang = Math.atan2(dy, dx); g.t += dt;
    return;
  }
  const [tx, ty] = g.route[g.i], dx = tx - g.x, dy = ty - g.y, d = Math.hypot(dx, dy);
  if (g.wait > 0) g.wait -= dt;
  else if (d < 2) { g.i = (g.i + 1) % g.route.length; g.wait = .4 + Math.random() * 1.2; }
  else { g.x += dx / d * g.speed * dt; g.y += dy / d * g.speed * dt; g.ang = Math.atan2(dy, dx); g.t += dt; }
}
const faceOf = a => Math.abs(Math.cos(a)) > Math.abs(Math.sin(a)) ? (Math.cos(a) > 0 ? 'right' : 'left') : (Math.sin(a) > 0 ? 'down' : 'up');

function makeNoise(x, y, r) {
  noiseRings.push({ x, y, t: 0, r });
  guards.forEach(g => {
    if (g.distracted > 0 || g.curious > 0 || g.invest) return;
    const dx = x - g.x, dy = y - (g.y - 8), d = Math.hypot(dx, dy);
    if (d > r) return;
    for (let k = 6; k < d; k += 4) if (solidAt(g.x + dx * k / d, g.y - 8 + dy * k / d)) return;
    g.curious = 1.6;
    g.ang = Math.atan2(y - g.y, x - g.x);
  });
}

function sees(g) {
  const gx = g.x, gy = g.y - 8, dx = player.x + 4 - gx, dy = player.y + 3 - gy, d = Math.hypot(dx, dy);
  const styleScale = heistMode === 'loud' ? 1.25 : heistMode === 'stealth' ? .86 : 1;
  const intelScale = storyChoice === 'intel' ? .82 : 1;
  const visibility = (inventory.disguise ? 58 : 80) * styleScale * intelScale;
  if (d > (crouching() ? 46 : visibility) * (hasLoot ? 1.15 : 1)) return false;
  const a = Math.atan2(dy, dx), diff = Math.abs(Math.atan2(Math.sin(a - g.ang), Math.cos(a - g.ang)));
  if (d > 14 && diff > .7) return false;
  for (let s = 6; s < d; s += 4) if (solidAt(gx + dx * s / d, gy + dy * s / d)) return false;
  return true;
}

function caught(text) {
  if (where === 'bank') {
    wanted = clamp(wanted + 1, 0, 5);
    alarmCount++;
    saveProgress();
  }
  scene = 'caught'; bannerText = text; bannerT = 1.6;
  playSound('alert');
}
function toast(s) {
  toastText = s; toastT = 2.2;
  const live = document.getElementById('live');
  if (live) live.textContent = s;
}

function startStoryBeat(speaker, lines, onComplete) {
  talk = { n: { name: speaker }, lines, i: 0, offerChoice: false, onComplete };
  scene = 'talk';
  for (const key in keys) delete keys[key];
}

function respawnBank() {
  if (hasLoot) toast('Hasil rampokan disita. Brankas masih terbuka, coba lagi!');
  hasLoot = false; shown = 0; suspicion = 0; smokeT = 0; fuseT = 0; fuseUsed = false;
  where = 'bank'; player.x = 14 * T + 4; player.y = 17 * T;
  resetGuards();
  scene = 'play';
}

function win() {
  clearInterval(tick);
  $('cipher').hidden = true;
  vaultOpen = true; scene = 'play';
  toast('Brankas terbuka! Ambil uangnya.');
  saveProgress();
}

function finish() {
  where = 'city';
  money += REWARD; hasLoot = false; vaultOpen = false; wanted = 0; police = null;
  const quiet = heistMode === 'stealth' && alarmCount <= 1 && suspicion < .1;
  const prepared = inventory.lockpick && inventory.disguise && sideQuestStep === 2;
  const ending = quiet && storyChoice === 'intel'
    ? ['MATA-MATA KOTA', 'Dari kejauhan, Sari melihatmu menghilang ke dalam got. Satu anggukan cukup: malam ini, tak ada warga yang ikut terseret. Besok, kota akan sibuk mencari hantu yang tak pernah mereka lihat.']
    : quiet && storyChoice === 'solo'
      ? ['SERIGALA SENDIRIAN', 'Tak ada rekan, tak ada saksi yang bisa dipercaya. Hanya kamu, hujan, dan sirene yang makin jauh. Semua uang itu milikmu—begitu juga semua rahasianya.']
      : quiet ? ['HANTU SENYAP', 'Kamera merekam lorong kosong. Penjaga bersumpah mendengar langkah kaki, tapi tak seorang pun melihatmu. Sebelum matahari terbit, kamu sudah jadi legenda kecil di kota ini.']
    : heistMode === 'loud' && prepared ? ['AKSI BESAR', 'Sirene meraung dan lampu kota menyala satu per satu. Tapi penyamaran dan bantuan orang-orang yang pernah kamu tolong membuka jalan keluar. Malam ini, seluruh kota punya cerita tentangmu.']
      : prepared ? ['PERAMPOK PROFESIONAL', 'Saat polisi mengepung bank, setiap persiapanmu terbayar. Kamu lolos dengan rencana tetap utuh—dan meninggalkan kota dengan satu cerita yang tak akan mereka pecahkan.']
    : ['KABUR TIPIS!', 'Napasmu masih memburu saat sirene memenuhi jalan. Hasil rampokan aman, tapi kota kini mengingat wajah dan jejakmu. Ini bukan akhir cerita—hanya awal dari perburuan.'];
  const routeName = heistMode === 'loud' ? 'RUTE BERISIK' : 'RUTE SENYAP';
  const nextRoute = heistMode === 'loud'
    ? 'Coba rencana senyap dan hindari alarm agar bisa menemukan ending yang berbeda.'
    : 'Coba rencana berisik, atau ambil keputusan cerita yang berbeda bersama Sari.';
  $('endingRoute').textContent = routeName + ' · ' + (storyChoice === 'intel' ? 'INFO SARI' : storyChoice === 'solo' ? 'SENDIRIAN' : 'TANPA BANTUAN');
  $('endingTitle').textContent = ending[0];
  $('endingText').textContent = ending[1];
  $('endingReward').textContent = rp(REWARD);
  $('endingAlarms').textContent = alarmCount + ' kali';
  const helped = (sideQuestStep >= 2 ? 1 : 0) + (sideQuest2Step >= 2 ? 1 : 0);
  $('endingSideQuest').textContent = helped ? helped + ' warga · +' + rp((sideQuestStep >= 2 ? 800 : 0) + (sideQuest2Step >= 2 ? 500 : 0)) : 'Tidak';
  const isNewEnding = recordEnding(ending[0]);
  $('endingReplay').textContent = nextRoute + ' Ending terbuka: ' + seenEndings.size + '/' + ENDING_TITLES.length + (isNewEnding ? ' (BARU!)' : '.');
  setMissionStep(missionObjectives.length);
  saveProgress();
  scene = 'end';
  $('loot').hidden = false;
}

function resetAll() {
  $('loot').hidden = true;
  where = 'home'; scene = 'play'; vaultOpen = false; hasLoot = false; shown = 0; suspicion = 0; fuseT = 0; fuseUsed = false;
  money = 1200; missionStep = 0; wanted = 0; police = null;
  sideQuestStep = 0; sideQuest2Step = 0; smokeT = 0; alarmCount = 0; interactionEffects = [];
  cityPatrols.length = 0;
  storyChoice = null; heistMode = null;
  $('heistChoice').hidden = true; $('storyChoice').hidden = true;
  inventory.lockpick = inventory.disguise = inventory.smoke = inventory.diversion = false;
  talk = null; target = null; hint = ''; toastT = 0;
  lv = 0; qi = 0; lives = MAX_LIVES;
  player.x = 10 * T; player.y = 10 * T; player.dir = 'down'; player.moving = false; player.t = 0;
  for (const key in keys) delete keys[key];
  buildBank(); resetGuards(); saveProgress();
  if (seenEndings.size === 0) {
    startStoryBeat('PETUNJUK', [
      'Gerak dengan WASD atau panah. Tekan E untuk bicara dan membuka pintu.',
      'Di dalam bank, tahan Shift untuk jongkok. Penjaga dan kamera sulit melihatmu saat jongkok.',
      'Tombol MISI di kiri bawah menampilkan tujuanmu. Keluar rumah dan temui Raka dulu.'
    ], saveProgress);
  }
}

function chooseHeistMode(mode) {
  heistMode = mode;
  $('heistChoice').hidden = true;
  scene = 'play';
  if (mode === 'loud') {
    alarmCount++;
    wanted = Math.max(wanted, 3);
    suspicion = .25;
    toast('Alarm aktif! Penjaga lebih waspada dan polisi mulai mencari.');
    playSound('alert');
  } else {
    suspicion = 0;
    toast('Rencana senyap. Lari itu berisik, jongkok lebih senyap.');
    playSound('success');
  }
  saveProgress();
}

function useDiversion() {
  if (scene !== 'play' || where !== 'bank' || !inventory.diversion) return;
  const nearest = guards
    .map(guard => ({ guard, distance: Math.hypot(guard.x - feet().x, guard.y - feet().y) }))
    .filter(item => item.distance <= 112)
    .sort((a, b) => a.distance - b.distance)[0];
  if (!nearest) {
    toast('Tidak ada penjaga yang cukup dekat untuk dialihkan.');
    return;
  }
  const guard = nearest.guard;
  guard.distracted = 5;
  guard.ang = Math.atan2(guard.y - feet().y, guard.x - feet().x);
  inventory.diversion = false;
  toast('Umpan berhasil! Penjaga teralihkan selama beberapa detik.');
  playSound('success');
  addInteractionEffect(guard.x, guard.y - 8, '#65e2c0');
  saveProgress();
}

function interact() {
  if (!target) return;
  if (target.k === 'npc') {
    const n = target.n, f = feet();
    n.dir = Math.abs(f.x - n.x) > Math.abs(f.y - n.y) ? (f.x > n.x ? 'right' : 'left') : (f.y > n.y ? 'down' : 'up');
    const offerStoryChoice = n.name === 'Sari' && storyChoice === null && sideQuestStep !== 1;
    let questLines = null;
    if (n.name === 'Bu Tini' && sideQuest2Step === 0) {
      questLines = ['Nak, tolong antar sebungkus gorengan ke Pak Ujang dekat bank, ya.', 'Dia belum makan dari sore. Upahnya Rp 500 dari saya.'];
      sideQuest2Step = 1; toast('Misi sampingan baru: antar gorengan ke Pak Ujang.'); saveProgress();
    } else if (n.name === 'Pak Ujang' && sideQuest2Step === 1) {
      questLines = ['Gorengan dari Bu Tini? Wah, pas lagi laper!', 'Ini upah Rp 500. Titip salam buat beliau.'];
      sideQuest2Step = 2; money += 500; toast('Gorengan terkirim! Kamu mendapat Rp 500.'); playSound('buy'); saveProgress();
    }
    const lines = questLines || (n.name === 'Raka' && missionStep === 1
      ? ['Rumahmu baru direnovasi. Kalau mau kerja di bank, beli alat pembuka di toko dulu.', 'Hati-hati menyeberang. Warga sebaiknya lewat zebra cross.']
      : n.name === 'Pak Joko' && sideQuestStep === 0
        ? ['Aku perlu bantuan mengantar paket kecil ke Sari dekat rumah di selatan kota.', 'Tolong serahkan langsung padanya. Ada upah Rp 800 kalau berhasil.']
        : n.name === 'Sari' && sideQuestStep === 1
          ? ['Paket dari Pak Joko? Pas banget, ini barang yang kutunggu.', 'Ini upah Rp 800 untuk bantuanmu.']
        : offerStoryChoice
          ? ['Aku bisa kasih tahu pola patroli satpam.', 'Kalau kamu lebih nyaman, kita juga bisa tidak saling terlibat.']
      : wanted > 0
        ? ['Polisi sedang mencari seseorang. Jangan bikin masalah di sini.', 'Kalau keadaan panas, pulang dan tunggu sampai aman.']
        : alarmCount > 0
          ? ['Sejak alarm bank berbunyi, patroli polisi makin sering keliling kota.', 'Jalan lewat gang dan jangan menarik perhatian.']
        : n.name === 'Sari'
          ? ['Aku dengar penyamaran bisa mengelabui penjaga bank.', 'Bom asap juga berguna kalau kamu ketahuan.']
          : n.lines);
    if (n.name === 'Raka' && missionStep === 1) { setMissionStep(2); if (inventory.lockpick) setMissionStep(3); }
    if (n.name === 'Pak Joko' && sideQuestStep === 0) {
      sideQuestStep = 1; toast('Misi sampingan dimulai: antarkan paket ke Sari.');
      saveProgress();
    } else if (n.name === 'Sari' && sideQuestStep === 1) {
      sideQuestStep = 2; money += 800; toast('Paket terkirim! Kamu mendapat Rp 800.');
      playSound('buy'); saveProgress();
    }
    addInteractionEffect(n.x, n.y - 8, '#f0c24b');
    talk = { n, lines, i: 0, offerChoice: offerStoryChoice }; scene = 'talk'; playSound('success');
    for (const key in keys) delete keys[key];
  } else if (target.k === 'bank') {
    if (hasLoot) {
      toast('Kamu sudah membawa hasil rampokan. Kabur dari bank, jangan kembali masuk!');
      return;
    }
    where = 'bank'; player.x = 14 * T + 4; player.y = 17 * T; suspicion = 0; fuseT = 0; fuseUsed = false; resetGuards();
    heistMode = null; scene = 'heistchoice'; $('heistChoice').hidden = false;
    if (missionStep === 3) setMissionStep(4);
    if (!inventory.lockpick) toast('Kamu belum punya alat pembuka; brankas akan lebih sulit.');
    playSound('door'); saveProgress();
  } else if (target.k === 'cafe') {
    where = 'cafe'; player.x = 10 * T + 4; player.y = 16 * T; playSound('door');
  } else if (target.k === 'cafeExit') {
    const kd = doorOf(buildings.find(b => b.name === 'KAFE'));
    where = 'city'; player.x = kd.x - 4; player.y = kd.y - 4; playSound('door');
  } else if (target.k === 'office') {
    where = 'office'; player.x = 9 * T; player.y = 10 * T; playSound('door');
  } else if (target.k === 'officeExit') {
    const od = doorOf(buildings.find(b => b.name === 'KANTOR'));
    where = 'city'; player.x = od.x - 4; player.y = od.y - 4; playSound('door');
  } else if (target.k === 'home') {
    if (hasLoot && missionStep >= 5 && missionStep < missionObjectives.length) {
      toast('Jangan pulang dulu! Cari gang di selatan dan sembunyi di gorong-gorong.');
      return;
    }
    where = 'home'; player.x = 10 * T; player.y = 10 * T; police = null; playSound('door');
    saveProgress();
  } else if (target.k === 'homeExit') {
    where = 'city'; player.x = (homeB.x + homeB.w / 2) * T - 4; player.y = (homeB.y + homeB.h) * T + 2;
    if (missionStep === 0) setMissionStep(1);
    playSound('door'); saveProgress();
  } else if (target.k === 'shop') {
    where = 'shop'; player.x = 10 * T; player.y = 11 * T; playSound('door');
  } else if (target.k === 'shopExit') {
    where = 'city'; player.x = (shopB.x + shopB.w / 2) * T - 4; player.y = (shopB.y + shopB.h) * T + 2; playSound('door');
  } else if (target.k === 'shopCounter') {
    openShopMenu();
  } else   if (target.k === 'hideout') {
    startStoryBeat('KAMU', [
      'Gang belakang sempit dan gelap. Sirene terdengar dari tiga arah sekaligus.',
      'Tutup got di ujung gang sedikit bergeser. Tak ada waktu memilih jalan lain.',
      storyChoice === 'intel'
        ? 'Kata Sari, gorong-gorong ini tembus sampai ke belakang terminal. Semoga dia benar.'
        : storyChoice === 'solo'
          ? 'Tak ada yang tahu kamu turun ke sini. Tak ada juga yang akan mencarimu.'
          : 'Kamu menarik tutup got, lalu turun bersama tas itu.'
    ], finish);
  } else if (target.k === 'fuse') {
    fuseUsed = true; fuseT = 15;
    addInteractionEffect(FUSE.x, FUSE.y - 8, '#f0c24b');
    const near = guards.map(g => ({ g, d: Math.hypot(g.x - FUSE.x, g.y - FUSE.y) })).sort((a, b) => a.d - b.d)[0];
    if (near && !(near.g.distracted > 0)) near.g.invest = { x: FUSE.x, y: 17 * T + 6, w: 0 };
    toast('Sekring dicabut! Kamera mati, tapi satpam curiga.');
    playSound('success');
  } else if (target.k === 'door') {
    toast(target.b.name + ': pintunya terkunci. Ini bukan bank.');
  } else if (target.k === 'vault') {
    if (!vaultOpen) openCipher();
    else if (!hasLoot) {
      hasLoot = true; shown = 0;
      wanted = heistMode === 'loud' ? 5 : 2;
      alarmCount++;
      const escapeLines = heistMode === 'loud'
        ? [
            'ALARM! Lampu merah menyapu seluruh ruangan.',
            'Satpam: "Brankasnya! Jangan biarkan dia keluar!"',
            'Langkah kaki berlari mendekat. Jalan keluar tak akan lama terbuka.'
          ]
        : [
            'Sensor brankas menyala. Alarm mulai meraung.',
            'Satpam: "Ruang brankas! Periksa pintu belakang!"',
            storyChoice === 'intel'
              ? 'Kamu ingat pesan Sari: tunggu patroli lewat, lalu lari.'
              : 'Sirene makin dekat. Kamu harus keluar sebelum mereka tiba.'
          ];
      playSound('alert'); addInteractionEffect(feet().x, feet().y, '#e0343a');
      startStoryBeat('ALARM BANK', escapeLines, saveProgress);
    }
  }
}

addEventListener('keydown', e => {
  if (scene === 'help') {
    if (e.key === 'Escape' || e.code === 'KeyH' || e.key === '?') { e.preventDefault(); closeHelp(); }
    return;
  }
  if ((e.code === 'KeyH' || e.key === '?') && !e.repeat && (scene === 'play' || scene === 'talk')) { e.preventDefault(); openHelp(); return; }
  if (scene === 'cipher') { if (e.key === 'Escape') closeCipher(); return; }
  if (scene === 'heistchoice' || scene === 'storychoice') return;
  if (scene === 'skinshop') {
    if (e.key === 'Escape') closeShopMenu();
    return;
  }
  if ((e.key === 'Escape' || e.code === 'KeyP') && (scene === 'play' || scene === 'talk' || scene === 'pause')) {
    e.preventDefault();
    if (!e.repeat) togglePause();
    return;
  }
  if (scene === 'menu' || scene === 'end') return;
  if (e.code === 'KeyF' && !e.repeat) { useDiversion(); return; }
  if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  if (e.code === 'KeyE' && !e.repeat) {
    if (scene === 'talk') {
      talk.i++;
      if (talk.i >= talk.lines.length) {
        if (talk.offerChoice) {
          scene = 'storychoice';
          $('storyChoice').hidden = false;
        } else {
          const onComplete = talk.onComplete;
          talk = null; scene = 'play';
          if (onComplete) onComplete();
          saveProgress();
        }
      }
    }
    else if (scene === 'play') interact();
  }
  keys[e.code] = true;
});
addEventListener('keyup', e => { delete keys[e.code]; });
function releaseTouchKeys() {
  document.querySelectorAll('#mobileControls [data-game-key]').forEach(button => {
    if (button.dataset.activePointer) {
      dispatchEvent(new KeyboardEvent('keyup', { code: button.dataset.gameKey, key: button.dataset.gameKey }));
      delete button.dataset.activePointer;
    }
  });
}
document.querySelectorAll('#mobileControls [data-game-key]').forEach(button => {
  button.addEventListener('pointerdown', event => {
    event.preventDefault();
    if (button.dataset.activePointer) return;
    button.dataset.activePointer = String(event.pointerId);
    if (event.isTrusted) button.setPointerCapture(event.pointerId);
    dispatchEvent(new KeyboardEvent('keydown', { code: button.dataset.gameKey, key: button.dataset.gameKey, cancelable: true }));
  });
  const release = event => {
    if (button.dataset.activePointer !== String(event.pointerId)) return;
    delete button.dataset.activePointer;
    dispatchEvent(new KeyboardEvent('keyup', { code: button.dataset.gameKey, key: button.dataset.gameKey }));
  };
  button.addEventListener('pointerup', release);
  button.addEventListener('pointercancel', release);
  button.addEventListener('lostpointercapture', release);
});
addEventListener('blur', () => { releaseTouchKeys(); for (const k in keys) delete keys[k]; });
$('continueGame').addEventListener('click', () => {
  if (!hasSaveData) return;
  $('mainMenu').hidden = true;
  if (where === 'bank' && !heistMode) {
    scene = 'heistchoice';
    $('heistChoice').hidden = false;
  } else scene = 'play';
  playSound('success');
});
$('newGame').addEventListener('click', () => {
  if (hasSaveData && missionStep < missionObjectives.length && !confirm('Mulai petualangan baru? Progres tersimpan akan ditimpa.')) return;
  $('mainMenu').hidden = true;
  $('pauseMenu').hidden = true;
  $('skinShop').hidden = true;
  $('heistChoice').hidden = true;
  $('storyChoice').hidden = true;
  resetAll();
  refreshLobby();
  if (!helpSeen()) setTimeout(openHelp, 500);
});
$('resumeGame').addEventListener('click', togglePause);
$('saveAndMenu').addEventListener('click', showMainMenu);
$('closeSkinShop').addEventListener('click', closeShopMenu);
$('stealthPlan').addEventListener('click', () => chooseHeistMode('stealth'));
$('loudPlan').addEventListener('click', () => chooseHeistMode('loud'));
$('acceptIntel').addEventListener('click', () => {
  storyChoice = 'intel';
  talk = null; scene = 'play'; $('storyChoice').hidden = true;
  toast('Sari membagikan info patroli. Penjaga lebih mudah dihindari.');
  saveProgress();
});
$('declineIntel').addEventListener('click', () => {
  storyChoice = 'solo';
  talk = null; scene = 'play'; $('storyChoice').hidden = true;
  toast('Kamu memilih bergerak sendiri. Ending cerita akan berbeda.');
  saveProgress();
});
$('useDiversion').addEventListener('click', useDiversion);
$('endingMenu').addEventListener('click', () => {
  $('loot').hidden = true;
  showMainMenu();
});
$('again').addEventListener('click', () => {
  $('loot').hidden = true;
  resetAll();
});

function update(dt) {
  toastT -= dt;
  updateInteractionEffects(dt);
  if (scene === 'end') return;
  if (scene === 'play' || scene === 'talk' || scene === 'caught' || scene === 'crashed') {
    saveTimer -= dt;
    if (saveTimer <= 0) { saveProgress(); saveTimer = 5; }
  }
  if (hasLoot && shown < REWARD) shown = Math.min(REWARD, shown + REWARD * dt / 3);
  if (where === 'city' && (scene === 'play' || scene === 'caught' || scene === 'crashed')) updateTraffic(dt);
  if (scene === 'crashed') {
    bannerT -= dt;
    if (bannerT <= 0) {
      where = 'city'; player.x = 116; player.y = 216; scene = 'play';
      for (const k in keys) delete keys[k];
    }
    return;
  }
  if (scene === 'caught') { bannerT -= dt; if (bannerT <= 0) respawnBank(); return; }
  if (scene !== 'play') return;

  movePlayer(dt);
  footstepTimer -= dt;
  if (player.moving && footstepTimer <= 0) {
    playSound('step'); footstepTimer = .34;
  }
  const hitCar = where === 'city' ? playerHitByTraffic() : null;
  if (hitCar) { crash(hitCar); return; }
  if (where === 'city') {
    updatePolice(dt);
    updateCityPatrols(dt);
    if (where !== 'city') return;
  }
  const f = feet();
  hint = ''; target = null;

  if (where === 'city') {
    npcs.forEach(n => npcStep(n, dt));
    const n = npcs.find(n => Math.hypot(n.x - f.x, n.y - f.y) < 22);
    const near = buildings.find(b => { const d = doorOf(b); return Math.hypot(d.x - f.x, d.y - f.y) < (b.bank ? 26 : 20); });
    if (hasLoot && missionStep >= 5 && missionStep < missionObjectives.length && Math.hypot(hideout.x - f.x, hideout.y - f.y) < 24) {
      target = { k: 'hideout' }; hint = '[E] Turun ke gorong-gorong dan sembunyi';
    }
    else if (n) { target = { k: 'npc', n }; hint = '[E] Bicara dengan ' + n.name; }
    else if (near && near.bank) { target = { k: 'bank' }; hint = '[E] Masuk bank'; }
    else if (near && near.store) { target = { k: 'shop' }; hint = '[E] Masuk toko'; }
    else if (near && near.home) { target = { k: 'home' }; hint = '[E] Masuk rumah'; }
    else if (near && near.name === 'KAFE') { target = { k: 'cafe' }; hint = '[E] Masuk kafe'; }
    else if (near && near.name === 'KANTOR') { target = { k: 'office' }; hint = '[E] Masuk kantor'; }
    else if (near) { target = { k: 'door', b: near }; hint = '[E] Cek pintu'; }
    return;
  }

  if (where === 'cafe') {
    updateCafe(dt);
    const exit = { x: 10 * T + 8, y: 18 * T };
    if (Math.hypot(exit.x - f.x, exit.y - f.y) < 30) {
      target = { k: 'cafeExit' }; hint = '[E] Keluar kafe';
    }
    return;
  }
  if (where === 'office') {
    updateOffice(dt);
    const exit = { x: 10 * T + 8, y: 14 * T };
    if (Math.hypot(exit.x - f.x, exit.y - f.y) < 30) {
      target = { k: 'officeExit' }; hint = '[E] Keluar kantor';
    }
    return;
  }
  if (where === 'home') {
    if (wanted > 0) wanted = Math.max(0, wanted - dt * .8);
    const exit = { x: 10 * T + 8, y: 14 * T };
    if (Math.hypot(exit.x - f.x, exit.y - f.y) < 30) {
      target = { k: 'homeExit' }; hint = '[E] Keluar rumah';
    }
    return;
  }
  if (where === 'shop') {
    const exit = { x: 10 * T + 8, y: 14 * T };
    const counter = { x: 16 * T + 8, y: 12 * T + 8 };
    if (Math.hypot(counter.x - f.x, counter.y - f.y) < 36) {
      const nextSupply = ['lockpick', 'disguise', 'smoke', 'diversion'].find(key => !inventory[key]);
      const supplyName = nextSupply === 'lockpick' ? 'alat pembuka Rp 400'
        : nextSupply === 'disguise' ? 'penyamaran Rp 350'
        : nextSupply === 'smoke' ? 'bom asap Rp 450'
        : nextSupply === 'diversion' ? 'umpan pengalih Rp 600' : 'perlengkapan';
      target = { k: 'shopCounter' };
      hint = '[E] Beli ' + (nextSupply ? supplyName : '— semua lengkap');
    } else if (Math.hypot(exit.x - f.x, exit.y - f.y) < 30) {
      target = { k: 'shopExit' }; hint = '[E] Keluar toko';
    }
    return;
  }
  if (fuseT > 0) fuseT = Math.max(0, fuseT - dt);
  noiseRings.forEach(r => { r.t += dt; });
  for (let i = noiseRings.length - 1; i >= 0; i--) if (noiseRings[i].t > .6) noiseRings.splice(i, 1);
  noiseT -= dt;
  if (player.moving && !crouching() && noiseT <= 0) {
    noiseT = .5;
    makeNoise(f.x, f.y, 56 * (hasLoot ? 1.2 : 1) * (heistMode === 'loud' ? 1.3 : 1));
  }
  let seen = false;
  guards.forEach(g => {
    guardStep(g, dt);
    if (sees(g)) { seen = true; g.seenT = .8; g.lastSeen = { x: f.x, y: f.y }; }
    else g.seenT = Math.max(0, (g.seenT || 0) - dt);
  });
  if (suspicion > .45) {
    const src = guards.find(g => g.seenT > 0 && g.lastSeen);
    if (src) guards.forEach(o => {
      if (o !== src && !(o.seenT > 0) && !o.invest && !(o.distracted > 0) && Math.hypot(o.x - src.x, o.y - src.y) < 220) {
        o.invest = { x: src.lastSeen.x, y: src.lastSeen.y, w: 0 };
      }
    });
  }
  bankCameras.forEach(camera => {
    camera.t += dt;
    camera.ang = camera.base + Math.sin(camera.t * .9 + camera.ph) * .8;
    if (fuseT <= 0 && sees(camera)) seen = true;
  });
  smokeT = Math.max(0, smokeT - dt);
  if (smokeT > 0) seen = false;
  if (seen && inventory.smoke) {
    inventory.smoke = false; seen = false; suspicion = 0; smokeT = 2.5;
    for (let i = 0; i < 6; i++) addInteractionEffect(player.x + 4 + (i - 3) * 5, player.y + 2 + (i % 2) * 5, '#c9ced8');
    toast('Bom asap dipakai—kabur sebelum penjaga melihatmu lagi!');
    saveProgress();
  }
  const suspicionRate = heistMode === 'loud' ? 1.35 : heistMode === 'stealth' ? .85 : 1;
  suspicion = clamp(suspicion + (seen ? dt * (inventory.lockpick ? 1.8 : 2.2) * suspicionRate : -dt * .8), 0, 1);
  if (suspicion >= 1) { caught('KETAHUAN!'); return; }

  if (!fuseUsed && Math.hypot(f.x - FUSE.x, f.y - FUSE.y) < 26) {
    target = { k: 'fuse' }; hint = '[E] Cabut sekring: kamera mati 15 detik';
  }
  const vx = (4 + 7 * vaultRoom) * T;
  if (Math.hypot(f.x - vx, f.y - 40) < 30) {
    target = { k: 'vault' };
    hint = !vaultOpen ? '[E] Buka brankas' : hasLoot ? '' : '[E] Ambil uang';
  }
  if (player.y + 6 > 18 * T + 4 && Math.abs(f.x - (14 * T + 8)) < 14) {
    if (hasLoot) {
      where = 'city'; player.x = 732; player.y = 23 * T; suspicion = 0;
      setMissionStep(5);
      police = null;
      startStoryBeat('RADIO POLISI', [
        'Radio: "Semua unit, tersangka keluar dari bank."',
        'Sirene mengejar dari belakang. Gang jadi satu-satunya jalan aman.'
      ], saveProgress);
    }
    else { where = 'city'; player.x = 732; player.y = 23 * T; suspicion = 0; toast('Belum dapat uang. Masuk lagi lewat pintu bank.'); }
  }
}

/* ---------- render ---------- */
function words(s, x, y, color, font, align) {
  ctx.font = font || 'bold 8px monospace'; ctx.textAlign = align || 'left';
  const text = { s, x, y, color: color || '#fff', font: ctx.font, align: ctx.textAlign, transform: ctx.getTransform() };
  if (ctx === mainCtx) textQueue.push(text);
  else {
    ctx.fillStyle = '#000'; ctx.fillText(s, x + 1, y + 1);
    ctx.fillStyle = color || '#fff'; ctx.fillText(s, x, y);
  }
  ctx.textAlign = 'left';
}
function renderText() {
  const sx = textCanvas.width / VW, sy = textCanvas.height / VH;
  textCtx.setTransform(1, 0, 0, 1, 0, 0);
  textCtx.clearRect(0, 0, textCanvas.width, textCanvas.height);
  const drawText = ({ s, x, y, color, font, align, transform }) => {
    textCtx.setTransform(
      sx * transform.a, sy * transform.b, sx * transform.c,
      sy * transform.d, sx * transform.e, sy * transform.f
    );
    textCtx.font = font;
    textCtx.textAlign = align;
    textCtx.fillStyle = '#000';
    textCtx.fillText(s, x + 1, y + 1);
    textCtx.fillStyle = color;
    textCtx.fillText(s, x, y);
  };
  if (where === 'city') {
    placeLabels.forEach(({ s, x, y, color, font, align }) => {
      textCtx.setTransform(sx, 0, 0, sy, -cam.x * sx, -cam.y * sy);
      textCtx.font = font;
      textCtx.textAlign = align;
      textCtx.fillStyle = '#000';
      textCtx.fillText(s, x + 1, y + 1);
      textCtx.fillStyle = color;
      textCtx.fillText(s, x, y);
    });
  }
  textQueue.forEach(drawText);
  textCtx.setTransform(1, 0, 0, 1, 0, 0);
}
function plate(s, x, y, color, right) {
  ctx.font = 'bold 8px monospace';
  const w = ctx.measureText(s).width + 8, px = x === null ? Math.round((VW - w) / 2) : right ? VW - w - 4 : x;
  ctx.fillStyle = 'rgba(10,14,20,.8)'; ctx.fillRect(px, y, w, 13);
  words(s, px + 4, y + 10, color);
}
function wrap(s, n) {
  const out = []; let line = '';
  s.split(' ').forEach(w => {
    if ((line + ' ' + w).trim().length > n) { out.push(line); line = w; }
    else line = (line + ' ' + w).trim();
  });
  out.push(line);
  return out;
}

function draw() {
  textQueue = [];
  const w = world();
  ctx.clearRect(0, 0, VW, VH);
  cam.x = clamp(Math.round(player.x + 4 - VW / 2), 0, w.w * T - VW);
  cam.y = clamp(Math.round(player.y + 3 - VH / 2), 0, w.h * T - VH);
  const sceneLayer = where === 'city' ? cityLayer : where === 'bank' ? bankLayer : where === 'cafe' ? cafeLayer : where === 'home' ? homeLayer : where === 'shop' ? shopLayer : officeLayer;
  ctx.drawImage(sceneLayer, cam.x, cam.y, VW, VH, 0, 0, VW, VH);
  ctx.save();
  ctx.translate(-cam.x, -cam.y);

  const list = [];
  if (where === 'city') drawCityAtmosphere(performance.now());
  const crouch = where === 'bank' && crouching();
  list.push({ y: player.y + 6, f: () => {
    robber(player.x - 3, player.y - 12, player.dir, player.moving ? Math.floor(player.t * 8) % 2 : 0, crouch, hasLoot, equippedSkin);
    if (inventory.disguise && where === 'bank') drawDisguise(player.x - 3, player.y - 12 + (crouch ? 3 : 0));
  } });
  if (smokeT > 0 && where === 'bank') list.push({ y: player.y + 20, f: drawSmokeCloud });
  if (where === 'city') {
    list.push({ y: -Infinity, f: drawTrafficLights });
    if (missionStep >= 5 && missionStep < missionObjectives.length && hasLoot) list.push({ y: hideout.y + 8, f: drawHideoutMarker });
    trafficCars.forEach(car => list.push({
      y: car.y + (car.axis === 'v' ? 18 : 9),
      f: () => drawTrafficCar(car)
    }));
    props.forEach(p => {
      if (Math.abs(p.x * T - cam.x - 160) > 200 || Math.abs(p.y * T - cam.y - 120) > 170) return;
      list.push({ y: (p.y + 1) * T, f: () => p.k === 'tree' ? drawTree(p.x, p.y) : drawLamp(p.x, p.y) });
    });
    npcs.forEach(n => list.push({ y: n.y, f: () => chibi(n.x - 6, n.y - 16, n.look, n.dir, Math.floor(n.step * 6) % 2) }));
    cityPatrols.forEach(officer => list.push({
      y: officer.y,
      f: () => drawPoliceOfficer(officer)
    }));
    if (police) list.push({ y: police.y, f: () => drawPoliceOfficer(police) });
  } else if (where === 'bank') {
    drawVault();
    noiseRings.forEach(r => {
      const k = r.t / .6;
      ctx.strokeStyle = 'rgba(255,255,255,' + (.25 * (1 - k)) + ')'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 6 + k * r.r * .6, 0, Math.PI * 2); ctx.stroke();
    });
    list.push({ y: FUSE.y + 8, f: drawFuseBox });
    bankCameras.forEach(camera => {
      if (fuseT <= 0) {
        ctx.fillStyle = suspicion > .05 ? 'rgba(238,106,116,.26)' : 'rgba(95,216,192,.18)';
        ctx.beginPath(); ctx.moveTo(camera.x, camera.y - 8); ctx.arc(camera.x, camera.y - 8, 80, camera.ang - .7, camera.ang + .7); ctx.closePath(); ctx.fill();
      }
      list.push({ y: camera.y, f: () => drawCameraSprite(camera) });
    });
    guards.forEach(g => {
      ctx.fillStyle = g.seenT > 0 ? 'rgba(238,106,116,.32)' : 'rgba(255,230,120,.22)';
      ctx.beginPath(); ctx.moveTo(g.x, g.y - 8); ctx.arc(g.x, g.y - 8, 80, g.ang - .7, g.ang + .7); ctx.closePath(); ctx.fill();
      list.push({ y: g.y, f: () => {
        chibi(g.x - 6, g.y - 16, guardLook, faceOf(g.ang), Math.floor(g.t * 6) % 2);
        if (g.seenT > 0) words('!', g.x, g.y - 20, '#ee6a74', 'bold 10px monospace', 'center');
        else if (g.distracted > 0) words('?', g.x, g.y - 20, '#65e2c0', 'bold 10px monospace', 'center');
        else if (g.curious > 0 || g.invest) words('?', g.x, g.y - 20, '#f0c24b', 'bold 10px monospace', 'center');
      } });
    });
  } else if (where === 'cafe') {
    cafePeople.forEach((person, i) => {
      list.push({ y: 8 * T, f: () => drawCafeMeal(person) });
      list.push({ y: person.y, f: () => drawCafeGuest(person, i, performance.now()) });
    });
    list.push({
      y: cafeStaff.y,
      f: () => chibi(cafeStaff.x - 6, cafeStaff.y - 16, cafeStaff.look, 'down', Math.floor(performance.now() / 700) % 2)
    });
  } else if (where === 'office') {
    officeWorkers.forEach(worker => list.push({
      y: worker.y,
      f: () => drawOfficeWorker(worker)
    }));
  }
  interactionEffects.forEach(effect => list.push({
    y: effect.y,
    f: () => drawInteractionEffect(effect)
  }));
  list.sort((a, b) => a.y - b.y).forEach(o => o.f());
  ctx.restore();
  if (where === 'bank') drawBankDarkness();
  if (where === 'bank' && hasLoot) {
    const pulse = .035 + (Math.sin(performance.now() / 130) + 1) * .025;
    ctx.fillStyle = `rgba(190,20,35,${pulse})`;
    ctx.fillRect(0, 0, VW, VH);
  }
  if (where === 'city' && missionStep === 1) drawRakaWaypoint();
  if (where === 'city' && (scene === 'play' || scene === 'talk')) drawMiniMap();
  hud();
  renderText();
}

function drawFuseBox() {
  const x = FUSE.x - 5, y = FUSE.y - 12;
  ctx.fillStyle = OUT; ctx.fillRect(x - 1, y - 1, 12, 14);
  ctx.fillStyle = '#7b8591'; ctx.fillRect(x, y, 10, 12);
  ctx.fillStyle = '#4b535e'; ctx.fillRect(x + 1, y + 1, 8, 6);
  ctx.fillStyle = fuseUsed ? '#ee6a74' : '#5fd88a'; ctx.fillRect(x + 4, y + 9, 2, 2);
}
function drawBankDarkness() {
  const px = player.x + 4 - cam.x, py = player.y + 2 - cam.y;
  const flick = fuseT > 0 ? (Math.sin(performance.now() / 60) > .55 ? .08 : .3) : 0;
  const g = ctx.createRadialGradient(px, py, 28, px, py, 160);
  g.addColorStop(0, 'rgba(3,6,14,0)');
  g.addColorStop(1, 'rgba(3,6,14,' + Math.min(.8, .4 + flick) + ')');
  ctx.fillStyle = g; ctx.fillRect(0, 0, VW, VH);
}

function drawHideoutMarker() {
  const x = hideout.x, y = hideout.y;
  ctx.fillStyle = 'rgba(240,194,75,.2)';
  ctx.fillRect(x - 12, y - 8, 24, 18);
  ctx.fillStyle = '#352b24'; ctx.fillRect(x - 8, y - 5, 16, 13);
  ctx.fillStyle = '#9b7040'; ctx.fillRect(x - 7, y - 4, 14, 10);
  ctx.fillStyle = '#d1aa5d'; ctx.fillRect(x - 7, y, 14, 2);
  ctx.fillRect(x - 1, y - 4, 2, 10);
  words('GANG', x, y - 8, '#ffe16b', 'bold 6px monospace', 'center');
}

function drawInteractionEffect(effect) {
  const progress = 1 - effect.life / effect.maxLife;
  const radius = 2 + Math.floor(progress * 5);
  ctx.globalAlpha = 1 - progress;
  ctx.fillStyle = effect.color;
  ctx.fillRect(effect.x - radius, effect.y, 2, 2);
  ctx.fillRect(effect.x + radius, effect.y, 2, 2);
  ctx.fillRect(effect.x, effect.y - radius, 2, 2);
  ctx.fillRect(effect.x, effect.y + radius, 2, 2);
  ctx.globalAlpha = 1;
}

let miniLayer = null;
function buildMiniLayer() {
  miniLayer = document.createElement('canvas');
  miniLayer.width = 60; miniLayer.height = 40;
  const m = miniLayer.getContext('2d');
  m.fillStyle = 'rgba(10,14,20,.9)'; m.fillRect(0, 0, 60, 40);
  m.strokeStyle = '#8d9bab'; m.lineWidth = 1; m.strokeRect(.5, .5, 59, 39);
  for (let ty = 0; ty < city.h; ty++) for (let tx = 0; tx < city.w; tx++) {
    m.fillStyle = isRoad(tx, ty) ? '#686d70' : ground(tx, ty) === 's' ? '#b4a181' : '#50614b';
    m.fillRect(2 + tx, 2 + ty, 1, 1);
  }
  buildings.forEach(building => {
    m.fillStyle = building.bank ? '#e0b84a' : building.home ? '#5c8c72' : building.store ? '#7eb4aa' : '#8f8991';
    m.fillRect(2 + building.x, 2 + building.y, building.w, building.h);
  });
}
function drawMiniMap() {
  const x = VW - 62, y = 62;
  if (!miniLayer) buildMiniLayer();
  ctx.drawImage(miniLayer, x - 2, y - 2);
  const mainTarget = missionStep === 1 ? npcs[0]
    : missionStep === 2 ? shopB
      : missionStep === 3 ? bankB
        : missionStep === 4 ? bankB
          : missionStep >= 5 && missionStep < missionObjectives.length && hasLoot ? { x: hideout.x / T, y: hideout.y / T }
          : missionStep === 0 ? homeB : null;
  if (mainTarget) {
    const tx = mainTarget.tx !== undefined ? mainTarget.tx
      : mainTarget.w !== undefined ? mainTarget.x + mainTarget.w / 2
        : mainTarget.x > 200 ? mainTarget.x / T : mainTarget.x;
    const ty = mainTarget.ty !== undefined ? mainTarget.ty
      : mainTarget.h !== undefined ? mainTarget.y + mainTarget.h / 2
        : mainTarget.y > 200 ? mainTarget.y / T : mainTarget.y;
    ctx.fillStyle = '#ffe16b'; ctx.fillRect(x + Math.floor(tx), y + Math.floor(ty), 2, 2);
  }
  const sideTarget = sideQuestStep === 0 ? npcs.find(n => n.name === 'Pak Joko')
    : sideQuestStep === 1 ? npcs.find(n => n.name === 'Sari') : null;
  if (sideTarget) {
    ctx.fillStyle = '#ed82d3'; ctx.fillRect(x + Math.floor(sideTarget.x / T), y + Math.floor(sideTarget.y / T), 2, 2);
  }
  const side2Target = sideQuest2Step === 0 ? npcs.find(n => n.name === 'Bu Tini')
    : sideQuest2Step === 1 ? npcs.find(n => n.name === 'Pak Ujang') : null;
  if (side2Target) {
    ctx.fillStyle = '#ed82d3'; ctx.fillRect(x + Math.floor(side2Target.x / T), y + Math.floor(side2Target.y / T), 2, 2);
  }
  cityPatrols.forEach(officer => {
    ctx.fillStyle = '#56c8ff';
    ctx.fillRect(x + Math.floor(officer.x / T), y + Math.floor(officer.y / T), 3, 3);
  });
  ctx.fillStyle = '#5fd8c0';
  ctx.fillRect(x + Math.floor((player.x + 4) / T), y + Math.floor((player.y + 6) / T), 2, 2);
  words('PETA', x + 2, y - 4, '#e8edf2', 'bold 5px monospace');
}

function drawRakaWaypoint() {
  const raka = npcs[0];
  const playerX = player.x + 4, playerY = player.y + 6;
  const targetX = raka.x - cam.x, targetY = raka.y - cam.y - 18;
  const dx = raka.x - playerX, dy = raka.y - playerY;
  const direction = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'E' : 'W') : (dy > 0 ? 'S' : 'N');
  const distance = Math.hypot(dx, dy);
  const blocks = Math.round(distance / T);
  const guidance = distance < 24 ? 'RAKA DEKAT' : 'RAKA ' + direction + ' ' + blocks;
  const visible = targetX >= 18 && targetX <= VW - 18 && targetY >= 36 && targetY <= VH - 58;
  const markerX = visible ? targetX : clamp(targetX, 18, VW - 18);
  const markerY = visible ? targetY : clamp(targetY, 38, VH - 62);
  const angle = visible ? 0 : Math.atan2(targetY - (playerY - cam.y), targetX - (playerX - cam.x)) + Math.PI / 2;
  ctx.save();
  ctx.translate(markerX, markerY);
  ctx.rotate(angle);
  ctx.fillStyle = '#ffe16b';
  ctx.beginPath();
  ctx.moveTo(0, -8); ctx.lineTo(6, 6); ctx.lineTo(0, 3); ctx.lineTo(-6, 6);
  ctx.closePath(); ctx.fill();
  ctx.strokeStyle = '#312718'; ctx.lineWidth = 1; ctx.stroke();
  ctx.restore();
  if (visible || markerY > 38) words('RAKA', markerX, markerY - 9, '#ffe16b', 'bold 7px monospace', 'center');
  plate(guidance, 0, 42, '#ffe16b', true);
}

function hud() {
  const obj = where === 'city' && hasLoot ? 'Hindari polisi, cari gang & gorong-gorong di selatan!'
    : where === 'city' && alarmCount > 0 ? 'Polisi berpatroli lebih banyak. Hati-hati!'
    : where === 'city' ? 'Cari BANK (gedung berpilar emas). Tanya warga!'
    : where === 'cafe' ? 'Warteg masih buka - nasi hangat dan teman ngobrol!'
    : where === 'office' ? 'Kantor pusat - ruang kerja sedang aktif.'
    : where === 'home' ? 'Rumahmu - akhirnya bisa istirahat sejenak.'
    : where === 'shop' ? 'Toko kelontong - kebutuhan malam ini ada di sini.'
    : typeof where === 'string' && where.startsWith('r_') ? 'Lihat-lihat dulu. Pintu keluar ada di bawah.'
    : !vaultOpen ? 'Cari brankas, periksa tiap ruangan'
    : !hasLoot ? 'Brankas terbuka! Ambil uangnya'
    : 'Kabur lewat pintu EXIT di bawah!';
  plate(obj, 4, 4, '#f0e2a0');
  plate('UANG ' + rp(money), 0, 20, '#8fe3a0', true);
  if (scene === 'play') {
    if (where === 'city' && wanted > 0) plate('BURONAN ' + '!'.repeat(Math.ceil(wanted)), 0, 36, '#f4a1a7', true);
  }
  if (where === 'bank') {
    const gear = ['lockpick', 'disguise', 'smoke', 'diversion'].filter(key => inventory[key]).length;
    plate('PERLENGKAPAN ' + gear + '/4', 0, 36, '#bfe8dc', true);
    if (scene === 'play' && heistMode) plate(heistMode === 'stealth' ? 'RENCANA SENYAP' : 'RENCANA BERISIK', 4, 20, heistMode === 'stealth' ? '#8fe3a0' : '#f4a1a7');
  }
  if (hasLoot) plate(rp(shown), 0, 4, '#8fe3a0', true);
  if (where === 'bank' && suspicion > .02) {
    ctx.fillStyle = '#000'; ctx.fillRect(110, 20, 100, 6);
    ctx.fillStyle = '#ee6a74'; ctx.fillRect(111, 21, 98 * suspicion, 4);
  }
  if (scene === 'play' && hint) plate(hint, null, VH - 18, '#f0c24b');
  if (toastT > 0 && scene === 'play') plate(toastText, null, where === 'city' ? 104 : where === 'bank' ? 54 : 36, '#fff');
  if (scene === 'talk') {
    ctx.fillStyle = 'rgba(14,20,30,.94)'; ctx.fillRect(8, VH - 62, VW - 16, 54);
    ctx.strokeStyle = '#5fd8c0'; ctx.lineWidth = 1; ctx.strokeRect(8.5, VH - 61.5, VW - 17, 53);
    words(talk.n.name, 16, VH - 49, '#5fd8c0');
    wrap(talk.lines[talk.i], 54).forEach((l, i) => words(l, 16, VH - 35 + i * 11, '#e8edf2'));
    words('[E] lanjut', VW - 16, VH - 14, '#8d9bab', 'bold 8px monospace', 'right');
  }
  if (scene === 'caught' || scene === 'crashed') {
    ctx.fillStyle = 'rgba(120,10,20,.5)'; ctx.fillRect(0, 0, VW, VH);
    words(bannerText, VW / 2, VH / 2, '#fff', '12px "Press Start 2P", monospace', 'center');
  }
}

let lastLive = '';
function updateMissionPanel() {
  const toggle = $('missionToggle'), panel = $('missionPanel');
  if (scene === 'talk' && talk) {
    const spoken = talk.n.name + ': ' + talk.lines[talk.i];
    if (spoken !== lastLive) { lastLive = spoken; $('live').textContent = spoken; }
  } else lastLive = '';
  const visible = scene === 'play' || scene === 'talk';
  $('mobileControls').hidden = !visible;
  $('touchDiversion').hidden = !(where === 'bank' && inventory.diversion);
  $('useDiversion').hidden = !(scene === 'play' && where === 'bank' && inventory.diversion);
  toggle.hidden = !visible;
  if (!visible) {
    panel.hidden = true;
    toggle.setAttribute('aria-expanded', 'false');
    toggle.textContent = 'MISI +';
  }
  $('mainMissionText').textContent = missionStep >= missionObjectives.length
    ? 'Selesai! Kamu berhasil menyelesaikan misi utama.'
    : missionObjectives[missionStep];
  const side1 = sideQuestStep >= 2 ? 'Paket Sari: selesai (+Rp 800).' : sideQuestObjectives[sideQuestStep];
  const side2 = sideQuest2Step >= 2 ? 'Gorengan Pak Ujang: selesai (+Rp 500).' : sideQuest2Objectives[sideQuest2Step];
  $('sideMissionText').textContent = side1 + '\n' + side2;
}

let last = performance.now();
function frame(now) {
  const dt = Math.min(.05, (now - last) / 1000);
  last = now;
  update(dt);
  updateMissionPanel();
  if (scene === 'menu') refreshLobby();
  draw();
  requestAnimationFrame(frame);
}
buildCity();
buildBank();
buildCafe();
buildOffice();
buildHome();
buildShop();
loadProgress();
resetGuards();
$('continueGame').disabled = !hasSaveData;
refreshLobby();
const missionToggle = $('missionToggle'), missionPanel = $('missionPanel');
missionToggle.addEventListener('click', () => {
  const expanded = missionToggle.getAttribute('aria-expanded') === 'true';
  missionToggle.setAttribute('aria-expanded', String(!expanded));
  missionPanel.hidden = expanded;
  missionToggle.textContent = expanded ? 'MISI +' : 'MISI −';
});
const soundButton = $('soundToggle');
soundButton.addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  soundButton.textContent = soundEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
  soundButton.setAttribute('aria-pressed', String(soundEnabled));
  if (soundEnabled) playSound('success');
  else stopMusic();
  saveProgress();
});
soundButton.textContent = soundEnabled ? 'AUDIO: ON' : 'AUDIO: OFF';
soundButton.setAttribute('aria-pressed', String(soundEnabled));
requestAnimationFrame(frame);

/* ---------- puzzle kode ---------- */
let lv = 0, qi = 0, lives = MAX_LIVES, cur = 0, secs = 0, tick = null, codes = [], order = [], found = [], qDone = false;
const reverseLevels = new Set([2]);

function toChar(n) {
  if (n === 0) return ' ';
  if (n >= 1 && n <= 26) return String.fromCharCode(n + 64);
  if (n <= -1 && n >= -26) return String.fromCharCode(-n + 96);
  return null;
}
const fmt = s => String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
function say(t, type) { $('msg').textContent = t; $('msg').className = type || ''; }

function paint() {
  $('lv').textContent = `${lv + 1}/${levels.length}`;
  $('qn').textContent = `${qi + 1}/${levels[lv].length}`;
  $('lives').textContent = '♥'.repeat(lives) + '♡'.repeat(MAX_LIVES - lives);
  $('time').textContent = fmt(secs);
  $('time').classList.toggle('low', secs <= 15);
  $('seq').textContent = codes.join(', ');
  $('pos').textContent = qDone ? 'SELESAI' : reverseLevels.has(lv) ? (cur + 1) + ' dari KANAN (angka paling kanan dulu)' : cur + 1;
  $('found').textContent = found.length ? found.map(c => c === ' ' ? '␠' : c).join(' ') : '-';
  $('num').disabled = $('ok').disabled = qDone;
  $('next').hidden = !qDone;
  $('next').textContent = lv === levels.length - 1 && qi === levels[lv].length - 1 ? 'BUKA BRANKAS' : 'LANJUT';
}

function startQ() {
  clearInterval(tick);
  codes = levels[lv][qi]; cur = 0; found = []; qDone = false;
  order = reverseLevels.has(lv) ? codes.slice().reverse() : codes;
  secs = 120 + lv * 30 + Math.max(0, codes.length - 5) * 4 + (inventory.lockpick ? 30 : -25);
  $('num').value = '';
  paint();
  tick = setInterval(() => {
    secs--;
    $('time').textContent = fmt(secs);
    $('time').classList.toggle('low', secs <= 15);
    if (secs <= 0) hit('Waktu habis!', true);
  }, 1000);
  $('num').focus();
}

function openCipher() {
  scene = 'cipher';
  for (const k in keys) delete keys[k];
  lives = Math.max(lives, 1);
  $('cipher').hidden = false;
  startQ();
  say('Ketik angka sesuai urutan, satu per satu. Esc untuk mundur dari brankas.' + (reverseLevels.has(lv) ? ' SANDI TERBALIK: mulai dari angka paling kanan.' : ''));
}
$('cipherClose') && $('cipherClose').addEventListener('click', () => { if (scene === 'cipher') closeCipher(); });
const HELP_KEY = 'bankHeistHelpSeen';
let helpPrev = 'play';
const helpSeen = () => { try { return localStorage.getItem(HELP_KEY) === '1'; } catch (error) { return true; } };
function openHelp() {
  if (scene !== 'play' && scene !== 'talk') return;
  helpPrev = scene; scene = 'help';
  for (const k in keys) delete keys[k];
  $('helpPanel').hidden = false;
  $('helpToggle').classList.remove('pulse');
  try { localStorage.setItem(HELP_KEY, '1'); } catch (error) { /* storage diblokir */ }
  $('helpClose').focus();
}
function closeHelp() {
  if (scene !== 'help') return;
  $('helpPanel').hidden = true;
  scene = helpPrev;
  $('helpToggle').blur();
}
$('helpToggle').addEventListener('click', () => { if (scene === 'help') closeHelp(); else openHelp(); });
$('helpClose').addEventListener('click', closeHelp);
if (!helpSeen()) $('helpToggle').classList.add('pulse');
function closeCipher() {
  clearInterval(tick);
  $('cipher').hidden = true;
  scene = 'play';
}

function hit(reason, restart) {
  lives--;
  $('num').value = '';
  if (lives <= 0) {
    closeCipher();
    lv = 0; qi = 0; lives = MAX_LIVES;
    caught('ALARM BUNYI!');
    return;
  }
  if (restart) { startQ(); say(reason + ' Soal diulang, nyawa berkurang.', 'bad'); return; }
  paint();
  say(reason + ' Nyawa berkurang.', 'bad');
  $('num').focus();
}

$('f').addEventListener('submit', e => {
  e.preventDefault();
  if (qDone) return;
  const value = $('num').value.trim();
  const n = Number(value);
  if (!value || !Number.isInteger(n) || toChar(n) === null) { say('Masukkan bilangan bulat -26 sampai 26.', 'bad'); return; }
  if (n !== order[cur]) { hit(reverseLevels.has(lv) ? 'Angka salah. SANDI TERBALIK: ketik dari angka paling KANAN dulu.' : 'Angka salah.'); return; }
  found.push(toChar(n));
  cur++;
  $('num').value = '';
  if (cur === order.length) {
    clearInterval(tick);
    qDone = true;
    paint();
    say('Soal selesai! Jawabannya: ' + (reverseLevels.has(lv) ? found.slice().reverse() : found).join('').replace(/ /g, '␠'), 'ok');
    $('next').focus();
    return;
  }
  paint();
  say(n === 0 ? 'Benar, 0 itu spasi.' : `Benar! ${n} = ${toChar(n)}`, 'ok');
  $('num').focus();
});

$('next').addEventListener('click', () => {
  if (!qDone) return;
  if (lv === levels.length - 1 && qi === levels[lv].length - 1) { win(); return; }
  qi++;
  if (qi >= levels[lv].length) { lv++; qi = 0; }
  startQ();
  say(`Segel ${lv + 1} dari ${levels.length}. Lanjut soal ${qi + 1}.` + (reverseLevels.has(lv) ? ' SANDI TERBALIK: ketik dari angka paling kanan!' : ''));
});
/* ===== tambahan suasana, npc, musik, isi gedung (dulu juice.js) ===== */
/* tambahan: suasana malam, npc lebih hidup, musik, panah tujuan
   dimuat setelah script.js, jadi tinggal hapus tag-nya kalau mau balik ke versi lama */
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
    const run = ++musicRun;
    const step = () => {
      if (!audioContext || !musicNodes.length || run !== musicRun) return;
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
    if (missionStep >= 5 && missionStep < missionObjectives.length && hasLoot) return hideout;
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