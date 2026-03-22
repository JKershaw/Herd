// game.js — Single source of truth for all pure game logic.
// Loaded as <script type="module"> in index.html (globals via window assignment).
// Also imported by tests via ES module exports.

// === Constants ===

export const W = 280;
export const H = 210;
export const PEN = { x: 224, y: 14, w: 40, h: H - 30, gateY: 55, gateH: 75 };
export const FENCE_L = 14, FENCE_R = W - 14, FENCE_T = 14, FENCE_B = H - 14;

// === Math utilities ===

export function lerp(a, b, t) { return a + (b - a) * t; }
export function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
export function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
export function angleDiff(a, b) { return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }

// === Physics / collision ===

export function wallInfo(x, y, margin) {
  return {
    nearL: x < FENCE_L + margin,
    nearR: x > FENCE_R - margin,
    nearT: y < FENCE_T + margin,
    nearB: y > FENCE_B - margin,
    nearPenL: x > PEN.x - margin && x < PEN.x + 4 + margin && y >= PEN.y && y <= PEN.y + PEN.h
              && !(y >= PEN.gateY && y <= PEN.gateY + PEN.gateH),
    nearPenB: y > PEN.y + PEN.h - 4 - margin && y < PEN.y + PEN.h + margin
              && x >= PEN.x && x <= PEN.x + PEN.w,
  };
}

export function fenceCollide(x, y, r) {
  let nx = x, ny = y;
  nx = clamp(nx, FENCE_L + r, FENCE_R - r);
  ny = clamp(ny, FENCE_T + r, FENCE_B - r);
  const inGate = ny >= PEN.gateY && ny <= PEN.gateY + PEN.gateH;
  if (!inGate && nx > PEN.x - r && nx < PEN.x + 3 + r && ny >= PEN.y && ny <= PEN.y + PEN.h)
    nx = x < PEN.x ? PEN.x - r : PEN.x + 3 + r;
  if (nx >= PEN.x && nx <= PEN.x + PEN.w)
    if (ny > PEN.y + PEN.h - 3 - r && ny < PEN.y + PEN.h + r)
      ny = y < PEN.y + PEN.h - 1 ? PEN.y + PEN.h - 3 - r : PEN.y + PEN.h + r;
  return { x: nx, y: ny };
}

export function isInPen(x, y) {
  return x >= PEN.x + 2 && x <= PEN.x + PEN.w - 2 && y >= PEN.y + 2 && y <= PEN.y + PEN.h - 4;
}

// === Clustering (union-find) ===

export function clusterSheep(sheep) {
  const active = sheep.filter(s => !s.settled);
  if (active.length === 0) return [];
  const thr = 40;
  const par = active.map((_, i) => i);
  function find(i) { while (par[i] !== i) { par[i] = par[par[i]]; i = par[i]; } return i; }
  function union(a, b) { par[find(a)] = find(b); }
  for (let i = 0; i < active.length; i++)
    for (let j = i + 1; j < active.length; j++)
      if (dist(active[i], active[j]) < thr) union(i, j);
  const groups = {};
  active.forEach((s, i) => { const r = find(i); if (!groups[r]) groups[r] = []; groups[r].push(s); });
  return Object.values(groups).map(m => ({
    members: m,
    x: m.reduce((s, sh) => s + sh.x, 0) / m.length,
    y: m.reduce((s, sh) => s + sh.y, 0) / m.length,
    size: m.length,
  }));
}

// === Entity factories ===

export function createSheep(n) {
  return Array.from({ length: n }, () => ({
    x: 28 + Math.random() * 150, y: 30 + Math.random() * 150,
    vx: 0, vy: 0, wobble: Math.random() * Math.PI * 2,
    grazeTimer: Math.random() * 200, isGrazing: false,
    headDir: Math.random() * Math.PI * 2, settled: false, settleTimer: 0,
    panic: 0, fleeTimer: 0,
  }));
}

