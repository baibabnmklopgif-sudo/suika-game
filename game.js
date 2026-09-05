/* ===================================================================
 *  合成大西瓜 · Unified 2D Physics & Animation Engine
 *  - 真实滚动物理 (Rolling Physics & High Angular Damping - 杜绝幽灵自转)
 *  - 2.5D 弹力软体变形 (Squish & Spring-Damper)
 *  - 8-子步高精度圆体刚体碰撞解算器 (Zero-tunneling Impulse Solver)
 *  - 冲击波涟漪 (Shockwave) & 屏幕震动 (Screen Shake)
 *  - 连击 (Combo) 乘数加分与动态升调音效
 *  - WebAudio 纯代码程序化合成音效 + 移动端震动反馈 (Haptic)
 * =================================================================== */
"use strict";

/* ---------- 水果配置表 ---------- */
const FRUITS = [
  { id: 0,  name: "葡萄",   img: "grape",      r: 0.052, score: 1   },
  { id: 1,  name: "樱桃",   img: "cherry",     r: 0.070, score: 2   },
  { id: 2,  name: "橘子",   img: "orange",     r: 0.088, score: 4   },
  { id: 3,  name: "柠檬",   img: "lemon",      r: 0.106, score: 8   },
  { id: 4,  name: "猕猴桃", img: "kiwi",       r: 0.126, score: 16  },
  { id: 5,  name: "番茄",   img: "tomato",     r: 0.150, score: 32  },
  { id: 6,  name: "桃子",   img: "peach",      r: 0.176, score: 64  },
  { id: 7,  name: "菠萝",   img: "pineapple",  r: 0.206, score: 128 },
  { id: 8,  name: "椰子",   img: "coconut",    r: 0.240, score: 256 },
  { id: 9,  name: "半西瓜", img: "halfmelon",  r: 0.278, score: 512 },
  { id: 10, name: "大西瓜", img: "watermelon", r: 0.320, score: 1024},
];

const MAX_DROP_LEVEL = 4;        // 掉落仅出前 5 种基础水果
const GRAVITY = 2700;            // px/s² (基于标准宽 480px)
const RESTITUTION = 0.20;        // 弹性恢复系数
const FRICTION = 0.985;          // 地面滚动阻尼
const DROP_COOLDOWN = 360;       // 掉落冷却 (ms)
const DANGER_RATIO = 0.17;       // 警戒线高度比例
const OVER_TIME = 1200;          // 警戒线上超时判负 (ms)

/* ---------- DOM 元素绑定 ---------- */
const canvas       = document.getElementById("game");
const ctx          = canvas.getContext("2d");
const stageEl      = document.getElementById("stage");
const scoreEl      = document.getElementById("score");
const bestEl       = document.getElementById("best");
const comboTag     = document.getElementById("combo-tag");
const nextImg      = document.getElementById("next-img");
const lineEl       = document.getElementById("danger-line");
const soundBtn     = document.getElementById("sound-btn");
const helpBtn      = document.getElementById("help-btn");
const overlay      = document.getElementById("overlay");
const startOverlay = document.getElementById("start-overlay");
const finalEl      = document.getElementById("final-score");
const finalBestEl  = document.getElementById("final-best");
const bestTip      = document.getElementById("best-tip");

/* ---------- 素材加载 ---------- */
const sprites = {};
FRUITS.forEach(f => {
  const img = new Image();
  img.src = `assets/${f.img}.png`;
  sprites[f.img] = img;
});

/* ---------- 进化链图鉴生成 ---------- */
(() => {
  const evo = document.getElementById("evolution");
  FRUITS.forEach((f, idx) => {
    const im = document.createElement("img");
    im.src = `assets/${f.img}.png`;
    im.alt = f.name;
    evo.appendChild(im);
    if (idx < FRUITS.length - 1) {
      const arr = document.createElement("span");
      arr.className = "arrow";
      arr.textContent = "▸";
      evo.appendChild(arr);
    }
  });
})();

/* ---------- WebAudio 音频合成引擎 ---------- */
let audioEnabled = true;
let audioCtx = null;

function getAudioContext() {
  if (!audioCtx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (AC) audioCtx = new AC();
  }
  if (audioCtx && audioCtx.state === "suspended") {
    audioCtx.resume();
  }
  return audioCtx;
}

