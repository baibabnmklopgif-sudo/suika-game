/* ===================================================================
 *  合成大西瓜  ·  Canvas 2D + 自研圆形刚体物理
 *  支持触屏 / 鼠标，移动端适配（DPR 高清渲染 + 自适应尺寸）
 * =================================================================== */
"use strict";

/* ---------- 水果配置（半径为舞台宽度的比例） ---------- */
const FRUITS = [
  { name: "葡萄",   img: "grape",      r: 0.052, score: 1  },
  { name: "樱桃",   img: "cherry",     r: 0.070, score: 2  },
  { name: "橘子",   img: "orange",     r: 0.088, score: 4  },
  { name: "柠檬",   img: "lemon",      r: 0.106, score: 8  },
  { name: "猕猴桃", img: "kiwi",       r: 0.126, score: 16 },
  { name: "番茄",   img: "tomato",     r: 0.150, score: 32 },
  { name: "桃子",   img: "peach",      r: 0.176, score: 64 },
  { name: "菠萝",   img: "pineapple",  r: 0.206, score: 128},
  { name: "椰子",   img: "coconut",    r: 0.240, score: 256},
  { name: "半西瓜", img: "halfmelon",  r: 0.278, score: 512},
  { name: "大西瓜", img: "watermelon", r: 0.320, score: 1024},
];
const MAX_DROP_LEVEL = 4;      // 掉落只出前 5 种
const GRAVITY  = 2600;         // px/s²（按 480px 宽标准化后缩放）
const AIR_DAMP = 0.999;
const RESTITUTION = 0.18;
const FRICTION = 0.985;
const DROP_COOLDOWN = 380;     // ms
const DANGER_RATIO = 0.16;     // 危险线位置（距顶部比例）
const OVER_TIME = 1200;        // 超线持续判负时长 ms

/* ---------- DOM ---------- */
const canvas   = document.getElementById("game");
const ctx      = canvas.getContext("2d");
const stageEl  = document.getElementById("stage");
const scoreEl  = document.getElementById("score");
const bestEl   = document.getElementById("best");
const nextImg  = document.getElementById("next-img");
const lineEl   = document.getElementById("danger-line");
const overlay  = document.getElementById("overlay");
const startOverlay = document.getElementById("start-overlay");
const finalEl  = document.getElementById("final-score");
const bestTip  = document.getElementById("best-tip");

/* ---------- 素材加载 ---------- */
const sprites = {};
let loaded = 0;
FRUITS.forEach(f => {
  const im = new Image();
  im.src = `assets/${f.img}.png`;
  im.onload = () => loaded++;
  sprites[f.img] = im;
});

/* ---------- 进化链 UI ---------- */
(() => {
  const evo = document.getElementById("evolution");
  FRUITS.forEach((f, i) => {
    const im = document.createElement("img");
    im.src = `assets/${f.img}.png`;
    im.alt = f.name;
    evo.appendChild(im);
    if (i < FRUITS.length - 1) {
      const a = document.createElement("span");
      a.className = "arrow"; a.textContent = "▸";
      evo.appendChild(a);
    }
  });
})();

/* ---------- 画布尺寸 / DPR ---------- */
let W = 0, H = 0, DPR = 1, SCALE = 1;
function resize() {
  const rect = stageEl.getBoundingClientRect();
  DPR = Math.min(window.devicePixelRatio || 1, 3);
  W = rect.width; H = rect.height;
  canvas.width  = Math.round(W * DPR);
  canvas.height = Math.round(H * DPR);
  ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
  SCALE = W / 480;                       // 物理量按宽度归一
  lineEl.style.top = `${H * DANGER_RATIO}px`;
  balls.forEach(b => {                   // 旋转屏幕时防出界
    b.x = Math.min(Math.max(b.x, b.r), W - b.r);
  });
}
window.addEventListener("resize", resize);
window.addEventListener("orientationchange", () => setTimeout(resize, 250));