export function createDog() {
  return {
    x: 110, y: 185, vx: 0, vy: 0,
    targetX: 110, targetY: 185,
    angle: Math.PI * 0.5, distFromFocus: 65,
    wobble: 0, focusIndex: 0,
    idleTime: 0, lookDir: 0, lookTarget: 0, tailWag: 0,
    renderDir: Math.PI * 0.5,
  };
}

// === Simulation ===

export function updateParticles(particles, dt) {
  return particles.filter(p => {
    p.x += p.vx * dt; p.y += p.vy * dt;
    p.vy += 55 * dt; p.vx *= 0.97; p.life -= dt * 1.6;
    return p.life > 0;
  });
}

export function updateDog(dog, sheep, cmd, dt) {
  const clusters = clusterSheep(sheep);
  if (clusters.length === 0) return { clusters, focusInfo: "" };
  dog.focusIndex = clamp(dog.focusIndex, 0, clusters.length - 1);

  if (cmd) {
    dog.idleTime = 0;
  } else {
    dog.idleTime += dt;
    if (dog.idleTime > 1.5) {
      let bestIdx = 0, bestScore = -1;
      clusters.forEach((c, i) => {
        const dPen = Math.sqrt((c.x - PEN.x) ** 2 + (c.y - (PEN.gateY + PEN.gateH / 2)) ** 2);
        const score = c.size * 12 + dPen * 0.35;
        if (score > bestScore) { bestScore = score; bestIdx = i; }
      });
      if (bestIdx !== dog.focusIndex) {
        dog.focusIndex = bestIdx; dog.idleTime = 0;
        const fc = clusters[bestIdx];
        dog.angle = Math.atan2(dog.y - fc.y, dog.x - fc.x);
        dog.distFromFocus = Math.min(dog.distFromFocus + 15, 90);
      }
    }
  }

  const focus = clusters[clamp(dog.focusIndex, 0, clusters.length - 1)];
  dog.lookTarget = Math.atan2(focus.y - dog.y, focus.x - dog.x);
  dog.lookDir += angleDiff(dog.lookDir, dog.lookTarget) * Math.min(dt * 4, 0.15);

  if (cmd === "comebye") {
    dog.angle += 1.7 * dt;
    dog.distFromFocus = lerp(dog.distFromFocus, 48, 0.03);
  } else if (cmd === "away") {
    dog.angle -= 1.7 * dt;
    dog.distFromFocus = lerp(dog.distFromFocus, 48, 0.03);
  } else if (cmd === "walkup") {
    dog.distFromFocus = lerp(dog.distFromFocus, 20, 0.04);
  } else {
    dog.distFromFocus = lerp(dog.distFromFocus, dog.distFromFocus + 0.2, 0.005);
  }
  dog.distFromFocus = clamp(dog.distFromFocus, 16, 110);
  dog.wobble += dt * 3.5;
  dog.tailWag += dt * (cmd ? 14 : 6);

  let rawTX = focus.x + Math.cos(dog.angle) * dog.distFromFocus + Math.sin(dog.wobble) * 1;
  let rawTY = focus.y + Math.sin(dog.angle) * dog.distFromFocus + Math.cos(dog.wobble * 0.7) * 1;

  const projected = fenceCollide(rawTX, rawTY, 4);
  dog.targetX = projected.x;
  dog.targetY = projected.y;

  const dx = dog.targetX - dog.x, dy = dog.targetY - dog.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  const spd = cmd ? 80 : 22;
  if (d > 0.5) {
    dog.vx = lerp(dog.vx, (dx / d) * spd, 0.12);
    dog.vy = lerp(dog.vy, (dy / d) * spd, 0.12);
  } else { dog.vx *= 0.8; dog.vy *= 0.8; }

  dog.x += dog.vx * dt; dog.y += dog.vy * dt;
  const fc2 = fenceCollide(dog.x, dog.y, 3);

  if (Math.abs(fc2.x - dog.x) > 0.1) { dog.vx = 0; }
  if (Math.abs(fc2.y - dog.y) > 0.1) { dog.vy = 0; }
  dog.x = fc2.x; dog.y = fc2.y;

  const dSpd2 = Math.sqrt(dog.vx * dog.vx + dog.vy * dog.vy);
  const moveDir = Math.atan2(dog.vy, dog.vx);
  const blend = clamp((dSpd2 - 3) / 7, 0, 1);
  const targetDir = dog.lookDir + angleDiff(dog.lookDir, moveDir) * blend;
  dog.renderDir = dog.renderDir + angleDiff(dog.renderDir, targetDir) * Math.min(dt * 8, 0.25);

  const focusInfo = clusters.length > 1
    ? `Focus: group of ${focus.size}`
    : clusters.length === 1 ? `Flock: ${focus.size}` : "";

  return { clusters, focusInfo };
}

