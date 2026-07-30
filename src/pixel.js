// ============================================================
//  精靈烘焙：把字串點陣圖轉成離屏 canvas
//  零外部圖檔，全部在執行時生成
// ============================================================

/** 全域調色盤 — 單字元索引 */
export const PAL = {
  '.': null,
  K: '#14101a',  // 硬描邊
  L: '#2a2233',  // 軟描邊 / 深陰影

  f: '#f6f1e6',  // 毛皮 / 雪 亮
  F: '#d5ccb9',  // 毛皮 中
  E: '#aca291',  // 毛皮 暗

  s: '#f4bb8c',  // 膚色
  S: '#cb8a5c',  // 膚色暗
  e: '#221a2c',  // 眼

  p: '#4d83c4',  // 大衣
  P: '#74aae8',  // 大衣亮
  d: '#315790',  // 大衣暗
  D: '#1f3c65',  // 大衣更暗

  b: '#6f4d2e',  // 皮革
  B: '#4b3320',  // 皮革暗
  w: '#8d6539',  // 木
  W: '#5f4224',  // 木暗

  y: '#fff2b0',  // 焰心
  o: '#ffa62b',  // 焰中
  r: '#ea5a1c',  // 焰緣

  m: '#cc4f4f',  // 肉
  M: '#9e3239',  // 肉暗
  n: '#ec8079',  // 肉亮
  x: '#f2e7d3',  // 骨

  G: '#ffd651',  // 金
  g: '#c9992c',  // 金暗

  c: '#9fdff0',  // 冰
  C: '#5aa8cc',  // 冰暗

  t: '#2f7a4a',  // 松綠
  T: '#1d5031',  // 松綠暗
  u: '#4aa863',  // 松綠亮

  z: '#9aa0aa',  // 岩
  Z: '#5c626e',  // 岩暗
  h: '#c3c8d1',  // 岩亮

  i: '#3a4a63',  // 金屬暗
  I: '#6d829f',  // 金屬亮

  a: '#ffb8d0',  // 粉紅（可愛系）
  A: '#e87a9f',  // 粉紅暗
  l: '#a8e8d0',  // 薄荷
  N: '#7fc9b0',  // 薄荷暗
  V: '#c8b8f0',  // 薰衣草
  U: '#9a86d8',  // 薰衣草暗

  j: '#d9a882',  // 木頭斷面（年輪亮）
  J: '#b07f5c',  // 木頭斷面（年輪暗）
  q: '#c96a4e',  // 鏽紅（背包 / 靴子）
  Q: '#8f4530',  // 鏽紅暗
  v: '#d69a52',  // 皮革亮褐（補丁 / 扣環）
};

/**
 * 把字串陣列烘成 canvas。
 * 每列自動補齊 / 截斷到 w，所以手寫時多一格少一格不會炸。
 */
export function px(w, rows, palette = PAL) {
  const h = rows.length;
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const ctx = cv.getContext('2d');
  const img = ctx.createImageData(w, h);
  const d = img.data;

  for (let y = 0; y < h; y++) {
    const row = rows[y];
    for (let x = 0; x < w; x++) {
      const ch = x < row.length ? row[x] : '.';
      const col = palette[ch];
      if (!col) continue;
      const i = (y * w + x) * 4;
      d[i]     = parseInt(col.slice(1, 3), 16);
      d[i + 1] = parseInt(col.slice(3, 5), 16);
      d[i + 2] = parseInt(col.slice(5, 7), 16);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  cv.cx = w >> 1;          // 預設錨點：底部中心
  cv.cy = h;
  return cv;
}

/**
 * 用幾何形狀組合精靈，再自動上陰影與描邊。
 * 手刻剪影對「有機體」（動物）很難控制比例，用形狀組合可靠得多。
 *
 *   shape(26, 19, ({ell, rect, put}) => { ... }, {
 *     shade: { f: ['F', 'E'] },   // 受光面 f → 半陰影 F → 深陰影 E
 *     outline: 'K',
 *   })
 */
export function shape(w, h, ops, opts = {}) {
  const grid = Array.from({ length: h }, () => new Array(w).fill('.'));
  const put = (x, y, c) => {
    x = Math.round(x); y = Math.round(y);
    if (x >= 0 && x < w && y >= 0 && y < h) grid[y][x] = c;
  };
  const ell = (cx, cy, rx, ry, c) => {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const dx = (x - cx) / rx, dy = (y - cy) / ry;
        if (dx * dx + dy * dy <= 1.0) put(x, y, c);
      }
  };
  const rect = (x0, y0, rw, rh, c) => {
    for (let y = y0; y < y0 + rh; y++) for (let x = x0; x < x0 + rw; x++) put(x, y, c);
  };
  ops({ ell, rect, put });

  const solid = (x, y) => x >= 0 && x < w && y >= 0 && y < h && grid[y][x] !== '.';

  // ---- 自動陰影：光源在左上，越接近右下邊緣越暗 ----
  if (opts.shade) {
    const src = grid.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      const c = src[y][x];
      const map = opts.shade[c];
      if (!map) continue;
      const near = !solidSrc(x + 1, y + 2) || !solidSrc(x + 2, y + 1);
      const far  = !solidSrc(x + 2, y + 4) || !solidSrc(x + 4, y + 2);
      if (near) grid[y][x] = map[1] || map[0];
      else if (far) grid[y][x] = map[0];
    }
    function solidSrc(x, y) {
      return x >= 0 && x < w && y >= 0 && y < h && src[y][x] !== '.';
    }
  }

  // ---- 自動描邊 ----
  const oc = opts.outline === undefined ? 'K' : opts.outline;
  if (oc) {
    const src = grid.map(r => r.slice());
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
      if (src[y][x] !== '.') continue;
      if ((x > 0 && src[y][x - 1] !== '.') || (x < w - 1 && src[y][x + 1] !== '.') ||
          (y > 0 && src[y - 1][x] !== '.') || (y < h - 1 && src[y + 1][x] !== '.')) {
        grid[y][x] = oc;
      }
    }
  }

  return px(w, grid.map(r => r.join('')));
}

