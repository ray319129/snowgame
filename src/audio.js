// ============================================================
//  WebAudio 即時合成。無音檔。
//  賣肉時的音高遞增是本作最重要的一個回饋（DESIGN.md §2）
// ============================================================

let ac = null;
let master = null;
let enabled = true;

export function initAudio() {
  if (ac) { if (ac.state === 'suspended') ac.resume(); return; }
  const C = window.AudioContext || window.webkitAudioContext;
  if (!C) { enabled = false; return; }
  ac = new C();
  master = ac.createGain();
  master.gain.value = 0.34;
  master.connect(ac.destination);
}

function tone({ freq = 440, type = 'square', dur = 0.09, vol = 0.5, slide = 0, delay = 0, attack = 0.004 }) {
  if (!enabled || !ac) return;
  const t0 = ac.currentTime + delay;
  const o = ac.createOscillator();
  const g = ac.createGain();
  o.type = type;
  o.frequency.setValueAtTime(freq, t0);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * slide), t0 + dur);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(vol, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  o.connect(g); g.connect(master);
  o.start(t0); o.stop(t0 + dur + 0.02);
}

function noise({ dur = 0.12, vol = 0.4, filter = 1200, delay = 0 }) {
  if (!enabled || !ac) return;
  const t0 = ac.currentTime + delay;
  const n = Math.floor(ac.sampleRate * dur);
  const buf = ac.createBuffer(1, n, ac.sampleRate);
  const d = buf.getChannelData(0);
  for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
  const src = ac.createBufferSource(); src.buffer = buf;
  const bp = ac.createBiquadFilter(); bp.type = 'lowpass'; bp.frequency.value = filter;
  const g = ac.createGain(); g.gain.value = vol;
  src.connect(bp); bp.connect(g); g.connect(master);
  src.start(t0);
}

// ---- 音效庫 ----
export const SFX = {
  swing()      { noise({ dur: 0.07, vol: 0.16, filter: 2600 }); },

  /** 每把武器的命中音色不同，跟視覺特效對齊 */
  hit(kind) {
    switch (kind) {
      case 'slash':                                   // 骨刀：短促高頻
        noise({ dur: 0.05, vol: 0.24, filter: 4200 });
        tone({ freq: 520, type: 'square', dur: 0.05, vol: 0.18, slide: 0.4 });
        break;
      case 'pierce':                                  // 獵矛：金屬穿刺
        tone({ freq: 880, type: 'triangle', dur: 0.09, vol: 0.20, slide: 0.35 });
        noise({ dur: 0.07, vol: 0.16, filter: 3200 });
        break;
      case 'crush':                                   // 戰斧：低沉重擊
        tone({ freq: 90, type: 'sawtooth', dur: 0.16, vol: 0.34, slide: 0.4 });
        noise({ dur: 0.14, vol: 0.30, filter: 500 });
        break;
      case 'aurora':                                  // 極光劍：和聲共鳴
        tone({ freq: 660, type: 'sine', dur: 0.16, vol: 0.20 });
        tone({ freq: 990, type: 'sine', dur: 0.13, vol: 0.14, delay: 0.03 });
        noise({ dur: 0.10, vol: 0.14, filter: 5000 });
        break;
      default:                                        // 火把
        tone({ freq: 180, type: 'square', dur: 0.07, vol: 0.28, slide: 0.5 });
        noise({ dur: 0.06, vol: 0.22, filter: 900 });
    }
  },
  bearDie()    { tone({ freq: 150, type: 'sawtooth', dur: 0.3, vol: 0.3, slide: 0.35 });
                 noise({ dur: 0.25, vol: 0.25, filter: 600 }); },
  pickup(i)    { tone({ freq: 520 + Math.min(i, 14) * 22, type: 'triangle', dur: 0.05, vol: 0.2 }); },

  /** 賣肉：音高隨連續數遞增，這是核心爽點 */
  sell(streak) {
    const step = Math.min(streak, 24);
    const f = 392 * Math.pow(2, step / 12);   // 半音一階往上爬
    tone({ freq: f, type: 'triangle', dur: 0.075, vol: 0.3 });
    tone({ freq: f * 2, type: 'sine', dur: 0.05, vol: 0.1 });
  },

  upgrade() {
    tone({ freq: 523, type: 'square', dur: 0.06, vol: 0.24 });
    tone({ freq: 784, type: 'square', dur: 0.08, vol: 0.24, delay: 0.05 });
  },
  upgradeBig() {
    [523, 659, 784, 1047].forEach((f, i) =>
      tone({ freq: f, type: 'square', dur: 0.11, vol: 0.26, delay: i * 0.055 }));
  },
  hurt()  { tone({ freq: 300, type: 'sawtooth', dur: 0.16, vol: 0.3, slide: 0.4 }); },
  die()   { [400, 330, 260, 190].forEach((f, i) =>
              tone({ freq: f, type: 'sawtooth', dur: 0.2, vol: 0.28, delay: i * 0.1 })); },
  respawn(){ [392, 523, 659].forEach((f, i) =>
              tone({ freq: f, type: 'triangle', dur: 0.14, vol: 0.24, delay: i * 0.07 })); },
  fireLit(){ noise({ dur: 0.5, vol: 0.3, filter: 700 });
             [262, 330, 392, 523, 659].forEach((f, i) =>
              tone({ freq: f, type: 'triangle', dur: 0.18, vol: 0.24, delay: i * 0.06 })); },
  gateTick(p) { tone({ freq: 220 + p * 440, type: 'sine', dur: 0.04, vol: 0.14 }); },
  gateOpen()  { noise({ dur: 1.0, vol: 0.35, filter: 2200 });
                [330, 415, 494, 622, 831, 988].forEach((f, i) =>
                  tone({ freq: f, type: 'square', dur: 0.25, vol: 0.26, delay: i * 0.08 })); },
  coldWarn()  { tone({ freq: 880, type: 'sine', dur: 0.12, vol: 0.16, slide: 0.6 }); },
};
