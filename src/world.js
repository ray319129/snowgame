// ============================================================
//  世界：地形預渲染、道具散佈、地塊（熊的生成單位）
// ============================================================
import { CFG, zoneAt } from './config.js';
import { ART } from './art.js';

/** 種子亂數 —— 地圖每次都一樣，方便調平衡 */
export function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5;  s >>>= 0;
    return s / 4294967296;
  };
}

export const world = {
  ground: null,       // 目前顯示的底圖（雪地 + 目前尺寸的營地）
  groundSnow: null,   // 只有雪地的乾淨底圖，重畫營地時當來源
  props: [],
  plots: [],
  firepits: [],
  gate: null,
  campExpand: 0,      // 圍牆等級帶來的營地擴張
};

/** 圍牆等級改變時重畫營地地板（擴建看得見） */
export function setCampExpand(e) {
  if (world.campExpand === e && world.ground) return;
  world.campExpand = e;
  if (!world.groundSnow) return;
  const g = world.ground.getContext('2d');
  g.globalCompositeOperation = 'source-over';
  g.drawImage(world.groundSnow, 0, 0);
  paintCamp(g, campRect());
}

/** 目前的營地範圍（會因為圍牆升級而變大） */
export function campRect() {
  const e = world.campExpand || 0;
  const c = CFG.CAMP;
  return { x: c.x - e, y: c.y - e, w: c.w + e * 2, h: c.h + e * 2 };
}

export function inCamp(x, y, pad = 0) {
  const c = campRect();
  return x > c.x - pad && x < c.x + c.w + pad && y > c.y - pad && y < c.y + c.h + pad;
}

//  圍牆最大擴張，底圖照這個尺寸預渲染，之後只要移動柵欄即可
const MAX_EXPAND = CFG.BUILD.wall.per * CFG.BUILD.wall.max;

function maxCamp() {
  const c = CFG.CAMP;
  return { x: c.x - MAX_EXPAND, y: c.y - MAX_EXPAND, w: c.w + MAX_EXPAND * 2, h: c.h + MAX_EXPAND * 2 };
}

//  spacing 刻意調小 —— 樹要能長成一片林子，不是均勻散點
function blocked(x, y, spacing = 12) {
  const c = maxCamp();
  if (x > c.x - 30 && x < c.x + c.w + 30 && y > c.y - 30 && y < c.y + c.h + 30) return true;
  for (const f of CFG.FIREPITS) if (Math.hypot(x - f.x, y - f.y) < 62) return true;
  for (const p of world.props) if (Math.hypot(x - p.x, y - p.y) < spacing) return true;
  return false;
}

