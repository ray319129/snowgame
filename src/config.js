// ============================================================
//  所有可調數值集中在這裡。平衡只改這個檔案。
//  數值依據 DESIGN.md
// ============================================================

export const CFG = {
  // ---- 畫面 ----
  BASE_W: 240,
  MIN_H: 330,
  MAX_H: 540,

  // ---- 世界 ----
  WORLD: { w: 780, h: 1560 },
  //  營地是唯一的據點，所有經營都在這裡發生
  CAMP:  { x: 236, y: 1200, w: 288, h: 300 },
  RESPAWN:  { x: 380, y: 1424 },
  CAMPFIRE: { x: 380, y: 1400 },

  // ---- 販賣區：玩家放肉上貨架 → 顧客排隊買走 → 現金堆在收銀台 → 玩家去收 ----
  SHELF: { x: 392, y: 1252, r: 26 },
  //  顧客從營地左側走進來，往右排成一列
  QUEUE: { x: 352, y: 1252, dx: -27, dy: 0, entryX: 202, entryY: 1252 },
  CASH:  { x: 444, y: 1276, r: 26 },
  //  木材場：跟肉分開的第二條產線（修基地 / 直接換錢）
  WOOD:  { x: 276, y: 1292, r: 24 },

  // ---- 基地（據點）----
  //  熊用「一次一爪」而不是持續掉血 —— 看得見、聽得見、才有威脅感
  BASE: {
    hp: 300,
    bearHit: 2,             // 每爪傷害
    bearSwing: 2.2,         // 每爪間隔（秒）
    campRepair: 1.2,        // 玩家待在營地內的自然修復 HP/s
    breakCd: 5,             // 被打爆後的無敵緩衝
  },

  // ---- 樹木砍伐 ----
  //  木材兩用：基地缺血 → 修基地；基地滿血 → 在木材場直接換錢
  TREE: { hp: 8, value: 9, hpRepair: 15, drops: 3, respawn: 22 },

  //  火堆是野外唯一的中繼站：擋住失溫、驅趕熊、慢慢回血。
  //  Zone 1 要有左右兩個免費火堆，玩家才不會在中途無路可退。
  FIREPITS: [
    { x: 152, y: 1010, lit: true,  cost: 0    },
    { x: 622, y: 1010, lit: true,  cost: 0    },
    { x: 388, y: 806,  lit: false, cost: 140  },
    { x: 168, y: 470,  lit: false, cost: 1200 },
    { x: 604, y: 300,  lit: false, cost: 3600 },
  ],

  // 四條主升級線的升級台（站上去蓄力 1.5 秒才升一級）
  PADS: [
    { key: 'cap',   x: 284, y: 1462, r: 20 },
    { key: 'speed', x: 332, y: 1462, r: 20 },
    { key: 'power', x: 380, y: 1462, r: 20 },
    { key: 'vigor', x: 428, y: 1462, r: 20 },
    { key: 'warm',  x: 476, y: 1462, r: 20 },
  ],
  PAD_CHARGE: 1.5,          // 站上去要蓄力幾秒才升一級

  // 據點建設台（六個排成一列，剛好塞進 240 寬的畫面）
  BUILD_PADS: [
    { key: 'shelf',   x: 280, y: 1340, r: 17 },
    { key: 'counter', x: 320, y: 1340, r: 17 },
    { key: 'wall',    x: 360, y: 1340, r: 17 },
    { key: 'tower',   x: 400, y: 1340, r: 17 },
    { key: 'hauler',  x: 440, y: 1340, r: 17 },
    { key: 'hunter',  x: 480, y: 1340, r: 17 },
  ],

  // 箭塔會蓋在這些位置（依等級依序啟用）
  //  塔要蓋在畫面看得到的地方，否則玩家不知道自己買了什麼
  TOWER_SPOTS: [
    { x: 282, y: 1224 }, { x: 478, y: 1224 },
    { x: 282, y: 1482 }, { x: 478, y: 1482 },
  ],

  // 武器架（站上去蓄力購買下一階武器）
  WEAPON_RACK: { x: 300, y: 1402, r: 20 },
  // 遠征營帳（轉生）
  PRESTIGE_PAD: { x: 460, y: 1402, r: 20 },

  // ---- 玩家 ----
  PLAYER: {
    accel: 1000, friction: 1400,
    radius: 6,
    pickupRange: 20,
    hpMax: 100,
    iframes: 1.0,           // 無敵幀同時擋住所有熊，避免被一窩熊瞬間秒殺
    respawnIframes: 3.0,
    loadSlowMax: 0.24,      // 滿載時 -24% 移速
    torchLight: 54,
  },

  // ---- 武器（一路升級上去）----
  //  dmg 是「基礎倍率」，實際傷害 = power升級值 × mult
  //  hit：擊中特效類型，每把武器手感不同（見 render.js 的 HIT_FX）
  WEAPONS: [
    { id: 0, name: '火把',   sprite: 'wpTorch',  cost: 0,     mult: 1.00, range: 27, arc: 2.0, interval: 0.50, targets: 2, color: '#ffb648', hit: 'burn',   shake: 1.2 },
    { id: 1, name: '骨刀',   sprite: 'wpKnife',  cost: 320,   mult: 1.35, range: 26, arc: 1.8, interval: 0.34, targets: 2, color: '#e8e2d0', hit: 'slash',  shake: 1.0 },
    { id: 2, name: '獵矛',   sprite: 'wpSpear',  cost: 1800,  mult: 2.10, range: 42, arc: 1.1, interval: 0.42, targets: 3, color: '#cfd8e6', hit: 'pierce', shake: 1.6 },
    { id: 3, name: '戰斧',   sprite: 'wpAxe',    cost: 9500,  mult: 3.40, range: 33, arc: 3.0, interval: 0.52, targets: 6, color: '#f0a05a', hit: 'crush',  shake: 3.4 },
    { id: 4, name: '極光劍', sprite: 'wpBlade',  cost: 48000, mult: 5.60, range: 40, arc: 3.6, interval: 0.40, targets: 9, color: '#9fdff0', hit: 'aurora', shake: 2.4 },
  ],

  // ---- 失溫（野外持續扣血）----
  COLD: {
    base: 1.05,             // HP/s，Zone1 基準 → 沒有火可撐約 95 秒
    campHeal: 26,           // 營地內回血 HP/s（安全區，直接回滿）
    fireHeal: 8,            // 火堆旁回血 HP/s —— 低於熊的 DPS，
                            //   所以火堆不是無敵區，只是可以喘口氣的地方
    fireRadius: 48,
    fireRepel: 30,          // 熊不敢靠火堆這麼近（但站在外圈還是打得到你）
    fireLight: 92,
    combatLock: 2.0,        // 受擊後幾秒內火堆不回血（戰鬥中不能靠火回血）
  },

  // ---- 區域 ----
  //  兩區的關鍵指標是「每點熊血能換到多少錢」＝ drops × meat / bearHp。
  //  舊數值 Z1 0.60 / Z2 0.69 —— 北方只多 15%，卻要多吃 1.5 倍失溫與 1.7 倍熊傷，
  //  理性玩家會永遠待在南方，等於整個北區白做。
  //  現在拉到 Z1 0.60 / Z2 2.03（3.4 倍），北上才是真正的收入躍升。
  ZONES: [
    { id: 1, name: '冰原邊緣', tag: 'ZONE 1', y0: 650, y1: 1560,
      cold: 1.0, dark: 0.10,
      bearHp: 10, bearSpd: 48, bearAggro: 165, bearDmg: 7, meat: 2, drops: 3 },
    { id: 2, name: '裂冰灣', tag: 'ZONE 2', y0: -50, y1: 650,
      cold: 1.5, dark: 0.52,
      bearHp: 65, bearSpd: 60, bearAggro: 200, bearDmg: 12, meat: 33, drops: 4 },
  ],

  // ---- 熊 ----
  BEAR: {
    respawn: 4, maxPerPlot: 6, plotSize: 165,
    radius: 10, hitCooldown: 1.2, knock: 130,
    wanderSpd: 0.45,
    //  領地：每個地塊有一個熊窩，熊會聚集在它周圍而不是平均散開。
    //  這讓地圖有「獵場熱點」，而不是到處都一樣。
    denRadius: 46,          // 閒晃時距離熊窩的半徑
    denPull: 0.55,          // 離窩太遠時往回走的傾向
    denLeash: 210,          // 追玩家最遠追到離窩多遠就放棄
    //  熊互相推開，不然會疊成一坨卡住（用距離判定，不是繞路尋徑）
    sepRadius: 24,          // 這個距離內就互相推開
    sepForce: 190,          // 推開的力道
    //  主動突襲營地：離營地夠近的熊會自己往據點跑，不用玩家靠過去。
    //  玩家躲進營地時，範圍會擴大 —— 躲起來不是安全策略。
    raidRange: 300,
    raidRangeHiding: 460,
    //  同時圍攻的名額。沒有這個上限的話，玩家一進營地就會被 30 隻熊推平，
    //  而且熊全部擠在同一段牆上，看起來像一坨貼圖。
    raidMax: 5,
    // 變體：機率 / 血量倍率 / 速度倍率 / 傷害倍率 / 掉肉加成 / 體型
    VARIANTS: [
      { id: 'cub',   name: '幼熊',   p: 0.30, hp: 0.45, spd: 1.45, dmg: 0.55, drop: -1, scale: 'cub'   },
      { id: 'adult', name: '成年熊', p: 0.55, hp: 1.00, spd: 1.00, dmg: 1.00, drop: 0,  scale: 'adult' },
      { id: 'rage',  name: '狂暴熊', p: 0.15, hp: 2.60, spd: 0.80, dmg: 1.80, drop: +3, scale: 'rage'  },
    ],
  },

  // ---- 威脅等級：熊會跟著玩家一起變強 ----
  //  沒有這個的話，蓋滿兩座箭塔之後熊就完全構不成威脅，中期直接失去張力。
  //  威脅由「玩家目前的實力」推算，所以是玩家自己把熊養大的 —— 變強有代價。
  THREAT: {
    div: 6,            // 實力總分除以這個 = 威脅等級
    max: 40,
    hpPow: 1.5,        // 血量走加速曲線：前期溫和，後期陡
    hpMul: 0.18,
    dmgMul: 0.06,      // 傷害走線性且溫和 —— 玩家血量上限是固定的 100
    spdMul: 0.012,
    meatMul: 0.5,      // 肉價跟著漲：熊變硬，但也變值錢
    //  高威脅時狂暴熊變多、幼熊變少（機率會重新正規化）
    rageBias: 0.02,
    cubBias: -0.012,
  },

  // ---- 箭塔搬遷 ----
  //  玩家可以自己把塔扛去想守的地方，據點佈局變成一種決策
  TOWER: { grabR: 13, grabT: 0.75, placeT: 0.7, stillSpd: 8 },

  // ---- 肉塊 ----
  MEAT: { despawn: 90, magnet: 22, radius: 5 },

  // ---- 四條主升級線 ----
  //  cost(n) = base * 1.18^n
  //  區域升級上限已移除 —— 玩家可以一路升到 max
  UPG: {
    cap:   { name: '背包容量', desc: '一次能扛多少肉',   unit: '格',
             base: 8,  g: 1.18, start: 8,  per: 3,    max: 50, mode: 'add' },
    speed: { name: '移動速度', desc: '跑得越快賺得越快', unit: '',
             base: 12, g: 1.18, start: 86, per: 0.05, max: 50, mode: 'mul' },
    power: { name: '武器威力', desc: '每次揮擊的傷害',   unit: '',
             base: 10, g: 1.18, start: 4,  per: 0.11, max: 60, mode: 'mul' },
    //  血量上限：後期熊的傷害會漲到 30+，沒有這條線出門就是被三下打死
    vigor: { name: '體魄',     desc: '提高血量上限',     unit: '',
             base: 16, g: 1.19, start: 100, per: 16, max: 50, mode: 'add' },
    warm:  { name: '保暖',     desc: '減少野外失溫扣血', unit: '',
             base: 14, g: 1.18, start: 1,  per: 0.05, max: 50, mode: 'div' },
  },

  // ---- 據點建設 ----
  //  每項有多個等級，逐級變強；效果全部「看得見」
  //  wood：升這一級需要的木材（× 目前等級＋1）。木造建築才吃木材，
  //  僱人不用。這讓砍樹在後期還有意義 —— 不然木頭賣的錢會被肉價完全輾過。
  BUILD: {
    //  貨架容量必須永遠大於背包容量，否則卸貨會卸不完，體感很差
    shelf:   { name: '貨架',     desc: '能擺放的肉量',       base: 60,   g: 1.55, max: 8, start: 20, per: 14, wood: 5  },
    counter: { name: '收銀台',   desc: '同時排隊的顧客數',   base: 140,  g: 1.85, max: 5, start: 3,  per: 1,  wood: 7  },
    wall:    { name: '圍牆',     desc: '擴大營地安全範圍',   base: 260,  g: 2.10, max: 4, start: 0,  per: 18, wood: 12 },
    tower:   { name: '箭塔',     desc: '自動射擊靠近的熊',   base: 600,  g: 2.20, max: 4, start: 0,  per: 1,  wood: 18 },
    hauler:  { name: '搬運工',   desc: '自動把地上的肉送回', base: 800,  g: 2.30, max: 4, start: 0,  per: 1,  wood: 0  },
    hunter:  { name: '獵人助手', desc: '自動獵殺野外的熊',   base: 2400, g: 2.45, max: 4, start: 0,  per: 1,  wood: 0  },
  },

  //  木材庫存上限。滿了之後多的木頭會自動換成錢，不會浪費。
  WOOD_MAX: 220,

  // ---- 雪地腳印 ----
  PRINT_MAX: 56,
  PRINT_LIFE: 4.5,

  // ---- 顧客 ----
  CUSTOMER: {
    spawnInterval: 2.0,     // 每隔多久來一位（會被收銀台等級縮短）
    walkSpeed: 62,
    buyInterval: 0.055,     // 每 0.055 秒拿走一塊肉
    wantBase: 6,            // 需求量基準
    wantVar: 6,             // 需求量隨機幅度
    payBonus: 1.0,          // 顧客付的錢 = 肉價 × 這個倍率
    patience: 30,           // 等太久會離開
  },

  // ---- 轉生：極光印記 ----
  PRESTIGE: {
    unlockZones: 2,                 // 解鎖 Zone 2 之後才開放
    marksDiv: 90,                   // marks = floor(sqrt(lifetime / 90))
    TREE: {
      blood:   { name: '血脈', desc: '起始背包 +4',      base: 1, g: 1.9, max: 8,  per: 4    },
      skill:   { name: '熟練', desc: '所有肉價 +12%',    base: 2, g: 1.8, max: 12, per: 0.12 },
      swift:   { name: '疾行', desc: '起始移速 +8%',     base: 2, g: 1.7, max: 10, per: 0.08 },
      hide:    { name: '厚皮', desc: '降溫速率 -10%',    base: 2, g: 1.8, max: 8,  per: 0.10 },
      harvest: { name: '豐收', desc: '熊掉肉 +1',        base: 5, g: 3.0, max: 4,  per: 1    },
      fame:    { name: '名聲', desc: '顧客需求量 +20%',  base: 3, g: 1.9, max: 8,  per: 0.20 },
      spark:   { name: '火種', desc: '開局保留武器與區域', base: 8, g: 1, max: 1,  per: 1    },
    },
  },

  SELL_INTERVAL: 0.055,     // 玩家把肉放上貨架的速度
  CASH_PICK: 0.045,         // 撿現金的速度
  FIRE_DRAIN: 54,           // $/s 流入火堆（要慢到有「儀式感」）

  SAVE_KEY: 'frostline_save',
  SAVE_VERSION: 3,
};

