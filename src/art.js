// ============================================================
//  所有精靈定義。字元對照見 pixel.js 的 PAL。
//  錨點慣例：cx = 寬/2，cy = 高（腳底），繪製時對齊實體座標。
// ============================================================
import { px, shape, flipX, PAL } from './pixel.js';

const A = {};

// ---------- 獵人（面向右）16x20 ----------
const hunterBase = [
  '.....KKKKKK.....',
  '...KKffffffKK...',
  '..KffFFFFFFffK..',
  '..KfFssssssSFK..',
  '..KfFsesssSSFK..',
  '..KfFssssssSFK..',
  '..KfFSsssSSFfK..',
  '...KffFFFFffK...',
  '....KKbbbbKK....',
  '...KpPPPPPPpK...',
  '..KdpPPPPPPPpK..',
  '..KdpPPPPPPPpK..',
  '..KdpPbbbbbPpK..',
  '..KdpPBBBBBPpK..',
  '..KddpPPPPPpdK..',
  '...KddpppppdK...',
];
A.hunterIdle = px(16, [
  ...hunterBase,
  '....Kdd.ddK.....',
  '....Kdd.ddK.....',
  '....KbB.bBK.....',
  '....KBB.BBK.....',
  '.....KK.KK......',
]);
A.hunterWalkA = px(16, [
  ...hunterBase,
  '...Kdd...ddK....',
  '...Kdd....ddK...',
  '...KbB....bBK...',
  '...KBB....BBK...',
  '....KK.....KK...',
]);
A.hunterWalkB = px(16, [
  ...hunterBase,
  '....Kdd..ddK....',
  '.....Kdd.ddK....',
  '.....KbBbBK.....',
  '.....KBBBBK.....',
  '......KKKK......',
]);
A.hunterWalkA_L = flipX(A.hunterWalkA);
A.hunterWalkB_L = flipX(A.hunterWalkB);
A.hunterIdle_L  = flipX(A.hunterIdle);

// ---------- 火把（獨立精靈，跟著手臂位移）7x11 ----------
A.torch = [
  px(7, [
    '...y...',
    '..yoy..',
    '.yooor.',
    '.roooy.',
    '..ror..',
    '...r...',
    '..KwK..',
    '..KwK..',
    '..KWK..',
    '..KWK..',
    '..KKK..',
  ]),
  px(7, [
    '..y....',
    '.yoy...',
    'yoooyr.',
    '.rooor.',
    '..roo..',
    '...r...',
    '..KwK..',
    '..KwK..',
    '..KWK..',
    '..KWK..',
    '..KKK..',
  ]),
  px(7, [
    '....y..',
    '...yoy.',
    '.ryoooy',
    '.rooor.',
    '..oor..',
    '...r...',
    '..KwK..',
    '..KwK..',
    '..KWK..',
    '..KWK..',
    '..KKK..',
  ]),
];

// ---------- 北極熊（面向右）26x18 ----------
//  重點：肩隆起、脖子下傾、明顯的吻部與黑鼻、小圓耳、四條粗腿
//  側面：拱起的背 + 掛在右前下方的頭 + 突出吻部。用形狀組合以控制比例。
//  三種變體共用同一組幾何，只換縮放與毛色。
function bear(legPhase, s = 1, fur = 'f', dark = 'F') {
  const W = Math.round(27 * s), H = Math.round(20 * s);
  const k = (v) => v * s;
  return shape(W, H, ({ ell, rect, put }) => {
    const back = legPhase ? k(1) : 0;
    // 遠側的腳（先畫，顏色較深）
    rect(Math.round(k(6) + back), Math.round(k(13)), Math.max(2, Math.round(k(3))), Math.round(k(6)), dark === 'F' ? 'E' : 'L');
    rect(Math.round(k(18) + back), Math.round(k(13)), Math.max(2, Math.round(k(3))), Math.round(k(6)), dark === 'F' ? 'E' : 'L');
    // 身體：臀部 + 肩隆起
    ell(k(7), k(8.5), k(7), k(5.5), fur);
    ell(k(12), k(7.5), k(7.5), k(5.5), fur);
    // 脖子（往右下傾）
    ell(k(17), k(10), k(4), k(4), fur);
    // 頭
    ell(k(21), k(12), k(4.2), k(3.8), fur);
    // 吻部
    ell(k(24.5), k(13), k(2.4), k(2.2), fur);
    // 耳朵
    ell(k(18.5), k(7.6), k(2), k(2), fur);
    // 近側的腳
    rect(Math.round(k(3) - back), Math.round(k(13)), Math.max(2, Math.round(k(3))), Math.round(k(6)), fur);
    rect(Math.round(k(15) - back), Math.round(k(13)), Math.max(2, Math.round(k(3))), Math.round(k(6)), fur);
    // 眼
    const ex = Math.round(k(20)), ey = Math.round(k(11));
    put(ex, ey, 'e'); put(ex + 1, ey, 'e');
    put(ex, ey + 1, 'e'); put(ex + 1, ey + 1, 'e');
    // 黑鼻
    const nx = Math.round(k(24)), ny = Math.round(k(12));
    for (let x = nx; x <= nx + Math.max(1, Math.round(k(2))); x++) { put(x, ny, 'e'); put(x, ny + 1, 'e'); }
  }, { shade: { [fur]: [dark, dark === 'F' ? 'E' : 'L'] } });
}

//  成年熊（標準）
A.bearA = bear(0);
A.bearB = bear(1);
//  幼熊：小、快、脆
A.cubA = bear(0, 0.68);
A.cubB = bear(1, 0.68);
//  狂暴熊：大、毛色髒、慢但重
A.rageA = bear(0, 1.18, 'F', 'E');
A.rageB = bear(1, 1.18, 'F', 'E');

export const BEAR_SPRITES = {
  cub:   [A.cubA, A.cubB],
  adult: [A.bearA, A.bearB],
  rage:  [A.rageA, A.rageB],
};
A.bearA_L = flipX(A.bearA);
A.bearB_L = flipX(A.bearB);

// ---------- 肉塊 10x8 ----------
A.meat = px(10, [
  '..KKKK....',
  '.KnnmmK...',
  'KnmmmmmK..',
  'KmmmmmmmK.',
  'KMmmmmmmK.',
  '.KMmmmMK..',
  '..KxxxK...',
  '...KKK....',
]);

// ---------- 金幣 8x8（3 幀旋轉）----------
A.coin = [
  px(8, [
    '..KKKK..',
    '.KGGGGK.',
    'KGyyGGGK',
    'KGyGGGgK',
    'KGGGGGgK',
    'KgGGGggK',
    '.KgggK..',
    '..KKK...',
  ]),
  px(8, [
    '...KK...',
    '..KGGK..',
    '..KyGK..',
    '..KyGK..',
    '..KGgK..',
    '..KGgK..',
    '..KggK..',
    '...KK...',
  ]),
  px(8, [
    '..KKKK..',
    '.KgggGK.',
    'KggGGGyK',
    'KgGGGyyK',
    'KgGGGGGK',
    'KggGGGGK',
    '.KgggK..',
    '..KKK...',
  ]),
];

