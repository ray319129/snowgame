// ============================================================
//  開發者工具面板 —— 用來跳過前期、直接測試中後期的狀態。
//  開啟方式：網址加 ?dev=1，或遊戲中按 ` （backquote）／F2。
//  正式玩家不會看到；面板不影響存檔格式，關掉就跟平常一樣。
// ============================================================
import { CFG } from './config.js';
import {
  G, save, resetSave, val, threatLevel, threatMul, saveTowerPos,
} from './game.js';
import { initBase, resetBase } from './base.js';
import { world, campRect } from './world.js';

let root = null, open = false, statusEl = null;

/** 只有網址帶 ?dev=1 才啟用。整包工具在一般玩家的場次裡完全不會建立。 */
export const DEV_ON = new URLSearchParams(location.search).get('dev') === '1';

/** 目前所有升級／建設全部拉到指定比例（0~1） */
function setProgress(f) {
  for (const k in CFG.UPG)   G.upg[k]   = Math.round(CFG.UPG[k].max * f);
  for (const k in CFG.BUILD) G.build[k] = Math.round(CFG.BUILD[k].max * f);
  G.weapon = Math.min(CFG.WEAPONS.length - 1, Math.round((CFG.WEAPONS.length - 1) * f));
  G.weaponsOwned = [];
  for (let i = 0; i <= G.weapon; i++) G.weaponsOwned.push(i);
  initBase();
  save();
}

function money(n) { G.money += n; G.lifetime += n; G.runEarned += n; }

function give(value, n) {
  const p = G.player;
  for (let i = 0; i < n; i++) {
    G.drops.push({
      x: p.x + (Math.random() - 0.5) * 40, y: p.y + (Math.random() - 0.5) * 40,
      vx: 0, vy: 0, z: 4, vz: 20, life: CFG.MEAT.despawn, value, spin: Math.random() * 6,
    });
  }
}

function teleport(x, y) {
  const p = G.player;
  p.x = x; p.y = y; p.vx = p.vy = 0;
  p.hp = CFG.PLAYER.hpMax;
  p.iframes = CFG.PLAYER.respawnIframes;
  if (!p.alive) { p.alive = true; p.deadT = 0; }
}

/** 把所有熊清掉並讓地塊立刻重新排隊生成（生出來的會套用當下威脅值） */
function respawnBears() {
  G.bears.length = 0;
  for (const pl of world.plots) { pl.bears.length = 0; pl.queue.length = 0; }
  for (const pl of world.plots) {
    for (let i = 0; i < CFG.BEAR.maxPerPlot; i++) pl.queue.push(G.time);
  }
}

function status() {
  if (!statusEl) return;
  const t = threatLevel();
  const m = threatMul(t);
  const z2 = CFG.ZONES[1];
  statusEl.innerHTML =
    `威脅 <b>${t}</b>　熊血 <b>×${m.hp.toFixed(1)}</b>　傷害 <b>×${m.dmg.toFixed(2)}</b>　肉價 <b>×${m.meat.toFixed(1)}</b><br>` +
    `玩家傷害 <b>${val.power().toFixed(0)}</b>　Z2 成年熊血 <b>${Math.round(z2.bearHp * m.hp)}</b>　` +
    `場上熊 <b>${G.bears.length}</b>　塔 <b>${G.towers.length}</b>`;
}

const BTN = [
  ['錢', [
    ['+$1K',   () => money(1e3)],
    ['+$100K', () => money(1e5)],
    ['+$10M',  () => money(1e7)],
    ['歸零',   () => { G.money = 0; }],
  ]],
  ['進度', [
    ['前期 25%', () => setProgress(0.25)],
    ['中期 50%', () => setProgress(0.5)],
    ['後期 75%', () => setProgress(0.75)],
    ['滿等',     () => setProgress(1)],
  ]],
  ['威脅', [
    ['−1',   () => { G.devThreat = Math.max(0, (G.devThreat ?? threatLevel()) - 1); respawnBears(); }],
    ['+1',   () => { G.devThreat = Math.min(CFG.THREAT.max, (G.devThreat ?? threatLevel()) + 1); respawnBears(); }],
    ['+10',  () => { G.devThreat = Math.min(CFG.THREAT.max, (G.devThreat ?? threatLevel()) + 10); respawnBears(); }],
    ['自動', () => { G.devThreat = null; respawnBears(); }],
  ]],
  ['熊', [
    ['全部清除', () => { G.bears.length = 0; world.plots.forEach(p => { p.bears.length = 0; p.queue.length = 0; }); }],
    ['重新生成', respawnBears],
    ['引到營地', () => {
      const c = campRect();
      G.bears.slice(0, 12).forEach((b, i) => {
        b.x = c.x + 30 + (i % 6) * 45; b.y = c.y - 40 - Math.floor(i / 6) * 30;
      });
    }],
  ]],
  ['基地', [
    ['補滿',   () => { G.baseHp = G.baseMaxHp; }],
    ['剩 1',   () => { G.baseHp = 1; }],
    ['砍半',   () => { G.baseHp = Math.max(1, G.baseHp / 2); }],
  ]],
  ['物資', [
    ['+30 肉',   () => give(val.meat(CFG.ZONES[0]) * threatMul().meat, 30)],
    ['+30 木頭', () => give(9999, 30)],
    ['清空背包', () => { G.player.carry.length = 0; }],
    ['清貨架',   () => { G.shelf.length = 0; G.cash = 0; }],
  ]],
  ['傳送', [
    ['營地',   () => teleport(CFG.RESPAWN.x, CFG.RESPAWN.y)],
    ['Zone 1', () => teleport(390, 950)],
    ['Zone 2', () => teleport(390, 400)],
  ]],
  ['其他', [
    ['無敵：關', function () {
      G.devGod = !G.devGod;
      this.textContent = '無敵：' + (G.devGod ? '開' : '關');
      this.classList.toggle('on', G.devGod);
    }],
    ['速度 ×1', function () {
      const s = [1, 2, 4, 8];
      G.devSpeed = s[(s.indexOf(G.devSpeed) + 1) % s.length];
      this.textContent = '速度 ×' + G.devSpeed;
      this.classList.toggle('on', G.devSpeed !== 1);
    }],
    ['塔位重置', () => { G.towerPos = null; initBase(); saveTowerPos(); save(); }],
    ['重置據點', () => { resetBase(); }],
    ['存檔',     () => { save(); }],
    ['清除存檔', () => { if (confirm('確定清除存檔並重新開始？')) resetSave(); }],
  ]],
];

