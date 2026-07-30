// ============================================================
//  遊戲狀態與模擬。固定時間步 60Hz。
// ============================================================
import {
  CFG, upgCost, upgValue, buildCost, buildValue, buildWood, markCost,
  zoneAt, upgCapFor, WOOD_MARKER,
} from './config.js';
import { world, buildWorld, inCamp, campRect, makeRng } from './world.js';
import { SFX } from './audio.js';
import { abbr } from './pixel.js';
import { initBase, updateBase, resetBase, shelfSpace, depositMeat } from './base.js';

export const rng = makeRng(4242);

const EMPTY_UPG   = () => ({ cap: 0, speed: 0, power: 0, vigor: 0, warm: 0 });
const EMPTY_BUILD = () =>
  ({ shelf: 0, counter: 0, wall: 0, tower: 0, hauler: 0, chopper: 0, hunter: 0, robot: 0 });
const EMPTY_TREE  = () => ({ blood: 0, skill: 0, swift: 0, hide: 0, harvest: 0, fame: 0, spark: 0 });

export const G = {
  money: 0,
  lifetime: 0,                 // 生涯總收入（轉生用）
  runEarned: 0,                // 本輪收入
  upg: EMPTY_UPG(),
  build: EMPTY_BUILD(),
  zonesOpen: 2,                // 兩個區域從一開始就開放

  baseHp: 300,
  baseMaxHp: 300,
  baseBreakT: 0,               // 基地損毀後的無敵冷卻時間

  weapon: 0,
  weaponsOwned: [0],

  marks: 0,
  tree: EMPTY_TREE(),
  prestiges: 0,

  stats: { sold: 0, kills: 0, deaths: 0, time: 0 },

  player: null,
  bears: [],
  drops: [],
  fx: [],
  floats: [],
  prints: [],                  // 雪地腳印（純視覺，不存檔）

  // 據點（base.js 管理）
  shelf: [],
  cash: 0,
  customers: [],
  helpers: [],
  towers: [],
  shots: [],

  time: 0,
  shake: 0,
  padCharge: 0, padKey: null,
  cashTimer: 0, cashStreak: 0, cashStreakT: 0,
  shelfTimer: 0,
  woodTimer: 0,
  wood: 0,                     // 木材庫存：拿來蓋東西的資源
  woodPile: 0,                 // 木材場上堆著的木頭（純視覺，會慢慢被運走）

  //  箭塔搬遷：扛在身上的塔（索引）與蓄力進度
  towerPos: null,              // 玩家自訂的塔位（null = 用預設點位）
  towerCarry: -1,
  towerGrab: 0,
  towerPlace: 0,
  towerLock: false,            // 剛放下：要離開範圍才能再扛

  //  商店：擁有的裝飾品與目前穿戴（純外觀，不影響數值）
  owned: { decor: [], hat: [], crew: ['none'] },
  equip: { hat: null, crew: 'none' },

  //  開發者工具（? dev=1 或按 ` 開啟）
  devThreat: null,             // 覆寫威脅等級
  devGod: false,
  devSpeed: 1,
  coldWarnT: 0,
  lockHintT: -99,
  flash: 0,
  running: false,

  prestigeOpen: false,
  savedPlayer: null,
  saveWarned: false,
  onSaved: () => {},
  onToast: () => {},
  onPanel: () => {},           // 顯示「站上去時的說明面板」
  onPrestigePad: () => {},     // 進出遠征營帳
};

// ---------------- 存檔 ----------------
export let lastSaveAt = 0;
export function save() {
  try {
    const p = G.player;
    localStorage.setItem(CFG.SAVE_KEY, JSON.stringify({
      v: CFG.SAVE_VERSION,
      money: G.money, lifetime: G.lifetime, runEarned: G.runEarned,
      upg: G.upg, build: G.build, zonesOpen: G.zonesOpen,
      weapon: G.weapon, weaponsOwned: G.weaponsOwned,
      marks: G.marks, tree: G.tree, prestiges: G.prestiges,
      stats: G.stats,
      shelf: G.shelf, cash: G.cash,
      baseHp: G.baseHp,
      wood: G.wood,
      towerPos: G.towerPos,
      owned: G.owned, equip: G.equip,
      // 玩家身上的東西也要存，不然重整就掉背包
      player: p ? { x: p.x, y: p.y, hp: p.hp, carry: p.carry } : null,
      fire: world.firepits.map(f => f.lit),
      at: Date.now(),
    }));
    lastSaveAt = performance.now();
    G.onSaved();
    return true;
  } catch (e) {
    // 隱私模式 / 容量滿：告訴玩家，不要無聲失敗
    if (!G.saveWarned) { G.saveWarned = true; G.onToast('無法存檔（瀏覽器封鎖儲存）', true); }
    return false;
  }
}

function load() {
  try {
    const raw = localStorage.getItem(CFG.SAVE_KEY);
    if (!raw) return;
    const d = JSON.parse(raw);
    if (!d) return;
    //  存檔相容策略：新版本只「補欄位」，不整包丟掉。
    //  舊檔缺的鍵一律靠 EMPTY_* 與 || 預設值補齊，玩家的進度不會因為更新而消失。
    //  只有真的舊到無法解讀（v 比最低相容版本還小）才放棄。
    if (d.v > CFG.SAVE_VERSION || d.v < CFG.SAVE_MIN) return;
    G.money = d.money || 0;
    G.lifetime = d.lifetime || 0;
    G.runEarned = d.runEarned || 0;
    Object.assign(G.upg, d.upg || {});
    Object.assign(G.build, d.build || {});
    Object.assign(G.tree, d.tree || {});
    G.zonesOpen = 2; // 兩個區域永遠開放
    G.weapon = d.weapon || 0;
    G.weaponsOwned = d.weaponsOwned || [0];
    G.marks = d.marks || 0;
    G.prestiges = d.prestiges || 0;
    Object.assign(G.stats, d.stats || {});
    G.shelf = d.shelf || [];
    G.cash = d.cash || 0;
    G.baseHp = d.baseHp || CFG.BASE.hp;
    G.wood = d.wood || 0;
    G.towerPos = Array.isArray(d.towerPos) ? d.towerPos : null;
    if (d.owned) {
      G.owned.decor = d.owned.decor || [];
      G.owned.hat   = d.owned.hat || [];
      G.owned.crew  = d.owned.crew || ['none'];
    }
    if (d.equip) Object.assign(G.equip, d.equip);
    G.savedPlayer = d.player || null;
    if (d.fire) d.fire.forEach((lit, i) => { if (world.firepits[i]) world.firepits[i].lit = lit; });
  } catch (e) { /* 壞檔就當新玩家 */ }
}

export function resetSave() {
  try { localStorage.removeItem(CFG.SAVE_KEY); } catch (e) {}
  location.reload();
}

// ---------------- 數值查詢（含印記樹加成）----------------
const T = CFG.PRESTIGE.TREE;
export const val = {
  cap:   () => Math.round(upgValue('cap', G.upg.cap) + G.tree.blood * T.blood.per),
  speed: () => upgValue('speed', G.upg.speed) * (1 + G.tree.swift * T.swift.per),
  /** 實際傷害 = 威力升級 × 武器倍率 */
  power: () => upgValue('power', G.upg.power) * CFG.WEAPONS[G.weapon].mult,
  /** 血量上限（體魄升級線） */
  hpMax: () => Math.round(upgValue('vigor', G.upg.vigor)),
  warm:  () => upgValue('warm', G.upg.warm) * (1 - G.tree.hide * T.hide.per),
  /** 一塊肉在某區域的價格 */
  meat:  (zone) => zone.meat * (1 + G.tree.skill * T.skill.per),
  /** 顧客需求量倍率 */
  fame:  () => 1 + G.tree.fame * T.fame.per,
  weapon: () => CFG.WEAPONS[G.weapon],
  shelfMax: () => Math.round(buildValue('shelf', G.build.shelf)),
  queueMax: () => Math.round(buildValue('counter', G.build.counter)),
};