/* ---------- 音效（WebAudio 合成，无需素材） ---------- */
let audioCtx = null;
function beep(freq, dur = 0.09, type = "sine", vol = 0.18) {
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const o = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(vol, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + dur);
    o.connect(g).connect(audioCtx.destination);
    o.start(); o.stop(audioCtx.currentTime + dur);
  } catch (e) { /* 忽略音频异常 */ }
}
const sndDrop  = () => beep(300, .08, "triangle", .12);
const sndMerge = lv => beep(380 + lv * 70, .14, "sine", .2);
const sndBig   = () => { beep(523, .18, "sine", .25); setTimeout(() => beep(784, .25, "sine", .25), 110); };

/* ---------- 游戏状态 ---------- */
let balls = [];
let particles = [];
let score = 0;
let best = +(localStorage.getItem("suika_best") || 0);
let curLevel = 0, nextLevel = 0;
let aimX = null;
let canDrop = true;
let running = false;
let gameOver = false;
let overTimer = 0;
let lastDropped = null;
bestEl.textContent = best;

function randLevel() {
  // 权重：小水果更常见
  const w = [30, 26, 20, 14, 10];
  let t = Math.random() * w.slice(0, MAX_DROP_LEVEL + 1).reduce((a, b) => a + b);
  for (let i = 0; i <= MAX_DROP_LEVEL; i++) { t -= w[i]; if (t < 0) return i; }
  return 0;
}

function newBall(level, x, y, fromMerge = false) {
  const f = FRUITS[level];
  return {
    level, r: f.r * W * 0.5 * 2 / 2,   // r 定义为宽度比例的一半直径
    x, y, vx: 0, vy: 0,
    rot: (Math.random() - .5) * .3, vr: 0,
    pop: fromMerge ? 1 : 0,            // 合成弹出动画
    spawn: fromMerge ? 0 : 1,
    settled: false,
    id: Math.random(),
  };
}
function ballRadius(level) { return FRUITS[level].r * W * 0.5; }

function reset() {
  balls = []; particles = [];
  score = 0; scoreEl.textContent = 0;
  curLevel = randLevel(); nextLevel = randLevel();
  nextImg.src = `assets/${FRUITS[nextLevel].img}.png`;
  canDrop = true; gameOver = false; overTimer = 0;
  aimX = W / 2; lastDropped = null;
  lineEl.classList.remove("flash");
  overlay.classList.add("hidden");
}

/* ---------- 掉落 ---------- */
function dropAt(x) {
  if (!canDrop || gameOver || !running) return;
  const r = ballRadius(curLevel);
  x = Math.min(Math.max(x, r + 2), W - r - 2);
  const b = newBall(curLevel, x, r + 4);
  b.r = r;
  balls.push(b);
  lastDropped = b;
  sndDrop();
  canDrop = false;
  curLevel = nextLevel;
  nextLevel = randLevel();
  nextImg.src = `assets/${FRUITS[nextLevel].img}.png`;
  setTimeout(() => { canDrop = true; }, DROP_COOLDOWN);
}

/* ---------- 合成 ---------- */
function mergeBalls(a, b) {
  const level = a.level + 1;
  const nx = (a.x + b.x) / 2, ny = (a.y + b.y) / 2;
  balls = balls.filter(o => o !== a && o !== b);
  const nb = newBall(level, nx, ny, true);
  nb.r = ballRadius(level);
  nb.y = Math.min(ny, H - nb.r);
  nb.vy = -120 * SCALE;
  balls.push(nb);

  const gain = FRUITS[level].score;
  score += gain;
  scoreEl.textContent = score;
  floatScore(nx, ny - nb.r, `+${gain}`);
  spawnParticles(nx, ny, level);
  if (level === FRUITS.length - 1) { sndBig(); celebrate(nx, ny); }
  else sndMerge(level);

  if (score > best) { best = score; bestEl.textContent = best; localStorage.setItem("suika_best", best); }
}

