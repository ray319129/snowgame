// ============================================================
//  輸入：鍵盤 + 浮動式虛擬搖桿
//  浮動搖桿 = 手指按下處即為圓心（DESIGN.md §3）
// ============================================================

export const input = {
  x: 0, y: 0,           // 正規化方向向量 (-1..1)
  active: false,        // 搖桿是否在使用中
  ox: 0, oy: 0,         // 搖桿圓心（螢幕 CSS 座標）
  px: 0, py: 0,         // 目前指位
  mag: 0,               // 0..1
};

const keys = new Set();
const KEYMAP = {
  ArrowUp: 'u', ArrowDown: 'd', ArrowLeft: 'l', ArrowRight: 'r',
  KeyW: 'u', KeyS: 'd', KeyA: 'l', KeyD: 'r',
};

const MAX_R = 42;       // 搖桿最大半徑（CSS px）
const DEAD  = 5;

let pointerId = null;
let enabled = true;

/** 開啟彈窗時要停掉搖桿，否則角色會邊看選單邊亂跑 */
export function setInputEnabled(v) {
  enabled = v;
  if (!v) { keys.clear(); pointerId = null; input.active = false; input.mag = 0; }
}

export function initInput(el, onFirstTouch) {
  window.addEventListener('keydown', (e) => {
    const k = KEYMAP[e.code];
    if (k) { keys.add(k); e.preventDefault(); }
    if (onFirstTouch) onFirstTouch();
  }, { passive: false });

  window.addEventListener('keyup', (e) => {
    const k = KEYMAP[e.code];
    if (k) keys.delete(k);
  });

  window.addEventListener('blur', () => keys.clear());

  el.addEventListener('pointerdown', (e) => {
    if (!enabled || pointerId !== null) return;
    pointerId = e.pointerId;
    el.setPointerCapture(pointerId);
    input.active = true;
    input.ox = input.px = e.clientX;
    input.oy = input.py = e.clientY;
    if (onFirstTouch) onFirstTouch();
    e.preventDefault();
  });

  el.addEventListener('pointermove', (e) => {
    if (e.pointerId !== pointerId) return;
    input.px = e.clientX;
    input.py = e.clientY;
    // 圓心跟隨：手指拉超過半徑時，圓心被拖著走（避免長距離拖曳後失去精度）
    const dx = input.px - input.ox, dy = input.py - input.oy;
    const d = Math.hypot(dx, dy);
    if (d > MAX_R) {
      input.ox += dx * (1 - MAX_R / d);
      input.oy += dy * (1 - MAX_R / d);
    }
    e.preventDefault();
  });

  const end = (e) => {
    if (e.pointerId !== pointerId) return;
    pointerId = null;
    input.active = false;
    input.mag = 0;
  };
  el.addEventListener('pointerup', end);
  el.addEventListener('pointercancel', end);
  el.addEventListener('lostpointercapture', end);
}

export function pollInput() {
  if (!enabled) { input.x = 0; input.y = 0; input.mag = 0; return input; }
  let x = 0, y = 0;
  if (keys.has('l')) x -= 1;
  if (keys.has('r')) x += 1;
  if (keys.has('u')) y -= 1;
  if (keys.has('d')) y += 1;

  if (x || y) {
    const m = Math.hypot(x, y);
    input.x = x / m; input.y = y / m; input.mag = 1;
    return input;
  }

  if (input.active) {
    const dx = input.px - input.ox, dy = input.py - input.oy;
    const d = Math.hypot(dx, dy);
    if (d > DEAD) {
      input.x = dx / d; input.y = dy / d;
      input.mag = Math.min(1, (d - DEAD) / (MAX_R - DEAD));
      return input;
    }
  }

  input.x = 0; input.y = 0; input.mag = 0;
  return input;
}