/**
 * 威脅等級 —— 熊有多強。
 * 由玩家目前的實力推算，所以是玩家自己把熊養大的：每買一次升級，
 * 野外就變兇一點。這樣中期蓋滿箭塔之後才不會瞬間失去挑戰性。
 * 新生的熊才會套用當下的威脅值，已經在場上的熊不會突然變強。
 */
export function threatLevel() {
  if (G.devThreat !== null && G.devThreat !== undefined) return G.devThreat;
  let u = 0; for (const k in CFG.UPG) u += G.upg[k];
  let b = 0; for (const k in CFG.BUILD) b += G.build[k];
  const raw = u * 0.55 + b * 1.6 + G.weapon * 4 + G.prestiges * 3;
  return Math.max(0, Math.min(CFG.THREAT.max, Math.floor(raw / CFG.THREAT.div)));
}

/** 威脅等級換算成各項倍率 */
export function threatMul(t = threatLevel()) {
  const T = CFG.THREAT;
  return {
    hp:   1 + Math.pow(t, T.hpPow) * T.hpMul,
    dmg:  1 + t * T.dmgMul,
    spd:  1 + t * T.spdMul,
    meat: 1 + t * T.meatMul,
  };
}

/** 這條升級線的等級上限（區域上限已移除，就是 max） */
export function levelCap(key) { return upgCapFor(G.zonesOpen, key); }
export function nextCost(key) {
  if (G.upg[key] >= levelCap(key)) return Infinity;
  return upgCost(key, G.upg[key]);
}
export function nextBuildCost(key) {
  if (G.build[key] >= CFG.BUILD[key].max) return Infinity;
  return buildCost(key, G.build[key]);
}
export function nextWeapon() {
  const i = G.weapon + 1;
  return i < CFG.WEAPONS.length ? CFG.WEAPONS[i] : null;
}
export function pendingMarks() {
  return Math.max(0, Math.floor(Math.sqrt(G.lifetime / CFG.PRESTIGE.marksDiv)) - G.marks - spentMarks());
}
function spentMarks() {
  let n = 0;
  for (const k in G.tree) for (let i = 0; i < G.tree[k]; i++) n += markCost(k, i);
  return n;
}
export function marksAvailable() { return G.marks; }

// ---------------- 初始化 ----------------
export function initGame() {
  buildWorld();
  load();

  const sp = G.savedPlayer;
  G.player = {
    x: sp ? sp.x : CFG.RESPAWN.x,
    y: sp ? sp.y : CFG.RESPAWN.y,
    vx: 0, vy: 0, face: 1,
    // 回來時至少給一半體溫，免得一進遊戲就凍死
    hp: sp ? Math.max(val.hpMax() * 0.5, sp.hp || 0) : val.hpMax(),
    carry: sp ? (sp.carry || []) : [],
    atkTimer: 0, swing: 0, swingDir: 0,
    //  三把環繞武器，各自有獨立冷卻
    orbit: 0,
    blades: Array.from({ length: CFG.ORBIT.base + 4 }, () => ({ cd: 0 })),
    iframes: sp ? 2 : 0, walkT: 0, hurtFlash: 0,
    combatT: 0, nearFire: false, coldTick: 0,
    alive: true, deadT: 0,
  };

  initBase();
  respawnAllBears();
}

function respawnAllBears() {
  G.bears.length = 0;
  world.plots.forEach(p => {
    p.bears = [];
    p.queue = [];
    for (let i = 0; i < CFG.BEAR.maxPerPlot; i++) spawnBear(p);
  });
}

// ---------------- 熊 ----------------
//  威脅越高，狂暴熊越多、幼熊越少 —— 後期的熊群組成本身就更硬
function pickVariant(t = 0) {
  const T = CFG.THREAT;
  const w = CFG.BEAR.VARIANTS.map(v => {
    const bias = v.id === 'rage' ? T.rageBias : v.id === 'cub' ? T.cubBias : 0;
    return Math.max(0.01, v.p + bias * t);
  });
  const total = w.reduce((a, b) => a + b, 0);
  let r = rng() * total;
  for (let i = 0; i < w.length; i++) { r -= w[i]; if (r <= 0) return CFG.BEAR.VARIANTS[i]; }
  return CFG.BEAR.VARIANTS[1];
}

/** 在熊窩附近取一個點（不是整個地塊平均分布 —— 熊要聚集） */
function nearDen(plot, radius = CFG.BEAR.denRadius) {
  const r = plot.rect;
  //  sqrt 讓分布往中心集中
  const a = rng() * Math.PI * 2;
  const d = Math.sqrt(rng()) * radius;
  return {
    x: Math.max(r.x + 12, Math.min(r.x + r.w - 12, plot.den.x + Math.cos(a) * d)),
    y: Math.max(r.y + 12, Math.min(r.y + r.h - 12, plot.den.y + Math.sin(a) * d)),
  };
}

function spawnBear(plot) {
  const z = plot.zone;
  const t = threatLevel();
  const m = threatMul(t);
  const v = pickVariant(t);
  const hp = Math.max(1, Math.round(z.bearHp * v.hp * m.hp));
  const spot = nearDen(plot, CFG.BEAR.denRadius * 0.8);
  const b = {
    x: spot.x, y: spot.y,
    vx: 0, vy: 0, face: 1,
    hp, maxHp: hp,
    zone: z, plot, variant: v,
    threat: t,               // 出生時的威脅值，決定掉肉價值
    spd: z.bearSpd * v.spd * m.spd,
    dmg: z.bearDmg * v.dmg * m.dmg,
    tx: 0, ty: 0, thinkT: 0,
    hitT: 0, flash: 0, walkT: 0,
    knockX: 0, knockY: 0,
    sepX: 0, sepY: 0,        // 每幀重算的互斥推力
    swingT: 0, clawT: 0,     // 拍打基地的冷卻與爪痕動畫
    raiding: false, hunting: false,
    lane: (rng() - 0.5) * 2, // 突襲時走哪一路（-1 最左 ~ +1 最右）
    radius: CFG.BEAR.radius * (v.id === 'cub' ? 0.72 : v.id === 'rage' ? 1.2 : 1),
  };
  b.tx = b.x; b.ty = b.y;
  plot.bears.push(b);
  G.bears.push(b);
  return b;
}

export function killBear(b, byHelper = false) {
  const z = b.zone;
  G.stats.kills++;
  SFX.bearDie();
  if (!byHelper) G.shake = Math.max(G.shake, 2.2);

  const n = Math.max(1, z.drops + b.variant.drop + G.tree.harvest * T.harvest.per);
  //  肉價跟著這隻熊出生時的威脅走：熊變硬，肉也變值錢，
  //  升級把熊養大這件事才會是「賺更多」而不是純粹的懲罰。
  const value = val.meat(z) * threatMul(b.threat || 0).meat;
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = 26 + rng() * 34;
    G.drops.push({
      x: b.x, y: b.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      z: 6, vz: 46 + rng() * 26,
      life: CFG.MEAT.despawn, value, spin: rng() * 6,
    });
  }
  burst(b.x, b.y - 6, 14, '#f6f1e6', 60);
  burst(b.x, b.y - 6, 6, '#cc4f4f', 40);

  const i = G.bears.indexOf(b); if (i >= 0) G.bears.splice(i, 1);
  const j = b.plot.bears.indexOf(b); if (j >= 0) b.plot.bears.splice(j, 1);
  b.plot.queue.push(G.time + CFG.BEAR.respawn);
}