// ---------- 營火（3 幀）20x18 ----------
function fire(f) {
  return px(20, [
    '.........y..........',
    '........yoy.........',
    f === 0 ? '.......yooy.........' : f === 1 ? '........yoo.........' : '.......yoyo.........',
    '......yooooy........',
    f === 0 ? '.....rooooooy.......' : f === 1 ? '.....yooooooo.......' : '.....rooooooy.......',
    '.....rooyyooy.......',
    '....rooyyyyoor......',
    f === 1 ? '....rooyyyyooor.....' : '....roooyyyooor.....',
    '...rrooooyoooor.....',
    '...rrrooooooorr.....',
    '....rrrooooorr......',
    '.....rrrrrrr........',
    '..KWwwWKKKKWwwWK....',
    '.KWwwwwWKKWwwwwWK...',
    'KWwwWKKWwwWKKWwwWK..',
    '.KWWKKKWWWKKKWWK....',
    '..KKZzZKKKZzZKK.....',
    '....KKKKKKKKK.......',
  ]);
}
A.campfire = [fire(0), fire(1), fire(2)];

// ---------- 未點燃火堆 20x11 ----------
A.firepitCold = px(20, [
  '....................',
  '.......KKKK.........',
  '.....KKWwwWKK.......',
  '...KKWwwWKKWwwWKK...',
  '..KWwwWKKKKKKWwwWK..',
  '.KWwWKKZzzzZKKWwWK..',
  '.KWWKKZzzzzzZKKWWK..',
  '..KKZzZzzzzzZzZKK...',
  '.KZzzZZzzzzzZZzzZK..',
  '.KZZZZZZZZZZZZZZZK..',
  '..KKKKKKKKKKKKKKK...',
]);

// ---------- 松樹 16x26 ----------
A.tree = px(16, [
  '.......KK.......',
  '......KuuK......',
  '......KttK......',
  '.....KuttuK.....',
  '.....KttttK.....',
  '....KuttttuK....',
  '....KtTttTtK....',
  '...KuttttttuK...',
  '...KttTttTttK...',
  '..KuttttttttuK..',
  '..KtTttttttTtK..',
  '.KuttttttttttuK.',
  '.KttTttttttTttK',
  'KuttttttttttttuK',
  'KtTttttttttttTtK',
  '.KTtttttttttTK..',
  '..KTTtttttTTK...',
  '...KKTTTTTKK....',
  '.....KWwWK......',
  '.....KWwWK......',
  '.....KWwWK......',
  '.....KWwWK......',
  '....KWWwWWK.....',
  '...KWfffffWK....',
  '..KffffffffK....',
  '...KKKKKKKK.....',
]);

// ---------- 岩石 14x11 ----------
A.rock = px(14, [
  '.....KKKK.....',
  '...KKhhhhKK...',
  '..KhhhzzzzK...',
  '.KhhzzzzzzzK..',
  'KhzzzzzzzzzZK.',
  'KzzzzzzzzzZZK.',
  'KzzzzzzzZZZZK.',
  '.KzzzZZZZZZK..',
  '.KZZZZZZZZZK..',
  '..KKZZZZZKK...',
  '....KKKKK.....',
]);

// ---------- 熊窩（領地中心）26x16 ----------
//  地圖上看得見的獵場熱點：熊會聚集在這附近
A.bearDen = shape(26, 16, ({ ell, rect, put }) => {
  ell(13, 12, 12.5, 6, 'f');           // 雪堆
  ell(8, 9, 6, 4, 'f');
  ell(18, 9.5, 5, 3.5, 'f');
  ell(13, 13.5, 5.5, 3.5, 'L');        // 洞口
  ell(13, 14.5, 4, 2.5, 'K');
  // 洞口旁的骨頭
  put(4, 14, 'x'); put(5, 14, 'x'); put(6, 14, 'x');
  put(4, 13, 'x'); put(6, 15, 'x');
  put(21, 14, 'x'); put(22, 14, 'x'); put(22, 15, 'x');
}, { shade: { f: ['F', 'E'] } });

// ---------- 冰晶 12x12 ----------
A.iceShard = px(12, [
  '.....KK.....',
  '....KccK....',
  '....KccK....',
  '...KccccK...',
  '..KcccccCK..',
  '.KccccCCCK..',
  '.KcccCCCCK..',
  '.KccCCCCCK..',
  '..KCCCCCK...',
  '..KCCCCK....',
  '...KCCK.....',
  '....KK......',
]);

// ---------- 帳篷 26x20（頂上積雪 + 深色門洞）----------
A.tent = px(26, [
  '............KK............',
  '...........KffK...........',
  '..........KffffK..........',
  '.........KfPPPPfK.........',
  '........KpPPPPPPpK........',
  '.......KpPPPPPPPPpK.......',
  '......KpPPPPPPPPPPpK......',
  '.....KpPPPPPKKPPPPPpK.....',
  '....KpPPPPPKDDKPPPPPpK....',
  '...KpPPPPPKDDDDKPPPPPpK...',
  '..KpPPPPPKDDDDDDKPPPPPpK..',
  '.KpPPPPPKDDDDDDDDKPPPPPpK.',
  'KpPPPPPKDDDDDDDDDDKPPPPPpK',
  'KpPPPPKDDDDDDDDDDDDKPPPPpK',
  'KpPPPKDDDDDDDDDDDDDDKPPPpK',
  'KdppPKDDDDDDDDDDDDDDKPppdK',
  'KddpPKDDDDDDDDDDDDDDKPpddK',
  'KdddpKDDDDDDDDDDDDDDKpdddK',
  'KKKKKKKKKKKKKKKKKKKKKKKKKK',
  '.KKKKKKKKKKKKKKKKKKKKKKKK.',
]);

// ---------- 販賣攤 24x22 ----------
A.stall = px(24, [
  '..KKKKKKKKKKKKKKKKKKKK..',
  '.KmmmmffffmmmmffffmmmmK.',
  '.KMMMMffffMMMMffffMMMMK.',
  '.KKKKKKKKKKKKKKKKKKKKKK.',
  '..KwWK............KwWK..',
  '..KwWK............KwWK..',
  '..KwWK...KGGGK....KwWK..',
  '..KwWK..KGyyGGK...KwWK..',
  '..KwWK..KGyGGgK...KwWK..',
  '..KwWK..KGGGggK...KwWK..',
  '..KwWK...KgggK....KwWK..',
  '..KwWK............KwWK..',
  '.KKwwWKKKKKKKKKKKKwwWKK.',
  'KwwwwwwwwwwwwwwwwwwwwwwK',
  'KWWWWWWWWWWWWWWWWWWWWWWK',
  'KwwwwwwwwwwwwwwwwwwwwwwK',
  'KWWWWWWWWWWWWWWWWWWWWWWK',
  'KKKKKKKKKKKKKKKKKKKKKKKK',
  '.KwWK............KwWK...',
  '.KwWK............KwWK...',
  '.KWWK............KWWK...',
  '.KKKK............KKKK...',
]);

