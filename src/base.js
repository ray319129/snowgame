// ============================================================
//  據點：貨架 → 顧客隊列 → 收銀現金堆，以及箭塔與幫手。
//  這一層是「可視化成就感」的核心（DESIGN.md P3）。
// ============================================================
import { CFG, buildValue, WOOD_MARKER } from './config.js';
import { world, inCamp, campRect, setCampExpand } from './world.js';
import { SFX } from './audio.js';
import { G, val, burst, float, coinFly, killBear, rng } from './game.js';

// ---------------- 貨架 ----------------
export function shelfSpace() { return Math.max(0, val.shelfMax() - G.shelf.length); }
export function depositMeat(v) { G.shelf.push(v); }

// ---------------- 初始化（建設等級改變時重建）----------------
export function initBase() {
  // 圍牆等級 → 營地實際範圍（會重畫底圖，擴建看得見）
  setCampExpand(buildValue('wall', G.build.wall));

  // 箭塔 —— 有玩家自訂位置就用自訂的，沒有才落回預設點位
  G.towers = [];
  for (let i = 0; i < G.build.tower && i < CFG.TOWER_SPOTS.length; i++) {
    const saved = G.towerPos && G.towerPos[i];
    const s = saved || CFG.TOWER_SPOTS[i];
    G.towers.push({ x: s.x, y: s.y, cd: 0, range: 150 + i * 8 });
  }
  G.towerCarry = -1;
  G.towerGrab = 0; G.towerPlace = 0;

  // 幫手
  const want = { hauler: G.build.hauler, hunter: G.build.hunter };
  const keep = [];
  for (const kind of ['hauler', 'hunter']) {
    const have = G.helpers.filter(h => h.kind === kind);
    for (let i = 0; i < want[kind]; i++) {
      keep.push(have[i] || makeHelper(kind, i));
    }
  }
  G.helpers = keep;

  // 貨架容量變小的話（轉生）要截斷
  if (G.shelf.length > val.shelfMax()) G.shelf.length = val.shelfMax();

  // 開局就有一位顧客在櫃檯等 —— 讓第一次收錢在 15 秒內發生
  if (G.customers.length === 0) {
    const c = newCustomer();
    c.x = CFG.QUEUE.x; c.y = CFG.QUEUE.y;
    G.customers.push(c);
  }
}

function newCustomer() {
  const want = Math.max(1, Math.round(
    (CFG.CUSTOMER.wantBase + rng() * CFG.CUSTOMER.wantVar) * val.fame()
  ));
  return {
    x: CFG.QUEUE.entryX, y: CFG.QUEUE.entryY + (rng() - 0.5) * 10,
    vx: 0, vy: 0, face: 1, walkT: 0,
    skin: Math.floor(rng() * 3),
    want, got: 0, paid: 0,
    state: 'walk', slot: 0, buyT: 0, wait: 0, leaveT: 0,
  };
}

export function resetBase() {
  G.shelf = []; G.cash = 0; G.customers = []; G.helpers = []; G.towers = []; G.shots = [];
  initBase();
}

function makeHelper(kind, i) {
  const c = campRect();
  return {
    kind, i,
    x: c.x + 40 + i * 22, y: c.y + c.h - 40,
    vx: 0, vy: 0, face: 1, walkT: 0,
    state: 'idle', target: null, carry: [], atkT: 0,
    mode: 'gather', dropT: 0,
  };
}

// ---------------- 主更新 ----------------
let spawnT = 0;

export function updateBase(dt) {
  updateCustomers(dt);
  updateTowers(dt);
  updateHelpers(dt);
  updateShots(dt);
}

// ---------------- 顧客 ----------------
function queueSlot(i) {
  return { x: CFG.QUEUE.x + CFG.QUEUE.dx * i, y: CFG.QUEUE.y + CFG.QUEUE.dy * i };
}