// ---------------- 特效（給 base.js 共用）----------------
export function burst(x, y, n, color, spd = 60) {
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = spd * (0.3 + rng() * 0.7);
    G.fx.push({
      x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 20,
      life: 0.3 + rng() * 0.4, max: 0.7, color, size: rng() > 0.5 ? 2 : 1, grav: 120,
    });
  }
}
export function float(x, y, text, color) {
  G.floats.push({ x, y, text, color, life: 0.9, vy: -22 });
}
export function coinFly(x, y, tx, ty, kind = 'coin') {
  G.fx.push({ coin: true, kind, x, y, tx, ty, t: 0, dur: 0.32 + rng() * 0.14, life: 1, max: 1 });
}

/** 擴散圓環 */
function ring(x, y, r0, r1, life, color, width = 2) {
  G.fx.push({ ring: true, x, y, r0, r1, life, max: life, color, width });
}
/** 直線光痕 */
function streak(x, y, a, len, life, color, width = 2) {
  G.fx.push({ streak: true, x, y, a, len, life, max: life, color, width });
}

/**
 * 每把武器有自己的擊中特效 —— 換武器要換手感，不只是換數字。
 *  (x,y) 是命中點，a 是揮擊方向
 */
export function hitFx(kind, x, y, a, color) {
  switch (kind) {
    case 'burn':      // 火把：橘色火星 + 小火圈
      burst(x, y, 8, '#ffa62b', 80);
      burst(x, y, 4, '#ea5a1c', 55);
      ring(x, y, 2, 13, 0.22, 'rgba(255,150,40,0.85)', 2);
      break;

    case 'slash':     // 骨刀：兩道交叉白刃 + 血點
      streak(x, y, a + 0.35, 20, 0.16, 'rgba(255,255,255,0.95)', 2);
      streak(x, y, a - 0.35, 16, 0.13, 'rgba(232,226,208,0.8)', 1);
      burst(x, y, 5, '#cc4f4f', 70);
      break;

    case 'pierce':    // 獵矛：沿刺擊方向的長光痕 + 冰屑
      streak(x - Math.cos(a) * 10, y - Math.sin(a) * 10, a, 34, 0.2, 'rgba(207,216,230,0.95)', 3);
      for (let i = 0; i < 6; i++) {
        const s = 90 + rng() * 70;
        G.fx.push({
          x, y, vx: Math.cos(a + (rng() - 0.5) * 0.7) * s, vy: Math.sin(a + (rng() - 0.5) * 0.7) * s,
          life: 0.22 + rng() * 0.14, max: 0.36, color: '#9fdff0', size: 2, grav: 60,
        });
      }
      break;

    case 'crush':     // 戰斧：厚重衝擊波 + 碎屑（震動最大）
      ring(x, y, 3, 26, 0.26, 'rgba(240,160,90,0.9)', 3);
      ring(x, y, 1, 16, 0.16, 'rgba(255,255,255,0.7)', 2);
      burst(x, y, 14, '#f0a05a', 120);
      burst(x, y, 6, '#8d6539', 90);
      break;

    case 'aurora':    // 極光劍：雙層極光環 + 殘留光屑
      ring(x, y, 2, 30, 0.34, 'rgba(159,223,240,0.9)', 3);
      ring(x, y, 2, 20, 0.24, 'rgba(200,255,240,0.8)', 2);
      for (let i = 0; i < 10; i++) {
        const ang = rng() * Math.PI * 2, s = 40 + rng() * 90;
        G.fx.push({
          x, y, vx: Math.cos(ang) * s, vy: Math.sin(ang) * s,
          life: 0.3 + rng() * 0.35, max: 0.65,
          color: rng() > 0.5 ? '#9fdff0' : '#e8f6ff', size: rng() > 0.6 ? 2 : 1, grav: -20,
        });
      }
      break;

    default:
      burst(x, y, 6, color || '#ffd651', 70);
  }
}

/** 進帳（統一入口，方便統計生涯收入） */
export function earn(amount) {
  G.money += amount;
  G.lifetime += amount;
  G.runEarned += amount;
}

// ---------------- 主更新 ----------------
export function update(dt, inp) {
  if (!G.running) return;
  G.time += dt;
  G.stats.time += dt;
  G.shake = Math.max(0, G.shake - dt * 14);
  G.flash = Math.max(0, G.flash - dt * 3);
  if (G.cashStreakT > 0) { G.cashStreakT -= dt; if (G.cashStreakT <= 0) G.cashStreak = 0; }

  const p = G.player;

  if (!p.alive) {
    p.deadT -= dt;
    if (p.deadT <= 0) respawn();
    updateBears(dt);
    updateDrops(dt);
    updateTrees(dt);
    updateBase(dt);
    updateFx(dt);
    updatePrints(dt);
    return;
  }

  updateMove(dt, p, inp);
  if (p.iframes > 0) p.iframes -= dt;
  if (p.hurtFlash > 0) p.hurtFlash -= dt;

  updateVitals(dt, p);
  updateCombat(dt, p);
  updateTriggers(dt, p);
  updateTowerMove(dt, p);      // 要在 updateTriggers 之後：站在台座上時不搶塔

  updateBears(dt);
  updateDrops(dt);
  updateTrees(dt);
  updateBase(dt);
  updateFx(dt);
  updatePrints(dt);
}

//  走在雪地上會留下腳印。用「累積距離」而不是計時器，
//  這樣走快走慢的間距才會一致。
function trackPrints(e, dt, size, spread) {
  const sp = Math.hypot(e.vx, e.vy);
  if (sp < 12) return;
  e.printD = (e.printD || 0) + sp * dt;
  if (e.printD < 13) return;
  e.printD = 0;
  e.printSide = !e.printSide;
  const nx = -e.vy / sp, ny = e.vx / sp;          // 移動方向的法線 → 左右腳
  const s = e.printSide ? spread : -spread;
  if (G.prints.length >= CFG.PRINT_MAX) G.prints.shift();
  G.prints.push({
    x: Math.round(e.x + nx * s), y: Math.round(e.y + ny * s - 1),
    size, life: CFG.PRINT_LIFE,
  });
}

function updatePrints(dt) {
  for (let i = G.prints.length - 1; i >= 0; i--) {
    if ((G.prints[i].life -= dt) <= 0) G.prints.splice(i, 1);
  }
}

function updateMove(dt, p, inp) {
  const loadRatio = p.carry.length / val.cap();
  const slow = 1 - CFG.PLAYER.loadSlowMax * Math.min(1, loadRatio);
  const maxSpd = val.speed() * slow;

  if (inp.mag > 0) {
    p.vx += inp.x * CFG.PLAYER.accel * dt;
    p.vy += inp.y * CFG.PLAYER.accel * dt;
    if (Math.abs(inp.x) > 0.25) p.face = inp.x > 0 ? 1 : -1;
    p.walkT += dt * 9;
  } else {
    const sp = Math.hypot(p.vx, p.vy);
    if (sp > 0) {
      const f = Math.max(0, sp - CFG.PLAYER.friction * dt) / sp;
      p.vx *= f; p.vy *= f;
    }
  }
  const target = maxSpd * inp.mag;
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > Math.max(target, 1)) { const f = Math.max(target, 0) / sp; p.vx *= f; p.vy *= f; }

  p.x += p.vx * dt; p.y += p.vy * dt;
  const R = CFG.PLAYER.radius;
  p.x = Math.max(R, Math.min(CFG.WORLD.w - R, p.x));
  p.y = Math.max(R + 8, Math.min(CFG.WORLD.h - R, p.y));

  if (!inCamp(p.x, p.y)) trackPrints(p, dt, 2, 2.5);   // 營地是木地板，不留印
}