// ---------- 升級圖騰底座 22x14（圖示疊在上面）----------
A.padPost = px(22, [
  '..KKKKKKKKKKKKKKKKKK..',
  '.KwwwwwwwwwwwwwwwwwwK.',
  'KwwWWWWWWWWWWWWWWWWwwK',
  'KwWWWWWWWWWWWWWWWWWWwK',
  'KwwwwwwwwwwwwwwwwwwwwK',
  '.KWWWWWWWWWWWWWWWWWWK.',
  '..KKKKKKKKKKKKKKKKKK..',
  '.......KwWK...........',
  '.......KwWK...........',
  '.......KWWK...........',
  '......KKWWKK..........',
  '.....KZzzzzZK.........',
  '....KZZzzzzZZK........',
  '.....KKKKKKKK.........',
]);

// ---------- 升級圖示 12x12 ----------
A.icoCap = px(12, [   // 背包（提把 + 翻蓋 + 前袋銅扣）
  '....KKKK....',
  '...KvBBvK...',
  '..KKKKKKKK..',
  '.KQqqqqqqQK.',
  'KQqqqqqqqqQK',
  'KQqqvvvvqqQK',
  'KQqKKKKKKqQK',
  'KQqKqqqqKqQK',
  'KQqKvKKvKqQK',
  'KQqKqqqqKqQK',
  '.KQKKKKKKQK.',
  '..KKKKKKKK..',
]);
A.icoSpeed = px(12, [ // 登山靴：L 形剪影 + 亮色鞋底（深色鞋底在小圖上會糊掉）
  '...KKKK.....',
  '..KqqqqK....',
  '..KqvvqK....',
  '..KqqqqK....',
  '..KqqqqK....',
  '..KqqqqK....',
  '..KqqqqqK...',
  '..KqqqqqqK..',
  '..KqqqqqqqK.',
  '..KqqqqqqqqK',
  '.KvvvvvvvvvK',
  '.KKKKKKKKKKK',
]);
A.icoPower = px(12, [ // 火把
  '....y.......',
  '...yoy......',
  '..yooor.....',
  '..rooy......',
  '...ro.......',
  '...KwK......',
  '...KwK......',
  '....KwK.....',
  '....KWK.....',
  '.....KWK....',
  '.....KWK....',
  '......KK....',
]);
A.icoVigor = px(12, [ // 體魄：心臟（帶高光，跟血條同色系）
  '.KK....KK...',
  'KmmKKKKmmK..',
  'KmnmmmmmnmK.',
  'KmnmmmmmmmK.',
  'KmnmmmmmmmK.',
  'KMmmmmmmmmK.',
  '.KMmmmmmmK..',
  '..KMmmmmK...',
  '...KMmmK....',
  '....KMK.....',
  '.....K......',
  '............',
]);
A.icoWarm = px(12, [  // 大衣（毛領 + 拉鍊）
  '..KKKKKKKK..',
  '.KffffffffK.',
  '.KFFFFFFFFK.',
  'KpPPPPPPPPpK',
  'KpPPPKKPPPpK',
  'KpPPPKKPPPpK',
  'KpPPPKKPPPpK',
  'KpPPPKKPPPpK',
  'KdpPPKKPPpdK',
  'KddppKKppddK',
  '.KdddddddK..',
  '..KKKKKKK...',
]);

// ---------- 心/雪花粒子 5x5 ----------
A.snowflake = px(5, [
  '..c..',
  '.ccc.',
  'ccccc',
  '.ccc.',
  '..c..',
]);

// ============================================================
//  武器（一路升級上去）
// ============================================================
A.wpTorch = A.torch;                       // 已在上面定義（3 幀火焰）

A.wpKnife = [px(7, [                       // 骨刀
  '....K..',
  '...KxK.',
  '..KxxK.',
  '..KxxK.',
  '.KxxfK.',
  '.KxfxK.',
  '.KxxxK.',
  '.KKxKK.',
  '..KwK..',
  '..KwK..',
  '..KWK..',
  '..KKK..',
])];

A.wpSpear = [px(7, [                       // 獵矛
  '...K...',
  '..KcK..',
  '..KcK..',
  '.KcCcK.',
  '.KcCcK.',
  '.KKCKK.',
  '..KwK..',
  '..KwK..',
  '..KWK..',
  '..KwK..',
  '..KWK..',
  '..KwK..',
  '..KWK..',
  '..KWK..',
  '..KKK..',
])];

A.wpAxe = [px(13, [                        // 戰斧
  '....KKKKK....',
  '...KhhhzzK...',
  '..KhhzzzzZK..',
  '.KhzzzzzzZZK.',
  'KhzzzKKKzZZZK',
  'KhzzK...KZZZK',
  'KhzK.....KZZK',
  '.KK..KwK..KK.',
  '.....KwK.....',
  '.....KWK.....',
  '.....KwK.....',
  '.....KWK.....',
  '.....KKK.....',
])];

A.wpBlade = [px(9, [                       // 極光劍
  '....K....',
  '...KcK...',
  '...KcK...',
  '..KcccK..',
  '..KcCcK..',
  '..KcCcK..',
  '..KcCcK..',
  '..KcCcK..',
  '..KcCcK..',
  '.KKCCCKK.',
  'KGGGGGGGK',
  '.KKKwKKK.',
  '...KwK...',
  '...KWK...',
  '...KKK...',
])];

// ============================================================
//  顧客（三種顏色）
// ============================================================
function customer(coat, coatHi, coatDark, hat) {
  return px(14, [
    '....KKKKKK....',
    '...K' + hat + hat + hat + hat + hat + hat + 'K...',
    '..KfFFFFFFfK..',
    '..KfsssssSfK..',
    '..KfsesssSfK..',
    '..KfsssssSfK..',
    '...KfFFFFfK...',
    '...K' + coat + coatHi + coatHi + coatHi + coat + 'K...',
    '..K' + coat + coatHi + coatHi + coatHi + coatHi + coat + coatDark + 'K..',
    '..K' + coat + coatHi + coatHi + coatHi + coatHi + coat + coatDark + 'K..',
    '..K' + coat + coatHi + 'bbb' + coat + coatDark + 'K..',
    '..K' + coatDark + coat + coatHi + coatHi + coat + coatDark + coatDark + 'K..',
    '...K' + coatDark + coat + coat + coat + coatDark + 'K...',
    '....K' + coatDark + 'K.' + coatDark + 'K....',
    '....KbK.KbK...',
    '....KBK.KBK...',
    '.....K...K....',
  ]);
}
A.customers = [
  customer('m', 'n', 'M', 'f'),   // 紅
  customer('t', 'u', 'T', 'F'),   // 綠
  customer('b', 'w', 'B', 'f'),   // 棕
];

//  顧客頭上的需求泡泡
A.wantBubble = px(20, [
  '..KKKKKKKKKKKKKK....',
  '.KffffffffffffffK...',
  'KffffffffffffffffK..',
  'KffffffffffffffffK..',
  'KffffffffffffffffK..',
  'KffffffffffffffffK..',
  '.KffffffffffffffK...',
  '..KKKffKKKKKKKKK....',
  '.....KfK............',
  '......KK............',
]);

