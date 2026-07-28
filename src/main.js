// ============================================================
//  啟動、視窗適配、主迴圈、HUD / 面板 / 印記樹
// ============================================================
import { CFG, zoneAt, upgValue, buildValue, markCost } from './config.js';
import { initInput, pollInput, input, setInputEnabled } from './input.js';
import { initAudio } from './audio.js';
import {
  G, initGame, update, val, save, resetSave,
  nextCost, nextBuildCost, nextWeapon, levelCap, threatLevel,
  pendingMarks, markSpendable, buyMark, doPrestige,
} from './game.js';
import { initRender, resizeRender, render, SM } from './render.js';
import { initDev } from './dev.js';
import { abbr } from './pixel.js';

const stage   = document.getElementById('stage');
const canvas  = document.getElementById('game');
const startEl = document.getElementById('start');

const el = {
  money: document.getElementById('moneyVal'),
  warmF: document.getElementById('warmFill'),
  warmT: document.getElementById('warmTxt'),
  loadF: document.getElementById('loadFill'),
  loadT: document.getElementById('loadTxt'),
  zone:  document.getElementById('zone'),
  baseF: document.getElementById('baseFill'),
  baseTxt: document.getElementById('baseTxt'),
  toasts:document.getElementById('toasts'),
  dead:  document.getElementById('dead'),
  cold:  document.getElementById('cold'),
  panel: document.getElementById('panel'),
  pName: document.getElementById('pName'),
  pDesc: document.getElementById('pDesc'),
  pVal:  document.getElementById('pVal'),
  pCost: document.getElementById('pCost'),
  pBar:  document.getElementById('pBar'),
  modal: document.getElementById('modal'),
  nodes: document.getElementById('nodes'),
  markCount: document.getElementById('markCount'),
  resetBtn: document.getElementById('resetBtn'),
  modalClose: document.getElementById('modalClose'),
};

let VW = CFG.BASE_W, VH = 512;

// ---------------- 視窗適配 ----------------
function resize() {
  const availW = window.innerWidth, availH = window.innerHeight;
  VW = CFG.BASE_W;
  VH = Math.round(Math.max(CFG.MIN_H, Math.min(CFG.MAX_H, VW * availH / availW)));
  canvas.width = VW; canvas.height = VH;

  const scale = Math.min(availW / VW, availH / VH);
  const cssW = Math.floor(VW * scale), cssH = Math.floor(VH * scale);
  stage.style.width = cssW + 'px';
  stage.style.height = cssH + 'px';

  resizeRender(VW, VH);
  const r = stage.getBoundingClientRect();
  SM.left = r.left; SM.top = r.top;
  SM.sx = VW / cssW; SM.sy = VH / cssH;
}
window.addEventListener('resize', resize);
window.addEventListener('orientationchange', () => setTimeout(resize, 120));

// ---------------- Toast ----------------
let lastToast = 0;
function toast(msg, warn = false) {
  const now = performance.now();
  if (now - lastToast < 60) return;
  lastToast = now;
  const d = document.createElement('div');
  d.className = 'toast' + (warn ? ' warn' : '');
  d.textContent = msg;
  el.toasts.appendChild(d);
  setTimeout(() => d.remove(), 2100);
}
G.onToast = toast;

// ---------------- 台座說明面板 ----------------
//  這是「讓玩家知道每個升級到底在升什麼」的解法
let panelPad = null;
G.onPanel = (pad) => { panelPad = pad; };

function fmt(n, digits = 0) {
  return n >= 1000 ? abbr(n) : n.toFixed(digits);
}

function upgDisplay(key, lv) {
  const u = CFG.UPG[key];
  const v = upgValue(key, lv);
  if (key === 'cap')   return Math.round(v + G.tree.blood * CFG.PRESTIGE.TREE.blood.per) + ' 格';
  if (key === 'speed') return Math.round(v * (1 + G.tree.swift * CFG.PRESTIGE.TREE.swift.per));
  if (key === 'power') return (v * val.weapon().mult).toFixed(1) + ' 傷害';
  if (key === 'warm')  return '−' + Math.round((1 - v) * 100) + '% 失溫傷害';
  return fmt(v);
}