// ---------------- 血量與失溫 ----------------
//  血量統一承受兩種傷害：野外失溫（持續）與熊的攻擊（瞬間）。
//  火堆只「擋住失溫 + 微量回血」，而且受擊後 2 秒不回血 ——
//  否則站在營火下會變成無敵（回血速度超過熊的 DPS）。
function updateVitals(dt, p) {
  const camp = inCamp(p.x, p.y);
  let nearFire = false;
  for (const f of world.firepits) {
    if (!f.lit) continue;
    if (Math.hypot(p.x - f.x, p.y - f.y) < CFG.COLD.fireRadius) { nearFire = true; break; }
  }
  p.nearFire = nearFire;
  if (p.combatT > 0) p.combatT -= dt;

  if (camp) {
    p.hp = Math.min(val.hpMax(), p.hp + CFG.COLD.campHeal * dt);
    G.baseHp = Math.min(G.baseMaxHp, G.baseHp + CFG.BASE.campRepair * dt);
  } else if (nearFire) {
    // 火驅散寒氣，但戰鬥中不回血
    if (p.combatT <= 0) p.hp = Math.min(val.hpMax(), p.hp + CFG.COLD.fireHeal * dt);
  } else if (!G.devGod) {
    const z = zoneAt(p.y);
    const dps = CFG.COLD.base * z.cold * val.warm();
    p.hp -= dps * dt;
    p.coldTick = (p.coldTick || 0) + dps * dt;
    if (p.coldTick >= 5) {          // 每累積 5 點失溫傷害跳一次數字
      p.coldTick -= 5;
      float(p.x + (rng() - 0.5) * 10, p.y - 30, '-5', '#9fdff0');
    }
  }

  if (p.hp < 30 && p.hp > 0) {
    G.coldWarnT -= dt;
    if (G.coldWarnT <= 0) { SFX.coldWarn(); G.coldWarnT = p.hp < 15 ? 0.55 : 1.1; }
  }
  if (p.hp <= 0) die();
}

// ---------------- 戰鬥：三把環繞武器 ----------------
//  武器不再是「面向敵人揮一下」，而是三把繞著角色轉、各自獨立判定。
//  好處是玩家只要移動就好（符合本作的單一輸入），而且看起來一直在輸出。
//  每把刀有自己的冷卻，所以繞一圈掃過一群熊會逐一計傷，不會一幀打爆全部。
export function orbitRadius() { return CFG.ORBIT.radius + val.weapon().range * 0.35; }
/** 幾把武器在轉：基礎三把，每升一階武器型態多一把 */
export function orbitCount() { return CFG.ORBIT.base + G.weapon; }

function updateCombat(dt, p) {
  const w = val.weapon();
  const O = CFG.ORBIT;
  const n = orbitCount();
  while (p.blades.length < n) p.blades.push({ cd: 0 });   // 換武器後補足刀數
  p.orbit = (p.orbit + O.speed * dt) % (Math.PI * 2);

  const R = orbitRadius();
  const dmg = val.power();
  const cd = w.interval * 0.85;
  let anyHit = false, treeHit = false;

  for (let i = 0; i < n; i++) {
    const blade = p.blades[i];
    if (blade.cd > 0) { blade.cd -= dt; continue; }

    const a = p.orbit + (i / n) * Math.PI * 2;
    const bx = p.x + Math.cos(a) * R;
    const by = p.y - 8 + Math.sin(a) * R * 0.62;   // 稍微壓扁，貼合俯視角

    // ---- 打熊 ----
    let hitSomething = false;
    for (const b of G.bears.slice()) {
      if (Math.hypot(b.x - bx, b.y - 8 - by) > b.radius + 7) continue;
      b.hp -= dmg;
      b.flash = 0.12;
      const dx = b.x - p.x, dy = b.y - p.y, d = Math.hypot(dx, dy) || 1;
      b.knockX += (dx / d) * 60;
      b.knockY += (dy / d) * 60;
      float(b.x, b.y - 18, '-' + abbr(Math.round(dmg)), '#ffd651');
      hitFx(w.hit, bx, by, a, w.color);
      if (b.hp <= 0) killBear(b);
      hitSomething = true;
      anyHit = true;
      break;                                        // 一把刀一次只打一隻
    }

    // ---- 沒打到熊就順手砍樹 ----
    if (!hitSomething) {
      for (const pr of world.props) {
        if (pr.kind !== 'tree' || pr.deadT > 0 || pr.hp <= 0) continue;
        if (Math.hypot(pr.x - bx, pr.y - 6 - by) > 10) continue;
        damageTree(pr, dmg * 0.6);
        hitSomething = true;
        treeHit = true;
        break;
      }
    }

    if (hitSomething) blade.cd = cd;
  }

  if (anyHit) { SFX.hit(w.hit); G.shake = Math.max(G.shake, w.shake * 0.6); }
  else if (treeHit) { SFX.hit('crush'); G.shake = Math.max(G.shake, 0.8); }
}

// ---------------- 砍樹（玩家與伐木工共用）----------------
export function damageTree(pr, amount) {
  pr.hp -= amount;
  burst(pr.x, pr.y - 12, 3, '#8d6539', 42);
  if (pr.hp > 0) return false;

  pr.hp = 0;
  pr.deadT = CFG.TREE.respawn;
  const n = CFG.TREE.drops + (rng() < 0.5 ? 1 : 0);
  for (let i = 0; i < n; i++) {
    const a = rng() * Math.PI * 2, s = 18 + rng() * 28;
    G.drops.push({
      x: pr.x + (rng() - 0.5) * 8, y: pr.y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      z: 4, vz: 20 + rng() * 14,
      life: CFG.MEAT.despawn, value: WOOD_MARKER, spin: rng() * 4,
    });
  }
  burst(pr.x, pr.y - 14, 10, '#8d6539', 62);
  burst(pr.x, pr.y - 14, 4, '#a0d060', 40);
  return true;
}

// ---------------- 樹木再生 ----------------
function updateTrees(dt) {
  for (const pr of world.props) {
    if (pr.kind !== 'tree' || pr.deadT <= 0) continue;
    pr.deadT -= dt;
    if (pr.deadT <= 0) pr.hp = pr.maxHp;
  }
  // 木材場上的木頭會慢慢被運走，堆才不會永遠留在那
  if (G.woodPile > 0) G.woodPile = Math.max(0, G.woodPile - dt * 1.6);
}

/**
 * 這隻熊現在追得到玩家嗎？追人永遠優先於攻城，只有這裡回傳 false 才會去拆據點。
 * 「追不到」的情況：玩家死了、躲進營地（熊進不去）、或不在感知範圍又不在牠的地塊裡。
 */
function canHunt(b, p, playerOutside, campCX, campTopY) {
  if (!playerOutside) return false;
  const den = b.plot.den;
  //  離窩太遠就放棄追人（這是「獵場熱點」的來源），但已經打到據點附近的熊例外，
  //  否則牠會無視站在旁邊的玩家繼續埋頭拆牆。
  //  這裡刻意用位置判斷而不是 b.raiding 旗標：追人時會讓出攻城名額，
  //  用旗標的話下一幀就被繩索鎖回去，變成追一幀就放棄。
  if (Math.hypot(b.x - den.x, b.y - den.y) >= CFG.BEAR.denLeash &&
      Math.hypot(b.x - campCX, b.y - campTopY) >= CFG.BEAR.raidRange) return false;
  const r = b.plot.rect;
  const inPlot = p.x > r.x && p.x < r.x + r.w && p.y > r.y && p.y < r.y + r.h;
  return Math.hypot(p.x - b.x, p.y - b.y) < b.zone.bearAggro || inPlot;
}