// ============================================================
//  現金與金條
// ============================================================
A.bill = px(12, [
  '.KKKKKKKKKK.',
  'KtuuuuuuuutK',
  'KuGGGGGGGGuK',
  'KuGGtuutGGuK',
  'KuGGuGGuGGuK',
  'KuGGtuutGGuK',
  'KuGGGGGGGGuK',
  'KtuuuuuuuutK',
  '.KKKKKKKKKK.',
]);
A.goldBar = px(14, [
  '...KKKKKKKK...',
  '..KyyyyyyyyK..',
  '.KyGGGGGGGGyK.',
  'KyGGGGGGGGGGyK',
  'KGGGGGGGGGGGgK',
  'KgGGGGGGGGGggK',
  'KggggggggggggK',
  '.KKKKKKKKKKKK.',
]);

// ============================================================
//  據點建築
// ============================================================
//  貨架（肉會堆在上面）
A.shelf = px(34, [
  '..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..',
  '.KwwwwwwwwwwwwwwwwwwwwwwwwwwwwK.',
  'KwWWWWWWWWWWWWWWWWWWWWWWWWWWWWwK',
  'KwwwwwwwwwwwwwwwwwwwwwwwwwwwwwwK',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWWWWWK.',
  '..KKwWK................KwWKKK...',
  '....KwK................KwK......',
  '....KwK................KwK......',
  '..KKwwKKKKKKKKKKKKKKKKKwwKK.....',
  '.KwwwwwwwwwwwwwwwwwwwwwwwwwK....',
  'KwWWWWWWWWWWWWWWWWWWWWWWWWWWK...',
  'KwwwwwwwwwwwwwwwwwwwwwwwwwwwK...',
  '.KWWWWWWWWWWWWWWWWWWWWWWWWWK....',
  '..KKwWK................KwWK.....',
  '....KwK................KwK......',
  '....KWK................KWK......',
  '....KKK................KKK......',
]);

//  收銀台
A.counter = px(26, [
  '.KKKKKKKKKKKKKKKKKKKKKKKK.',
  'KwwwwwwwwwwwwwwwwwwwwwwwwK',
  'KwWWWWWWWWWWWWWWWWWWWWWWwK',
  'KwwwwwwwwwwwwwwwwwwwwwwwwK',
  'KWWWWWWWWWWWWWWWWWWWWWWWWK',
  'KwWK..KGGGGGGGGGGK...KwWKK',
  'KwWK..KGyyyyyyyGGK...KwWK.',
  'KwWK..KGGGGGGGGGgK...KwWK.',
  'KwWK..KKKKKKKKKKKK...KwWK.',
  'KwWK.................KwWK.',
  'KWWK.................KWWK.',
  'KKKK.................KKKK.',
]);

//  箭塔四階：木哨塔 → 石塔 → 鐵弩塔 → 極光塔
//  四階共用同一個剪影（高腳架 + 中央梯子 + 平台欄杆），只換材質與頂飾，
//  所以升級時「還是我的塔，但變強了」一眼看得出來。塔刻意做得比人高很多。
function watchtower(tier) {
  //  每階 [主色, 暗面]。鐵塔刻意用深色當主色 —— 夾在亮灰石塔與發光極光塔
  //  之間，剪影明暗才拉得開，遠遠就看得出自己升到第幾階。
  const [L, D] = [['w', 'W'], ['z', 'Z'], ['i', 'I'], ['c', 'C']][tier];
  const W = 26, H = 38;
  return shape(W, H, ({ rect }) => {
    // ---- 頂飾：每一階都不同，遠遠就看得出等級 ----
    if (tier === 1) {                                   // 石塔：旗
      rect(12, 0, 2, 6, 'W'); rect(14, 1, 6, 3, 'm'); rect(14, 3, 6, 1, 'M');
    } else if (tier === 2) {                            // 鐵弩塔：弩臂
      rect(12, 0, 2, 5, 'i');
      rect(4, 3, 18, 1, 'I'); rect(3, 1, 1, 4, 'I'); rect(22, 1, 1, 4, 'I');
    } else if (tier === 3) {                            // 極光塔：懸浮晶體
      rect(12, 0, 2, 6, 'c'); rect(11, 1, 4, 4, 'C'); rect(12, 2, 2, 2, 'y');
    }

    // ---- 平台欄杆 ----
    rect(1, 5, 24, 2, L);
    for (let x = 2; x < 24; x += 4) rect(x, 7, 2, 3, D);

    // ---- 甲板 ----
    rect(0, 10, 26, 2, L);
    rect(0, 12, 26, 2, D);

    // ---- 腳架（往下外八）+ 中央梯子 + 交叉橫撐 ----
    for (let i = 0; i < 20; i++) {
      const y = 14 + i;
      const s = Math.floor(i / 5);
      rect(5 - s, y, 2, 1, L);  rect(7 - s, y, 1, 1, D);
      rect(18 + s, y, 2, 1, L); rect(20 + s, y, 1, 1, D);
      if (i % 3 === 1) rect(11, y, 4, 1, L);            // 梯子橫木
      else { rect(11, y, 1, 1, L); rect(14, y, 1, 1, L); }
      if (i === 6 || i === 14) rect(6 - s, y, 14 + s * 2, 1, D);
    }

    // ---- 石基座 ----
    rect(1, 34, 5, 3, 'z');  rect(1, 36, 5, 1, 'Z');
    rect(20, 34, 5, 3, 'z'); rect(20, 36, 5, 1, 'Z');
  });
}
A.towers = [watchtower(0), watchtower(1), watchtower(2), watchtower(3)];
A.tower = A.towers[0];

//  圍牆：三根尖頭柵欄 + 一道橫樑，柱頂積雪（沿著營地邊界排列）
A.wallPost = shape(14, 17, ({ rect }) => {
  for (let i = 0; i < 3; i++) {
    const x = 1 + i * 5;
    rect(x, 2, 2, 14, 'w');      // 柱身
    rect(x + 1, 2, 1, 14, 'W');  // 暗面
    rect(x, 1, 1, 1, 'w');       // 尖頭
    rect(x, 0, 1, 1, 'f');       // 積雪
  }
  rect(0, 6, 13, 2, 'w');        // 橫樑
  rect(0, 8, 13, 1, 'W');
});

//  幫手：搬運工（拉雪橇）與獵人助手
A.hauler = px(14, [
  '....KKKKKK....',
  '...KffffffK...',
  '..KfFFFFFFfK..',
  '..KfsssssSfK..',
  '..KfsesssSfK..',
  '...KfFFFFfK...',
  '...KtuuuutK...',
  '..KtuuuuuutK..',
  '..KtuuuuuutK..',
  '..KtubbbuTtK..',
  '..KTtuuuuTTK..',
  '...KTtttTTK...',
  '....KTK.KTK...',
  '....KbK.KbK...',
  '....KBK.KBK...',
  '.....K...K....',
]);
A.helperHunter = px(14, [
  '....KKKKKK....',
  '...KffffffK...',
  '..KfFFFFFFfK..',
  '..KfsssssSfK..',
  '..KfsesssSfK..',
  '...KfFFFFfK...',
  '...KmnnnnmK...',
  '..KmnnnnnnmK..',
  '..KmnnnnnnmK..',
  '..KmnbbbnMmK..',
  '..KMmnnnnMMK..',
  '...KMmmmMMK...',
  '....KMK.KMK...',
  '....KbK.KbK...',
  '....KBK.KBK...',
  '.....K...K....',
]);

