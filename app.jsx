const { useState, useEffect, useRef, useCallback } = React;

const W = 280;
const H = 210;
// Full-height pen on right side
const PEN = { x: 224, y: 14, w: 40, h: H - 30, gateY: 55, gateH: 75 };
const FENCE_L = 14, FENCE_R = W - 14, FENCE_T = 14, FENCE_B = H - 14;

function lerp(a, b, t) { return a + (b - a) * t; }
function dist(a, b) { return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2); }
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function angleDiff(a, b) { return ((b - a + Math.PI * 3) % (Math.PI * 2)) - Math.PI; }

function makeWhistle(ctx, freq, dur, sweep = 1.3) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * sweep, ctx.currentTime + dur * 0.35);
    o.frequency.exponentialRampToValueAtTime(freq * 0.65, ctx.currentTime + dur);
    g.gain.setValueAtTime(0.1, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  } catch (e) {}
}

function celebSound(ctx, index) {
  if (!ctx) return;
  try {
    const bf = 520 + index * 60;
    [0, 0.1, 0.18].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = i === 2 ? "triangle" : "sine";
      o.frequency.setValueAtTime(bf + i * 120, ctx.currentTime + d);
      g.gain.setValueAtTime(0.08, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.25);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.25);
    });
  } catch (e) {}
}

function winFanfare(ctx) {
  if (!ctx) return;
  try {
    [0, 0.15, 0.3, 0.5, 0.65].forEach((d, i) => {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.type = "triangle";
      o.frequency.setValueAtTime([523, 659, 784, 1047, 1319][i], ctx.currentTime + d);
      g.gain.setValueAtTime(0.1, ctx.currentTime + d);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + d + 0.4);
      o.connect(g).connect(ctx.destination);
      o.start(ctx.currentTime + d); o.stop(ctx.currentTime + d + 0.4);
    });
  } catch (e) {}
}