// ---------------- 熊 AI（主動獵殺玩家）----------------
function updateBears(dt) {
  const p = G.player;

  for (const plot of world.plots) {
    while (plot.queue.length && plot.queue[0] <= G.time &&
           plot.bears.length < CFG.BEAR.maxPerPlot) {
      plot.queue.shift();
      const b = spawnBear(plot);
      burst(b.x, b.y - 6, 8, '#f6f1e6', 40);
    }
  }

  const camp = campRect();
  const playerOutside = p.alive && !inCamp(p.x, p.y);

  //  互斥力：熊之間會互相推開，避免整群疊在同一個點上卡住。
  //  這是「群體看起來像一群動物」而不是「一坨貼圖」的關鍵。
  const sr = CFG.BEAR.sepRadius, sr2 = sr * sr;
  for (const b of G.bears) { b.sepX = 0; b.sepY = 0; }
  for (let i = 0; i < G.bears.length; i++) {
    const a = G.bears[i];
    for (let j = i + 1; j < G.bears.length; j++) {
      const c = G.bears[j];
      const dx = a.x - c.x, dy = a.y - c.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > sr2 || d2 < 0.0001) continue;
      const d = Math.sqrt(d2);
      const push = (1 - d / sr) / d;
      a.sepX += dx * push; a.sepY += dy * push;
      c.sepX -= dx * push; c.sepY -= dy * push;
    }
  }

  //  獵殺玩家永遠優先於攻城 —— 追得到人就追人，只有打不到人才去拆據點。
  //  這一步必須在分配突襲名額「之前」做完，否則正在追人的熊會白白佔著名額。
  const campCX = camp.x + camp.w / 2, campTopY = camp.y;
  const raidRange = playerOutside ? CFG.BEAR.raidRange : CFG.BEAR.raidRangeHiding;
  //  名額要「黏著」：已經在攻城的熊保住位子，一路打到底。
  //  每幀重新選最近的幾隻的話，熊會在半路一直被換掉，然後被熊窩繩索拉回去，
  //  結果就是一群熊在半路來回走、永遠打不到牆。
  let active = 0;
  const cands = [];
  for (const b of G.bears) {
    b.hunting = canHunt(b, p, playerOutside, campCX, campTopY);
    if (b.hunting) { b.raiding = false; continue; }   // 追人的熊讓出攻城名額
    const d = Math.hypot(b.x - campCX, b.y - campTopY);
    if (b.raiding && d < raidRange * 1.35) { active++; continue; }
    b.raiding = false;
    if (d < raidRange) cands.push([d, b]);
  }
  cands.sort((a, c) => a[0] - c[0]);
  for (let i = 0; i < cands.length && active < CFG.BEAR.raidMax; i++, active++) {
    cands[i][1].raiding = true;
  }

  for (const b of G.bears) {
    if (b.flash > 0) b.flash -= dt;
    if (b.hitT > 0) b.hitT -= dt;
    b.knockX *= Math.pow(0.0008, dt);
    b.knockY *= Math.pow(0.0008, dt);

    const z = b.zone;
    const dpx = p.x - b.x, dpy = p.y - b.y;
    const dp = Math.hypot(dpx, dpy);

    //  追人 / 攻城的取捨已經在上面的前置迴圈決定好了（追人優先）
    const den = b.plot.den;
    const denDist = Math.hypot(b.x - den.x, b.y - den.y);
    const hunt = b.hunting;
    //  每隻熊沿著自己那一路進攻，整群才會攤開成一條攻擊線而不是疊一坨
    const laneX = campCX + b.lane * (camp.w * 0.45);

    let mvx = 0, mvy = 0, spd = b.spd;

    if (hunt) {
      mvx = dpx / (dp || 1); mvy = dpy / (dp || 1);
      spd *= 1.1;
    } else if (b.raiding) {
      const rdx = laneX - b.x, rdy = campTopY - 14 - b.y;
      const rd = Math.hypot(rdx, rdy) || 1;
      mvx = rdx / rd; mvy = rdy / rd;
      spd *= 0.9;
    } else {
      b.thinkT -= dt;
      if (b.thinkT <= 0) {
        b.thinkT = 1.2 + rng() * 2.2;
        const spot = nearDen(b.plot);
        b.tx = spot.x; b.ty = spot.y;
      }
      // 離窩太遠就直接往回走，不再閒晃
      let dx, dy;
      if (denDist > CFG.BEAR.denRadius * 1.6) {
        dx = den.x - b.x; dy = den.y - b.y;
        spd *= CFG.BEAR.wanderSpd + CFG.BEAR.denPull;
      } else {
        dx = b.tx - b.x; dy = b.ty - b.y;
        spd *= CFG.BEAR.wanderSpd;
      }
      const d = Math.hypot(dx, dy);
      if (d > 6) { mvx = dx / d; mvy = dy / d; }
    }

    b.vx = mvx * spd + b.knockX + b.sepX * CFG.BEAR.sepForce;
    b.vy = mvy * spd + b.knockY + b.sepY * CFG.BEAR.sepForce;
    b.x += b.vx * dt; b.y += b.vy * dt;
    if (Math.abs(b.vx) > 4) b.face = b.vx > 0 ? 1 : -1;
    if (Math.hypot(mvx, mvy) > 0.1) b.walkT += dt * (hunt ? 8 : 4);

    // 火會驅趕野獸：熊不敢靠點燃的火堆太近
    for (const f of world.firepits) {
      if (!f.lit) continue;
      const fx = b.x - f.x, fy = b.y - f.y;
      const fd = Math.hypot(fx, fy);
      if (fd < CFG.COLD.fireRepel && fd > 0.01) {
        const push = (CFG.COLD.fireRepel - fd) / CFG.COLD.fireRepel;
        b.x += (fx / fd) * push * 90 * dt;
        b.y += (fy / fd) * push * 90 * dt;
      }
    }

    // 熊進不了營地，但會沿著外圍拍打圍牆 —— 一次一爪，看得見也聽得見
    if (b.swingT > 0) b.swingT -= dt;
    if (b.clawT > 0) b.clawT -= dt;

    const pad = 12;
    const wallY = camp.y - pad;
    const overWall = b.x > camp.x - pad && b.x < camp.x + camp.w + pad;
    if (overWall && b.y > wallY && b.y < camp.y + camp.h + pad) {
      b.y = wallY;
      b.vy = Math.min(0, b.vy);
    }
    //  用「貼著牆」而不是「穿進營地」判定攻擊 —— 被推回牆線上的熊
    //  剛好落在邊界外，穿透判定會讓牠們站在那裡完全不打。
    //  正在追人的熊不打牆 —— 玩家在場時，注意力全部在玩家身上
    if (!hunt && overWall && Math.abs(b.y - wallY) < 5 && b.swingT <= 0) {
      b.swingT = CFG.BASE.bearSwing * (0.85 + rng() * 0.3);
      b.clawT = 0.3;
      if (G.baseBreakT <= 0) {
        const dmg = CFG.BASE.bearHit * b.variant.dmg;
        G.baseHp = Math.max(0, G.baseHp - dmg);
        float(b.x, b.y - 22, '-' + Math.round(dmg), '#ff8a5c');
        burst(b.x, wallY + 4, 5, '#8d6539', 55);
        G.shake = Math.max(G.shake, 1.8);
        SFX.hit('crush');
      }
    }
    b.x = Math.max(12, Math.min(CFG.WORLD.w - 12, b.x));
    b.y = Math.max(24, Math.min(CFG.WORLD.h - 12, b.y));
    //  只有離玩家近的熊才記腳印 —— 遠處的看不到，記了只是浪費池子
    if (Math.abs(b.x - p.x) < 140 && Math.abs(b.y - p.y) < 200) {
      trackPrints(b, dt, b.variant.id === 'rage' ? 3 : 2, 3.5);
    }

    if (p.alive && b.hitT <= 0 && p.iframes <= 0 &&
        dp < b.radius + CFG.PLAYER.radius + 3 && playerOutside) {
      hurt(b.dmg, dpx / (dp || 1), dpy / (dp || 1));
      b.hitT = CFG.BEAR.hitCooldown;
    }
  }

  // 基地冷卻倒計時
  if (G.baseBreakT > 0) G.baseBreakT -= dt;

  // 基地血量耗盡懲罰（扣 20% 金錢，基地恢復至 35%，5 秒無敵緩衝）
  if (G.baseHp <= 0 && G.baseBreakT <= 0) {
    G.baseBreakT = CFG.BASE.breakCd;
    G.baseHp = G.baseMaxHp * 0.35;
    const penalty = Math.floor(G.money * 0.2);
    if (penalty > 0) {
      G.money = Math.max(0, G.money - penalty);
      float(camp.x + camp.w / 2, camp.y + 20, '-$' + abbr(penalty), '#ff5a4a');
    }
    G.onToast('據點受損！' + (penalty > 0 ? `損失 $${abbr(penalty)}` : ''), true);
    G.flash = 0.8;
    G.shake = Math.max(G.shake, 8);
    burst(camp.x + camp.w / 2, camp.y + camp.h / 2, 24, '#ff5a4a', 90);
  }
}