function renderPanel() {
  if (!panelPad) { el.panel.classList.remove('on'); return; }
  el.panel.classList.add('on');
  const pad = panelPad;
  let name, desc, cur, next, cost, ok;

  if (pad.kind === 'upg') {
    const u = CFG.UPG[pad.key];
    const lv = G.upg[pad.key];
    name = `${u.name}  LV${lv}`;
    desc = u.desc;
    cur  = upgDisplay(pad.key, lv);
    next = lv < levelCap(pad.key) ? upgDisplay(pad.key, lv + 1) : null;
    cost = nextCost(pad.key);
    ok   = G.money >= cost;
  } else if (pad.kind === 'build') {
    const b = CFG.BUILD[pad.key];
    const lv = G.build[pad.key];
    name = `${b.name}  LV${lv}`;
    desc = b.desc;
    cur  = buildLabel(pad.key, lv);
    next = lv < b.max ? buildLabel(pad.key, lv + 1) : null;
    cost = nextBuildCost(pad.key);
    ok   = G.money >= cost;
  } else if (pad.kind === 'weapon') {
    const w = nextWeapon(), cw = val.weapon();
    name = w ? `武器：${w.name}` : `武器：${cw.name}`;
    desc = w ? `傷害 ×${w.mult.toFixed(2)}．範圍 ${w.range}．同時打 ${w.targets} 隻` : '已是最強武器';
    cur  = `${cw.name}  ×${cw.mult.toFixed(2)}`;
    next = w ? `${w.name}  ×${w.mult.toFixed(2)}` : null;
    cost = w ? w.cost : Infinity;
    ok   = w && G.money >= w.cost;
  }

  el.pName.textContent = name;
  el.pDesc.textContent = desc;
  el.pVal.innerHTML = next ? `${cur} → <b>${next}</b>` : cur;
  if (isFinite(cost)) {
    el.pCost.textContent = '$' + abbr(cost);
    el.pCost.className = 'pcost' + (ok ? '' : ' no');
  } else {
    el.pCost.textContent = '';
    el.pCost.className = 'pcost';
  }
  el.pBar.style.width = (Math.min(1, G.padCharge / CFG.PAD_CHARGE) * 100) + '%';
}

function buildLabel(key, lv) {
  const v = buildValue(key, lv);
  if (key === 'shelf')   return Math.round(v) + ' 塊';
  if (key === 'counter') return Math.round(v) + ' 位顧客';
  if (key === 'wall')    return lv === 0 ? '未建造' : '+' + Math.round(v) + ' 範圍';
  if (key === 'tower')   return lv === 0 ? '未建造' : lv + ' 座塔';
  if (key === 'hauler')  return lv === 0 ? '未僱用' : lv + ' 人';
  if (key === 'hunter')  return lv === 0 ? '未僱用' : lv + ' 人';
  return '' + v;
}

// ---------------- 印記樹 ----------------
G.onPrestigePad = (open) => { open ? openModal() : closeModal(); };

function openModal() {
  el.modal.classList.add('on');
  setInputEnabled(false);
  renderModal();
}
function closeModal() {
  el.modal.classList.remove('on');
  setInputEnabled(true);
}
el.modalClose.addEventListener('pointerdown', (e) => { e.stopPropagation(); closeModal(); });
el.resetBtn.addEventListener('pointerdown', (e) => {
  e.stopPropagation();
  if (doPrestige()) { renderModal(); closeModal(); }
});

function renderModal() {
  const spend = markSpendable();
  el.markCount.textContent = spend;
  el.nodes.innerHTML = '';
  for (const key in CFG.PRESTIGE.TREE) {
    const t = CFG.PRESTIGE.TREE[key];
    const lv = G.tree[key];
    const maxed = lv >= t.max;
    const cost = markCost(key, lv);
    const can = !maxed && spend >= cost;

    const d = document.createElement('div');
    d.className = 'node' + (maxed ? ' max' : can ? ' can' : '');
    d.innerHTML =
      `<div class="nm"><b>${t.name}</b><span>${t.desc}</span></div>` +
      `<div class="lv">LV${lv}/${t.max}</div>` +
      `<div class="pc">${maxed ? '—' : cost}</div>`;
    if (!maxed) d.addEventListener('pointerdown', (e) => {
      e.stopPropagation();
      if (buyMark(key)) renderModal();
    });
    el.nodes.appendChild(d);
  }
  const gain = pendingMarks();
  el.resetBtn.textContent = gain > 0 ? `遠征歸來  +${gain} 印記` : '收入還不夠，再賺一些';
  el.resetBtn.className = gain > 0 ? 'can' : 'no';
}

// ---------------- HUD ----------------
let hudMoney = -1, hudCap = -1, hudCarry = -1, hudZone = -1, hudThreat = -1;
const inCampNow = (p) => {
  const c = CFG.CAMP, e = 0;
  return p.x > c.x - e && p.x < c.x + c.w + e && p.y > c.y - e && p.y < c.y + c.h + e;
};