function updateCustomers(dt) {
  const maxQ = val.queueMax();

  // 生成
  spawnT -= dt;
  if (spawnT <= 0) {
    const interval = CFG.CUSTOMER.spawnInterval / (1 + G.build.counter * 0.35);
    spawnT = interval * (0.75 + rng() * 0.5);
    if (G.customers.filter(c => c.state !== 'leaving').length < maxQ) {
      G.customers.push(newCustomer());
    }
  }

  // 重新指派排隊位置
  let slot = 0;
  for (const c of G.customers) {
    if (c.state === 'leaving') continue;
    c.slot = slot++;
  }

  for (let i = G.customers.length - 1; i >= 0; i--) {
    const c = G.customers[i];
    c.walkT += dt * 6;

    if (c.state === 'leaving') {
      c.leaveT -= dt;
      moveTo(c, CFG.QUEUE.entryX - 60, c.y, CFG.CUSTOMER.walkSpeed * 1.3, dt);
      if (c.leaveT <= 0 || c.x < CFG.QUEUE.entryX - 50) G.customers.splice(i, 1);
      continue;
    }

    const s = queueSlot(c.slot);
    const arrived = Math.hypot(c.x - s.x, c.y - s.y) < 4;

    if (!arrived) {
      c.state = 'walk';
      moveTo(c, s.x, s.y, CFG.CUSTOMER.walkSpeed, dt);
      continue;
    }

    c.vx = c.vy = 0;

    if (c.slot !== 0) {
      // 排隊等待，等太久會走人
      c.state = 'wait';
      c.wait += dt;
      if (c.wait > CFG.CUSTOMER.patience * 1.6) leave(c, false);
      continue;
    }

    // 隊首：從貨架拿肉
    c.state = 'buy';
    if (G.shelf.length === 0) {
      c.wait += dt;
      if (c.wait > CFG.CUSTOMER.patience) leave(c, false);
      continue;
    }
    //  每拿走一塊就立刻付錢 —— 現金堆會持續長高，回饋不用等
    c.buyT -= dt;
    while (c.buyT <= 0 && c.got < c.want && G.shelf.length > 0) {
      c.buyT += CFG.CUSTOMER.buyInterval;
      const v = G.shelf.pop();
      c.got++;
      const pay = (v === WOOD_MARKER ? CFG.TREE.value : v) * CFG.CUSTOMER.payBonus;
      c.paid += pay;
      G.cash += pay;
      G.stats.sold++;
      coinFly(CFG.SHELF.x + (rng() - 0.5) * 16, CFG.SHELF.y - 18, c.x, c.y - 16, 'meat');
      coinFly(c.x, c.y - 16, CFG.CASH.x + (rng() - 0.5) * 12, CFG.CASH.y - 6, 'bill');
    }
    if (c.got >= c.want) leave(c, true);
  }
}

function leave(c, satisfied) {
  c.state = 'leaving';
  c.leaveT = 6;
  if (satisfied) {
    // 買滿的顧客給小費
    const tip = Math.max(1, Math.round(c.paid * 0.15));
    G.cash += tip;
    SFX.pickup(6);
    float(c.x, c.y - 30, '+$' + Math.round(c.paid + tip), '#ffd651');
    burst(CFG.CASH.x, CFG.CASH.y - 8, 8, '#ffd651', 45);
  } else {
    float(c.x, c.y - 26, '!', '#ff8a5c');
  }
}

function moveTo(e, tx, ty, spd, dt) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy);
  if (d < 1) { e.vx = e.vy = 0; return true; }
  e.vx = (dx / d) * spd; e.vy = (dy / d) * spd;
  e.x += e.vx * dt; e.y += e.vy * dt;
  if (Math.abs(e.vx) > 2) e.face = e.vx > 0 ? 1 : -1;
  return false;
}

// ---------------- 箭塔 ----------------
function updateTowers(dt) {
  for (const t of G.towers) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    let best = null, bd = t.range;
    for (const b of G.bears) {
      const d = Math.hypot(b.x - t.x, b.y - t.y);
      if (d < bd) { bd = d; best = b; }
    }
    if (!best) continue;
    t.cd = 0.9;
    G.shots.push({
      x: t.x, y: t.y - 26, tx: best.x, ty: best.y - 6,
      target: best, t: 0, dur: 0.28,
      dmg: 6 * (1 + G.build.tower * 0.9) * (1 + G.upg.power * 0.06),
    });
    SFX.swing();
  }
}

function updateShots(dt) {
  for (let i = G.shots.length - 1; i >= 0; i--) {
    const s = G.shots[i];
    s.t += dt;
    if (s.t < s.dur) continue;
    G.shots.splice(i, 1);
    const b = s.target;
    if (!b || G.bears.indexOf(b) < 0) continue;
    b.hp -= s.dmg;
    b.flash = 0.12;
    float(b.x, b.y - 18, '-' + Math.round(s.dmg), '#9fdff0');
    burst(b.x, b.y - 8, 5, '#9fdff0', 50);
    if (b.hp <= 0) killBear(b, true);
    else SFX.hit();
  }
}

// ---------------- 幫手 ----------------
function updateHelpers(dt) {
  const c = campRect();
  const campCx = c.x + c.w / 2, campCy = c.y + c.h / 2;

  for (const h of G.helpers) {
    h.walkT += dt * 7;
    if (h.kind === 'hauler') updateHauler(h, dt, campCx, campCy);
    else updateHunter(h, dt, campCx, campCy);
  }
}

const HAULER_RANGE = 420;
/** 搬運工的載重跟著玩家的背包一起長，後期才不會變成一次搬五塊的雞肋 */
function haulerCarry() { return Math.max(4, Math.round(val.cap() * 0.5)); }

/** 這趟搬的是木頭還是肉？第一個撿到的東西決定這一趟的目的地。 */
function haulingWood(h) { return h.carry.length > 0 && h.carry[0] === WOOD_MARKER; }