function hurt(amount, nx, ny) {
  const p = G.player;
  if (G.devGod) return;
  p.hp -= amount;
  p.iframes = CFG.PLAYER.iframes;
  p.combatT = CFG.COLD.combatLock;      // 受擊後火堆不回血
  p.hurtFlash = 0.25;
  p.vx += nx * CFG.BEAR.knock;
  p.vy += ny * CFG.BEAR.knock;
  G.shake = Math.max(G.shake, 4);
  SFX.hurt();
  float(p.x, p.y - 26, '-' + Math.round(amount), '#ff5a4a');
  burst(p.x, p.y - 10, 8, '#e8543a', 70);
  if (p.hp <= 0) die();
}

function die() {
  const p = G.player;
  if (!p.alive) return;
  p.alive = false;
  p.hp = 0;
  p.deadT = 1.6;
  G.stats.deaths++;
  SFX.die();
  G.shake = 7;

  for (const v of p.carry) {
    const a = rng() * Math.PI * 2, s = 20 + rng() * 50;
    G.drops.push({
      x: p.x, y: p.y, vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      z: 8, vz: 40 + rng() * 40, life: CFG.MEAT.despawn, value: v, spin: rng() * 6,
    });
  }
  G.onToast(p.carry.length ? `凍僵了！掉落 ${p.carry.length} 塊肉` : '凍僵了！', true);
  p.carry = [];
  burst(p.x, p.y - 10, 26, '#9fdff0', 90);
}

function respawn() {
  const p = G.player;
  p.alive = true;
  p.x = CFG.RESPAWN.x; p.y = CFG.RESPAWN.y;
  p.vx = p.vy = 0;
  p.hp = val.hpMax();
  p.iframes = CFG.PLAYER.respawnIframes;
  SFX.respawn();
  burst(p.x, p.y - 10, 20, '#ffa62b', 70);
}

/**
 * 玩家正站在「收得下他手上這批貨」的卸貨圈裡嗎？
 * 用當下位置判斷而不是記狀態旗標：貨架滿了就回傳 false，
 * 玩家不會因為站在放不下東西的圈圈裡而變成撿不了東西。
 */
function inDepositZone(p) {
  const wood = countWood(p.carry);
  if (p.carry.length - wood > 0 && shelfSpace() > 0 &&
      Math.hypot(p.x - CFG.SHELF.x, p.y - CFG.SHELF.y) < CFG.SHELF.r) return true;
  if (wood > 0 &&
      Math.hypot(p.x - CFG.WOOD.x, p.y - CFG.WOOD.y) < CFG.WOOD.r) return true;
  return false;
}

// ---------------- 掉落物 ----------------
function updateDrops(dt) {
  const p = G.player;
  const cap = val.cap();
  const depositing = inDepositZone(p);

  for (let i = G.drops.length - 1; i >= 0; i--) {
    const d = G.drops[i];
    d.life -= dt;
    if (d.life <= 0) { G.drops.splice(i, 1); continue; }

    if (d.z > 0 || d.vz !== 0) {
      d.vz -= 240 * dt;
      d.z += d.vz * dt;
      if (d.z <= 0) { d.z = 0; d.vz = d.vz < -30 ? -d.vz * 0.32 : 0; }
    }
    d.x += d.vx * dt; d.y += d.vy * dt;
    const f = Math.pow(0.0009, dt);
    d.vx *= f; d.vy *= f;
    d.x = Math.max(6, Math.min(CFG.WORLD.w - 6, d.x));
    d.y = Math.max(20, Math.min(CFG.WORLD.h - 6, d.y));

    //  玩家永遠搶得贏搬運工：被預定的掉落物照樣撿得起來，
    //  撿走後搬運工發現目標不在 G.drops 裡就會自己換目標。
    //  但站在卸貨圈裡時先把身上的貨放完 —— 否則一邊放一邊撿，背包永遠清不空。
    if (!p.alive || depositing) continue;

    const dx = p.x - d.x, dy = p.y - d.y - 4;
    const dist = Math.hypot(dx, dy);

    if (p.carry.length < cap && dist < CFG.MEAT.magnet + CFG.PLAYER.pickupRange) {
      const pull = 260 * (1 - dist / (CFG.MEAT.magnet + CFG.PLAYER.pickupRange));
      d.vx += (dx / (dist || 1)) * pull * dt * 6;
      d.vy += (dy / (dist || 1)) * pull * dt * 6;
    }
    if (p.carry.length < cap && dist < 9) {
      p.carry.push(d.value);
      SFX.pickup(p.carry.length);
      G.drops.splice(i, 1);
    }
  }
}

// ---------------- 背包內容分類（肉 vs 木材）----------------
export function countWood(carry) {
  let n = 0;
  for (const v of carry) if (v === WOOD_MARKER) n++;
  return n;
}
function countMeat(carry) { return carry.length - countWood(carry); }
function lastIndexOfMeat(carry) {
  for (let i = carry.length - 1; i >= 0; i--) if (carry[i] !== WOOD_MARKER) return i;
  return -1;
}

// ---------------- 箭塔搬遷 ----------------
/**
 * 站在塔底蓄力把塔扛起來，走到想要的位置停下來就放下。
 * 用「站著不動」當放置條件是安全的：只有在扛塔狀態才會觸發，
 * 平常走路不會誤放。
 */