function floatScore(x, y, text) {
  const el = document.createElement("div");
  el.className = "float-score";
  el.textContent = text;
  el.style.left = `${x}px`;
  el.style.top  = `${y}px`;
  el.style.fontSize = `${Math.min(26, 14 + text.length * 2)}px`;
  stageEl.appendChild(el);
  setTimeout(() => el.remove(), 800);
}

/* ---------- 粒子 ---------- */
const PAL = ["#ffd54f", "#ff8a65", "#aed581", "#4fc3f7", "#f48fb1", "#fff176"];
function spawnParticles(x, y, level) {
  const n = 10 + level * 3;
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2;
    const sp = (80 + Math.random() * 220) * SCALE;
    particles.push({
      x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - 60 * SCALE,
      life: 1, size: (3 + Math.random() * 5) * SCALE,
      color: PAL[(Math.random() * PAL.length) | 0],
    });
  }
}
function celebrate(x, y) {
  for (let k = 0; k < 3; k++) setTimeout(() => spawnParticles(x, y, 10), k * 160);
}

/* ---------- 物理 ---------- */
function physics(dt) {
  const g = GRAVITY * SCALE;
  for (const b of balls) {
    b.vy += g * dt;
    b.vx *= AIR_DAMP;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    b.rot += b.vr * dt;
    if (b.pop > 0)   b.pop   = Math.max(0, b.pop - dt * 4);
    if (b.spawn > 0) b.spawn = Math.max(0, b.spawn - dt * 6);

    // 墙壁
    if (b.x - b.r < 0)      { b.x = b.r;      b.vx = Math.abs(b.vx) * RESTITUTION; }
    else if (b.x + b.r > W) { b.x = W - b.r;  b.vx = -Math.abs(b.vx) * RESTITUTION; }
    // 地面
    if (b.y + b.r > H) {
      b.y = H - b.r;
      if (Math.abs(b.vy) > 60 * SCALE) b.vy = -b.vy * RESTITUTION;
      else b.vy = 0;
      b.vx *= FRICTION;
      b.vr *= 0.95;
    }
  }

  // 碰撞（多次迭代提高稳定性）
  let mergePair = null;
  for (let iter = 0; iter < 3; iter++) {
    for (let i = 0; i < balls.length; i++) {
      for (let j = i + 1; j < balls.length; j++) {
        const a = balls[i], c = balls[j];
        const dx = c.x - a.x, dy = c.y - a.y;
        const dist = Math.hypot(dx, dy) || 0.0001;
        const min = a.r + c.r;
        if (dist < min) {
          if (a.level === c.level && !mergePair &&
              a.level < FRUITS.length - 1) {
            mergePair = [a, c];
          }
          const nx = dx / dist, ny = dy / dist;
          const overlap = min - dist;
          const ma = a.r * a.r, mc = c.r * c.r;   // 质量 ∝ r²
          const total = ma + mc;
          a.x -= nx * overlap * (mc / total);
          a.y -= ny * overlap * (mc / total);
          c.x += nx * overlap * (ma / total);
          c.y += ny * overlap * (ma / total);
          // 冲量
          const rvx = c.vx - a.vx, rvy = c.vy - a.vy;
          const vn = rvx * nx + rvy * ny;
          if (vn < 0) {
            const imp = -(1 + RESTITUTION) * vn / (1/ma + 1/mc);
            a.vx -= imp * nx / ma; a.vy -= imp * ny / ma;
            c.vx += imp * nx / mc; c.vy += imp * ny / mc;
            // 切向摩擦带动旋转
            const tx = -ny, ty = nx;
            const vt = rvx * tx + rvy * ty;
            a.vr += vt * 0.002; c.vr -= vt * 0.002;
          }
        }
      }
    }
  }
  if (mergePair) mergeBalls(mergePair[0], mergePair[1]);
}