function updateHauler(h, dt, cx, cy) {
  // ============ 卸貨中：一定要把身上的貨全部放完才會再出發 ============
  //  這個狀態必須是「黏著」的。之前每幀重新判斷該不該回家，結果放下第一塊之後
  //  背包沒滿了、附近又找得到新目標，回家的條件就不成立，搬運工就扛著剩下的貨
  //  跑去撿下一個 —— 看起來就是「賣一個就跑掉」。
  if (h.mode === 'deliver') {
    const wood = haulingWood(h);
    const dest = wood ? CFG.WOOD : CFG.SHELF;
    const arrived = moveTo(h, dest.x, dest.y + 16, 70, dt);
    if (arrived || Math.hypot(h.x - dest.x, h.y - dest.y) < 22) {
      //  卸不掉時不要讓計時器一直往負數跑，否則清出空位會瞬間倒完
      h.dropT = Math.max(-0.08, (h.dropT || 0) - dt);
      while (h.dropT <= 0 && h.carry.length > 0) {
        if (wood) {
          h.dropT += 0.08;
          h.carry.pop();
          if (G.baseHp < G.baseMaxHp) {
            G.baseHp = Math.min(G.baseMaxHp, G.baseHp + CFG.TREE.hpRepair);
            float(dest.x, dest.y - 26, '+' + CFG.TREE.hpRepair + ' 基地', '#9fe8a0');
          } else {
            G.woodPile = Math.min(60, G.woodPile + 1);
            G.cash += CFG.TREE.value;
            coinFly(h.x, h.y - 14, CFG.CASH.x, CFG.CASH.y - 6, 'bill');
          }
        } else if (shelfSpace() > 0) {
          h.dropT += 0.08;
          depositMeat(h.carry.pop());
          coinFly(h.x, h.y - 14, dest.x, dest.y - 16, 'meat');
        } else break;      // 貨架滿了就站在原地等位子，不會扛著肉跑掉
      }
    }
    if (h.carry.length === 0) { h.mode = 'gather'; h.dropT = 0; }
    return;
  }

  // ============ 撿貨中 ============
  //  撿完一個就立刻找下一個，否則 target 剛清空就會馬上切去卸貨，
  //  變成每趟只搬一塊，載重上限形同虛設。
  //
  //  用 owner 記「是誰預定的」而不是一個 taken 布林 —— 之前用布林時，
  //  搬運工預定完自己那份，下一幀看到旗標又以為被別人拿走，於是每幀重選目標：
  //  自己永遠走不到定點，而且範圍內每個掉落物都被標成已預定，玩家也撿不起來。
  if (!h.target || h.target.owner !== h || G.drops.indexOf(h.target) < 0) {
    if (h.target) h.target.owner = null;
    h.target = null;
    const wantWood = haulingWood(h);
    let bd = HAULER_RANGE;
    for (const d of G.drops) {
      if (d.owner && d.owner !== h) continue;
      // 一趟只搬同一種貨，才不會拿著木頭跑去貨架
      if (h.carry.length > 0 && (d.value === WOOD_MARKER) !== wantWood) continue;
      if (Math.hypot(d.x - cx, d.y - cy) > HAULER_RANGE) continue;
      const dh = Math.hypot(d.x - h.x, d.y - h.y);
      if (dh < bd) { bd = dh; h.target = d; }
    }
    if (h.target) h.target.owner = h;
  }

  // 背滿了、或附近沒東西撿了 → 進入卸貨狀態
  if (h.carry.length >= haulerCarry() || (h.carry.length > 0 && !h.target)) {
    if (h.target) { h.target.owner = null; h.target = null; }
    h.mode = 'deliver';
    return;
  }

  if (!h.target) {
    moveTo(h, cx - 40, cy + 40, 40, dt);
    return;
  }
  moveTo(h, h.target.x, h.target.y, 78, dt);
  if (Math.hypot(h.x - h.target.x, h.y - h.target.y) < 9) {
    h.carry.push(h.target.value);
    const i = G.drops.indexOf(h.target);
    if (i >= 0) G.drops.splice(i, 1);
    h.target = null;
  }
}

const HUNTER_RANGE = 380;

function updateHunter(h, dt, cx, cy) {
  h.atkT -= dt;
  if (!h.target || G.bears.indexOf(h.target) < 0) {
    h.target = null;
    let bd = HUNTER_RANGE;
    for (const b of G.bears) {
      const d = Math.hypot(b.x - cx, b.y - cy);
      if (d > HUNTER_RANGE) continue;
      const dh = Math.hypot(b.x - h.x, b.y - h.y);
      if (dh < bd) { bd = dh; h.target = b; }
    }
  }
  if (!h.target) { moveTo(h, cx + 40, cy + 40, 40, dt); return; }

  const d = Math.hypot(h.x - h.target.x, h.y - h.target.y);
  if (d > 22) { moveTo(h, h.target.x, h.target.y, 74, dt); return; }
  h.vx = h.vy = 0;

  if (h.atkT <= 0) {
    h.atkT = 0.75;
    h.swing = 0.2;
    const dmg = val.power() * 0.4 * (1 + h.i * 0.25);
    h.target.hp -= dmg;
    h.target.flash = 0.12;
    float(h.target.x, h.target.y - 18, '-' + Math.round(dmg), '#a0e8a0');
    if (h.target.hp <= 0) { killBear(h.target, true); h.target = null; }
    else SFX.hit();
  }
  if (h.swing > 0) h.swing -= dt;
}