/** 水平鏡射一張精靈 */
export function flipX(src) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.translate(src.width, 0);
  ctx.scale(-1, 1);
  ctx.drawImage(src, 0, 0);
  cv.cx = src.cx; cv.cy = src.cy;
  return cv;
}

/** 產生一張整體染色的版本（用於受擊閃白、無敵閃爍） */
export function tint(src, color, alpha = 1) {
  const cv = document.createElement('canvas');
  cv.width = src.width; cv.height = src.height;
  const ctx = cv.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(src, 0, 0);
  ctx.globalCompositeOperation = 'source-atop';
  ctx.globalAlpha = alpha;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, cv.width, cv.height);
  cv.cx = src.cx; cv.cy = src.cy;
  return cv;
}

// ============================================================
//  4x6 點陣字（數字與符號）— 世界內漂浮數字用
// ============================================================
const FONT_ROWS = {
  '0': ['.##.', '#..#', '#..#', '#..#', '#..#', '.##.'],
  '1': ['..#.', '.##.', '..#.', '..#.', '..#.', '.###'],
  '2': ['.##.', '#..#', '...#', '..#.', '.#..', '####'],
  '3': ['###.', '...#', '.##.', '...#', '#..#', '.##.'],
  '4': ['..#.', '.##.', '#.#.', '####', '..#.', '..#.'],
  '5': ['####', '#...', '###.', '...#', '#..#', '.##.'],
  '6': ['.##.', '#...', '###.', '#..#', '#..#', '.##.'],
  '7': ['####', '...#', '..#.', '..#.', '.#..', '.#..'],
  '8': ['.##.', '#..#', '.##.', '#..#', '#..#', '.##.'],
  '9': ['.##.', '#..#', '#..#', '.###', '...#', '.##.'],
  '$': ['..#.', '.###', '##..', '..##', '###.', '..#.'],
  '+': ['....', '..#.', '.###', '..#.', '....', '....'],
  '-': ['....', '....', '.###', '....', '....', '....'],
  '.': ['....', '....', '....', '....', '.##.', '.##.'],
  ',': ['....', '....', '....', '.##.', '.##.', '.#..'],
  '%': ['#..#', '..#.', '.#..', '.#..', '#...', '#..#'],
  '/': ['...#', '..#.', '..#.', '.#..', '#...', '#...'],
  'K': ['#..#', '#.#.', '##..', '#.#.', '#..#', '#..#'],
  'M': ['#..#', '####', '####', '#..#', '#..#', '#..#'],
  'L': ['#...', '#...', '#...', '#...', '#...', '####'],
  'V': ['#..#', '#..#', '#..#', '#..#', '.##.', '..#.'],
  'A': ['.##.', '#..#', '#..#', '####', '#..#', '#..#'],
  'X': ['#..#', '#..#', '.##.', '.##.', '#..#', '#..#'],
  'x': ['....', '....', '#..#', '.##.', '#..#', '....'],
  '!': ['.##.', '.##.', '.##.', '.##.', '....', '.##.'],
  ' ': ['....', '....', '....', '....', '....', '....'],
};

const glyphCache = new Map();

function glyph(ch, color) {
  const key = ch + color;
  let g = glyphCache.get(key);
  if (g) return g;
  const rows = FONT_ROWS[ch] || FONT_ROWS[' '];
  const pal = { '.': null, '#': color };
  g = px(4, rows, pal);
  glyphCache.set(key, g);
  return g;
}

export function textWidth(str) {
  return str.length * 5 - 1;
}

/** 在 ctx 上畫點陣文字，(x,y) 為左上角。帶 1px 描邊。 */
export function drawText(ctx, str, x, y, color = '#ffffff', outline = '#14101a') {
  x = Math.round(x); y = Math.round(y);
  if (outline) {
    for (let i = 0; i < str.length; i++) {
      const g = glyph(str[i], outline);
      const gx = x + i * 5;
      ctx.drawImage(g, gx - 1, y); ctx.drawImage(g, gx + 1, y);
      ctx.drawImage(g, gx, y - 1); ctx.drawImage(g, gx, y + 1);
    }
  }
  for (let i = 0; i < str.length; i++) {
    ctx.drawImage(glyph(str[i], color), x + i * 5, y);
  }
}

export function drawTextC(ctx, str, cx, y, color, outline) {
  drawText(ctx, str, cx - textWidth(str) / 2, y, color, outline);
}

/** 大數字縮寫：1234 -> 1.2K */
export function abbr(n) {
  n = Math.floor(n);
  if (n < 1000) return '' + n;
  if (n < 1e6) return (n / 1e3).toFixed(n < 1e4 ? 1 : 0) + 'K';
  if (n < 1e9) return (n / 1e6).toFixed(n < 1e7 ? 1 : 0) + 'M';
  return (n / 1e9).toFixed(1) + 'B';
}