export function buildWorld() {
  const W = CFG.WORLD.w, H = CFG.WORLD.h;
  const rng = makeRng(20260728);

  const cv = document.createElement('canvas');
  cv.width = W; cv.height = H;
  const g = cv.getContext('2d');
  g.imageSmoothingEnabled = false;

  // ---------- 雪地基色（越深越冷藍）----------
  for (let y = 0; y < H; y++) {
    const z = zoneAt(y);
    const base = z.id === 1 ? [223, 232, 242] : [190, 208, 231];
    g.fillStyle = `rgb(${base[0]},${base[1]},${base[2]})`;
    g.fillRect(0, y, W, 1);
  }

  // ---------- 顆粒噪點 ----------
  for (let y = 0; y < H; y += 2) {
    for (let x = 0; x < W; x += 2) {
      const r = rng();
      if (r > 0.82) { g.fillStyle = 'rgba(255,255,255,0.55)'; g.fillRect(x, y, 2, 2); }
      else if (r < 0.10) { g.fillStyle = 'rgba(150,175,205,0.28)'; g.fillRect(x, y, 2, 2); }
    }
  }

  // ---------- 雪堆 ----------
  for (let i = 0; i < 230; i++) {
    const x = rng() * W, y = rng() * H, w = 14 + rng() * 46, h = 6 + rng() * 16;
    g.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.4)' : 'rgba(160,185,215,0.2)';
    g.beginPath(); g.ellipse(x, y, w, h, 0, 0, 7); g.fill();
  }

  // ---------- 冰裂縫 ----------
  for (let i = 0; i < 95; i++) {
    let x = rng() * W, y = 120 + rng() * (H - 420);
    g.strokeStyle = 'rgba(120,160,200,0.42)'; g.lineWidth = 1;
    g.beginPath(); g.moveTo(x, y);
    const seg = 2 + Math.floor(rng() * 4);
    for (let s = 0; s < seg; s++) {
      x += (rng() - 0.5) * 40; y += (rng() - 0.5) * 26;
      g.lineTo(x, y);
    }
    g.stroke();
  }

  // ---------- 區域交界的冰脊 ----------
  const yb = CFG.ZONES[0].y0;
  for (let x = 0; x < W; x += 4) {
    const n = Math.sin(x * 0.09) * 5 + Math.sin(x * 0.031) * 8;
    g.fillStyle = 'rgba(120,160,200,0.35)';
    g.fillRect(x, yb + n - 3, 4, 7);
    g.fillStyle = 'rgba(255,255,255,0.7)';
    g.fillRect(x, yb + n - 5, 4, 3);
  }

  // 雪地版本存起來，之後擴建營地時當乾淨來源
  world.groundSnow = cv;
  const cv2 = document.createElement('canvas');
  cv2.width = W; cv2.height = H;
  const g2 = cv2.getContext('2d');
  g2.imageSmoothingEnabled = false;
  g2.drawImage(cv, 0, 0);
  world.ground = cv2;
  paintCamp(g2, campRect());

  // ---------- 道具散佈 ----------
  //  樹是資源（砍了給木材），所以密度要高到「隨手就能砍一棵」。
  //  樹叢化散佈：先撒種子點，再在種子周圍長一小片，看起來像森林而不是雜訊。
  world.props = [];
  const propRng = makeRng(777);
  const addProp = (x, y, kind) => {
    if (x < 16 || x > W - 16 || y < 40 || y > H - 50) return;
    if (blocked(x, y)) return;
    const hp = kind === 'tree' ? CFG.TREE.hp : 0;
    world.props.push({ x: Math.round(x), y: Math.round(y), kind, hp, maxHp: hp, deadT: 0 });
  };

  // 樹叢
  for (let i = 0; i < 380; i++) {
    const cx = 16 + propRng() * (W - 32);
    const cy = 40 + propRng() * (H - 90);
    const n = 3 + Math.floor(propRng() * 5);
    for (let j = 0; j < n; j++) {
      addProp(cx + (propRng() - 0.5) * 72, cy + (propRng() - 0.5) * 62, 'tree');
    }
  }
  // 零星石頭與冰晶
  for (let i = 0; i < 110; i++) {
    addProp(16 + propRng() * (W - 32), 40 + propRng() * (H - 90),
            propRng() > 0.42 ? 'rock' : 'ice');
  }

  world.firepits = CFG.FIREPITS.map((f, i) => ({ ...f, id: i, progress: 0 }));
  world.gate = { ...CFG.GATE, progress: CFG.GATE.cost, open: true };

  // ---------- 地塊（熊的生成單位）----------
  //  地塊變小 + 每塊上限提高 → 整體密度大幅上升
  world.plots = [];
  const ps = CFG.BEAR.plotSize;
  const campTop = maxCamp().y;
  const denRng = makeRng(5150);
  for (const z of CFG.ZONES) {
    const y0 = Math.max(30, z.y0), y1 = Math.min(H - 40, z.y1);
    for (let py = y0; py < y1 - 50; py += ps) {
      for (let pxx = 16; pxx < W - 50; pxx += ps) {
        const rect = {
          x: pxx, y: py,
          w: Math.min(ps, W - 16 - pxx),
          h: Math.min(ps, y1 - py),
        };
        if (rect.y + rect.h > campTop - 30) continue;
        if (rect.w < 70 || rect.h < 70) continue;
        //  每個地塊有一個熊窩，熊會聚集在它周圍（看得見的獵場熱點）。
        //  熊窩要避開火堆與迷霧門 —— 否則玩家「退回火堆療傷」等於自殺。
        let den = null;
        for (let tries = 0; tries < 24; tries++) {
          const cand = {
            x: Math.round(rect.x + rect.w * (0.22 + denRng() * 0.56)),
            y: Math.round(rect.y + rect.h * (0.22 + denRng() * 0.56)),
          };
          const clash =
            CFG.FIREPITS.some(f => Math.hypot(cand.x - f.x, cand.y - f.y) < 150) ||
            Math.hypot(cand.x - CFG.GATE.x, cand.y - CFG.GATE.y) < 110;
          if (!clash) { den = cand; break; }
          if (tries === 23) den = cand;   // 真的擠不下就算了
        }
        world.plots.push({ rect, zone: z, den, bears: [], queue: [] });
      }
    }
  }

  // 熊窩上不要長樹，不然看不出那是窩
  world.props = world.props.filter(pr =>
    !world.plots.some(pl => Math.hypot(pr.x - pl.den.x, pr.y - pl.den.y) < 26));

  return world;
}