function build() {
  root = document.createElement('div');
  root.id = 'dev';
  root.innerHTML = '<div class="hd">開發者工具 <span class="x">✕</span></div><div class="st"></div>';
  const hd = root.querySelector('.hd');
  statusEl = root.querySelector('.st');
  hd.querySelector('.x').addEventListener('pointerdown', (e) => { e.stopPropagation(); toggle(false); });

  for (const [group, items] of BTN) {
    const g = document.createElement('div');
    g.className = 'gp';
    g.innerHTML = `<span class="gl">${group}</span>`;
    const wrap = document.createElement('div');
    wrap.className = 'bs';
    for (const [label, fn] of items) {
      const b = document.createElement('button');
      b.textContent = label;
      b.addEventListener('pointerdown', (e) => {
        e.stopPropagation();
        fn.call(b);
        status();
      });
      wrap.appendChild(b);
    }
    g.appendChild(wrap);
    root.appendChild(g);
  }
  // 面板自己吃掉指標事件，不要傳到底下的搖桿
  for (const ev of ['pointerdown', 'pointermove', 'pointerup']) {
    root.addEventListener(ev, (e) => e.stopPropagation());
  }
  document.body.appendChild(root);
}

export function toggle(v) {
  if (!root) build();
  open = v === undefined ? !open : v;
  root.classList.toggle('on', open);
  if (open) status();
}

export function initDev() {
  if (!DEV_ON) return;          // 沒開就連 CSS 都不注入
  const style = document.createElement('style');
  style.textContent = `
    #dev{position:fixed;left:6px;top:6px;z-index:99;display:none;
      max-height:92vh;overflow-y:auto;width:236px;
      background:rgba(10,14,24,.95);border:2px solid #4a5878;border-radius:4px;
      padding:6px 7px 8px;font-size:11px;color:#cfe0f7;
      font-family:"Segoe UI","Microsoft JhengHei",system-ui,sans-serif}
    #dev.on{display:block}
    #dev .hd{display:flex;justify-content:space-between;align-items:center;
      font-weight:800;letter-spacing:1px;color:#ffd651;margin-bottom:4px}
    #dev .hd .x{cursor:pointer;color:#8fa0bd;padding:0 4px}
    #dev .st{font-size:9px;line-height:1.6;color:#8fe8a0;background:#121727;
      border-radius:3px;padding:4px 5px;margin-bottom:6px}
    #dev .st b{color:#ffd651}
    #dev .gp{margin-bottom:5px}
    #dev .gl{font-size:9px;font-weight:800;letter-spacing:1px;color:#7a8298}
    #dev .bs{display:flex;flex-wrap:wrap;gap:3px;margin-top:2px}
    #dev button{font:inherit;font-size:10px;cursor:pointer;
      background:#1e2637;color:#cfe0f7;border:1px solid #3b465f;border-radius:3px;
      padding:3px 6px}
    #dev button:active{background:#2c3550}
    #dev button:hover{border-color:#6d829f}
    #dev button.on{background:#3a2a12;border-color:#ffd651;color:#ffd651}
  `;
  document.head.appendChild(style);

  //  只認網址參數 ?dev=1。沒有快捷鍵 —— 一般玩家不可能誤觸開啟。
  if (!DEV_ON) return;
  toggle(true);

  // 面板開著時每半秒刷新一次數值
  setInterval(() => { if (open) status(); }, 500);
}