/* ---------- 失败判定 ---------- */
function checkGameOver(dt) {
  const line = H * DANGER_RATIO;
  let danger = false;
  for (const b of balls) {
    const slow = Math.abs(b.vy) < 40 * SCALE;
    if (b.y - b.r < line && slow && b.spawn === 0) { danger = true; break; }
  }
  if (danger) {
    overTimer += dt * 1000;
    lineEl.classList.add("flash");
    if (overTimer > OVER_TIME) endGame();
  } else {
    overTimer = 0;
    lineEl.classList.remove("flash");
  }
}

function endGame() {
  gameOver = true; running = false;
  finalEl.textContent = score;
  bestTip.classList.toggle("hidden", score < best || score === 0 || score !== best);
  overlay.classList.remove("hidden");
}

/* ---------- 渲染 ---------- */
function draw() {
  ctx.clearRect(0, 0, W, H);

  // 瞄准辅助线 + 预览水果
  if (running && !gameOver && aimX !== null && canDrop) {
    const r = ballRadius(curLevel);
    const x = Math.min(Math.max(aimX, r + 2), W - r - 2);
    ctx.save();
    ctx.strokeStyle = "rgba(255,255,255,.55)";
    ctx.setLineDash([6, 8]);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x, r * 2 + 6);
    ctx.lineTo(x, H - 4);
    ctx.stroke();
    ctx.restore();
    drawFruit(curLevel, x, r + 4, r, 0, 1);
  }

  for (const b of balls) {
    const squish = 1 + b.pop * 0.25;          // 合成时弹一下
    drawFruit(b.level, b.x, b.y, b.r * squish, b.rot, 1);
  }

  // 粒子
  for (const p of particles) {
    ctx.globalAlpha = Math.max(0, p.life);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawFruit(level, x, y, r, rot, alpha) {
  const im = sprites[FRUITS[level].img];
  if (!im || !im.complete) return;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rot);
  ctx.globalAlpha = alpha;
  ctx.drawImage(im, -r, -r, r * 2, r * 2);
  ctx.restore();
}

/* ---------- 主循环 ---------- */
let lastT = 0;
function loop(t) {
  requestAnimationFrame(loop);
  const dt = Math.min((t - lastT) / 1000 || 0, 1 / 30);
  lastT = t;
  if (running && !gameOver) {
    // 物理子步，防高速穿透
    const sub = 2;
    for (let i = 0; i < sub; i++) physics(dt / sub);
    checkGameOver(dt);
  }
  for (const p of particles) {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 1200 * SCALE * dt;
    p.life -= dt * 1.6;
  }
  particles = particles.filter(p => p.life > 0);
  draw();
}

/* ---------- 输入（触屏 + 鼠标） ---------- */
function stageX(e) {
  const rect = stageEl.getBoundingClientRect();
  const pt = e.touches ? e.touches[0] : e;
  return pt.clientX - rect.left;
}
let pressing = false;
stageEl.addEventListener("pointerdown", e => {
  pressing = true;
  aimX = stageX(e);
});
stageEl.addEventListener("pointermove", e => {
  if (pressing || e.pointerType === "mouse") aimX = stageX(e);
});
window.addEventListener("pointerup", e => {
  if (!pressing) return;
  pressing = false;
  if (running && !gameOver) dropAt(aimX ?? W / 2);
});
// 阻止 iOS 双击缩放 / 滚动
document.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
document.addEventListener("dblclick", e => e.preventDefault());

/* ---------- 按钮 ---------- */
document.getElementById("start-btn").addEventListener("click", () => {
  startOverlay.classList.add("hidden");
  resize(); reset();
  running = true;
  beep(600, .1, "sine", .15);
});
document.getElementById("restart-btn").addEventListener("click", () => {
  reset(); running = true;
  beep(600, .1, "sine", .15);
});

/* ---------- 启动 ---------- */
resize();
requestAnimationFrame(loop);