function playSound(type, param = 0) {
  if (!audioEnabled) return;
  try {
    const actx = getAudioContext();
    if (!actx) return;
    const now = actx.currentTime;

    if (type === "drop") {
      const osc = actx.createOscillator();
      const gain = actx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(280, now);
      osc.frequency.exponentialRampToValueAtTime(140, now + 0.08);
      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
      osc.connect(gain).connect(actx.destination);
      osc.start(now);
      osc.stop(now + 0.08);
    } else if (type === "merge") {
      const baseFreq = 340 + param * 45;
      const notes = [baseFreq, baseFreq * 1.25, baseFreq * 1.5];
      notes.forEach((freq, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "triangle";
        osc.frequency.setValueAtTime(freq, now + i * 0.03);
        gain.gain.setValueAtTime(0.2, now + i * 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.03 + 0.14);
        osc.connect(gain).connect(actx.destination);
        osc.start(now + i * 0.03);
        osc.stop(now + i * 0.03 + 0.14);
      });
    } else if (type === "watermelon") {
      const chord = [523.25, 659.25, 783.99, 1046.50];
      chord.forEach((f, i) => {
        const osc = actx.createOscillator();
        const gain = actx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(f, now + i * 0.06);
        gain.gain.setValueAtTime(0.25, now + i * 0.06);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.06 + 0.35);
        osc.connect(gain).connect(actx.destination);
        osc.start(now + i * 0.06);
        osc.stop(now + i * 0.06 + 0.35);
      });
    }
  } catch (e) {}
}

function vibrate(ms) {
  if (navigator.vibrate) {
    try { navigator.vibrate(ms); } catch (e) {}
  }
}

/* ---------- 响应式屏幕缩放适配 ---------- */
let W = 0, H = 0, DPR = 1, SCALE = 1;
function handleResize() {
  const rect = stageEl.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = rect.width;
  H = rect.height;
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  SCALE = W / 480;
  lineEl.style.top = `${H * DANGER_RATIO}px`;

  for (const b of bodies) {
    b.r = fruitRadius(b.level);
    b.x = Math.max(b.r, Math.min(W - b.r, b.x));
  }
}
window.addEventListener("resize", handleResize);
window.addEventListener("orientationchange", () => setTimeout(handleResize, 200));

/* ---------- 游戏状态变量 ---------- */
let bodies = [];
let particles = [];
let shockwaves = [];
let score = 0;
let best = +(localStorage.getItem("suika_best_v2") || 0);
let curLevel = 0, nextLevel = 0;
let aimX = null;
let canDrop = true;
let isRunning = false;
let isGameOver = false;
let dangerTimer = 0;
let screenShake = 0;

// 连击 (Combo) 机制
let comboCount = 0;
let lastMergeTime = 0;
const COMBO_TIMEOUT = 1600; // ms

bestEl.textContent = best;

function randFruitLevel() {
  const weights = [32, 28, 20, 12, 8];
  let total = 0;
  for (let i = 0; i <= MAX_DROP_LEVEL; i++) total += weights[i];
  let r = Math.random() * total;
  for (let i = 0; i <= MAX_DROP_LEVEL; i++) {
    r -= weights[i];
    if (r < 0) return i;
  }
  return 0;
}

function fruitRadius(level) {
  return FRUITS[level].r * W * 0.5;
}

/* 刚体对象建模 */
function createBody(level, x, y, isMerge = false) {
  const r = fruitRadius(level);
  return {
    id: Math.random(),
    level,
    r,
    x, y,
    vx: 0, vy: 0,
    rot: 0,              // 初始角度自然端正
    vr: 0,               // 初始角速度为 0
    // 弹力形变动画系统 (Spring Squash & Stretch)
    sx: isMerge ? 1.35 : 0.85,
    sy: isMerge ? 0.75 : 1.15,
    vsx: 0, vsy: 0,
    spawnTime: performance.now(),
  };
}

function initGame() {
  bodies = [];
  particles = [];
  shockwaves = [];
  score = 0;
  comboCount = 0;
  scoreEl.textContent = "0";
  comboTag.classList.add("hidden");
  curLevel = randFruitLevel();
  nextLevel = randFruitLevel();
  nextImg.src = `assets/${FRUITS[nextLevel].img}.png`;
  canDrop = true;
  isGameOver = false;
  dangerTimer = 0;
  screenShake = 0;
  aimX = W / 2;
  lineEl.classList.remove("flash");
  overlay.classList.add("hidden");
}