function updateHud() {
  const p = G.player;

  const m = Math.floor(G.money);
  if (m !== hudMoney) { hudMoney = m; el.money.textContent = abbr(m); }

  const w = Math.max(0, p.hp) / CFG.PLAYER.hpMax;
  el.warmF.style.width = (w * 100).toFixed(1) + '%';
  el.warmT.textContent = Math.ceil(Math.max(0, p.hp)) + ' / ' + CFG.PLAYER.hpMax;
  el.warmF.className = w < 0.3 ? 'low' : '';

  const cap = val.cap(), n = p.carry.length;
  if (cap !== hudCap || n !== hudCarry) {
    hudCap = cap; hudCarry = n;
    el.loadT.textContent = n + '/' + cap;
  }
  el.loadF.style.width = (Math.min(1, n / cap) * 100).toFixed(1) + '%';

  const baseW = Math.max(0, G.baseHp) / G.baseMaxHp;
  el.baseF.style.width = (baseW * 100).toFixed(1) + '%';
  el.baseTxt.textContent = Math.ceil(Math.max(0, G.baseHp)) + '/' + G.baseMaxHp;
  el.baseF.className = baseW < 0.35 ? 'low' : '';

  const z = zoneAt(p.y);
  const th = threatLevel();
  if (z.id !== hudZone || th !== hudThreat) {
    hudZone = z.id; hudThreat = th;
    el.zone.innerHTML = `${z.name}<em>${z.tag} · 威脅 ${th}</em>`;
  }

  // 低血：紅色暈影；在野外失溫中：偏藍
  const low = w < 0.45 ? (0.45 - w) / 0.45 : 0;
  const freezing = !p.nearFire && !inCampNow(p) ? 1 : 0;
  const col = freezing ? '150,205,255' : '255,70,50';
  el.cold.style.boxShadow =
    `inset 0 0 ${40 + low * 60}px ${5 + low * 24}px rgba(${col},${low * 0.6})`;
  el.dead.style.opacity = p.alive ? 0 : 1;

  renderPanel();
}

// ---------------- 主迴圈 ----------------
const STEP = 1 / 60;
let acc = 0, last = 0;

function frame(now) {
  requestAnimationFrame(frame);
  if (!last) last = now;
  let dt = (now - last) / 1000;
  last = now;
  if (dt > 0.25) dt = 0.25;
  acc += dt;

  const inp = pollInput();
  //  開發者加速：一幀多跑幾次固定步進（不改變物理步長，行為跟正常速度一致）
  const mul = G.devSpeed || 1;
  const maxSteps = 5 * mul;
  let steps = 0;
  while (acc >= STEP && steps < maxSteps) {
    for (let k = 0; k < mul; k++) update(STEP, inp);
    acc -= STEP; steps += mul;
  }
  if (steps >= maxSteps) acc = 0;

  render(dt);
  updateHud();
}

// ---------------- 啟動 ----------------
function boot() {
  initRender(canvas);
  initGame();
  resize();
  initInput(stage, () => initAudio());
  initDev();               // ` 或 F2 開啟，網址加 ?dev=1 直接開
  requestAnimationFrame(frame);
}

function start() {
  if (G.running) return;
  initAudio();
  G.running = true;
  startEl.classList.add('hide');
  setTimeout(() => startEl.style.display = 'none', 320);
  toast('獵殺 → 扛肉 → 上貨架');
}
startEl.addEventListener('pointerdown', start);
window.addEventListener('keydown', start, { once: true });

// ---------------- 自動存檔 ----------------
//  每 5 秒一次，加上所有「可能離開頁面」的時機都補存一次。
//  手機切到背景時 beforeunload 不一定會觸發，所以 pagehide 才是關鍵。
const saveDot = document.getElementById('saveDot');
let saveDotT = null;
G.onSaved = () => {
  if (!saveDot) return;
  saveDot.classList.add('on');
  clearTimeout(saveDotT);
  saveDotT = setTimeout(() => saveDot.classList.remove('on'), 900);
};

setInterval(() => { if (G.running) save(); }, 5000);
window.addEventListener('pagehide', () => { if (G.running) save(); });
window.addEventListener('beforeunload', () => { if (G.running) save(); });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (G.running) save(); last = 0; acc = 0; }
});

window.FL = {
  G, save, resetSave, CFG, val,
  /** 手動步進 n 幀（分頁未合成時 RAF 不會跑，用這個驗證畫面） */
  step(n = 1) {
    const inp = pollInput();
    for (let i = 0; i < n; i++) update(STEP, inp);
    render(STEP);
    updateHud();
  },
};

boot();