export function updateSheep(sheep, dog, dt, tick) {
  const fleeDist = 56;
  let settledCount = 0;
  const newParticles = [];

  for (let i = 0; i < sheep.length; i++) {
    const s = sheep[i];
    if (s.settled) { settledCount++; continue; }
    s.wobble += dt * 2.5;
    let ax = 0, ay = 0;

    const dd = dist(s, dog);
    const pressed = dd < fleeDist && dd > 0;

    if (pressed) {
      const str = ((fleeDist - dd) / fleeDist) ** 1.3 * 200;
      const fleeX = (s.x - dog.x) / dd;
      const fleeY = (s.y - dog.y) / dd;
      ax += fleeX * str;
      ay += fleeY * str;
      s.isGrazing = false;
      s.grazeTimer = 100 + Math.random() * 120;
      s.fleeTimer = 1.2;
    }
    if (s.fleeTimer > 0) {
      s.fleeTimer -= dt;
    }

    const wi = wallInfo(s.x, s.y, 14);
    const nearWallCount = [wi.nearL, wi.nearR, wi.nearT, wi.nearB, wi.nearPenL, wi.nearPenB]
      .filter(Boolean).length;

    if (pressed && nearWallCount >= 1) {
      s.panic = Math.min(s.panic + dt * 3, 1);
    } else {
      s.panic = Math.max(s.panic - dt * 1.5, 0);
    }

    if (pressed && nearWallCount >= 1) {
      const panicStr = 80 + s.panic * 120;
      if (wi.nearL || wi.nearR || wi.nearPenL) {
        const escapeY = (s.y > dog.y) ? 1 : -1;
        ay += escapeY * panicStr;
        if (wi.nearL) ax += panicStr * 0.4;
        if (wi.nearR) ax -= panicStr * 0.4;
        if (wi.nearPenL) ax -= panicStr * 0.4;
      }
      if (wi.nearT || wi.nearB || wi.nearPenB) {
        const escapeX = (s.x > dog.x) ? 1 : -1;
        ax += escapeX * panicStr;
        if (wi.nearT) ay += panicStr * 0.4;
        if (wi.nearB) ay -= panicStr * 0.4;
        if (wi.nearPenB) ay -= panicStr * 0.4;
      }
      if (nearWallCount >= 2 && s.panic > 0.5) {
        const toCenterX = (W / 2 - s.x);
        const toCenterY = (H / 2 - s.y);
        const tcLen = Math.sqrt(toCenterX * toCenterX + toCenterY * toCenterY) || 1;
        ax += (toCenterX / tcLen) * panicStr * 1.5;
        ay += (toCenterY / tcLen) * panicStr * 1.5;
      }
    }

    // Boids
    let sepX = 0, sepY = 0, cohX = 0, cohY = 0, aliX = 0, aliY = 0, nb = 0;
    for (let j = 0; j < sheep.length; j++) {
      if (i === j || sheep[j].settled) continue;
      const d2 = dist(s, sheep[j]);
      if (d2 < 34 && d2 > 0) {
        sepX += (s.x - sheep[j].x) / d2 * (14 / d2);
        sepY += (s.y - sheep[j].y) / d2 * (14 / d2);
        cohX += sheep[j].x; cohY += sheep[j].y;
        aliX += sheep[j].vx; aliY += sheep[j].vy;
        nb++;
      }
    }
    ax += sepX * 30; ay += sepY * 30;
    if (nb > 0) {
      const cohStr = (pressed || s.fleeTimer > 0) ? 0.25 : 0.9;
      ax += ((cohX / nb) - s.x) * cohStr;
      ay += ((cohY / nb) - s.y) * cohStr;
      ax += (aliX / nb) * 0.35; ay += (aliY / nb) * 0.35;
    }

    s.grazeTimer -= dt * 60;
    if (s.grazeTimer <= 0 && dd > fleeDist * 1.3) {
      s.isGrazing = true; s.grazeTimer = 100 + Math.random() * 220;
      s.headDir += (Math.random() - 0.5) * 1.0;
    }
    if (s.isGrazing && dd < fleeDist) s.isGrazing = false;

    if (!s.isGrazing) {
      ax += Math.sin(tick * 0.019 + i * 7.3) * 3.5;
      ay += Math.cos(tick * 0.015 + i * 5.1) * 3.5;
    } else { ax *= 0.08; ay *= 0.08; }

    if (isInPen(s.x, s.y)) {
      const pcx = PEN.x + PEN.w / 2, pcy = PEN.y + PEN.h / 2;
      ax += (pcx - s.x) * 0.7; ay += (pcy - s.y) * 0.7;
      s.settleTimer += dt;
      if (s.settleTimer > 1.6 && !s.settled) {
        s.settled = true; s.vx = 0; s.vy = 0;
        settledCount++;
        for (let p = 0; p < 14; p++) {
          const a = (p / 14) * Math.PI * 2;
          newParticles.push({
            x: s.x, y: s.y,
            vx: Math.cos(a) * (25 + Math.random() * 20),
            vy: Math.sin(a) * (25 + Math.random() * 20) - 18,
            life: 1,
            color: ["#ffd740", "#4CAF50", "#fff", "#ffab40"][p % 4],
            size: 1 + Math.random() * 0.8,
          });
        }
      }
    } else {
      s.settleTimer = Math.max(0, s.settleTimer - dt * 3);
    }

    s.vx += ax * dt; s.vy += ay * dt;

    const isFleeing = pressed || s.fleeTimer > 0;
    const maxSpd = isFleeing ? 70 + s.panic * 40 : 50 + s.panic * 30;
    const dmpVal = s.isGrazing ? 0.85 : isFleeing ? 0.975 : (0.93 - s.panic * 0.03);
    s.vx *= dmpVal; s.vy *= dmpVal;
    const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
    if (spd > maxSpd) { s.vx = (s.vx / spd) * maxSpd; s.vy = (s.vy / spd) * maxSpd; }

    s.x += s.vx * dt; s.y += s.vy * dt;
    if (spd > 5) s.headDir += angleDiff(s.headDir, Math.atan2(s.vy, s.vx)) * Math.min(dt * 6, 0.15);

    const fc = fenceCollide(s.x, s.y, 3);
    if (Math.abs(fc.x - s.x) > 0.1) s.vx = 0;
    if (Math.abs(fc.y - s.y) > 0.1) s.vy = 0;
    s.x = fc.x; s.y = fc.y;
  }

  return { settledCount, newParticles };
}

// Expose as globals when loaded in the browser via <script type="module">
if (typeof window !== 'undefined') {
  Object.assign(window, {
    W, H, PEN, FENCE_L, FENCE_R, FENCE_T, FENCE_B,
    lerp, dist, clamp, angleDiff,
    wallInfo, fenceCollide, isInPen,
    clusterSheep, createSheep, createDog,
    updateParticles, updateDog, updateSheep,
  });
}