//  伐木工：綠格子外套 + 肩上的斧頭
A.chopperMan = px(14, [
  '....KKKKKK....',
  '...KffffffK...',
  '..KfFFFFFFfK..',
  '..KfsssssSfK..',
  '..KfsesssSfK..',
  '...KfFFFFfK...',
  '...KtuTutTK.K.',
  '..KtuTutTutKzK',
  '..KuTutTutuKzK',
  '..KtubbbuTtKK.',
  '..KTtuuuuTTK..',
  '...KTtttTTK...',
  '....KTK.KTK...',
  '....KbK.KbK...',
  '....KBK.KBK...',
  '.....K...K....',
]);

//  收銀機器人：方頭 + 天線 + 胸口的金幣槽（刻意做成一眼認得出的機器人剪影）
A.robotUnit = px(14, [
  '......K.......',
  '.....KyK......',
  '.....KIK......',
  '..KKKKKKKKK...',
  '..KIiiiiiiIK..',
  '..KIcKIIKcIK..',   // 兩顆發光的眼
  '..KIiiiiiiIK..',
  '..KKIIIIIIKK..',
  '.KIiiiiiiiiIK.',
  '.KIiKGGGGKiIK.',   // 胸口的金幣槽
  '.KIiKGyyGKiIK.',
  '.KIiKGGGGKiIK.',
  '.KIiiiiiiiiIK.',
  '.KKIIIIIIIIKK.',
  '..KIK....KIK..',
  '..KKK....KKK..',
]);

//  遠征營帳（轉生入口）
A.prestigeTent = px(22, [
  '..........KK..........',
  '.........KccK.........',
  '........KcCCcK........',
  '.......KcCCCCcK.......',
  '......KcCCCCCCcK......',
  '.....KcCCCCCCCCcK.....',
  '....KcCCCKKKKCCCcK....',
  '...KcCCCKGGGGKCCCcK...',
  '..KcCCCKGyyyyGKCCCcK..',
  '.KcCCCKGyGGGGyGKCCCcK.',
  'KcCCCKGyGGGGGGyGKCCCcK',
  'KcCCKGGGGGGGGGGGGKCCcK',
  'KcCKGGGGGGGGGGGGGGKCcK',
  'KCKGGGGGGGGGGGGGGGGKCK',
  'KKGGGGGGGGGGGGGGGGGGKK',
  'KGGGGGGGGGGGGGGGGGGGGK',
  'KKKKKKKKKKKKKKKKKKKKKK',
]);

//  建設台圖示
A.icoBuild = px(12, [
  '...KKKKKK...',
  '..KwWwWwWK..',
  '.KwWwWwWwWK.',
  'KwWwWwWwWwWK',
  'KKKKKKKKKKKK',
  'KwWwWwWwWwWK',
  'KwWwWwWwWwWK',
  'KKKKKKKKKKKK',
  'KwWwWwWwWwWK',
  'KwWwWwWwWwWK',
  '.KWWWWWWWWK.',
  '..KKKKKKKK..',
]);
A.icoWeapon = px(12, [
  '.......KKK..',
  '......KcCK..',
  '.....KcCK...',
  '....KcCK....',
  '...KcCK.....',
  '..KcCK......',
  '.KKCK.......',
  'KGGGK.......',
  'KKwKK.......',
  '..KwK.......',
  '..KWK.......',
  '..KKK.......',
]);

// ---------- 建設台圖示 12x12 ----------
A.icoShelf = px(12, [
  'KKKKKKKKKKKK',
  'KwwwwwwwwwwK',
  'KWWWWWWWWWWK',
  'K.K......K.K',
  'K.K.mmmm.K.K',
  'KKKKKKKKKKKK',
  'KwwwwwwwwwwK',
  'KWWWWWWWWWWK',
  'K.K......K.K',
  'K.K.mmmm.K.K',
  'KKKKKKKKKKKK',
  '............',
]);
A.icoCounter = px(12, [
  '............',
  '.KKKKKKKKKK.',
  'KwwwwwwwwwwK',
  'KWWWWWWWWWWK',
  'KwK.KGGK.KwK',
  'KwK.KGyK.KwK',
  'KwK.KKKK.KwK',
  'KwK......KwK',
  'KWK......KWK',
  'KKK......KKK',
  '............',
  '............',
]);
A.icoWall = px(12, [   // 尖頭柵欄（跟實際圍牆同款）
  '.K..K..K..K.',
  'KwK.KwK.KwK.',
  'KwWKKwWKKwWK',
  'KKKKKKKKKKKK',
  'KwwwwwwwwwwK',
  'KWWWWWWWWWWK',
  'KKKKKKKKKKKK',
  'KwWKKwWKKwWK',
  'KwWKKwWKKwWK',
  'KwWKKwWKKwWK',
  'KWWKKWWKKWWK',
  '.KK..KK..KK.',
]);
A.icoTower = px(12, [  // 高腳哨塔（跟實際箭塔同剪影）
  '.KKKKKKKKKK.',
  'KwwwwwwwwwwK',
  'KWKKWKKWKKWK',
  'KKKKKKKKKKKK',
  'KwwwwwwwwwwK',
  'KWWWWWWWWWWK',
  'KKKKKKKKKKKK',
  '.KwWKKwWK...',
  '.KwWKKwWK...',
  'KwWKKKKKwWK.',
  'KwWK...KwWK.',
  'KKK.....KKK.',
]);
A.icoHauler = px(12, [
  '...KKKK.....',
  '..KffffK....',
  '..KfsesK....',
  '...KFFK.....',
  '..KtuuutK...',
  '..KtuuutK...',
  '...KTTK.....',
  '...KK.KK....',
  '.KKKKKKKKK..',
  'KwwwwwwwwwK.',
  'KWWWWWWWWWK.',
  '.KK.....KK..',
]);
A.icoHunter = px(12, [
  '...KKKK...K.',
  '..KffffK.KcK',
  '..KfsesK.KcK',
  '...KFFK.KCK.',
  '..KmnnnmK...',
  '..KmnnnmKw..',
  '..KmnbnmKw..',
  '..KMmmmMKW..',
  '...KMKKMK...',
  '...KbK.KbK..',
  '...KBK.KBK..',
  '....K...K...',
]);
A.icoMark = px(12, [
  '.....KK.....',
  '....KccK....',
  '...KcCCcK...',
  '..KcCCCCcK..',
  '.KcCCGGCCcK.',
  'KcCCGyyGCCcK',
  'KcCCGyyGCCcK',
  '.KcCCGGCCcK.',
  '..KcCCCCcK..',
  '...KcCCcK...',
  '....KccK....',
  '.....KK.....',
]);

// ---------- 木材 12x9（斷面朝左，年輪要看得出來才知道那是木頭）----------
A.woodLog = px(12, [
  '.........tu.',
  '........tKu.',
  '..KKKKKKKKK.',
  '.KjjjKwwwwwK',
  'KjJJjKwwwwwK',
  'KjJwJKwwwwwK',
  'KjJJjKWwwwWK',
  '.KjjjKWWWWWK',
  '..KKKKKKKKK.',
]);