/* ---------- 掉落操作 ---------- */
function performDrop(targetX) {
  if (!canDrop || isGameOver || !isRunning) return;
  const r = fruitRadius(curLevel);
  const x = Math.max(r + 2, Math.min(W - r - 2, targetX));
  const body = createBody(curLevel, x, r + 6, false);
  body.vy = 60 * SCALE;
  bodies.push(body);

  playSound("drop");
  vibrate(15);

  canDrop = false;
  curLevel = nextLevel;
  nextLevel = randFruitLevel();
  nextImg.src = `assets/${FRUITS[nextLevel].img}.png`;

  setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
}

/* ---------- 合成逻辑与特效 ---------- */
function mergeFruit(a, b) {
  const nextLv = a.level + 1;
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;

  bodies = bodies.filter(item => item !== a && item !== b);

  const nb = createBody(nextLv, mx, my, true);
  nb.vy = -140 * SCALE;
  bodies.push(nb);

  const now = performance.now();
  if (now - lastMergeTime < COMBO_TIMEOUT) {
    comboCount++;
  } else {
    comboCount = 1;
  }
  lastMergeTime = now;

  const baseScore = FRUITS[nextLv].score;
  const comboMultiplier = comboCount > 1 ? comboCount : 1;
  const finalGain = baseScore * comboMultiplier;

  score += finalGain;
  scoreEl.textContent = score;

  if (comboCount > 1) {
    comboTag.textContent = `COMBO x${comboCount}`;
    comboTag.classList.remove("hidden");
  }

  spawnFloatScore(mx, my - nb.r, comboCount > 1 ? `+${finalGain} (x${comboCount})` : `+${finalGain}`);
  spawnSplashParticles(mx, my, nextLv);

  shockwaves.push({ x: mx, y: my, r: nb.r * 0.5, maxR: nb.r * 2.8, alpha: 0.8 });
  screenShake = Math.min(14, screenShake + 3 + nextLv * 0.8);
  vibrate(Math.min(60, 20 + nextLv * 5));

  if (nextLv === FRUITS.length - 1) {
    playSound("watermelon");
    celebrateWatermelon(mx, my);
  } else {
    playSound("merge", nextLv + (comboCount - 1));
  }

  if (score > best) {
    best = score;
    bestEl.textContent = best;
    localStorage.setItem("suika_best_v2", best);
  }
}

function spawnFloatScore(x, y, text) {
  const el = document.createElement("div");
  el.className = "float-score";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  stageEl.appendChild(el);
  setTimeout(() => el.remove(), 850);
}

function spawnSplashParticles(x, y, level) {
  const count = 12 + level * 3;
  const colors = ["#ff5252", "#ffb142", "#34ace0", "#33d9b2", "#ffda79", "#ff793f"];
  for (let i = 0; i < count; i++) {
    const angle = Math.random() * Math.PI * 2;
    const speed = (90 + Math.random() * 240) * SCALE;
    particles.push({
      x, y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed - 80 * SCALE,
      size: (3 + Math.random() * 5) * SCALE,
      color: colors[(Math.random() * colors.length) | 0],
      life: 1.0,
      decay: 1.5 + Math.random() * 1.2
    });
  }
}

function celebrateWatermelon(x, y) {
  for (let k = 0; k < 4; k++) {
    setTimeout(() => spawnSplashParticles(x, y, 10), k * 140);
  }
}