/** 木材掉落物的標記值（與肉塊區分） */
export const WOOD_MARKER = 9999;

/** 第 n 級（0-indexed）的價格 */
export function upgCost(key, level) {
  const u = CFG.UPG[key];
  return Math.round(u.base * Math.pow(u.g, level));
}

/** 第 n 級的實際數值 */
export function upgValue(key, level) {
  const u = CFG.UPG[key];
  if (u.mode === 'add') return u.start + u.per * level;
  if (u.mode === 'mul') return u.start * (1 + u.per * level);
  if (u.mode === 'div') return u.start / (1 + u.per * level);
  return u.start;
}

/** 據點建設第 n 級的價格與數值 */
export function buildCost(key, level) {
  const b = CFG.BUILD[key];
  return Math.round(b.base * Math.pow(b.g, level));
}
/** 升這一級需要的木材（隨等級線性成長，不像錢那樣指數爆炸） */
export function buildWood(key, level) {
  const b = CFG.BUILD[key];
  return b.wood ? b.wood * (level + 1) : 0;
}
export function buildValue(key, level) {
  const b = CFG.BUILD[key];
  return b.start + b.per * level;
}

/** 印記樹第 n 級的價格 */
export function markCost(key, level) {
  const t = CFG.PRESTIGE.TREE[key];
  return Math.max(1, Math.round(t.base * Math.pow(t.g, level)));
}

/** 某條升級線能升到的最高等級（不再有區域上限） */
export function upgCapFor(_zonesOpen, key) {
  return CFG.UPG[key].max;
}

export function zoneAt(y) {
  for (const z of CFG.ZONES) if (y >= z.y0 && y < z.y1) return z;
  return CFG.ZONES[0];
}