function updateTowerMove(dt, p) {
  const T = CFG.TOWER;

  // ---- 扛著塔：跟著玩家走，停下來就放 ----
  if (G.towerCarry >= 0) {
    const t = G.towers[G.towerCarry];
    if (!t) { G.towerCarry = -1; return; }
    t.x = p.x; t.y = p.y + 2;
    t.cd = Math.max(t.cd, 0.3);              // 搬運中不開火

    if (Math.hypot(p.vx, p.vy) < T.stillSpd) {
      G.towerPlace += dt;
      if (G.towerPlace >= T.placeT) {
        G.towerPlace = 0;
        G.towerCarry = -1;
        //  放下之後玩家就站在塔底下，不鎖的話蓄力環會立刻重新開始，
        //  變成「放下 → 又扛起來」的無限迴圈。要先走開才能再扛。
        G.towerLock = true;
        t.x = Math.round(p.x); t.y = Math.round(p.y + 2);
        saveTowerPos();
        burst(t.x, t.y, 12, '#9fe8a0', 60);
        G.shake = Math.max(G.shake, 2.5);
        SFX.hit('crush');
        G.onToast('箭塔已就位');
        save();
      }
    } else {
      G.towerPlace = 0;
    }
    return;
  }

  // ---- 沒扛塔：站在某座塔底下蓄力就扛起來 ----
  //  站在升級／建設台座上時不搶塔，否則塔剛好放在台座旁邊會搶走操作
  if (G.padKey) { G.towerGrab = 0; return; }
  let near = -1, bd = T.grabR;
  for (let i = 0; i < G.towers.length; i++) {
    const d = Math.hypot(p.x - G.towers[i].x, p.y - G.towers[i].y);
    if (d < bd) { bd = d; near = i; }
  }
  if (near < 0) { G.towerGrab = 0; G.towerLock = false; return; }
  // 剛放下的塔要先走開才能再扛起來
  if (G.towerLock) { G.towerGrab = 0; return; }

  G.towerGrab += dt;
  if (G.towerGrab >= T.grabT) {
    G.towerGrab = 0;
    G.towerCarry = near;
    G.towerPlace = 0;
    burst(G.towers[near].x, G.towers[near].y, 10, '#ffd651', 55);
    SFX.pickup(3);
    G.onToast('扛起箭塔 — 走到定點停下放置');
  }
}

/** 把目前的塔位存進 G，存檔時一起寫進去 */
export function saveTowerPos() {
  G.towerPos = G.towers.map(t => ({ x: Math.round(t.x), y: Math.round(t.y) }));
}

/**
 * 一根木頭進到木材場的去向，優先序固定：
 *   1. 基地有傷 → 修基地（保命最優先）
 *   2. 庫存沒滿 → 存起來當建材
 *   3. 庫存滿了 → 直接換錢（永遠不會浪費）
 * 給玩家與搬運工共用，兩邊規則才不會分岔。
 */
export function depositWood(fx, fy, p = null) {
  G.woodPile = Math.min(60, G.woodPile + 1);
  if (G.baseHp < G.baseMaxHp) {
    G.baseHp = Math.min(G.baseMaxHp, G.baseHp + CFG.TREE.hpRepair);
    float(fx + (rng() - 0.5) * 14, fy - 26, '+' + CFG.TREE.hpRepair + ' 基地', '#9fe8a0');
    burst(fx, fy - 8, 4, '#9fe8a0', 38);
    SFX.pickup(4);
  } else if (G.wood < CFG.WOOD_MAX) {
    G.wood++;
    float(fx + (rng() - 0.5) * 14, fy - 26, '+1 木材', '#c98f4e');
    SFX.pickup(3);
  } else {
    earn(CFG.TREE.value);
    G.cashStreak++; G.cashStreakT = 0.6;
    SFX.sell(G.cashStreak);
    if (p) coinFly(fx, fy - 14, p.x, p.y - 20, 'coin');
    float(fx + (rng() - 0.5) * 16, fy - 26, '+$' + CFG.TREE.value, '#ffd651');
  }
}

// ---------------- 站立觸發區 ----------------
function updateTriggers(dt, p) {
  // ---- 貨架：只收肉 ----
  const sh = CFG.SHELF;
  if (Math.hypot(p.x - sh.x, p.y - sh.y) < sh.r && countMeat(p.carry) > 0) {
    // 貨架滿的時候不要讓計時器一直往負數跑，否則清出空位會瞬間倒完
    G.shelfTimer = Math.max(-CFG.SELL_INTERVAL, G.shelfTimer - dt);
    while (G.shelfTimer <= 0 && shelfSpace() > 0) {
      const i = lastIndexOfMeat(p.carry);
      if (i < 0) break;
      G.shelfTimer += CFG.SELL_INTERVAL;
      const v = p.carry.splice(i, 1)[0];
      depositMeat(v);
      SFX.pickup(G.shelf.length);
      coinFly(p.x, p.y - 16 - p.carry.length * 1.5, sh.x, sh.y - 16, 'meat');
    }
  } else {
    G.shelfTimer = 0;
  }

  // ---- 木材場：只收木頭。基地缺血就修基地，滿血就直接換錢 ----
  const wd = CFG.WOOD;
  if (Math.hypot(p.x - wd.x, p.y - wd.y) < wd.r && countWood(p.carry) > 0) {
    G.woodTimer -= dt;
    while (G.woodTimer <= 0) {
      const i = p.carry.lastIndexOf(WOOD_MARKER);
      if (i < 0) break;
      G.woodTimer += CFG.SELL_INTERVAL;
      p.carry.splice(i, 1);
      depositWood(wd.x, wd.y, p);
    }
  } else {
    G.woodTimer = 0;
  }

  // ---- 收現金 ----
  const cz = CFG.CASH;
  if (Math.hypot(p.x - cz.x, p.y - cz.y) < cz.r && G.cash > 0) {
    G.cashTimer -= dt;
    while (G.cashTimer <= 0 && G.cash > 0) {
      G.cashTimer += CFG.CASH_PICK;
      const take = Math.max(1, Math.ceil(G.cash / CFG.CASH_CHUNK));
      const amt = Math.min(G.cash, take);
      G.cash -= amt;
      earn(amt);
      G.cashStreak++; G.cashStreakT = 0.6;
      SFX.sell(G.cashStreak);
      coinFly(cz.x + (rng() - 0.5) * 14, cz.y - 8, p.x, p.y - 20, 'coin');
      float(cz.x + (rng() - 0.5) * 16, cz.y - 26, '+$' + abbr(amt), '#ffd651');
    }
  } else {
    G.cashTimer = 0;
  }

  // ---- 遠征營帳：站上去打開印記樹 ----
  const pp = CFG.PRESTIGE_PAD;
  const onPrestige = G.zonesOpen >= CFG.PRESTIGE.unlockZones &&
                     Math.hypot(p.x - pp.x, p.y - pp.y) < pp.r;
  if (onPrestige !== G.prestigeOpen) {
    G.prestigeOpen = onPrestige;
    G.onPrestigePad(onPrestige);
  }

  // ---- 蓄力型台座：升級 / 建設 / 武器 ----
  const pad = findPad(p);
  if (pad && pad.key !== G.padKey) { G.padKey = pad.key; G.padCharge = 0; }
  if (!pad) { G.padKey = null; G.padCharge = 0; G.onPanel(null); }
  else {
    const ok = padAffordable(pad);
    G.onPanel(pad);
    if (ok) {
      G.padCharge += dt;
      if (G.padCharge >= CFG.PAD_CHARGE) { G.padCharge = 0; padCommit(pad); }
    } else {
      G.padCharge = Math.max(0, G.padCharge - dt * 2);
    }
  }

  // ---- 火堆點燃 ----
  for (const f of world.firepits) {
    if (f.lit) continue;
    if (Math.hypot(p.x - f.x, p.y - f.y) < CFG.COLD.fireRadius * 0.7) {
      const pay = Math.min(f.cost - f.progress, CFG.FIRE_DRAIN * dt, G.money);
      if (pay > 0) {
        f.progress += pay; G.money -= pay;
        if (rng() < 0.3) coinFly(p.x, p.y - 14, f.x, f.y - 8);
        SFX.gateTick(f.progress / f.cost);
      }
      if (f.progress >= f.cost) {
        f.lit = true; SFX.fireLit(); G.flash = 0.6;
        burst(f.x, f.y - 8, 34, '#ffa62b', 90);
        G.onToast('火堆已點燃！'); save();
      }
    }
  }

}