function clusterSheep(sheep) {
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

// Wall proximity info for an entity
function wallInfo(x, y, margin) {
  return {
    nearL: x < FENCE_L + margin,
    nearR: x > FENCE_R - margin,
    nearT: y < FENCE_T + margin,
    nearB: y > FENCE_B - margin,
    // Also pen walls (only outside pen)
    nearPenL: x > PEN.x - margin && x < PEN.x + 4 + margin && y >= PEN.y && y <= PEN.y + PEN.h
              && !(y >= PEN.gateY && y <= PEN.gateY + PEN.gateH),
    nearPenB: y > PEN.y + PEN.h - 4 - margin && y < PEN.y + PEN.h + margin
              && x >= PEN.x && x <= PEN.x + PEN.w,
  };
}

function fenceCollide(x, y, r) {
  let nx = x, ny = y;
  nx = clamp(nx, FENCE_L + r, FENCE_R - r);
  ny = clamp(ny, FENCE_T + r, FENCE_B - r);
  const inGate = ny >= PEN.gateY && ny <= PEN.gateY + PEN.gateH;
  // Pen left wall
  if (!inGate && nx > PEN.x - r && nx < PEN.x + 3 + r && ny >= PEN.y && ny <= PEN.y + PEN.h)
    nx = x < PEN.x ? PEN.x - r : PEN.x + 3 + r;
  // Pen bottom wall
  if (nx >= PEN.x && nx <= PEN.x + PEN.w)
    if (ny > PEN.y + PEN.h - 3 - r && ny < PEN.y + PEN.h + r)
      ny = y < PEN.y + PEN.h - 1 ? PEN.y + PEN.h - 3 - r : PEN.y + PEN.h + r;
  return { x: nx, y: ny };
}

function isInPen(x, y) {
  return x >= PEN.x + 2 && x <= PEN.x + PEN.w - 2 && y >= PEN.y + 2 && y <= PEN.y + PEN.h - 4;
}

function createSheep(n) {
  return Array.from({ length: n }, () => ({
    x: 28 + Math.random() * 150, y: 30 + Math.random() * 150,
    vx: 0, vy: 0, wobble: Math.random() * Math.PI * 2,
    grazeTimer: Math.random() * 200, isGrazing: false,
    headDir: Math.random() * Math.PI * 2, settled: false, settleTimer: 0,
    panic: 0, fleeTimer: 0,
  }));
}

function createDog() {
  return {
    x: 110, y: 185, vx: 0, vy: 0,
    targetX: 110, targetY: 185,
    angle: Math.PI * 0.5, distFromFocus: 65,
    wobble: 0, focusIndex: 0,
    idleTime: 0, lookDir: 0, lookTarget: 0, tailWag: 0,
    renderDir: Math.PI * 0.5,
  };
}

function SheepHerdingGame() {
  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);
  const keysRef = useRef(new Set());
  const lastWhistleRef = useRef(null);
  const whistleBtnRef = useRef(null);
  const [gameState, setGameState] = useState("title");
  const [timer, setTimer] = useState(0);
  const [sheepCount, setSheepCount] = useState(0);
  const [totalSheep, setTotalSheep] = useState(7);
  const [activeWhistle, setActiveWhistle] = useState(null);
  const [focusInfo, setFocusInfo] = useState("");
  const [showSettings, setShowSettings] = useState(false);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  }, []);

  const initGame = useCallback((n) => {
    const count = n || totalSheep;
    gameRef.current = {
      sheep: createSheep(count), dog: createDog(),
      tick: 0, won: false, winDelay: 0, particles: [],
      grass: Array.from({ length: 500 }, () => ({
        x: Math.floor(FENCE_L + Math.random() * (FENCE_R - FENCE_L)),
        y: Math.floor(FENCE_T + Math.random() * (FENCE_B - FENCE_T)),
        shade: Math.floor(Math.random() * 3),
      })),
      clusters: [], numSheep: count,
    };
    setTimer(0); setSheepCount(0); setGameState("playing"); setFocusInfo(""); setShowSettings(false);
  }, [totalSheep]);

  useEffect(() => {
    const down = (e) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === " " && gameState === "title") { e.preventDefault(); initGame(); }
      if (e.key.toLowerCase() === "r" && gameState !== "title") initGame();
    };
    const up = (e) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [gameState, initGame]);

  useEffect(() => () => { if (audioRef.current) audioRef.current.close(); }, []);

  useEffect(() => {
    if (gameState !== "playing") return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = false;
    let animId, lastTime = performance.now(), timerAccum = 0;

    function getWhistle() {
      const k = keysRef.current;
      if (k.has("1") || k.has("q")) return "comebye";
      if (k.has("2") || k.has("w")) return "away";
      if (k.has("3") || k.has("e")) return "walkup";
      return whistleBtnRef.current;
    }

    function updateDog(dog, sheep, cmd, dt) {
      const clusters = clusterSheep(sheep);
      gameRef.current.clusters = clusters;
      if (clusters.length === 0) return;
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

      // Compute raw target
      let rawTX = focus.x + Math.cos(dog.angle) * dog.distFromFocus + Math.sin(dog.wobble) * 1;
      let rawTY = focus.y + Math.sin(dog.angle) * dog.distFromFocus + Math.cos(dog.wobble * 0.7) * 1;

      // Project target onto field if it's behind a wall — slide along boundary
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

      const prevX = dog.x, prevY = dog.y;
      dog.x += dog.vx * dt; dog.y += dog.vy * dt;
      const fc2 = fenceCollide(dog.x, dog.y, 3);

      // Instant direction change on wall contact — kill velocity on blocked axis
      if (Math.abs(fc2.x - dog.x) > 0.1) { dog.vx = 0; }
      if (Math.abs(fc2.y - dog.y) > 0.1) { dog.vy = 0; }
      dog.x = fc2.x; dog.y = fc2.y;

      // Smooth visual facing direction — never snaps
      const dSpd2 = Math.sqrt(dog.vx * dog.vx + dog.vy * dog.vy);
      const targetDir = dSpd2 > 3 ? Math.atan2(dog.vy, dog.vx) : dog.lookDir;
      dog.renderDir = dog.renderDir + angleDiff(dog.renderDir, targetDir) * Math.min(dt * 8, 0.25);

      setFocusInfo(clusters.length > 1 ? `Focus: group of ${focus.size}` : clusters.length === 1 ? `Flock: ${focus.size}` : "");
    }

    function updateSheep(sheep, dog, dt) {
      const tick = gameRef.current.tick;
      const wallMargin = 14;

      for (let i = 0; i < sheep.length; i++) {
        const s = sheep[i];
        if (s.settled) continue;
        s.wobble += dt * 2.5;
        let ax = 0, ay = 0;

        const dd = dist(s, dog);
        const fleeDist = 56;
        const pressed = dd < fleeDist && dd > 0;

        // Flee from dog — strong initial burst, sheep commit to a direction
        if (pressed) {
          const str = ((fleeDist - dd) / fleeDist) ** 1.3 * 200;
          const fleeX = (s.x - dog.x) / dd;
          const fleeY = (s.y - dog.y) / dd;
          ax += fleeX * str;
          ay += fleeY * str;
          s.isGrazing = false;
          s.grazeTimer = 100 + Math.random() * 120;
          s.fleeTimer = 1.2; // coast for this long after dog passes
        }
        // Coast phase — keep running in current direction after dog pressure ends
        if (s.fleeTimer > 0) {
          s.fleeTimer -= dt;
        }

        // --- Corner/wall panic system ---
        const wi = wallInfo(s.x, s.y, wallMargin);
        const nearWallCount = [wi.nearL, wi.nearR, wi.nearT, wi.nearB, wi.nearPenL, wi.nearPenB]
          .filter(Boolean).length;

        if (pressed && nearWallCount >= 1) {
          // Increase panic
          s.panic = Math.min(s.panic + dt * 3, 1);
        } else {
          s.panic = Math.max(s.panic - dt * 1.5, 0);
        }

        if (pressed && nearWallCount >= 1) {
          const panicStr = 80 + s.panic * 120;

          // Find escape direction: tangent along wall, away from dog
          // Determine which walls we're near and add tangential escape forces
          if (wi.nearL || wi.nearR || wi.nearPenL) {
            // Near vertical wall — escape along Y axis
            const escapeY = (s.y > dog.y) ? 1 : -1;
            ay += escapeY * panicStr;
            // Slight push away from wall
            if (wi.nearL) ax += panicStr * 0.4;
            if (wi.nearR) ax -= panicStr * 0.4;
            if (wi.nearPenL) ax -= panicStr * 0.4;
          }
          if (wi.nearT || wi.nearB || wi.nearPenB) {
            // Near horizontal wall — escape along X axis
            const escapeX = (s.x > dog.x) ? 1 : -1;
            ax += escapeX * panicStr;
            if (wi.nearT) ay += panicStr * 0.4;
            if (wi.nearB) ay -= panicStr * 0.4;
            if (wi.nearPenB) ay -= panicStr * 0.4;
          }

          // True corner: near 2+ walls — big panic burst outward
          if (nearWallCount >= 2 && s.panic > 0.5) {
            // Find the open direction (center of field)
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
          // When fleeing, sheep care less about staying in a flock — they run
          const cohStr = (pressed || s.fleeTimer > 0) ? 0.25 : 0.9;
          ax += ((cohX / nb) - s.x) * cohStr;
          ay += ((cohY / nb) - s.y) * cohStr;
          ax += (aliX / nb) * 0.35; ay += (aliY / nb) * 0.35;
        }

        // Graze
        s.grazeTimer -= dt * 60;
        if (s.grazeTimer <= 0 && dd > fleeDist * 1.3) {
          s.isGrazing = true; s.grazeTimer = 100 + Math.random() * 220;
          s.headDir += (Math.random() - 0.5) * 1.0;
        }
        if (s.isGrazing && dd < fleeDist) s.isGrazing = false;

        // Wander
        if (!s.isGrazing) {
          ax += Math.sin(tick * 0.019 + i * 7.3) * 3.5;
          ay += Math.cos(tick * 0.015 + i * 5.1) * 3.5;
        } else { ax *= 0.08; ay *= 0.08; }

        // Pen pull
        if (isInPen(s.x, s.y)) {
          const pcx = PEN.x + PEN.w / 2, pcy = PEN.y + PEN.h / 2;
          ax += (pcx - s.x) * 0.7; ay += (pcy - s.y) * 0.7;
          s.settleTimer += dt;
          if (s.settleTimer > 1.6 && !s.settled) {
            s.settled = true; s.vx = 0; s.vy = 0;
            const g = gameRef.current;
            const sc = sheep.filter(sh => sh.settled).length;
            for (let p = 0; p < 14; p++) {
              const a = (p / 14) * Math.PI * 2;
              g.particles.push({
                x: s.x, y: s.y,
                vx: Math.cos(a) * (25 + Math.random() * 20),
                vy: Math.sin(a) * (25 + Math.random() * 20) - 18,
                life: 1,
                color: ["#ffd740", "#4CAF50", "#fff", "#ffab40"][p % 4],
                size: 1 + Math.random() * 0.8,
              });
            }
            celebSound(ensureAudio(), sc);
          }
        } else {
          s.settleTimer = Math.max(0, s.settleTimer - dt * 3);
        }

        s.vx += ax * dt; s.vy += ay * dt;

        // When fleeing or coasting, much less friction so sheep run further in straight lines
        const isFleeing = pressed || s.fleeTimer > 0;
        const maxSpd = isFleeing ? 70 + s.panic * 40 : 50 + s.panic * 30;
        const dmpVal = s.isGrazing ? 0.85 : isFleeing ? 0.975 : (0.93 - s.panic * 0.03);
        s.vx *= dmpVal; s.vy *= dmpVal;
        const spd = Math.sqrt(s.vx * s.vx + s.vy * s.vy);
        if (spd > maxSpd) { s.vx = (s.vx / spd) * maxSpd; s.vy = (s.vy / spd) * maxSpd; }

        s.x += s.vx * dt; s.y += s.vy * dt;
        if (spd > 5) s.headDir += angleDiff(s.headDir, Math.atan2(s.vy, s.vx)) * Math.min(dt * 6, 0.15);

        const fc = fenceCollide(s.x, s.y, 3);
        // Kill velocity on blocked axis — no bounce reversal that causes flicker
        if (Math.abs(fc.x - s.x) > 0.1) s.vx = 0;
        if (Math.abs(fc.y - s.y) > 0.1) s.vy = 0;
        s.x = fc.x; s.y = fc.y;
      }
    }

    function updateParticles(dt) {
      const g = gameRef.current;
      g.particles = g.particles.filter(p => {
        p.x += p.vx * dt; p.y += p.vy * dt;
        p.vy += 55 * dt; p.vx *= 0.97; p.life -= dt * 1.6;
        return p.life > 0;
      });
    }

    function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.floor(x), Math.floor(y), w, h); }

    function render(c) {
      const g = gameRef.current;
      c.fillStyle = "#3a7d28"; c.fillRect(0, 0, W, H);
      g.grass.forEach(gs => { c.fillStyle = ["#348522", "#3f8a2d", "#2d7a1e"][gs.shade]; c.fillRect(gs.x, gs.y, 1, 1); });

      // Outer fences
      const fB = "#6B4226", fL = "#8B5E3C";
      px(c, FENCE_L - 2, FENCE_T - 2, W - 24, 3, fB); px(c, FENCE_L - 2, FENCE_T - 2, W - 24, 2, fL);
      px(c, FENCE_L - 2, FENCE_B, W - 24, 3, fB); px(c, FENCE_L - 2, FENCE_B, W - 24, 2, fL);
      px(c, FENCE_L - 2, FENCE_T - 2, 3, FENCE_B - FENCE_T + 5, fB); px(c, FENCE_L - 2, FENCE_T - 2, 2, FENCE_B - FENCE_T + 5, fL);
      px(c, FENCE_R, FENCE_T - 2, 3, FENCE_B - FENCE_T + 5, fB); px(c, FENCE_R, FENCE_T - 2, 2, FENCE_B - FENCE_T + 5, fL);

      // Posts
      for (let p = FENCE_L + 6; p < FENCE_R; p += 18) { px(c, p, FENCE_T - 3, 2, 4, "#5a3a1a"); px(c, p, FENCE_B - 1, 2, 4, "#5a3a1a"); }
      for (let p = FENCE_T + 6; p < FENCE_B; p += 18) { px(c, FENCE_L - 3, p, 4, 2, "#5a3a1a"); px(c, FENCE_R - 1, p, 4, 2, "#5a3a1a"); }

      // Pen interior
      c.fillStyle = "#3a8530"; c.fillRect(PEN.x + 3, PEN.y, PEN.w - 3, PEN.h);

      // Pen fences
      const pB = "#7a5030", pL = "#a0714f";
      // Left wall top segment (above gate)
      px(c, PEN.x, PEN.y, 3, PEN.gateY - PEN.y, pB); px(c, PEN.x, PEN.y, 2, PEN.gateY - PEN.y, pL);
      // Left wall bottom segment (below gate)
      px(c, PEN.x, PEN.gateY + PEN.gateH, 3, (PEN.y + PEN.h) - (PEN.gateY + PEN.gateH), pB);
      px(c, PEN.x, PEN.gateY + PEN.gateH, 2, (PEN.y + PEN.h) - (PEN.gateY + PEN.gateH), pL);
      // Bottom wall
      px(c, PEN.x, PEN.y + PEN.h - 1, PEN.w, 3, pB); px(c, PEN.x, PEN.y + PEN.h - 1, PEN.w, 2, pL);

      // Gate posts (bigger for visibility)
      px(c, PEN.x - 1, PEN.gateY - 2, 4, 4, "#5a3a1a");
      px(c, PEN.x - 1, PEN.gateY + PEN.gateH - 2, 4, 4, "#5a3a1a");

      // Pen posts along walls
      for (let p = PEN.y + 8; p < PEN.gateY; p += 14) px(c, PEN.x - 1, p, 3, 2, "#5a3a1a");
      for (let p = PEN.gateY + PEN.gateH + 8; p < PEN.y + PEN.h - 4; p += 14) px(c, PEN.x - 1, p, 3, 2, "#5a3a1a");

      // Gate opening hint — subtle lighter ground
      c.fillStyle = "rgba(160,180,100,0.08)";
      c.fillRect(PEN.x - 6, PEN.gateY + 2, 8, PEN.gateH - 4);

      // Focus ring
      if (g.clusters.length > 1) {
        const fi = clamp(g.dog.focusIndex, 0, g.clusters.length - 1);
        const fc = g.clusters[fi];
        if (fc) {
          c.strokeStyle = "rgba(255,255,200,0.1)";
          c.lineWidth = 1; c.setLineDash([2, 3]);
          c.beginPath(); c.arc(Math.floor(fc.x), Math.floor(fc.y), 22, 0, Math.PI * 2); c.stroke();
          c.setLineDash([]);
        }
      }

      // Sheep sorted by Y for depth
      const sorted = [...g.sheep].sort((a, b) => a.y - b.y);
      sorted.forEach(s => {
        const bx = Math.floor(s.x), by = Math.floor(s.y);
        const wb = s.isGrazing ? Math.sin(s.wobble * 0.5) * 0.5 : Math.sin(s.wobble) * 0.3;

        c.fillStyle = "rgba(0,0,0,0.13)"; c.fillRect(bx - 2, by + 3, 6, 2);

        // Tint reddish when panicking
        const panicTint = s.panic > 0.3;
        c.fillStyle = s.settled ? "#ddddd0" : panicTint ? "#f0e0d0" : "#f0f0e0";
        c.fillRect(bx - 2, by - 2 + wb, 5, 5);
        c.fillRect(bx - 1, by - 3 + wb, 3, 1);
        c.fillRect(bx - 1, by + 3 + wb, 3, 1);
        c.fillStyle = s.settled ? "#e8e8dc" : panicTint ? "#f8ece0" : "#fafaf0";
        c.fillRect(bx - 1, by - 2 + wb, 3, 2);

        const hx = bx + Math.cos(s.headDir) * 3.5, hy = by + Math.sin(s.headDir) * 3.5;
        c.fillStyle = "#b0a898"; c.fillRect(Math.floor(hx) - 1, Math.floor(hy) - 1, 3, 2);
        c.fillStyle = "#333"; c.fillRect(Math.floor(hx), Math.floor(hy) - 1, 1, 1);
        c.fillStyle = "#777"; c.fillRect(bx - 1, by + 3, 1, 2); c.fillRect(bx + 1, by + 3, 1, 2);

        if (s.settled) {
          c.fillStyle = "#4CAF50";
          c.fillRect(bx - 1, by - 5, 1, 1); c.fillRect(bx, by - 6, 1, 2); c.fillRect(bx + 1, by - 7, 1, 1);
        }
      });

      // Dog collie
      const d = g.dog;
      const dx = Math.floor(d.x), dy = Math.floor(d.y);
      const dSpd = Math.sqrt(d.vx * d.vx + d.vy * d.vy);
      const dir = d.renderDir;

      c.fillStyle = "rgba(0,0,0,0.18)"; c.fillRect(dx - 3, dy + 2, 7, 2);

      // Tail
      const tw = Math.sin(d.tailWag) * 0.5;
      const tailD = dir + Math.PI + tw;
      const tailX = dx + Math.cos(tailD) * 5, tailY = dy + Math.sin(tailD) * 5;
      c.fillStyle = "#1a1a1a"; c.fillRect(Math.floor(tailX), Math.floor(tailY), 2, 1);
      c.fillStyle = "#eee8dd"; c.fillRect(Math.floor(tailX + Math.cos(tailD) * 1.5), Math.floor(tailY + Math.sin(tailD) * 1.5), 1, 1);

      // Body
      c.fillStyle = "#1a1a1a";
      c.fillRect(dx - 2, dy - 2, 5, 4); c.fillRect(dx - 3, dy - 1, 7, 2);
      c.fillStyle = "#eee8dd";
      c.fillRect(Math.floor(dx + Math.cos(dir) * 1) - 1, Math.floor(dy + Math.sin(dir) * 1), 3, 2);

      // Head
      const hx2 = dx + Math.cos(dir) * 4.5, hy2 = dy + Math.sin(dir) * 4.5;
      c.fillStyle = "#1a1a1a"; c.fillRect(Math.floor(hx2) - 2, Math.floor(hy2) - 1, 4, 3);
      c.fillStyle = "#eee8dd"; c.fillRect(Math.floor(hx2), Math.floor(hy2) - 1, 1, 3);
      const snX = hx2 + Math.cos(dir) * 2, snY = hy2 + Math.sin(dir) * 2;
      c.fillStyle = "#eee8dd"; c.fillRect(Math.floor(snX), Math.floor(snY), 2, 1);
      c.fillStyle = "#222"; c.fillRect(Math.floor(snX) + 1, Math.floor(snY), 1, 1);
      c.fillStyle = "#d4a040";
      c.fillRect(Math.floor(hx2) - 1, Math.floor(hy2) - 1, 1, 1);
      c.fillRect(Math.floor(hx2) + 1, Math.floor(hy2) - 1, 1, 1);
      c.fillStyle = "#111";
      c.fillRect(Math.floor(hx2) - 2, Math.floor(hy2) - 2, 1, 2);
      c.fillRect(Math.floor(hx2) + 2, Math.floor(hy2) - 2, 1, 2);

      const wCmd = getWhistle();
      if (wCmd) {
        c.fillStyle = "rgba(255,255,200,0.22)";
        c.beginPath(); c.arc(dx, dy - 7, 4 + Math.sin(g.tick * 0.2) * 1.5, 0, Math.PI * 2); c.fill();
      }
      if (!wCmd && d.idleTime > 0.8 && d.idleTime < 1.5) {
        const a = 0.3 * Math.min(1, (d.idleTime - 0.8) / 0.3);
        c.fillStyle = `rgba(200,200,150,${a})`;
        c.fillRect(Math.floor(dx + Math.cos(d.lookDir) * 9), Math.floor(dy + Math.sin(d.lookDir) * 9), 2, 2);
      }

      // Particles
      g.particles.forEach(p => {
        c.globalAlpha = clamp(p.life, 0, 1);
        c.fillStyle = p.color;
        c.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size));
      });
      c.globalAlpha = 1;
    }

    function loop(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const g = gameRef.current;
      if (!g) { animId = requestAnimationFrame(loop); return; }
      if (g.won) {
        g.winDelay += dt;
        updateParticles(dt);
        render(ctx);
        if (g.winDelay > 2) setGameState("won");
        animId = requestAnimationFrame(loop); return;
      }

      g.tick++;
      timerAccum += dt;
      if (timerAccum >= 1) { timerAccum -= 1; setTimer(t => t + 1); }

      const cmd = getWhistle();
      if (cmd && cmd !== lastWhistleRef.current) {
        const ac = ensureAudio();
        if (cmd === "comebye") makeWhistle(ac, 780, 0.35);
        else if (cmd === "away") makeWhistle(ac, 580, 0.35, 0.8);
        else if (cmd === "walkup") makeWhistle(ac, 1050, 0.2, 1.5);
      }
      lastWhistleRef.current = cmd;
      setActiveWhistle(cmd);

      updateDog(g.dog, g.sheep, cmd, dt);
      updateSheep(g.sheep, g.dog, dt);
      updateParticles(dt);

      const settled = g.sheep.filter(s => s.settled).length;
      setSheepCount(settled);
      if (settled === g.numSheep && !g.won) {
        g.won = true; g.winDelay = 0;
        winFanfare(ensureAudio());
        for (let p = 0; p < 50; p++) {
          const a = (p / 50) * Math.PI * 2, r = 30 + Math.random() * 35;
          g.particles.push({
            x: PEN.x + PEN.w / 2, y: PEN.y + PEN.h / 2,
            vx: Math.cos(a) * r, vy: Math.sin(a) * r - 25,
            life: 1.8, color: ["#ffd740", "#ff6e40", "#4CAF50", "#fff", "#42a5f5"][p % 5],
            size: 1.5 + Math.random(),
          });
        }
      }

      render(ctx);
      animId = requestAnimationFrame(loop);
    }

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, [gameState, ensureAudio, totalSheep]);

  const wDown = (cmd) => { whistleBtnRef.current = cmd; ensureAudio(); };
  const wUp = () => { whistleBtnRef.current = null; };
  const fmtTime = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const wColors = {
    comebye: { bg: "#c49828", active: "#ffe04a", text: "#4a3a08" },
    away: { bg: "#3878a0", active: "#58c8f0", text: "#0e2a3a" },
    walkup: { bg: "#b04838", active: "#ff7060", text: "#3a0e08" },
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh", background: "#0e1608", fontFamily: "'Courier New', monospace",
      padding: "8px", boxSizing: "border-box", userSelect: "none",
    }}>
      <div style={{ color: "#a0b878", fontSize: 13, letterSpacing: 5, marginBottom: 3, textTransform: "uppercase", fontWeight: "bold" }}>
        Sheep Herder
      </div>
      <div style={{ display: "flex", gap: 16, marginBottom: 4, color: "#7a8858", fontSize: 11, alignItems: "center" }}>
        <span>{fmtTime(timer)}</span>
        <span style={{ color: "#a0b878" }}>{sheepCount}/{totalSheep} penned</span>
        {focusInfo && gameState === "playing" && <span style={{ color: "#5a6838", fontSize: 10 }}>{focusInfo}</span>}
        {gameState === "playing" && (
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button onClick={() => setShowSettings(v => !v)} style={{
              background: showSettings ? "#3a4a20" : "none", border: "1px solid #3a4a20", color: "#8a9868",
              fontSize: 10, padding: "2px 8px", fontFamily: "'Courier New', monospace",
              cursor: "pointer", borderRadius: 2,
            }}>{showSettings ? "✕" : "⚙"} Settings</button>
            {showSettings && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 10,
                background: "#1a2410", border: "1px solid #3a4a20", borderRadius: 3,
                padding: "10px 14px", minWidth: 180,
              }}>
                <div style={{ color: "#8a9868", fontSize: 10, marginBottom: 6 }}>SHEEP COUNT</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {[5, 7, 10, 15].map(n => (
                    <button key={n} onClick={() => { setTotalSheep(n); }} style={{
                      background: n === totalSheep ? "#4a6828" : "#222e14",
                      color: n === totalSheep ? "#d0dca8" : "#4a5830",
                      border: `1px solid ${n === totalSheep ? "#6a8a3a" : "#2a3818"}`,
                      borderRadius: 2, padding: "3px 9px", fontSize: 11,
                      fontFamily: "'Courier New', monospace", cursor: "pointer",
                    }}>{n}</button>
                  ))}
                </div>
                <button onClick={() => { setShowSettings(false); initGame(); }} style={{
                  background: "#3a5820", color: "#d0dca8", border: "1px solid #5a7a38",
                  padding: "5px 14px", fontSize: 11, fontFamily: "'Courier New', monospace",
                  cursor: "pointer", borderRadius: 2, width: "100%", letterSpacing: 1,
                }}>RESTART</button>
                <button onClick={() => { setShowSettings(false); setGameState("title"); }} style={{
                  background: "#1e2a12", color: "#6a7848", border: "1px solid #2a3818",
                  padding: "5px 14px", fontSize: 11, fontFamily: "'Courier New', monospace",
                  cursor: "pointer", borderRadius: 2, width: "100%", letterSpacing: 1, marginTop: 4,
                }}>MAIN MENU</button>
                <div style={{ color: "#3a4828", fontSize: 8, marginTop: 6, textAlign: "center" }}>
                  Changing sheep count applies on restart
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {gameState === "title" && (
        <div style={{
          display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center",
          border: "2px solid #2a3818", borderRadius: 2,
          background: "rgba(10, 16, 5, 0.92)", padding: "24px 16px",
          width: "100%", maxWidth: W * 3 + 4,
        }}>
          <div style={{ color: "#d0dca8", fontSize: 28, fontWeight: "bold", letterSpacing: 4, marginBottom: 6 }}>
            SHEEP HERDER
          </div>
          <div style={{ color: "#7a8858", fontSize: 11, marginBottom: 14, textAlign: "center", lineHeight: 1.8, maxWidth: 380 }}>
            Command your collie with three whistles.<br />
            The dog circles or approaches sheep — they flee from it.<br />
            Position the dog to push sheep through the gate into the pen.<br />
            Release all whistles to let the dog rest and refocus.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <span style={{ color: "#5a6838", fontSize: 10, marginRight: 4 }}>SHEEP:</span>
            {[5, 7, 10, 15].map(n => (
              <button key={n} onClick={() => setTotalSheep(n)} style={{
                background: n === totalSheep ? "#4a6828" : "#1e2a12",
                color: n === totalSheep ? "#d0dca8" : "#4a5830",
                border: `1px solid ${n === totalSheep ? "#6a8a3a" : "#2a3818"}`,
                borderRadius: 2, padding: "4px 10px", fontSize: 12,
                fontFamily: "'Courier New', monospace", cursor: "pointer",
                transition: "all 0.15s",
              }}>{n}</button>
            ))}
          </div>
          <button onClick={() => initGame()} style={{
            background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
            padding: "10px 40px", fontSize: 14, fontFamily: "'Courier New', monospace",
            cursor: "pointer", letterSpacing: 3, borderRadius: 2,
          }}>START</button>
          <div style={{ color: "#3a4828", fontSize: 9, marginTop: 8 }}>Q / W / E &nbsp;or&nbsp; 1 / 2 / 3 &nbsp;&nbsp;·&nbsp;&nbsp; R = reset</div>
        </div>
      )}

      {gameState !== "title" && (
      <div style={{ position: "relative", border: "2px solid #2a3818", borderRadius: 2, lineHeight: 0, overflow: "hidden" }}>
        <canvas ref={canvasRef} width={W} height={H} style={{
          width: "100%", maxWidth: W * 3, height: "auto",
          aspectRatio: `${W} / ${H}`, imageRendering: "pixelated", display: "block",
        }} />

        {gameState === "won" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(10, 16, 5, 0.88)",
          }}>
            <div style={{ color: "#ffd740", fontSize: 24, fontWeight: "bold", letterSpacing: 4, marginBottom: 4 }}>ALL PENNED!</div>
            <div style={{ color: "#a0b878", fontSize: 15, marginBottom: 3 }}>{totalSheep} sheep — {fmtTime(timer)}</div>
            <div style={{ color: "#5a6838", fontSize: 10, marginBottom: 14 }}>
              {timer < 25 ? "Lightning fast!" : timer < 45 ? "Sharp herding!" : timer < 90 ? "Well done!" : "Patience pays off!"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => initGame()} style={{
                background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
                padding: "8px 24px", fontSize: 12, fontFamily: "'Courier New', monospace",
                cursor: "pointer", letterSpacing: 2, borderRadius: 2,
              }}>AGAIN</button>
              <button onClick={() => setGameState("title")} style={{
                background: "#1e2a12", color: "#6a7848", border: "2px solid #2a3818",
                padding: "8px 24px", fontSize: 12, fontFamily: "'Courier New', monospace",
                cursor: "pointer", letterSpacing: 2, borderRadius: 2,
              }}>MENU</button>
            </div>
          </div>
        )}
      </div>
      )}

      <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
        {[
          { cmd: "comebye", label: "Come-bye", sub: "circle left", key: "Q/1" },
          { cmd: "away", label: "Away to me", sub: "circle right", key: "W/2" },
          { cmd: "walkup", label: "Walk up", sub: "approach", key: "E/3" },
        ].map(({ cmd, label, sub, key }) => {
          const cl = wColors[cmd];
          const on = activeWhistle === cmd;
          return (
            <button key={cmd}
              onPointerDown={(e) => { e.preventDefault(); wDown(cmd); }}
              onPointerUp={wUp} onPointerLeave={wUp} onContextMenu={e => e.preventDefault()}
              style={{
                background: on ? cl.active : cl.bg, color: cl.text,
                border: `2px solid ${on ? "#fff" : cl.text}`,
                borderRadius: 3, padding: "7px 11px",
                fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: "bold",
                cursor: "pointer", textAlign: "center", minWidth: 86,
                transition: "all 0.08s", transform: on ? "scale(0.93)" : "scale(1)",
                boxShadow: on ? `0 0 16px ${cl.active}50` : "none", touchAction: "none",
              }}>
              <div>{label}</div>
              <div style={{ fontSize: 8, fontWeight: "normal", opacity: 0.6, marginTop: 2 }}>{sub} [{key}]</div>
            </button>
          );
        })}
      </div>
      <div style={{ color: "#2a3418", fontSize: 8, marginTop: 5, textAlign: "center", maxWidth: 460, lineHeight: 1.5 }}>
        Hold a whistle to command · Release to let the dog pause & refocus · Push sheep through the gate
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SheepHerdingGame />);
