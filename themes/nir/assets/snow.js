// Snow, reimagined from the Tranquilpeak "snow-bringer" (originally from the soul-plus theme).
// Every click brings more snow, bursting from where you clicked, with stronger gusts and a
// warmer tint — until the 16th click, which still has its surprise.

const MAX = 900;
const RED_AT = 16;
const SONG = 'https://res.cloudinary.com/noirgif/video/upload/v1545761612/nir.moe/SFX/Grievous_Ladywww_-_Laur_vs_Team_Grimoire.mp3';

let canvas, ctx, w = 0, h = 0, dpr = 1;
let flakes = [], rings = [], clicks = 0, running = false, draining = false, last = 0;
let wind = 0, gust = 0, pointer = { x: -1e4, y: -1e4 };
let sprites = [];

const rand = (a, b) => a + Math.random() * (b - a);

const light = matchMedia('(prefers-color-scheme: light)');
function tint() {
  // White (icy blue on light backgrounds) → rose → red across the first 16 clicks,
  // like the original's colour shift.
  const t = Math.min(1, clicks / RED_AT) ** 1.4;
  const base = light.matches ? [96, 156, 222] : [255, 255, 255];
  const red = [240, 40, 60];
  return base.map((v, i) => Math.round(v + (red[i] - v) * t));
}

// Pre-render flakes once per click so each frame is just drawImage calls.
function buildSprites() {
  const [r, g, b] = tint();
  sprites = [4, 7, 11, 16].map((size, i) => {
    const px = Math.ceil(size * 2 * dpr) + 4;
    const c = document.createElement('canvas');
    c.width = c.height = px;
    const x = c.getContext('2d');
    const m = px / 2;
    const outline = light.matches ? 'rgba(17,26,35,.35)' : `rgba(${r},${g},${b},.9)`;
    if (i < 2) {
      if (light.matches) { x.shadowColor = outline; x.shadowBlur = 2 * dpr; }
      const grad = x.createRadialGradient(m, m, 0, m, m, m);
      grad.addColorStop(0, `rgba(${r},${g},${b},1)`);
      grad.addColorStop(.45, `rgba(${r},${g},${b},.75)`);
      grad.addColorStop(1, `rgba(${r},${g},${b},0)`);
      x.fillStyle = grad;
      x.fillRect(0, 0, px, px);
    } else {
      // Six-armed crystal with a soft glow.
      x.translate(m, m);
      x.shadowColor = outline;
      x.shadowBlur = 4 * dpr;
      x.strokeStyle = `rgba(${r},${g},${b},.95)`;
      x.lineCap = 'round';
      x.lineWidth = Math.max(1, size / 9) * dpr;
      const arm = size * dpr * .9;
      for (let k = 0; k < 6; k++) {
        x.rotate(Math.PI / 3);
        x.beginPath();
        x.moveTo(0, 0); x.lineTo(0, -arm);
        x.moveTo(0, -arm * .55); x.lineTo(-arm * .25, -arm * .78);
        x.moveTo(0, -arm * .55); x.lineTo(arm * .25, -arm * .78);
        x.stroke();
      }
    }
    return c;
  });
}

function flake(x, y, burst) {
  const z = rand(.35, 1); // depth: near flakes are bigger, faster and brighter
  const kind = z > .82 ? (Math.random() < .5 ? 3 : 2) : z > .55 ? 1 : 0;
  const angle = rand(0, Math.PI * 2), speed = burst ? rand(1.5, 7) * (0.6 + z) : 0;
  return {
    x, y, z, kind,
    vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - (burst ? 2 : 0),
    fall: (.5 + z * 1.6) * (1 + Math.min(clicks, 10) * .04),
    sway: rand(.4, 1.4), phase: rand(0, Math.PI * 2), spin: rand(-.02, .02), rot: rand(0, 6.3),
    alpha: .55 + z * .45
  };
}

function resize() {
  dpr = Math.min(devicePixelRatio || 1, 2);
  w = innerWidth; h = innerHeight;
  canvas.width = Math.round(w * dpr);
  canvas.height = Math.round(h * dpr);
  buildSprites();
}