/* ---------- 统一 2D 物理与真实旋转解算 ---------- */
function updatePhysics(dt) {
  const g = GRAVITY * SCALE;
  const angularDamping = Math.pow(0.005, dt); // 极强的角阻尼，防止无休止自转

  // 1. 积分与边界约束
  for (const b of bodies) {
    b.vy += g * dt;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    b.vx *= 0.998;
    b.vr *= angularDamping; // 空气角阻尼

    // 弹簧回弹模拟：让挤压形变平滑复原
    const k = 140.0;
    const d = 16.0;
    b.vsx += (-k * (b.sx - 1.0) - d * b.vsx) * dt;
    b.vsy += (-k * (b.sy - 1.0) - d * b.vsy) * dt;
    b.sx += b.vsx * dt;
    b.sy += b.vsy * dt;

    // 左右墙壁反弹
    if (b.x - b.r < 0) {
      b.x = b.r;
      b.vx = -b.vx * RESTITUTION;
      b.vr = b.vy / b.r * 0.2; // 贴墙滑动轻微转动
      b.sx = 0.88; b.sy = 1.12;
    } else if (b.x + b.r > W) {
      b.x = W - b.r;
      b.vx = -b.vx * RESTITUTION;
      b.vr = -b.vy / b.r * 0.2;
      b.sx = 0.88; b.sy = 1.12;
    }

    // 地面接触与滚动
    if (b.y + b.r > H) {
      b.y = H - b.r;
      if (Math.abs(b.vy) > 70 * SCALE) {
        b.vy = -b.vy * RESTITUTION;
        b.sx = 1.18; b.sy = 0.85;
      } else {
        b.vy = 0;
      }
      b.vx *= FRICTION;
      // 物理真实滚动关系：角速度与水平线速度绑定 v = w * r
      const targetVr = (b.vx / b.r) * 0.8;
      b.vr = b.vr * 0.85 + targetVr * 0.15;
      if (Math.abs(b.vx) < 3 * SCALE) {
        b.vx = 0;
        b.vr = 0; // 静止时彻底锁定自转
      }
    }
  }

  // 2. 刚体碰撞求解
  let mergeCandidate = null;
  const numBodies = bodies.length;

  for (let i = 0; i < numBodies; i++) {
    for (let j = i + 1; j < numBodies; j++) {
      const a = bodies[i];
      const b = bodies[j];
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const dist = Math.hypot(dx, dy) || 0.001;
      const minDist = a.r + b.r;

      if (dist < minDist) {
        // 发现相同水果碰撞合成
        if (a.level === b.level && !mergeCandidate && a.level < FRUITS.length - 1) {
          mergeCandidate = [a, b];
        }

        // 分离重叠
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        const ma = a.r * a.r;
        const mb = b.r * b.r;
        const totalM = ma + mb;

        a.x -= nx * overlap * (mb / totalM);
        a.y -= ny * overlap * (ma / totalM);
        b.x += nx * overlap * (ma / totalM);
        b.y += ny * overlap * (ma / totalM);

        // 法向冲量
        const rvx = b.vx - a.vx;
        const rvy = b.vy - a.vy;
        const normalVel = rvx * nx + rvy * ny;

        if (normalVel < 0) {
          const impulse = -(1 + RESTITUTION) * normalVel / (1 / ma + 1 / mb);
          a.vx -= impulse * nx / ma;
          a.vy -= impulse * ny / ma;
          b.vx += impulse * nx / mb;
          b.vy += impulse * ny / mb;

          // 弹性接触轻微挤压
          if (Math.abs(normalVel) > 80 * SCALE) {
            a.sx = 1.1; a.sy = 0.92;
            b.sx = 1.1; b.sy = 0.92;
          }

          // 接触面滚动摩擦（带衰减与最大力矩限制，避免灵异自转）
          const tx = -ny, ty = nx;
          const tangentVel = rvx * tx + rvy * ty;
          if (Math.abs(tangentVel) > 10 * SCALE) {
            const rotImpulse = Math.min(Math.abs(tangentVel * 0.04), 2.5) * Math.sign(tangentVel);
            a.vr += rotImpulse / a.r * 15;
            b.vr -= rotImpulse / b.r * 15;
          }
        }
      }
    }
  }

  if (mergeCandidate) {
    mergeFruit(mergeCandidate[0], mergeCandidate[1]);
  }
}

/* ---------- 警戒线判定与失败检测 ---------- */
function checkDanger(dt) {
  const lineY = H * DANGER_RATIO;
  const now = performance.now();
  let inDanger = false;

  for (const b of bodies) {
    if (now - b.spawnTime < 900) continue;
    const isStationary = Math.abs(b.vy) < 45 * SCALE;
    if (b.y - b.r < lineY && isStationary) {
      inDanger = true;
      break;
    }
  }

  if (inDanger) {
    dangerTimer += dt * 1000;
    lineEl.classList.add("flash");
    if (dangerTimer > OVER_TIME) {
      triggerGameOver();
    }
  } else {
    dangerTimer = 0;
    lineEl.classList.remove("flash");
  }

  if (comboCount > 0 && now - lastMergeTime > COMBO_TIMEOUT) {
    comboCount = 0;
    comboTag.classList.add("hidden");
  }
}

function triggerGameOver() {
  isGameOver = true;
  isRunning = false;
  finalEl.textContent = score;
  finalBestEl.textContent = best;
  bestTip.classList.toggle("hidden", score < best || score === 0);
  overlay.classList.remove("hidden");
}

