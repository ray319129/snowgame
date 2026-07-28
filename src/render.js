// ============================================================
//  渲染：低解析度 backbuffer + 光照層
//  所有繪製座標一律 round，保持像素對齊
// ============================================================
import { CFG, buildValue, WOOD_MARKER } from './config.js';
import { ART, BEAR_SPRITES, BUILD_ICON, WEAPON_SPRITE } from './art.js';
import { px, flipX, drawText, drawTextC, textWidth, abbr } from './pixel.js';
import { world, PROP_SPRITE, inCamp, campRect } from './world.js';
import {
  G, val, nextCost, nextBuildCost, nextWeapon, zoneLocked, pendingMarks, countWood,
} from './game.js';
import { input } from './input.js';

let ctx, lctx, lcv, VW, VH;
const cam = { x: 0, y: 0 };

/** CSS 座標 → backbuffer 座標的映射（主程式在 resize 時更新） */
export const SM = { left: 0, top: 0, sx: 1, sy: 1 };

// 左向鏡射快取
const flipCache = new Map();
function L(s) {
  let f = flipCache.get(s);
  if (!f) { f = flipX(s); flipCache.set(s, f); }
  return f;
}

export function initRender(canvas) {
  ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  lcv = document.createElement('canvas');
  lctx = lcv.getContext('2d');
}

export function resizeRender(w, h) {
  VW = w; VH = h;
  lcv.width = w; lcv.height = h;
  ctx.imageSmoothingEnabled = false;
  lctx.imageSmoothingEnabled = false;
}

// ---------- 工具 ----------
function spr(s, x, y, alpha = 1) {
  const dx = Math.round(x - s.width / 2 - cam.x);
  const dy = Math.round(y - s.height - cam.y);
  if (dx > VW || dy > VH || dx + s.width < 0 || dy + s.height < 0) return;
  if (alpha !== 1) { ctx.save(); ctx.globalAlpha = alpha; }
  ctx.drawImage(s, dx, dy);
  if (alpha !== 1) ctx.restore();
}

function shadow(x, y, rx, ry, a = 0.26) {
  ctx.save();
  ctx.globalAlpha = a;
  ctx.fillStyle = '#28324a';
  ctx.beginPath();
  ctx.ellipse(Math.round(x - cam.x), Math.round(y - cam.y), rx, ry, 0, 0, 7);
  ctx.fill();
  ctx.restore();
}

const S  = (x) => Math.round(x - cam.x);
const SY = (y) => Math.round(y - cam.y);

// ============================================================
export function render(dt) {
  const p = G.player;

  cam.x = Math.max(0, Math.min(CFG.WORLD.w - VW, p.x - VW / 2));
  cam.y = Math.max(0, Math.min(CFG.WORLD.h - VH, p.y - VH / 2 - 10));
  if (CFG.WORLD.w < VW) cam.x = (CFG.WORLD.w - VW) / 2;
  if (G.shake > 0.05) {
    cam.x += (Math.random() - 0.5) * G.shake;
    cam.y += (Math.random() - 0.5) * G.shake;
  }
  cam.x = Math.round(cam.x); cam.y = Math.round(cam.y);

  ctx.fillStyle = '#8fa8c4';
  ctx.fillRect(0, 0, VW, VH);
  ctx.drawImage(world.ground, cam.x, cam.y, VW, VH, 0, 0, VW, VH);

  drawGroundOverlays();

  // ---- 收集可排序的繪製物 ----
  const list = [];
  const near = (y, m = 60) => y > cam.y - m && y < cam.y + VH + m;

  for (const pr of world.props) {
    if (!near(pr.y) || pr.x < cam.x - 40 || pr.x > cam.x + VW + 40) continue;
    list.push({ y: pr.y, k: 'prop', o: pr });
  }
  //  熊窩：地圖上看得見的獵場熱點
  for (const pl of world.plots) {
    if (pl.zone.id > G.zonesOpen || !near(pl.den.y)) continue;
    if (pl.den.x < cam.x - 40 || pl.den.x > cam.x + VW + 40) continue;
    list.push({ y: pl.den.y, k: 'den', o: pl });
  }
  for (const f of world.firepits) list.push({ y: f.y, k: 'fire', o: f });

  // 據點設施
  list.push({ y: CFG.SHELF.y + 10, k: 'shelf', o: CFG.SHELF });
  list.push({ y: CFG.CASH.y + 8,   k: 'cash',  o: CFG.CASH });
  list.push({ y: CFG.WOOD.y + 8,   k: 'wood',  o: CFG.WOOD });
  list.push({ y: CFG.CAMPFIRE.y,   k: 'campfire', o: CFG.CAMPFIRE });
  list.push({ y: CFG.WEAPON_RACK.y + 6, k: 'rack', o: CFG.WEAPON_RACK });
  if (G.zonesOpen >= CFG.PRESTIGE.unlockZones)
    list.push({ y: CFG.PRESTIGE_PAD.y + 6, k: 'prestige', o: CFG.PRESTIGE_PAD });
  for (const q of CFG.PADS)       list.push({ y: q.y + 6, k: 'pad', o: q });
  for (const q of CFG.BUILD_PADS) list.push({ y: q.y + 6, k: 'bpad', o: q });
  for (const t of G.towers)       list.push({ y: t.y, k: 'tower', o: t });

  for (const d of G.drops)     if (near(d.y)) list.push({ y: d.y, k: 'meat', o: d });
  for (const b of G.bears)     if (near(b.y)) list.push({ y: b.y, k: 'bear', o: b });
  for (const c of G.customers) list.push({ y: c.y, k: 'cust', o: c });
  for (const h of G.helpers)   list.push({ y: h.y, k: 'helper', o: h });
  if (p.alive || p.deadT > 0)  list.push({ y: p.y, k: 'player', o: p });

  list.sort((a, b) => a.y - b.y);

  const DRAW = {
    den: drawDen,
    prop: drawProp, fire: drawFirepit, shelf: drawShelf, wood: drawWoodYard,
    cash: drawCash, campfire: drawCampfire, rack: drawRack, prestige: drawPrestige,
    pad: drawPad, bpad: drawBuildPad, tower: drawTower, meat: drawMeat,
    bear: drawBear, cust: drawCustomer, helper: drawHelper, player: drawPlayer,
  };
  for (const it of list) DRAW[it.k](it.o);

  drawWall();
  drawShots();
  drawFx();
  drawFloats();

  drawLighting();

  drawScreenUI();
}