// ---------- 木材場：兩根立柱夾著三層原木 30x22 ----------
A.woodYard = shape(30, 22, ({ rect }) => {
  // 立柱
  rect(1, 2, 3, 19, 'w');  rect(3, 2, 1, 19, 'W');
  rect(26, 2, 3, 19, 'w'); rect(28, 2, 1, 19, 'W');
  // 三層原木，左端露出年輪
  for (let r = 0; r < 3; r++) {
    const y = 6 + r * 5;
    rect(5, y, 21, 4, 'w');
    rect(5, y + 3, 21, 1, 'W');
    rect(5, y, 4, 4, 'j');
    rect(6, y + 1, 2, 2, 'J');
  }
});

A.icoChopper = px(12, [   // 斧頭
  '...KKKK.....',
  '..KzzzzKK...',
  '.KhzzzzzZK..',
  'KhzzKKzzZZK.',
  'KhzK..KZZK..',
  '.KK.KwK.KK..',
  '....KwK.....',
  '....KWK.....',
  '....KwK.....',
  '....KWK.....',
  '....KwK.....',
  '....KKK.....',
]);
A.icoRobot = px(12, [     // 機器人頭
  '....K..K....',
  '.....KK.....',
  '.KKKKKKKKKK.',
  'KIiiiiiiiiIK',
  'KIcKIIIIKcIK',
  'KIiiiiiiiiIK',
  'KIiKGGGGKiIK',
  'KIiKGyyGKiIK',
  'KIiiiiiiiiIK',
  'KKIIIIIIIIKK',
  '.KIK....KIK.',
  '.KKK....KKK.',
]);

// ============================================================
//  商店裝飾品
//  三種風格：極地質樸（雪人／圖騰）、節慶溫暖（燈籠／彩旗）、極光奇幻（水晶／星石）
// ============================================================
A.decSnowman = px(16, [
  '.....KKKK.......',
  '....KffffK......',
  '...KfKffKfK.....',
  '...Kfffffff K...',
  '...KfrfffffK....',
  '....KfffffK.....',
  '...KKKKKKKK.....',
  '..KfffffffffK...',
  '.KffffKKffffK...',
  '.KfffKGGKfffK...',
  '.KffffKKffffK...',
  '.KffffffffffK...',
  '..KffffffffK....',
  '...KffffffK.....',
  '....KKKKKK......',
  '................',
]);
A.decTotem = px(14, [
  '..KKKKKKKKKK..',
  '.KmmnmmmmnmmK.',
  '.KmnemmmmenmK.',
  '.KmmmmbmmmmmK.',
  '.KMmmmmmmmmMK.',
  '.KKKKKKKKKKKK.',
  '.KttutttttutK.',
  '.KteutttttetK.',
  '.KttttbttttiK.',
  '.KTtttttttTtK.',
  '.KKKKKKKKKKKK.',
  '..KwWwWwWwWK..',
  '..KWwWwWwWwK..',
  '..KKKKKKKKKK..',
]);
A.decLantern = px(12, [
  '.....KK.....',
  '....KwWK....',
  '..KKKKKKKK..',
  '.KrooooooK..',
  'KroyyyyorK..',
  'KroyyyyorK..',
  'KroyyyyorK..',
  '.KrooooooK..',
  '..KKKKKKK...',
  '....KwK.....',
  '....KWK.....',
  '...KKKKK....',
]);
A.decBanner = px(14, [
  '.K............',
  'KwK.KKKKKKKK..',
  'KwK.KmmnnmmK..',
  'KwWKKmnGGnmK..',
  'KwK.KmGyyGmK..',
  'KwK.KmnGGnmK..',
  'KwWKKMmmmmMK..',
  'KwK..KMmmMK...',
  'KwK...KMMK....',
  'KwWK...KK.....',
  'KwK...........',
  'KwWK..........',
  'KKKK..........',
  '..............',
]);
A.decCrystal = px(14, [
  '......KK......',
  '.....KccK.....',
  '....KcCCcK....',
  '....KcCCcK....',
  '...KcCyyCcK...',
  '...KcCyyCcK...',
  '..KcCCCCCCcK..',
  '..KcCCCCCCcK..',
  '...KcCCCCcK...',
  '....KcCCcK....',
  '.....KccK.....',
  '...KKKKKKKK...',
  '..KZzzzzzzZK..',
  '...KKKKKKKK...',
]);
A.decStarStone = px(14, [
  '......K.......',
  '.....KyK......',
  '..K..KyK..K...',
  '.KyKKKyKKKyK..',
  '..KyyyGyyyK...',
  '...KyGGGyK....',
  '..KyyGGGyyK...',
  '.KyKKGGGKKyK..',
  '..K.KGGGK.K...',
  '....KGGGK.....',
  '...KKKKKKK....',
  '..KzZZZZZzK...',
  '..KZZZZZZZK...',
  '...KKKKKKK....',
]);
A.decFlowerBed = px(16, [
  '................',
  '..K..K...K..K...',
  '.KmK.KuK.KmK.K..',
  'KmnmKKtuKKmnmKuK',
  '.KmK.KuK.KmK.KtK',
  '..KttKtKKtKttK..',
  '.KtuttutttuttuK.',
  'KwWwWwWwWwWwWwWK',
  'KwwwwwwwwwwwwwwK',
  'KWWWWWWWWWWWWWWK',
  'KKKKKKKKKKKKKKKK',
  '................',
  '................',
  '................',
  '................',
  '................',
]);
A.decIceArch = px(20, [
  '....KKKKKKKK....',
  '..KKcccccccc KK.',
  '.KcCCCCCCCCCCcK.',
  'KcCCcKKKKKKcCCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KcCcK......KcCcK',
  'KCCcK......KcCCK',
  'KZzZK......KZzZK',
  'KKKKK......KKKKK',
]);