function frame(now) {
  if (!running) return;
  const dt = Math.min(3, (now - last) / 16.67 || 1);
  last = now;
  gust *= Math.pow(.985, dt);
  wind = Math.sin(now / 4000) * .6 + gust;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (let i = rings.length - 1; i >= 0; i--) {
    const r = rings[i];
    r.t += dt / 40;
    if (r.t >= 1) { rings.splice(i, 1); continue; }
    const [cr, cg, cb] = tint();
    ctx.beginPath();
    ctx.arc(r.x * dpr, r.y * dpr, (12 + r.t * r.size) * dpr, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(${cr},${cg},${cb},${(1 - r.t) * .6})`;
    ctx.lineWidth = 2 * dpr * (1 - r.t);
    ctx.stroke();
  }

  for (let i = flakes.length - 1; i >= 0; i--) {
    const f = flakes[i];
    f.phase += .02 * dt;
    f.vx *= Math.pow(.96, dt);
    f.vy *= Math.pow(.96, dt);
    // gently push flakes away from the pointer
    const dx = f.x - pointer.x, dy = f.y - pointer.y, d2 = dx * dx + dy * dy;
    if (d2 < 6400) { const d = Math.sqrt(d2) || 1, k = (80 - d) / 80 * .6; f.vx += dx / d * k; f.vy += dy / d * k; }
    f.x += (f.vx + Math.sin(f.phase) * f.sway * .5 + wind * f.z * 1.5) * dt;
    f.y += (f.vy + f.fall) * dt;
    f.rot += f.spin * dt;
    if (f.y > h + 20 || f.x < -40 || f.x > w + 40) {
      if (draining) { flakes.splice(i, 1); continue; }
      f.y = rand(-40, -10);
      f.x = rand(-20, w + 20);
      f.vx = f.vy = 0;
    }
    const s = sprites[f.kind];
    const size = s.width / dpr * (.55 + f.z * .45);
    ctx.globalAlpha = f.alpha;
    if (f.kind > 1) {
      ctx.setTransform(Math.cos(f.rot), Math.sin(f.rot), -Math.sin(f.rot), Math.cos(f.rot), f.x * dpr, f.y * dpr);
      ctx.drawImage(s, -size * dpr / 2, -size * dpr / 2, size * dpr, size * dpr);
      ctx.setTransform(1, 0, 0, 1, 0, 0);
    } else {
      ctx.drawImage(s, (f.x - size / 2) * dpr, (f.y - size / 2) * dpr, size * dpr, size * dpr);
    }
  }
  ctx.globalAlpha = 1;
  if (draining && !flakes.length) { stop(); return; }
  requestAnimationFrame(frame);
}

function start() {
  if (running) return;
  running = true;
  last = performance.now();
  requestAnimationFrame(frame);
}
function stop() {
  running = false;
  canvas?.remove();
  canvas = null;
  flakes = [];
  clicks = 0;
  draining = false;
}

function setup() {
  canvas = document.createElement('canvas');
  canvas.className = 'snow-canvas';
  canvas.setAttribute('aria-hidden', 'true');
  ctx = canvas.getContext('2d');
  document.body.append(canvas);
  resize();
}
addEventListener('resize', () => canvas && resize());
light.addEventListener('change', () => canvas && buildSprites());
addEventListener('pointermove', e => { pointer = { x: e.clientX, y: e.clientY }; }, { passive: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) running = false; else if (canvas && !running) start();
});

export function snow(x = innerWidth / 2, y = 120) {
  if (!canvas) setup();
  draining = false;
  clicks++;
  buildSprites();
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // Each click is bigger than the last: a burst at the button, a ring, more snow and a gust.
  const burst = reduce ? 10 : 24 + clicks * 10;
  const fall = reduce ? 30 : 50 + clicks * 30;
  for (let i = 0; i < burst; i++) flakes.push(flake(x, y, true));
  for (let i = 0; i < fall; i++) flakes.push(flake(rand(0, w), rand(-h, 0), false));
  if (flakes.length > MAX) flakes.splice(0, flakes.length - MAX);
  rings.push({ x, y, t: 0, size: 60 + clicks * 12 });
  gust += (Math.random() < .5 ? -1 : 1) * Math.min(3, .4 + clicks * .18);
  start();

  if (clicks === RED_AT) {
    document.body.classList.add('snow-red');
    const audio = new Audio(SONG);
    audio.play().catch(() => {});
    audio.addEventListener('ended', () => {
      document.body.classList.remove('snow-red');
      draining = true;
    }, { once: true });
  }
}