/** 把營地地板 + 觸發區標記畫到底圖上（圍牆升級後會重畫一次） */
function paintCamp(g, c) {
  const rnd = makeRng(31337);
  const ccx = c.x + c.w / 2, ccy = c.y + c.h / 2;
  const rx = c.w / 2, ry = c.h / 2;

  // 被踩實的雪圈
  g.fillStyle = 'rgba(190,200,215,0.55)';
  g.beginPath(); g.ellipse(ccx, ccy, rx * 1.16, ry * 1.12, 0, 0, 7); g.fill();

  // 木地板
  for (let y = c.y; y < c.y + c.h; y += 6) {
    for (let x = c.x; x < c.x + c.w; x++) {
      const dx = (x - ccx) / rx, dy = (y - ccy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      g.fillStyle = ((y / 6) | 0) % 2 === 0 ? '#8d6539' : '#7e5a33';
      g.fillRect(x, y, 1, 5);
      if (rnd() > 0.93) { g.fillStyle = 'rgba(255,255,255,0.10)'; g.fillRect(x, y, 1, 5); }
    }
  }
  g.fillStyle = 'rgba(60,40,20,0.5)';
  for (let y = c.y; y < c.y + c.h; y += 6) {
    for (let x = c.x; x < c.x + c.w; x++) {
      const dx = (x - ccx) / rx, dy = (y + 5 - ccy) / ry;
      if (dx * dx + dy * dy > 1) continue;
      g.fillRect(x, y + 5, 1, 1);
    }
  }

  // 顧客走進來的雪徑
  g.strokeStyle = 'rgba(196,206,220,0.75)'; g.lineWidth = 11;
  g.beginPath();
  g.moveTo(CFG.QUEUE.entryX - 70, CFG.QUEUE.entryY);
  g.lineTo(CFG.QUEUE.x + 6, CFG.QUEUE.y);
  g.stroke();

  // 觸發區地面標記
  ringMark(g, CFG.SHELF.x, CFG.SHELF.y, CFG.SHELF.r, '#ffd651');
  ringMark(g, CFG.CASH.x, CFG.CASH.y, CFG.CASH.r, '#9fe8a0');
  ringMark(g, CFG.WOOD.x, CFG.WOOD.y, CFG.WOOD.r, '#c98f4e');
  for (const p of CFG.PADS) ringMark(g, p.x, p.y, p.r, '#74aae8');
  for (const p of CFG.BUILD_PADS) ringMark(g, p.x, p.y, p.r, '#9fe8a0');
  ringMark(g, CFG.WEAPON_RACK.x, CFG.WEAPON_RACK.y, CFG.WEAPON_RACK.r, '#ff9f5a');
  ringMark(g, CFG.PRESTIGE_PAD.x, CFG.PRESTIGE_PAD.y, CFG.PRESTIGE_PAD.r, '#c99fe8');
}

function ringMark(g, x, y, r, color) {
  g.save();
  g.strokeStyle = color; g.globalAlpha = 0.5; g.lineWidth = 2;
  g.beginPath(); g.arc(x, y, r, 0, 7); g.stroke();
  g.globalAlpha = 0.12; g.fillStyle = color;
  g.beginPath(); g.arc(x, y, r - 1, 0, 7); g.fill();
  g.globalAlpha = 0.35; g.lineWidth = 1;
  g.setLineDash([3, 4]);
  g.beginPath(); g.arc(x, y, r - 6, 0, 7); g.stroke();
  g.restore();
}

export const PROP_SPRITE = {
  tree: () => ART.tree,
  rock: () => ART.rock,
  ice:  () => ART.iceShard,
};