// ---------- 大型裝飾（用形狀組合，剪影才鎮得住場面）----------
//  極地風：石陣、鯨骨、獵人石堆
A.decStoneRing = shape(34, 22, ({ ell, rect }) => {
  for (let i = 0; i < 5; i++) {
    const x = 4 + i * 6.5, h = i === 2 ? 16 : 11 + (i % 2) * 3;
    rect(Math.round(x), 22 - h, 4, h, 'z');
    rect(Math.round(x) + 3, 22 - h, 1, h, 'Z');
    rect(Math.round(x), 22 - h, 4, 2, 'h');
  }
  ell(17, 20, 15, 3, 'f');
});
A.decWhaleBone = shape(38, 26, ({ ell, rect }) => {
  ell(19, 24, 17, 3, 'f');
  for (let i = 0; i < 2; i++) {
    const s = i ? 1 : -1;
    for (let k = 0; k < 6; k++) {
      const t = k / 5;
      rect(Math.round(19 + s * (3 + t * 15)), Math.round(22 - Math.sin(t * 2.1) * 17), 3,
           Math.round(4 + Math.sin(t * 2.1) * 15), 'x');
    }
  }
  rect(17, 6, 5, 18, 'x');
});
A.decCairn = shape(20, 26, ({ ell, rect }) => {
  ell(10, 24, 9, 3, 'f');
  const w = [13, 11, 9, 7, 5];
  let y = 24;
  for (let i = 0; i < w.length; i++) {
    y -= 4;
    rect(Math.round(10 - w[i] / 2), y, w[i], 4, i % 2 ? 'z' : 'h');
    rect(Math.round(10 - w[i] / 2), y, w[i], 1, 'h');
    rect(Math.round(10 + w[i] / 2) - 1, y, 1, 4, 'Z');
  }
});
//  節慶風：拱形彩旗、篝火台、禮物堆
A.decBunting = shape(44, 20, ({ rect, put }) => {
  rect(1, 3, 3, 17, 'w'); rect(3, 3, 1, 17, 'W');
  rect(40, 3, 3, 17, 'w'); rect(42, 3, 1, 17, 'W');
  const cols = ['m', 't', 'G', 'c', 'm', 't', 'G'];
  for (let i = 0; i < 7; i++) {
    const x = 6 + i * 5;
    const y = 4 + Math.round(Math.sin((i / 6) * Math.PI) * 4);
    for (let k = 0; k < 4; k++) rect(x + k, y + k, 5 - k * 2 + 1, 1, cols[i]);
  }
});
A.decBrazier = shape(22, 28, ({ ell, rect }) => {
  ell(11, 26, 9, 3, 'f');
  rect(9, 16, 4, 10, 'i'); rect(12, 16, 1, 10, 'I');
  rect(4, 22, 14, 2, 'i');
  ell(11, 14, 9, 4, 'i');
  ell(11, 13, 7, 3, 'r');
  ell(11, 11, 5, 4, 'o');
  ell(11, 9, 3, 3, 'y');
});
A.decGifts = shape(26, 20, ({ rect }) => {
  const box = (x, y, w, h, c, rib) => {
    rect(x, y, w, h, c);
    rect(x + Math.floor(w / 2) - 1, y, 2, h, rib);
    rect(x, y + Math.floor(h / 2) - 1, w, 2, rib);
  };
  box(1, 8, 11, 11, 'm', 'G');
  box(13, 11, 9, 8, 't', 'G');
  box(6, 1, 8, 7, 'c', 'G');
});
//  奇幻風：極光尖塔、浮空符石、星輝噴泉
A.decSpire = shape(24, 40, ({ ell, rect }) => {
  ell(12, 38, 10, 3, 'f');
  rect(8, 26, 8, 12, 'Z'); rect(8, 26, 8, 2, 'z');
  for (let i = 0; i < 7; i++) {
    const w = 10 - i, y = 26 - i * 4;
    rect(Math.round(12 - w / 2), y - 4, w, 5, i > 3 ? 'c' : 'C');
  }
  rect(11, 0, 2, 5, 'y');
});
A.decRuneStone = shape(24, 30, ({ ell, rect }) => {
  ell(12, 28, 10, 3, 'f');
  rect(6, 12, 12, 16, 'Z'); rect(6, 12, 12, 2, 'z');
  rect(9, 16, 2, 3, 'c'); rect(13, 16, 2, 3, 'c');
  rect(9, 21, 6, 2, 'c');
  ell(12, 6, 5, 5, 'C'); ell(12, 6, 3, 3, 'c'); ell(12, 6, 1, 1, 'y');
});
A.decFountain = shape(30, 26, ({ ell, rect }) => {
  ell(15, 24, 14, 4, 'h');
  ell(15, 23, 11, 3, 'C');
  ell(15, 22, 8, 2, 'c');
  rect(13, 10, 4, 12, 'h');
  ell(15, 9, 7, 3, 'z');
  for (let i = 0; i < 5; i++) {
    const a = (i / 4) * Math.PI;
    rect(Math.round(15 + Math.cos(a) * 7), Math.round(9 - Math.sin(a) * 7), 2, 3, 'c');
  }
  ell(15, 2, 2, 2, 'y');
});