// ---------- 地面動態標記 ----------
function drawGroundOverlays() {
  const p = G.player;

  const wood = countWood(p.carry);
  if (p.carry.length - wood > 0) pulseRing(CFG.SHELF, '#ffd651');
  if (wood > 0) pulseRing(CFG.WOOD, '#c98f4e');
  if (G.cash > 0) pulseRing(CFG.CASH, '#9fe8a0');

  for (const pad of CFG.PADS)
    if (G.money >= nextCost(pad.key)) pulseRing(pad, '#74aae8');
  for (const pad of CFG.BUILD_PADS)
    if (G.money >= nextBuildCost(pad.key)) pulseRing(pad, '#9fe8a0');
  const nw = nextWeapon();
  if (nw && G.money >= nw.cost) pulseRing(CFG.WEAPON_RACK, '#ff9f5a');
  if (G.zonesOpen >= CFG.PRESTIGE.unlockZones && pendingMarks() > 0)
    pulseRing(CFG.PRESTIGE_PAD, '#c99fe8');

  for (const f of world.firepits) {
    if (!f.lit) continue;
    ctx.save();
    ctx.globalAlpha = 0.10; ctx.fillStyle = '#ffa62b';
    ctx.beginPath(); ctx.arc(S(f.x), SY(f.y), CFG.COLD.fireRadius, 0, 7); ctx.fill();
    ctx.restore();
  }

  // 扛塔蓄力環（站在塔底下不動就會扛起來）
  if (G.towerCarry < 0 && G.towerGrab > 0.02) {
    const t = (Math.sin(G.time * 9) + 1) / 2;
    ctx.save();
    ctx.globalAlpha = 0.5 + t * 0.4;
    ctx.strokeStyle = '#ffd651'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.arc(S(p.x), SY(p.y) - 4, 12,
            -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.min(1, G.towerGrab / CFG.TOWER.grabT));
    ctx.stroke();
    ctx.restore();
  }

  // 蓄力環
  if (G.padKey && G.padCharge > 0.02) {
    const pad = findPadPos(G.padKey);
    if (pad) {
      const t = Math.min(1, G.padCharge / CFG.PAD_CHARGE);
      ctx.save();
      ctx.strokeStyle = '#ffe08a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(S(pad.x), SY(pad.y), pad.r - 1, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * t);
      ctx.stroke();
      ctx.restore();
    }
  }
}