/** 找出玩家目前站在哪個台座上 */
function findPad(p) {
  for (const q of CFG.PADS)
    if (Math.hypot(p.x - q.x, p.y - q.y) < q.r) return { kind: 'upg', key: q.key, ...q };
  for (const q of CFG.BUILD_PADS)
    if (Math.hypot(p.x - q.x, p.y - q.y) < q.r) return { kind: 'build', key: q.key, ...q };
  const wr = CFG.WEAPON_RACK;
  if (Math.hypot(p.x - wr.x, p.y - wr.y) < wr.r) return { kind: 'weapon', key: 'weapon', ...wr };
  return null;
}

function padAffordable(pad) {
  if (pad.kind === 'upg')   return G.money >= nextCost(pad.key);
  if (pad.kind === 'build') {
    return G.money >= nextBuildCost(pad.key) && G.wood >= nextBuildWood(pad.key);
  }
  if (pad.kind === 'weapon') { const w = nextWeapon(); return !!w && G.money >= w.cost; }
  return false;
}

function padCommit(pad) {
  if (pad.kind === 'upg')   return buy(pad.key);
  if (pad.kind === 'build') return build(pad.key);
  if (pad.kind === 'weapon') return buyWeapon();
}

export function buy(key) {
  if (G.upg[key] >= levelCap(key)) return false;
  const cost = nextCost(key);
  if (G.money < cost) return false;
  G.money -= cost;
  const before = val.hpMax();
  G.upg[key]++;
  const lv = G.upg[key];
  //  升體魄時把新增的上限直接補成當下血量 —— 看得到數字漲才有感覺
  if (key === 'vigor') {
    const gain = val.hpMax() - before;
    G.player.hp = Math.min(val.hpMax(), G.player.hp + gain);
    float(G.player.x, G.player.y - 34, '+' + gain + ' HP', '#8fe8a0');
  }
  if (lv % 5 === 0) { SFX.upgradeBig(); G.flash = 0.4; } else SFX.upgrade();
  const q = CFG.PADS.find(o => o.key === key);
  if (q) { float(q.x, q.y - 36, 'LV' + lv, '#74aae8'); burst(q.x, q.y - 8, 12, '#74aae8', 55); }
  G.shake = Math.max(G.shake, 1.6);
  save();
  return true;
}

export function nextBuildWood(key) {
  if (G.build[key] >= CFG.BUILD[key].max) return 0;
  return buildWood(key, G.build[key]);
}

export function build(key) {
  const cost = nextBuildCost(key);
  const wood = nextBuildWood(key);
  if (!isFinite(cost) || G.money < cost || G.wood < wood) return false;
  G.money -= cost;
  G.wood -= wood;
  G.build[key]++;
  SFX.upgradeBig(); G.flash = 0.5; G.shake = 3;
  const q = CFG.BUILD_PADS.find(o => o.key === key);
  if (q) { float(q.x, q.y - 36, 'LV' + G.build[key], '#9fe8a0'); burst(q.x, q.y - 8, 18, '#9fe8a0', 70); }
  G.onToast(`${CFG.BUILD[key].name} 升級到 LV${G.build[key]}`);
  initBase();       // 重建據點設施（塔、幫手數量等）
  save();
  return true;
}

export function buyWeapon() {
  const w = nextWeapon();
  if (!w || G.money < w.cost) return false;
  G.money -= w.cost;
  G.weapon = w.id;
  if (!G.weaponsOwned.includes(w.id)) G.weaponsOwned.push(w.id);
  SFX.upgradeBig(); G.flash = 0.8; G.shake = 5;
  burst(CFG.WEAPON_RACK.x, CFG.WEAPON_RACK.y - 10, 30, w.color, 90);
  G.onToast(`取得新武器：${w.name}！`);
  save();
  return true;
}

// ---------------- 商店（純外觀）----------------
//  裝飾品是永久的：轉生不會清掉。錢在後期會嚴重過剩，這是它的去處，
//  而且「我的據點長得跟別人不一樣」本身就是一種成就展示。
export function shopBuy(cat, id) {
  const item = CFG.SHOP[cat].find(i => i.id === id);
  if (!item || G.owned[cat].includes(id)) return false;
  if (G.money < item.cost) return false;
  G.money -= item.cost;
  G.owned[cat].push(id);
  if (cat === 'hat') G.equip.hat = id;
  if (cat === 'crew') G.equip.crew = id;
  SFX.upgradeBig(); G.flash = 0.6; G.shake = 3;
  G.onToast(`購入 ${item.name}`);
  const p = G.player;
  burst(p.x, p.y - 12, 22, '#ffd651', 80);
  save();
  return true;
}

export function shopEquip(cat, id) {
  if (!G.owned[cat].includes(id)) return false;
  G.equip[cat] = G.equip[cat] === id && cat === 'hat' ? null : id;   // 帽子可以脫掉
  SFX.upgrade();
  save();
  return true;
}

// ---------------- 轉生 ----------------
export function doPrestige() {
  const gain = pendingMarks();
  if (gain <= 0) return false;
  G.marks += gain;
  G.prestiges++;

  const keepWeapon = G.tree.spark > 0;
  G.money = 0;
  G.runEarned = 0;
  G.upg = EMPTY_UPG();
  G.build = EMPTY_BUILD();
  G.zonesOpen = 2; // 兩個區域永遠開放
  if (!keepWeapon) { G.weapon = 0; G.weaponsOwned = [0]; }
  G.shelf = [];
  G.cash = 0;
  G.customers = [];
  G.drops.length = 0;
  G.baseHp = CFG.BASE.hp;
  G.baseBreakT = 0;
  G.wood = 0;
  G.woodPile = 0;

  world.firepits.forEach((f, i) => { f.lit = CFG.FIREPITS[i].lit; f.progress = 0; });

  initBase();
  respawnAllBears();
  const p = G.player;
  p.x = CFG.RESPAWN.x; p.y = CFG.RESPAWN.y; p.carry = []; p.hp = val.hpMax();

  G.flash = 1.2; G.shake = 8;
  SFX.gateOpen();
  G.onToast(`遠征歸來 — 獲得 ${gain} 枚極光印記`);
  save();
  return true;
}

/** 花印記買永久升級 */
export function buyMark(key) {
  const t = CFG.PRESTIGE.TREE[key];
  if (G.tree[key] >= t.max) return false;
  const cost = markCost(key, G.tree[key]);
  const spendable = G.marks - spentMarks();
  if (spendable < cost) return false;
  G.tree[key]++;
  SFX.upgradeBig();
  G.onToast(`${t.name} → LV${G.tree[key]}`);
  save();
  return true;
}
export function markSpendable() { return G.marks - spentMarks(); }

// ---------------- 特效更新 ----------------
function updateFx(dt) {
  for (let i = G.fx.length - 1; i >= 0; i--) {
    const f = G.fx[i];
    if (f.coin) {
      f.t += dt;
      if (f.t >= f.dur) { G.fx.splice(i, 1); continue; }
      continue;
    }
    f.life -= dt;
    if (f.life <= 0) { G.fx.splice(i, 1); continue; }
    if (f.ring || f.streak) continue;       // 純視覺，不移動
    f.vy += (f.grav || 0) * dt;
    f.x += f.vx * dt; f.y += f.vy * dt;
    f.vx *= Math.pow(0.02, dt);
  }
  for (let i = G.floats.length - 1; i >= 0; i--) {
    const f = G.floats[i];
    f.life -= dt;
    if (f.life <= 0) { G.floats.splice(i, 1); continue; }
    f.y += f.vy * dt;
    f.vy *= Math.pow(0.3, dt);
  }
}

export { spawnBear };