// ---------- 可愛系裝飾：圓潤剪影 + 大眼睛 + 柔色 ----------
A.decPenguin = px(14, [
  '.....KKKK.....',
  '....KLLLLK....',
  '...KLLLLLLK...',
  '..KLKffffKLK..',
  '..KLfeffefLK..',   // 大眼
  '..KLffooffLK..',   // 橘喙
  '.KLLffffffLLK.',
  'KLLLffffffLLLK',
  'KLLLffffffLLLK',
  'KLLLffffffLLLK',
  '.KLLffffffLLK.',
  '..KLLffffLLK..',
  '...KKoKKoKK...',
  '....KKK.KKK...',
]);
A.decBunny = px(14, [
  '...K......K...',
  '..KfK....KfK..',
  '..KfaK..KafK..',
  '..KfaK..KafK..',
  '..KffK..KffK..',
  '...KffKKffK...',
  '...KffffffK...',
  '..KffefeffK...',   // 眼
  '..KfffAffffK..',   // 粉鼻
  '.KffffffffffK.',
  'KffffffffffffK',
  'KffffffffffffK',
  '.KffffffffffK.',
  '..KKKKKKKKKK..',
]);
A.decFox = px(16, [
  '..K..........K..',
  '.KfK........KfK.',
  '.KfEK......KEfK.',
  '.KffK......KffK.',
  '..KffKKKKKKffK..',
  '..KfffffffffK...',
  '.KffefffffefK...',
  '.KfffffKffffK...',
  'KffffffffffffK..',
  'KffffffffffffKK.',
  'KfffffffffffffK.',
  '.KffffffffffEfK.',   // 尾巴
  '.KffffffffEEEfK.',
  '..KffffffKKEEK..',
  '..KKKKKKK..KKK..',
  '................',
]);
A.decBearPlush = px(14, [
  '.KK......KK...',
  'KbbK....KbbK..',
  'KbBK....KbBK..',
  '.KbbKKKKbbK...',
  '..KbbbbbbbK...',
  '.KbbebbebbK...',   // 縫線眼
  '.KbbbjjbbbK...',   // 淺色吻部
  '.KbbbKKbbbK...',
  '..KbbbbbbK....',
  '.KbbbbbbbbK...',
  'KbbjjbbjjbbK..',
  'KbbbbbbbbbbK..',
  '.KbbK..KbbK...',
  '.KKK....KKK...',
]);
A.decSnowballs = px(16, [
  '................',
  '.....KKKK.......',
  '....KffffK......',
  '....KffffK......',
  '.....KKKK.......',
  '..KKKK..KKKK....',
  '.KffffKKffffK...',
  'KffffffffffffK..',
  'KffffffffffffK..',
  '.KffffKKffffK...',
  '..KKKK..KKKK....',
  '................',
  '................',
  '................',
  '................',
  '................',
]);
A.decMushrooms = px(16, [
  '................',
  '....KKKK........',
  '..KKmmmmKK......',
  '.KmfmmmfmK..KK..',
  'KmmmfmmmmmKKmmK.',
  'KmmmmmmmmmKmfmK.',
  '.KKKffKKKKKmmmK.',
  '...KffK..KKKKKK.',
  '...KffK....KffK.',
  '..KKffKK..KKffK.',
  '..KffffK..KffffK',
  '..KKKKKK..KKKKKK',
  '................',
  '................',
  '................',
  '................',
]);
A.decGingerbread = px(22, [
  '.........KK...........',
  '........KwwK..........',
  '.......KwffwK.........',
  '......KwffffwK........',
  '.....KwffwwffwK.......',
  '....KwffwwwwffwK......',
  '...KwffwwwwwwffwK.....',
  '..KffffffffffffffK....',
  '.KwwwwwwwwwwwwwwwwK...',
  'KwwaKKKKwwwwKKKKawwK..',
  'KwwKffffKwwKffffKwwK..',
  'KwwKffffKwwKffffKwwK..',
  'KwwKKKKKKwwKKKKKKwwK..',
  'KwwwwwwwKWWKwwwwwwwK..',
  'KwwwwwwwKWWKwwwwwwwK..',
  'KKKKKKKKKKKKKKKKKKKK..',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
  '......................',
]);
A.decCocoa = px(20, [
  '.......ff...........',
  '......f.f...........',
  '.......ff...........',
  '....KKKKKKKK........',
  '...KfffffffbK.......',
  '...KfbbbbbbfK.......',
  '...KfbbbbbbfKK......',
  '...KfbbbbbbfKaK.....',
  '...KKffffffKKKK.....',
  '.....KKKKKK.........',
  '..KKKKKKKKKKKKK.....',
  '.KaAaAaAaAaAaAK.....',
  'KwwwwwwwwwwwwwwK....',
  'KWWWWWWWWWWWWWWK....',
  'KKKKKKKKKKKKKKKK....',
  '.KwWK......KwWK.....',
  '.KwWK......KwWK.....',
  '.KKKK......KKKK.....',
  '....................',
  '....................',
]);
A.decPinwheel = px(16, [
  '.....KKK........',
  '..KKKaaaKKK.....',
  '.KaaaKaaKlllK...',
  '.KaaaaKKllllK...',
  '..KaaaKKlllK....',
  '...KKVVVVKK.....',
  '...KVVyyVVK.....',
  '...KKVVVVKK.....',
  '..KlllKKaaaK....',
  '.KllllKKaaaaK...',
  '.KlllKaaKaaaK...',
  '..KKKlaaaKKK....',
  '......KwK.......',
  '......KWK.......',
  '......KwK.......',
  '.....KKKK.......',
]);
A.decSprite = px(14, [
  '....K....K....',
  '...KlK..KlK...',
  '..KlllKKlllK..',
  '.KlllllllllK..',
  'KlllllllllllK.',
  'KllellllelllK.',   // 兩顆分開的大眼
  'KllellllelllK.',
  'KlllllllllllK.',
  'KlaKlllllKalK.',   // 粉臉頰
  'KlllKlllKlllK.',   // 小嘴
  '.KlllKKKlllK..',
  '..KlllllllK...',
  '...KKKKKKK....',
  '..............',
]);
A.decDuckPond = px(20, [
  '....................',
  '.......KKK..........',
  '......KyyyK.........',   // 鴨頭
  '.....KyeyyyK........',   // 眼
  '.....KyyyyyKoK......',   // 橘喙
  '...KKKyyyyyKKK......',
  '..KcKyyyyyyyyKcK....',
  '.KcCKyyyyyyyyyKCcK..',   // 身體浮在水面上
  '.KcCKyyyyyyyyKCCcK..',
  '.KcCCKKyyyyKKCCCcK..',
  '..KcCCCCCCCCCCCcK...',
  '...KcCCCCCCCCCcK....',
  '....KKcccccccKK.....',
  '......KKKKKKK.......',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
  '....................',
]);

// ---------- 角色頭飾（疊在頭上）----------
A.hatBeanie = px(14, [
  '....KKKKKK....',
  '...KmmnnmmK...',
  '..KmnnnnnnmK..',
  '..KMmmmmmmMK..',
  '.KffffffffffK.',
  '.KFFFFFFFFFFK.',
  '..KKKKKKKKKK..',
]);
A.hatCrown = px(14, [
  '.K...K...K....',
  'KyK.KyK.KyK...',
  'KGKKKGKKKGK...',
  'KGGGGGGGGGK...',
  'KGmGGmGGmGK...',
  'KgggggggggK...',
  'KKKKKKKKKKK...',
]);
A.hatAntler = px(16, [
  '.K...........K..',
  'KxK.......KxK...',
  'KxKK.....KKxK...',
  '.KxxK...KxxK....',
  '..KxxK.KxxK.....',
  '...KxxKxxK......',
  '....KxxxK.......',
  '...KbBBBbK......',
  '...KKKKKKK......',
]);
A.hatWreath = px(14, [
  '..KKKKKKKK....',
  '.KtutuututK...',
  'KtumtutumtuK..',
  'KutututututK..',
  'KtumtutumtuK..',
  '.KtututtutK...',
  '..KKKKKKKK....',
]);
A.hatExplorer = px(16, [
  '....KKKKKK......',
  '...KbBBBBbK.....',
  '...KbmmmmbK.....',
  '..KbBBBBBBbK....',
  '.KbbbbbbbbbbK...',
  'KbBBBBBBBBBBBK..',
  '.KKKKKKKKKKKK...',
]);

export const DECOR_SPRITE = {
  snowman: () => A.decSnowman, totem: () => A.decTotem,
  lantern: () => A.decLantern, banner: () => A.decBanner,
  crystal: () => A.decCrystal, starStone: () => A.decStarStone,
  flowerBed: () => A.decFlowerBed, iceArch: () => A.decIceArch,
  stoneRing: () => A.decStoneRing, whaleBone: () => A.decWhaleBone,
  cairn: () => A.decCairn, bunting: () => A.decBunting,
  brazier: () => A.decBrazier, gifts: () => A.decGifts,
  spire: () => A.decSpire, runeStone: () => A.decRuneStone,
  fountain: () => A.decFountain,
  penguin: () => A.decPenguin, bunny: () => A.decBunny, fox: () => A.decFox,
  bearPlush: () => A.decBearPlush, snowballs: () => A.decSnowballs,
  mushrooms: () => A.decMushrooms, gingerbread: () => A.decGingerbread,
  cocoa: () => A.decCocoa, pinwheel: () => A.decPinwheel,
  sprite: () => A.decSprite, duckPond: () => A.decDuckPond,
};
export const HAT_SPRITE = {
  beanie: () => A.hatBeanie, crown: () => A.hatCrown,
  antler: () => A.hatAntler, wreath: () => A.hatWreath,
  explorer: () => A.hatExplorer,
};

export const BUILD_ICON = {
  shelf: A.icoShelf, counter: A.icoCounter, wall: A.icoWall,
  tower: A.icoTower, hauler: A.icoHauler, chopper: A.icoChopper,
  hunter: A.icoHunter, robot: A.icoRobot,
};
export const WEAPON_SPRITE = {
  wpTorch: A.wpTorch, wpKnife: A.wpKnife, wpSpear: A.wpSpear,
  wpAxe: A.wpAxe, wpBlade: A.wpBlade,
};

export const ART = A;
export { PAL };