/* ---------- 2D 渲染系统 ---------- */
function render() {
  ctx.save();
  ctx.clearRect(0, 0, W, H);

  if (screenShake > 0) {
    const ox = (Math.random() - 0.5) * screenShake;
    const oy = (Math.random() - 0.5) * screenShake;
    ctx.translate(ox, oy);
  }

  // 1. 瞄准虚线与顶部预览水果
  if (isRunning && !isGameOver && aimX !== null && canDrop) {
    const r = fruitRadius(curLevel);
    const x = Math.max(r + 2, Math.min(W - r - 2, aimX));

    ctx.save();
    ctx.strokeStyle = "rgba(255, 255, 255, 0.65)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, r * 2 + 10);
    ctx.lineTo(x, H - 4);
    ctx.stroke();
    ctx.restore();

    renderFruit(curLevel, x, r + 6, r, 0, 1.0, 1.0, 1.0);
  }

  // 2. 绘制所有刚体水果
  for (const b of bodies) {
    renderFruit(b.level, b.x, b.y, b.r, b.rot, b.sx, b.sy, 1.0);
  }

  // 3. 冲击波光圈
  for (const sw of shockwaves) {
    ctx.save();
    ctx.strokeStyle = `rgba(255, 255, 255, ${sw.alpha})`;
    ctx.lineWidth = 3.5;
    ctx.beginPath();
    ctx.arc(sw.x, sw.y, sw.r, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  // 4. 粒子特效
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  ctx.restore();
}

function renderFruit(level, x, y, r, rot, sx, sy, alpha) {
  const sprite = sprites[FRUITS[level].img];
  if (!sprite || !sprite.complete) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.scale(sx, sy);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, -r, -r, r * 2, r * 2);
  ctx.restore();
}

/* ---------- 游戏主循环 ---------- */
let lastFrameTime = performance.now();
function gameLoop(now) {
  requestAnimationFrame(gameLoop);
  const dt = Math.min((now - lastFrameTime) / 1000, 1 / 30);
  lastFrameTime = now;

  if (isRunning && !isGameOver) {
    const subSteps = 8;
    for (let step = 0; step < subSteps; step++) {
      updatePhysics(dt / subSteps);
    }
    checkDanger(dt);
  }

  if (screenShake > 0) {
    screenShake = Math.max(0, screenShake - dt * 25);
  }

  for (const sw of shockwaves) {
    sw.r += (sw.maxR - sw.r) * dt * 10;
    sw.alpha -= dt * 2.5;
  }
  shockwaves = shockwaves.filter(sw => sw.alpha > 0);

  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 1100 * SCALE * dt;
    p.life -= dt * p.decay;
  }
  particles = particles.filter(p => p.life > 0);

  render();
}

/* ---------- 触控与鼠标交互系统 ---------- */
function getPointerX(e) {
  const rect = stageEl.getBoundingClientRect();
  const pt = e.touches ? e.touches[0] : e;
  return pt.clientX - rect.left;
}

let isPointerDown = false;
stageEl.addEventListener("pointerdown", e => {
  isPointerDown = true;
  aimX = getPointerX(e);
});

stageEl.addEventListener("pointermove", e => {
  if (isPointerDown || e.pointerType === "mouse") {
    aimX = getPointerX(e);
  }
});

window.addEventListener("pointerup", () => {
  if (!isPointerDown) return;
  isPointerDown = false;
  if (isRunning && !isGameOver) {
    performDrop(aimX ?? W / 2);
  }
});

document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
document.addEventListener("dblclick", e => e.preventDefault());

/* ---------- 按钮事件绑定 ---------- */
document.getElementById("start-btn").addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  handleResize();
  initGame();
  isRunning = true;
  getAudioContext();
  playSound("drop");
});

document.getElementById("restart-btn").addEventListener("click", () => {
  initGame();
  isRunning = true;
  playSound("drop");
});

soundBtn.addEventListener("click", () => {
  audioEnabled = !audioEnabled;
  soundBtn.textContent = audioEnabled ? "🔔" : "🔕";
});

helpBtn.addEventListener("click", () => {
  alert("🍉 玩法说明：\n1. 滑动屏幕控制水果投放位置\n2. 相同水果碰撞会自动进化成更高阶水果\n3. 连续合成可获得 COMBO 连击额外加分\n4. 水果超出警戒线将结束游戏！");
});

/* ---------- 启动游戏引擎 ---------- */
handleResize();
requestAnimationFrame(gameLoop);