function pulseRing(o, color) {
  const t = (Math.sin(G.time * 4 + o.x) + 1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.16 + t * 0.26;
  ctx.strokeStyle = color; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.arc(S(o.x), SY(o.y), o.r - 2 + t * 3, 0, 7); ctx.stroke();
  ctx.restore();
}

function findPadPos(key) {
  return CFG.PADS.find(q => q.key === key)
    || CFG.BUILD_PADS.find(q => q.key === key)
    || (key === 'weapon' ? CFG.WEAPON_RACK : null)
    || (key === 'prestige' ? CFG.PRESTIGE_PAD : null);
}

// ---------- 各種繪製 ----------
function drawProp(pr) {
  if (pr.kind === 'tree') {
    if (pr.deadT > 0) {
      shadow(pr.x, pr.y - 1, 5, 3, 0.14);
      spr(PROP_SPRITE.tree(), pr.x, pr.y, 0.28);
      return;
    }
    const a = 0.5 + 0.5 * (pr.hp / pr.maxHp);
    shadow(pr.x, pr.y - 1, 7, 3, 0.22);
    spr(PROP_SPRITE.tree(), pr.x, pr.y, a);
    return;
  }
  shadow(pr.x, pr.y - 1, 6, 3, 0.22);
  spr(PROP_SPRITE[pr.kind](), pr.x, pr.y);
}

//  熊窩 —— 熊聚集的中心，讓玩家看得出「這裡有一窩」
function drawDen(pl) {
  const d = pl.den;
  const n = pl.bears.length;
  if (n > 0) {
    ctx.save();
    ctx.globalAlpha = 0.09 + Math.min(0.10, n * 0.016);
    ctx.fillStyle = '#7a5a8a';
    ctx.beginPath(); ctx.arc(S(d.x), SY(d.y), CFG.BEAR.denRadius, 0, 7); ctx.fill();
    ctx.restore();
  }
  shadow(d.x, d.y - 1, 12, 4, 0.24);
  spr(ART.bearDen, d.x, d.y);
}

function drawCampfire(f) {
  shadow(f.x, f.y - 1, 11, 4, 0.3);
  spr(ART.campfire[Math.floor(G.time * 10) % 3], f.x, f.y);
}

function drawFirepit(f) {
  shadow(f.x, f.y - 1, 11, 4, 0.28);
  if (f.lit) { spr(ART.campfire[Math.floor(G.time * 10 + f.id * 3) % 3], f.x, f.y); return; }
  spr(ART.firepitCold, f.x, f.y);
  const pct = f.progress / f.cost, bw = 30;
  const bx = S(f.x) - bw / 2, by = SY(f.y) - 24;
  ctx.fillStyle = '#14101a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 5);
  ctx.fillStyle = '#3a4a63'; ctx.fillRect(bx, by, bw, 3);
  ctx.fillStyle = '#ffa62b'; ctx.fillRect(bx, by, Math.round(bw * pct), 3);
  drawTextC(ctx, '$' + abbr(f.cost - f.progress), S(f.x), by - 9, '#ffd651');
}

/**
 * 堆成一座山。這是本作「成就感看得見」的主要手段，所以刻意堆得又高又多。
 *  perRow  最底層一排幾個
 *  narrow  每往上一層縮多少（0 = 直筒，>0 = 金字塔）
 *  sway    晃動幅度（越高晃越大）
 */
function drawPile(pick, cx, baseY, n, {
  maxW = 5, narrow = 0.3, colW = 7, rowH = 4, sway = 0, phase = 0, alpha = 1,
} = {}) {
  if (n <= 0) return 0;
  // 底層寬度隨數量自動變寬，堆才會是「山」而不是「麵條」
  const baseW = Math.max(1, Math.min(maxW, Math.round(Math.sqrt(n * 1.7))));
  let i = 0, row = 0;
  while (i < n && row < 40) {
    const w = Math.max(1, Math.round(baseW - row * narrow));
    const wob = sway ? Math.sin(G.time * 7 + phase - row * 0.4) * sway * (0.2 + row * 0.13) : 0;
    for (let c = 0; c < w && i < n; c++, i++) {
      const ox = (c - (w - 1) / 2) * colW + wob;
      spr(pick(i), cx + ox, baseY - row * rowH, alpha);
    }
    row++;
  }
  return row;
}

// ---- 貨架：肉在上面堆成一座肉山（可視化庫存）----
const SHELF_SHOWN = 72;

function drawShelf(s) {
  shadow(s.x, s.y - 4, 16, 5, 0.28);
  spr(ART.shelf, s.x, s.y + 10);

  const n = G.shelf.length, max = val.shelfMax();
  const shown = Math.min(n, SHELF_SHOWN);

  // 下層架板先鋪滿 8 個，其餘往上疊成金字塔
  const lower = Math.min(shown, 8);
  for (let i = 0; i < lower; i++) {
    spr(ART.meat, s.x + (i - (lower - 1) / 2) * 4.2, s.y + 7);
  }
  const rows = drawPile(() => ART.meat, s.x, s.y - 9, shown - lower, {
    maxW: 9, narrow: 0.3, colW: 4.2, rowH: 3.4,
  });

  const topY = s.y - 9 - rows * 3.4;
  if (n > shown) drawTextC(ctx, 'X' + n, S(s.x), SY(topY) - 12, '#ffd651');
  drawTextC(ctx, n + '/' + max, S(s.x), SY(s.y) + 14, n >= max ? '#ff9d7a' : '#cfe0f7');
}

// ---- 收銀台：現金堆成金山（可視化財富）----
const CASH_SHOWN = 64;

function drawCash(cz) {
  shadow(cz.x, cz.y - 2, 14, 5, 0.28);
  spr(ART.counter, cz.x, cz.y + 8);

  if (G.cash <= 0) return;
  // 對數成長：小錢也看得出變化，大錢不會爆版
  const n = Math.max(1, Math.min(CASH_SHOWN, Math.ceil(Math.log10(G.cash + 1) * 15)));
  const goldFrom = Math.floor(n * 0.45);      // 上半部換成金條，越有錢越金光閃閃
  const rows = drawPile(
    (i) => (i >= goldFrom ? ART.goldBar : ART.bill),
    cz.x, cz.y - 2, n,
    { maxW: 7, narrow: 0.3, colW: 6.2, rowH: 3.4, sway: 0.35, phase: 1.3 },
  );
  drawTextC(ctx, '$' + abbr(G.cash), S(cz.x), SY(cz.y - 2 - rows * 3.6) - 11, '#ffe08a');
}

// ---- 木材場：跟肉完全分開的第二條產線 ----
function drawWoodYard(wz) {
  shadow(wz.x, wz.y - 2, 16, 5, 0.28);
  spr(ART.woodYard, wz.x, wz.y + 8);

  // 剛卸下、還沒被運走的木頭堆在架子前面
  const n = Math.round(G.woodPile);
  if (n > 0) {
    drawPile(() => ART.woodLog, wz.x, wz.y + 6, Math.min(n, 30), {
      maxW: 4, narrow: 0.35, colW: 5.4, rowH: 3.2,
    });
  }
  // 基地缺血時提示「拿木頭來修」，滿血時顯示賣價
  const hurt = G.baseHp < G.baseMaxHp;
  drawTextC(ctx, hurt ? '修基地' : '$' + CFG.TREE.value,
            S(wz.x), SY(wz.y) + 13, hurt ? '#9fe8a0' : '#ffd651');
}

function drawRack(r) {
  shadow(r.x, r.y + 4, 12, 4, 0.25);
  spr(ART.padPost, r.x, r.y + 6);
  const w = nextWeapon();
  const cur = CFG.WEAPONS[G.weapon];
  spr(WEAPON_SPRITE[cur.sprite][0], r.x, r.y - 6 + Math.round(Math.sin(G.time * 2.2) * 1));
  if (!w) { drawTextC(ctx, 'MAX', S(r.x), SY(r.y) + 10, '#8fa0bd'); return; }
  drawTextC(ctx, '$' + abbr(w.cost), S(r.x), SY(r.y) + 10, G.money >= w.cost ? '#ffd651' : '#7a8298');
}

function drawPrestige(p) {
  shadow(p.x, p.y - 2, 13, 5, 0.28);
  spr(ART.prestigeTent, p.x, p.y + 6);
  const m = pendingMarks();
  if (m > 0) {
    const bob = Math.round(Math.sin(G.time * 3) * 2);
    spr(ART.icoMark, p.x, p.y - 26 + bob);
    drawTextC(ctx, '+' + m, S(p.x), SY(p.y) - 38 + bob, '#e0c0ff');
  }
}

//  塔的外觀跟建設等級走：木哨塔 → 石塔 → 鐵弩塔 → 極光塔
function drawTower(t) {
  const tier = Math.max(0, Math.min(ART.towers.length - 1, G.build.tower - 1));
  const s = ART.towers[tier];
  const carried = G.towers[G.towerCarry] === t;

  // 扛在身上時整座塔浮起來、半透明，並在腳下畫出落點與射程
  if (carried) {
    const ready = Math.min(1, G.towerPlace / CFG.TOWER.placeT);
    ctx.save();
    ctx.globalAlpha = 0.25 + ready * 0.3;
    ctx.strokeStyle = ready >= 1 ? '#9fe8a0' : '#cfe0f7'; ctx.lineWidth = 1;
    ctx.setLineDash([3, 3]);
    ctx.beginPath(); ctx.arc(S(t.x), SY(t.y), t.range, 0, 7); ctx.stroke();
    ctx.restore();
    shadow(t.x, t.y - 1, 7, 3, 0.18);
    spr(s, t.x, t.y - 12 - Math.round(Math.sin(G.time * 5) * 2), 0.62);
    if (ready > 0) {
      ctx.save();
      ctx.strokeStyle = '#9fe8a0'; ctx.lineWidth = 3; ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.arc(S(t.x), SY(t.y) - 4, 13, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * ready);
      ctx.stroke();
      ctx.restore();
    }
    return;
  }

  shadow(t.x, t.y - 1, 6 + tier * 2, 4, 0.3);
  spr(s, t.x, t.y);
  // 頂端的火光／極光隨等級變亮
  if (tier >= 2) {
    const fl = 0.7 + Math.sin(G.time * 7 + t.x) * 0.3;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const col = tier >= 3 ? '150,230,255' : '255,190,80';
    const gr = ctx.createRadialGradient(S(t.x), SY(t.y) - s.height + 4, 0, S(t.x), SY(t.y) - s.height + 4, 16);
    gr.addColorStop(0, `rgba(${col},${0.5 * fl})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(S(t.x) - 16, SY(t.y) - s.height - 12, 32, 32);
    ctx.restore();
  }
}

// ---- 圍牆：沿著目前營地邊界排列 ----
function drawWall() {
  if (G.build.wall <= 0) return;
  const c = campRect();
  const cx = c.x + c.w / 2, cy = c.y + c.h / 2;
  const rx = c.w / 2, ry = c.h / 2;
  const step = 0.19;
  for (let a = 0; a < Math.PI * 2; a += step) {
    const x = cx + Math.cos(a) * rx, y = cy + Math.sin(a) * ry;
    if (x < cam.x - 20 || x > cam.x + VW + 20 || y < cam.y - 20 || y > cam.y + VH + 20) continue;
    // 顧客入口留缺口
    if (Math.abs(y - CFG.QUEUE.entryY) < 26 && x < cx) continue;
    spr(ART.wallPost, x, y + 6);
  }
}

const PAD_ICON = {
  cap: 'icoCap', speed: 'icoSpeed', power: 'icoPower',
  vigor: 'icoVigor', warm: 'icoWarm',
};

function drawPad(pad) {
  shadow(pad.x, pad.y + 5, 11, 4, 0.25);
  spr(ART.padPost, pad.x, pad.y + 6);
  spr(ART[PAD_ICON[pad.key]], pad.x, pad.y - 8 + Math.round(Math.sin(G.time * 2.4 + pad.x * 0.1)));

  const lv = G.upg[pad.key];
  drawTextC(ctx, 'LV' + lv, S(pad.x), SY(pad.y) - 30, '#cfe0f7');

  if (lv >= CFG.UPG[pad.key].max) drawTextC(ctx, 'MAX', S(pad.x), SY(pad.y) + 10, '#8fa0bd');
  else if (zoneLocked(pad.key)) lockIcon(pad);
  else {
    const cost = nextCost(pad.key);
    drawTextC(ctx, '$' + abbr(cost), S(pad.x), SY(pad.y) + 10, G.money >= cost ? '#ffd651' : '#7a8298');
  }
}

function drawBuildPad(pad) {
  shadow(pad.x, pad.y + 5, 10, 4, 0.25);
  spr(ART.padPost, pad.x, pad.y + 6);
  spr(BUILD_ICON[pad.key], pad.x, pad.y - 8 + Math.round(Math.sin(G.time * 2.4 + pad.x * 0.1)));
  const lv = G.build[pad.key];
  drawTextC(ctx, 'LV' + lv, S(pad.x), SY(pad.y) - 30, '#cfe0f7');
  const cost = nextBuildCost(pad.key);
  if (!isFinite(cost)) drawTextC(ctx, 'MAX', S(pad.x), SY(pad.y) + 10, '#8fa0bd');
  else drawTextC(ctx, '$' + abbr(cost), S(pad.x), SY(pad.y) + 10, G.money >= cost ? '#9fe8a0' : '#7a8298');
}

function lockIcon(pad) {
  const t = (Math.sin(G.time * 3 + pad.x) + 1) / 2;
  ctx.save();
  ctx.globalAlpha = 0.75 + t * 0.25;
  ctx.fillStyle = '#14101a'; ctx.fillRect(S(pad.x) - 4, SY(pad.y) + 8, 8, 6);
  ctx.fillStyle = '#ffb648'; ctx.fillRect(S(pad.x) - 3, SY(pad.y) + 9, 6, 4);
  ctx.fillStyle = '#14101a';
  ctx.fillRect(S(pad.x) - 3, SY(pad.y) + 5, 6, 1);
  ctx.fillRect(S(pad.x) - 3, SY(pad.y) + 6, 1, 2);
  ctx.fillRect(S(pad.x) + 2, SY(pad.y) + 6, 1, 2);
  ctx.restore();
}

function drawMeat(d) {
  const blink = d.life < 6 && (d.life % 0.5 < 0.25);
  shadow(d.x, d.y, 5, 2, 0.22);
  if (blink) return;
  const sprite = d.value === WOOD_MARKER ? ART.woodLog : ART.meat;
  spr(sprite, d.x, d.y - (d.z > 0 ? d.z : Math.sin(G.time * 3 + d.spin) * 0.8));
}

function drawBear(b) {
  const frames = BEAR_SPRITES[b.variant.scale];
  const walking = Math.abs(b.vx) + Math.abs(b.vy) > 8;
  const f = frames[walking && Math.floor(b.walkT) % 2 === 1 ? 1 : 0];
  const s = b.face > 0 ? f : L(f);

  shadow(b.x, b.y - 1, b.radius + 1, 4, 0.28);
  spr(s, b.x, b.y - (walking ? Math.round(Math.abs(Math.sin(b.walkT * 1.6))) : 0));

  if (b.flash > 0) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, b.flash * 7);
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#ff6a4a';
    ctx.fillRect(S(b.x) - s.width / 2, SY(b.y) - s.height, s.width, s.height);
    ctx.restore();
  }
  // 拍打圍牆的爪痕 —— 讓「基地正在被打」看得見
  if (b.clawT > 0) {
    const t = 1 - b.clawT / 0.3;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.9;
    ctx.strokeStyle = '#ff8a5c'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    for (let i = -1; i <= 1; i++) {
      ctx.beginPath();
      ctx.moveTo(S(b.x) + i * 4 - 3, SY(b.y) + 2 - t * 4);
      ctx.lineTo(S(b.x) + i * 4 + 3, SY(b.y) + 10 - t * 4);
      ctx.stroke();
    }
    ctx.restore();
  }

  if (b.hp < b.maxHp) {
    const bw = 18, bx = S(b.x) - bw / 2, by = SY(b.y) - s.height - 5;
    ctx.fillStyle = '#14101a'; ctx.fillRect(bx - 1, by - 1, bw + 2, 4);
    ctx.fillStyle = '#5a2a2a'; ctx.fillRect(bx, by, bw, 2);
    ctx.fillStyle = b.variant.id === 'rage' ? '#ff7a2a' : '#e8543a';
    ctx.fillRect(bx, by, Math.round(bw * Math.max(0, b.hp / b.maxHp)), 2);
  }
}

// ---- 顧客 ----
function drawCustomer(c) {
  const s0 = ART.customers[c.skin];
  const s = c.face > 0 ? s0 : L(s0);
  const moving = Math.abs(c.vx) + Math.abs(c.vy) > 2;
  shadow(c.x, c.y - 1, 6, 3, 0.26);
  spr(s, c.x, c.y - (moving ? Math.round(Math.abs(Math.sin(c.walkT))) : 0));

  if (c.state === 'leaving') return;
  // 需求泡泡：還要幾塊肉
  const left = Math.max(0, c.want - c.got);
  const bx = c.x + 2, by = c.y - 22;
  spr(ART.wantBubble, bx + 3, by);
  spr(ART.meat, bx - 1, by - 4);
  drawText(ctx, 'X' + left, S(bx) + 2, SY(by) - 13, '#3a2b1d', null);

  if (c.state === 'buy' && G.shelf.length === 0) {
    const t = (Math.sin(G.time * 8) + 1) / 2;
    ctx.save(); ctx.globalAlpha = 0.4 + t * 0.6;
    drawTextC(ctx, '!', S(c.x) + 12, SY(c.y) - 34, '#ff8a5c');
    ctx.restore();
  }
}

function drawHelper(h) {
  const s0 = h.kind === 'hauler' ? ART.hauler : ART.helperHunter;
  const s = h.face > 0 ? s0 : L(s0);
  const moving = Math.abs(h.vx) + Math.abs(h.vy) > 2;
  shadow(h.x, h.y - 1, 6, 3, 0.26);
  spr(s, h.x, h.y - (moving ? Math.round(Math.abs(Math.sin(h.walkT))) : 0));
  //  載重會跟著玩家背包一起長到幾十個，所以要堆成山而不是排成一根竹竿
  const hn = h.carry.length;
  if (hn > 0) {
    const shown = Math.min(hn, 32);
    const rows = drawPile(
      (i) => (h.carry[i] === WOOD_MARKER ? ART.woodLog : ART.meat),
      h.x, h.y - 16, shown,
      { maxW: 3, narrow: 0.2, colW: 4.2, rowH: 2.8, sway: 0.3, phase: h.i * 1.7 });
    if (hn > shown) drawTextC(ctx, 'X' + hn, S(h.x), SY(h.y) - 16 - rows * 3 - 10, '#ffd651');
  }
  if (h.kind === 'hunter' && h.swing > 0) {
    ctx.save();
    ctx.globalAlpha = 0.8;
    ctx.strokeStyle = '#a0e8a0'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(S(h.x), SY(h.y) - 8, 14, 0, 7); ctx.stroke();
    ctx.restore();
  }
}

function drawShots() {
  for (const s of G.shots) {
    const t = s.t / s.dur;
    const x = s.x + (s.tx - s.x) * t;
    const y = s.y + (s.ty - s.y) * t - Math.sin(t * Math.PI) * 12;
    ctx.save();
    ctx.strokeStyle = '#cfe8f8'; ctx.lineWidth = 1;
    const a = Math.atan2(s.ty - s.y, s.tx - s.x);
    ctx.beginPath();
    ctx.moveTo(S(x), SY(y));
    ctx.lineTo(S(x) - Math.cos(a) * 5, SY(y) - Math.sin(a) * 5);
    ctx.stroke();
    ctx.restore();
  }
}

// ---- 玩家 ----
const CARRY_SHOWN = 48;      // 背上最多畫幾塊肉（超過用 Xn 表示）

function drawPlayer(p) {
  if (!p.alive) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.deadT / 1.6) * 0.7;
    ctx.fillStyle = '#9fdff0';
    ctx.beginPath(); ctx.arc(S(p.x), SY(p.y) - 8, 10, 0, 7); ctx.fill();
    ctx.restore();
    return;
  }

  const moving = Math.hypot(p.vx, p.vy) > 8;
  const blink = p.iframes > 0 && Math.floor(G.time * 14) % 2 === 0;
  const alpha = blink ? 0.35 : 1;

  shadow(p.x, p.y - 1, 7, 3, 0.3);

  const frame = moving ? (Math.floor(p.walkT) % 2) : -1;
  let s = frame < 0 ? ART.hunterIdle : (frame === 0 ? ART.hunterWalkA : ART.hunterWalkB);
  if (p.face < 0) s = L(s);

  const py = p.y + (moving ? -Math.round(Math.abs(Math.sin(p.walkT * 1.6))) : 0);
  spr(s, p.x, py, alpha);

  // ---- 武器 ----
  const w = val.weapon();
  const frames = WEAPON_SPRITE[w.sprite];
  const wf = frames[frames.length > 1 ? Math.floor(G.time * 12) % frames.length : 0];
  let tox = p.face * 7, toy = -9;
  if (p.swing > 0) {
    const t = 1 - p.swing / (p.swingMax || 0.22);
    const a = p.swingDir + (1 - t * 2) * (w.arc / 2);
    tox = Math.cos(a) * (w.range * 0.45);
    toy = -9 + Math.sin(a) * (w.range * 0.32);
  }
  spr(wf, p.x + tox, py + toy + wf.height, alpha);

  // ---- 揮擊弧線 ----
  if (p.swing > 0) {
    const t = 1 - p.swing / (p.swingMax || 0.22);
    const a0 = p.swingDir + w.arc / 2, a1 = p.swingDir - w.arc / 2;
    const a = a0 + (a1 - a0) * t;
    ctx.save();
    ctx.globalAlpha = (1 - t) * 0.85;
    ctx.strokeStyle = w.color; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.arc(S(p.x), SY(py) - 8, w.range - 4, a - 0.5, a + 0.15); ctx.stroke();
    ctx.globalAlpha = (1 - t) * 0.45;
    ctx.strokeStyle = '#fff6d0'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(S(p.x), SY(py) - 8, w.range - 1, a - 0.4, a + 0.1); ctx.stroke();
    ctx.restore();
  }

  // ---- 背上的肉堆（財富可視化）----
  //  堆得越高越爽。跑動時整座塔會左右擺動，越上面晃越大。
  //  肉與木頭混著背，各自畫自己的圖 —— 玩家一眼知道身上帶了什麼
  const n = p.carry.length;
  const shown = Math.min(n, CARRY_SHOWN);
  const speedF = Math.min(1, Math.hypot(p.vx, p.vy) / 60);
  const rows = drawPile(
    (i) => (p.carry[i] === WOOD_MARKER ? ART.woodLog : ART.meat),
    p.x, py - 18, shown, {
      maxW: 4, narrow: 0.16, colW: 4.4, rowH: 2.9,
      sway: 0.3 + speedF * 0.8, phase: 0, alpha,
    });
  if (n > shown) drawTextC(ctx, 'X' + n, S(p.x), SY(py) - 18 - rows * 3 - 11, '#ffd651');

  if (p.hurtFlash > 0) {
    ctx.save();
    ctx.globalAlpha = p.hurtFlash * 2;
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = '#9fdff0';
    ctx.fillRect(S(p.x) - 9, SY(py) - 21, 18, 21);
    ctx.restore();
  }
}

// ---------- 特效 ----------
const FX_SPRITE = { coin: () => ART.coin[Math.floor(G.time * 22) % 3], bill: () => ART.bill, meat: () => ART.meat };

function drawFx() {
  for (const f of G.fx) {
    if (f.coin) {
      const t = f.t / f.dur;
      const e = 1 - Math.pow(1 - t, 2);
      const x = f.x + (f.tx - f.x) * e;
      const y = f.y + (f.ty - f.y) * e - Math.sin(t * Math.PI) * 22;
      spr((FX_SPRITE[f.kind] || FX_SPRITE.coin)(), x, y + 8);
      continue;
    }

    // 擴散圓環（衝擊波 / 火圈 / 極光環）
    if (f.ring) {
      const t = 1 - f.life / f.max;
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.95;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(1, f.width * (1 - t * 0.6));
      ctx.beginPath();
      ctx.arc(S(f.x), SY(f.y), f.r0 + (f.r1 - f.r0) * (1 - Math.pow(1 - t, 2)), 0, 7);
      ctx.stroke();
      ctx.restore();
      continue;
    }

    // 直線光痕（刀光 / 刺擊）
    if (f.streak) {
      const t = 1 - f.life / f.max;
      const len = f.len * (0.5 + 0.5 * (1 - Math.pow(1 - t, 2)));
      ctx.save();
      ctx.globalAlpha = (1 - t) * 0.95;
      ctx.strokeStyle = f.color;
      ctx.lineWidth = Math.max(1, f.width * (1 - t));
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(S(f.x - Math.cos(f.a) * len / 2), SY(f.y - Math.sin(f.a) * len / 2));
      ctx.lineTo(S(f.x + Math.cos(f.a) * len / 2), SY(f.y + Math.sin(f.a) * len / 2));
      ctx.stroke();
      ctx.restore();
      continue;
    }

    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life / (f.max * 0.5));
    ctx.fillStyle = f.color;
    ctx.fillRect(S(f.x), SY(f.y), f.size, f.size);
    ctx.restore();
  }
}

function drawFloats() {
  for (const f of G.floats) {
    ctx.save();
    ctx.globalAlpha = Math.min(1, f.life / 0.35);
    drawTextC(ctx, f.text, S(f.x), SY(f.y), f.color);
    ctx.restore();
  }
}

// ---------- 光照 ----------
function drawLighting() {
  const p = G.player;
  const yb = CFG.ZONES[0].y0;

  const grad = lctx.createLinearGradient(0, SY(yb - 150), 0, SY(yb + 150));
  grad.addColorStop(0, `rgba(10,26,54,${CFG.ZONES[1].dark})`);
  grad.addColorStop(1, `rgba(10,26,54,${CFG.ZONES[0].dark})`);

  lctx.globalCompositeOperation = 'source-over';
  lctx.clearRect(0, 0, VW, VH);
  lctx.fillStyle = grad;
  lctx.fillRect(0, 0, VW, VH);
  lctx.globalCompositeOperation = 'destination-out';

  const hole = (x, y, r, strength = 1) => {
    const sx = S(x), sy = SY(y);
    if (sx < -r || sx > VW + r || sy < -r || sy > VH + r) return;
    const gr = lctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(0,0,0,${strength})`);
    gr.addColorStop(0.55, `rgba(0,0,0,${strength * 0.75})`);
    gr.addColorStop(1, 'rgba(0,0,0,0)');
    lctx.fillStyle = gr;
    lctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  };

  const c = campRect();
  hole(c.x + c.w / 2, c.y + c.h / 2, Math.max(c.w, c.h) * 0.72, 1);

  const flick = 0.9 + Math.sin(G.time * 11) * 0.05 + Math.sin(G.time * 23) * 0.05;
  hole(CFG.CAMPFIRE.x, CFG.CAMPFIRE.y - 8, CFG.COLD.fireLight * flick, 1);
  for (const f of world.firepits) if (f.lit) hole(f.x, f.y - 8, CFG.COLD.fireLight * flick, 1);
  if (p.alive) hole(p.x, p.y - 12, CFG.PLAYER.torchLight * flick, 1);
  for (const t of G.towers) hole(t.x, t.y - 24, 46, 0.9);

  lctx.globalCompositeOperation = 'source-over';
  ctx.drawImage(lcv, 0, 0);

  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  const glow = (x, y, r, a, col = '255,150,50') => {
    const sx = S(x), sy = SY(y);
    if (sx < -r || sx > VW + r || sy < -r || sy > VH + r) return;
    const gr = ctx.createRadialGradient(sx, sy, 0, sx, sy, r);
    gr.addColorStop(0, `rgba(${col},${a})`);
    gr.addColorStop(1, `rgba(${col},0)`);
    ctx.fillStyle = gr;
    ctx.fillRect(sx - r, sy - r, r * 2, r * 2);
  };
  glow(CFG.CAMPFIRE.x, CFG.CAMPFIRE.y - 8, 60 * flick, 0.30);
  for (const f of world.firepits) if (f.lit) glow(f.x, f.y - 8, 60 * flick, 0.30);
  if (p.alive) glow(p.x, p.y - 12, 30 * flick, 0.20);
  ctx.restore();

  if (G.flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    ctx.fillStyle = `rgba(255,240,200,${G.flash * 0.5})`;
    ctx.fillRect(0, 0, VW, VH);
    ctx.restore();
  }
}

// ---------- 螢幕空間 UI ----------
function drawScreenUI() {
  const p = G.player;

  //  導引箭頭：永遠只指一個地方，玩家不會迷路
  let guide = null;
  if (p.alive) {
    const wood = countWood(p.carry);
    //  基地在挨打時，「把木頭運回去」的優先度高於任何賺錢動作
    if (wood > 0 && G.baseHp < G.baseMaxHp * 0.6) guide = { ...CFG.WOOD, color: '#9fe8a0' };
    else if (p.carry.length >= val.cap() && !inCamp(p.x, p.y)) {
      guide = wood > p.carry.length - wood
        ? { ...CFG.WOOD, color: '#c98f4e' }
        : { ...CFG.SHELF, color: '#ffd651' };
    } else if (G.cash > 0 && inCamp(p.x, p.y) && p.carry.length === 0) guide = { ...CFG.CASH, color: '#9fe8a0' };
  }
  if (guide) {
    const dx = guide.x - p.x, dy = guide.y - p.y;
    if (Math.hypot(dx, dy) > 70) {
      const a = Math.atan2(dy, dx);
      const rad = Math.min(VW, VH) * 0.34;
      const t = (Math.sin(G.time * 6) + 1) / 2;
      ctx.save();
      ctx.translate(Math.round(VW / 2 + Math.cos(a) * rad), Math.round(VH / 2 + Math.sin(a) * rad));
      ctx.rotate(a);
      ctx.globalAlpha = 0.55 + t * 0.4;
      ctx.fillStyle = guide.color;
      ctx.beginPath();
      ctx.moveTo(8, 0); ctx.lineTo(-4, -6); ctx.lineTo(-1, 0); ctx.lineTo(-4, 6);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = '#14101a'; ctx.lineWidth = 1; ctx.stroke();
      ctx.restore();
    }
  }

  if (input.active && input.mag > 0.02) {
    const ox = (input.ox - SM.left) * SM.sx;
    const oy = (input.oy - SM.top) * SM.sy;
    const kx = ox + input.x * input.mag * 20;
    const ky = oy + input.y * input.mag * 20;
    ctx.save();
    ctx.globalAlpha = 0.28;
    ctx.strokeStyle = '#e8eef7'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.arc(ox, oy, 21, 0, 7); ctx.stroke();
    ctx.globalAlpha = 0.55; ctx.fillStyle = '#e8eef7';
    ctx.beginPath(); ctx.arc(kx, ky, 8, 0, 7); ctx.fill();
    ctx.strokeStyle = '#14101a'; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
  }
}

/** 世界座標 → 螢幕 CSS 座標（給 DOM 說明面板定位用） */
export function worldToCss(x, y) {
  return { x: S(x) / SM.sx + SM.left, y: SY(y) / SM.sy + SM.top };
}
