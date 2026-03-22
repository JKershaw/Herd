const { useState, useEffect, useRef, useCallback } = React;

// Constants and pure game functions are loaded from game.js as globals.

// Touch device detection (hide keyboard hints, adjust layout)
const IS_TOUCH = typeof window !== 'undefined' && ('ontouchstart' in window || navigator.maxTouchPoints > 0);

// === High scores (localStorage, top 5 per sheep count) ===
const HS_KEY = "herd-highscores";
function getScores(n) {
  const sc = window.__HERD_SCENARIO;
  if (sc && sc.scores) return sc.scores[n] || [];
  try { return (JSON.parse(localStorage.getItem(HS_KEY)) || {})[n] || []; }
  catch { return []; }
}
function saveScore(n, name, time) {
  let all;
  try { all = JSON.parse(localStorage.getItem(HS_KEY)) || {}; } catch { all = {}; }
  const list = all[n] || [];
  list.push({ name: name.toUpperCase(), time });
  list.sort((a, b) => a.time - b.time);
  all[n] = list.slice(0, 5);
  localStorage.setItem(HS_KEY, JSON.stringify(all));
  return all[n];
}
function qualifies(n, time) {
  const list = getScores(n);
  return list.length < 5 || time < list[list.length - 1].time;
}

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

function popSound(ctx, appearing) {
  if (!ctx) return;
  try {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = "sine";
    const freq = appearing ? 800 : 500;
    const sweep = appearing ? 1.4 : 0.6;
    o.frequency.setValueAtTime(freq, ctx.currentTime);
    o.frequency.exponentialRampToValueAtTime(freq * sweep, ctx.currentTime + 0.06);
    g.gain.setValueAtTime(0.06, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.06);
    o.connect(g).connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + 0.06);
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

const isLocal = location.hostname === "localhost" || location.hostname === "127.0.0.1";
const SHEEP_OPTIONS = isLocal ? [1, 5, 7, 10, 15] : [5, 7, 10, 15];

function SheepHerdingGame() {
  // Scenario mode: when __HERD_SCENARIO is set, render a frozen frame for screenshots
  const scenario = window.__HERD_SCENARIO;
  const scenarioNeedsCanvas = scenario && scenario.gameState !== "title";

  const canvasRef = useRef(null);
  const gameRef = useRef(null);
  const audioRef = useRef(null);
  const keysRef = useRef(new Set());
  const lastWhistleRef = useRef(null);
  const whistleBtnRef = useRef(null);
  const [gameState, setGameState] = useState(
    scenario ? (scenarioNeedsCanvas ? "playing" : scenario.gameState) : "playing"
  );
  const [timer, setTimer] = useState(scenario?.timer ?? 0);
  const [sheepCount, setSheepCount] = useState(scenario?.sheepCount ?? 0);
  const [totalSheep, setTotalSheep] = useState(scenario?.totalSheep ?? 7);
  const [activeWhistle, setActiveWhistle] = useState(scenario?.activeWhistle ?? null);
  const [showSettings, setShowSettings] = useState(scenario?.showSettings ?? false);
  const [nameChars, setNameChars] = useState(scenario?.nameChars ?? [0, 0, 0]);
  const [nameCursor, setNameCursor] = useState(scenario?.nameCursor ?? 0);
  const [lastScore, setLastScore] = useState(scenario?.lastScore ?? null);

  const ensureAudio = useCallback(() => {
    if (!audioRef.current) audioRef.current = new (window.AudioContext || window.webkitAudioContext)();
    if (audioRef.current.state === "suspended") audioRef.current.resume();
    return audioRef.current;
  }, []);

  const initGame = useCallback((n) => {
    const count = n || totalSheep;
    gameRef.current = {
      sheep: createSheep(count), dog: createDog(),
      tick: 0, won: false, winDelay: 0, started: false, particles: [],
      grass: Array.from({ length: 500 }, () => ({
        x: Math.floor(FENCE_L + Math.random() * (FENCE_R - FENCE_L)),
        y: Math.floor(FENCE_T + Math.random() * (FENCE_B - FENCE_T)),
        shade: Math.floor(Math.random() * 3),
      })),
      clusters: [], numSheep: count, popQueue: [],
    };
    setTimer(0); setSheepCount(0); setGameState("playing"); setShowSettings(false);
    setNameChars([0, 0, 0]); setNameCursor(0); setLastScore(null);
  }, [totalSheep]);

  // Start a game immediately on first load (or set up scenario state)
  useEffect(() => {
    if (scenario) {
      const count = scenario.totalSheep || 7;
      gameRef.current = {
        sheep: createSheep(count), dog: createDog(),
        tick: 100, won: false, winDelay: 0, started: true, particles: [],
        grass: Array.from({ length: 500 }, () => ({
          x: Math.floor(FENCE_L + Math.random() * (FENCE_R - FENCE_L)),
          y: Math.floor(FENCE_T + Math.random() * (FENCE_B - FENCE_T)),
          shade: Math.floor(Math.random() * 3),
        })),
        clusters: [], numSheep: count, popQueue: [],
      };
      if (scenario.activeWhistle) whistleBtnRef.current = scenario.activeWhistle;
      if (!scenarioNeedsCanvas) window.__HERD_READY = true;
      return;
    }
    initGame(7);
  }, []);

  useEffect(() => {
    const down = (e) => {
      keysRef.current.add(e.key.toLowerCase());
      if (e.key === " " && gameState === "title") { e.preventDefault(); initGame(); }
      if (e.key.toLowerCase() === "r" && gameState !== "title" && gameState !== "enterName") initGame();
      if (gameState === "enterName") {
        if (e.key === "ArrowUp") { e.preventDefault(); setNameChars(c => { const n = [...c]; n[nameCursor] = (n[nameCursor] - 1 + 26) % 26; return n; }); }
        if (e.key === "ArrowDown") { e.preventDefault(); setNameChars(c => { const n = [...c]; n[nameCursor] = (n[nameCursor] + 1) % 26; return n; }); }
        if (e.key === "ArrowLeft") { e.preventDefault(); setNameCursor(c => Math.max(0, c - 1)); }
        if (e.key === "ArrowRight") { e.preventDefault(); setNameCursor(c => Math.min(2, c + 1)); }
        if (e.key === "Enter") {
          const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const name = nameChars.map(i => ALPHA[i]).join("");
          saveScore(totalSheep, name, timer);
          setLastScore({ name, time: timer });
          setGameState("won");
        }
      }
    };
    const up = (e) => keysRef.current.delete(e.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, [gameState, initGame, nameCursor, nameChars, totalSheep, timer]);

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

    function localUpdateDog(dog, sheep, cmd, dt) {
      const result = updateDog(dog, sheep, cmd, dt);
      gameRef.current.clusters = result.clusters;
    }

    function localUpdateSheep(sheep, dog, dt) {
      const prevSettled = sheep.filter(s => s.settled).length;
      const result = updateSheep(sheep, dog, dt, gameRef.current.tick);
      gameRef.current.particles.push(...result.newParticles);
      const newlySettled = result.settledCount - prevSettled;
      for (let i = 0; i < newlySettled; i++) {
        celebSound(ensureAudio(), prevSettled + i);
      }
    }

    function localUpdateParticles(dt) {
      const g = gameRef.current;
      g.particles = updateParticles(g.particles, dt);
    }

    function px(c, x, y, w, h, col) { c.fillStyle = col; c.fillRect(Math.floor(x), Math.floor(y), w, h); }

    function drawSheep(c, s) {
      const sc = s.scale != null ? s.scale : 1;
      if (sc <= 0) return;
      const bx = Math.floor(s.x), by = Math.floor(s.y);
      const wb = s.isGrazing ? Math.sin(s.wobble * 0.5) * 0.5 : Math.sin(s.wobble) * 0.3;

      if (sc < 1) {
        c.save(); c.translate(bx, by); c.scale(sc, sc); c.translate(-bx, -by);
      }

      c.fillStyle = "rgba(0,0,0,0.13)"; c.fillRect(bx - 2, by + 3, 6, 2);

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

      if (sc < 1) c.restore();
    }

    function drawDog(c, d, tick, whistleActive) {
      const dx = Math.floor(d.x), dy = Math.floor(d.y);
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

      if (whistleActive) {
        c.fillStyle = "rgba(255,255,200,0.22)";
        c.beginPath(); c.arc(dx, dy - 7, 4 + Math.sin(tick * 0.2) * 1.5, 0, Math.PI * 2); c.fill();
      }
      if (!whistleActive && d.idleTime > 0.8 && d.idleTime < 1.5) {
        const a = 0.3 * Math.min(1, (d.idleTime - 0.8) / 0.3);
        c.fillStyle = `rgba(200,200,150,${a})`;
        c.fillRect(Math.floor(dx + Math.cos(d.lookDir) * 9), Math.floor(dy + Math.sin(d.lookDir) * 9), 2, 2);
      }
    }

    function renderSprites(c, sprites) {
      const cellW = 48, cellH = 36;
      const cols = Math.min(sprites.length, 5);
      const rows = Math.ceil(sprites.length / cols);
      const gridW = cols * cellW, gridH = rows * cellH;
      const ox = Math.floor((W - gridW) / 2);
      const oy = Math.floor((H - gridH) / 2);

      c.fillStyle = "#1a2410"; c.fillRect(0, 0, W, H);

      sprites.forEach((sp, i) => {
        const col = i % cols, row = Math.floor(i / cols);
        const cx = ox + col * cellW + cellW / 2;
        const cy = oy + row * cellH + cellH / 2 - 4;

        if (sp.type === "sheep") {
          drawSheep(c, { x: cx, y: cy, wobble: 0, isGrazing: false, panic: 0, settled: false, headDir: 0, ...sp.overrides });
        } else if (sp.type === "dog") {
          drawDog(c, { x: cx, y: cy, vx: 0, vy: 0, renderDir: 0, tailWag: 0, idleTime: 0, lookDir: 0, ...sp.overrides },
            sp.tick || 100, sp.whistleActive || false);
        }

        if (sp.label) {
          c.fillStyle = "#8a9868"; c.font = "7px 'Courier New'"; c.textAlign = "center";
          c.fillText(sp.label, cx, cy + 18);
        }
      });

      // Expose clip bounds for screenshot cropping
      const pad = 4;
      window.__SPRITE_CLIP = { x: ox - pad, y: oy - pad, w: gridW + pad * 2, h: gridH + pad * 2 };
    }

    function render(c) {
      const g = gameRef.current;
      c.fillStyle = "#3a7d28"; c.fillRect(0, 0, W, H);
      // Subtle grass texture variation — patches of slightly different green
      g.grass.forEach(gs => { c.fillStyle = ["#348522", "#3f8a2d", "#2d7a1e", "#368726", "#3a8030"][gs.shade % 5]; c.fillRect(gs.x, gs.y, 1, 1); });
      // Subtle inner vignette on the field
      const vg = c.createRadialGradient(W / 2, H / 2, 40, W / 2, H / 2, Math.max(W, H) * 0.6);
      vg.addColorStop(0, "rgba(0,0,0,0)"); vg.addColorStop(1, "rgba(0,0,0,0.12)");
      c.fillStyle = vg; c.fillRect(0, 0, W, H);

      // Outer fences — with shadow for depth
      const fB = "#6B4226", fL = "#8B5E3C", fS = "rgba(0,0,0,0.15)";
      px(c, FENCE_L - 2, FENCE_T + 1, W - 24, 2, fS); // top shadow
      px(c, FENCE_L - 2, FENCE_B + 3, W - 24, 1, fS); // bottom shadow
      px(c, FENCE_L - 2, FENCE_T - 2, W - 24, 3, fB); px(c, FENCE_L - 2, FENCE_T - 2, W - 24, 2, fL);
      px(c, FENCE_L - 2, FENCE_B, W - 24, 3, fB); px(c, FENCE_L - 2, FENCE_B, W - 24, 2, fL);
      px(c, FENCE_L - 2, FENCE_T - 2, 3, FENCE_B - FENCE_T + 5, fB); px(c, FENCE_L - 2, FENCE_T - 2, 2, FENCE_B - FENCE_T + 5, fL);
      px(c, FENCE_R, FENCE_T - 2, 3, FENCE_B - FENCE_T + 5, fB); px(c, FENCE_R, FENCE_T - 2, 2, FENCE_B - FENCE_T + 5, fL);

      // Posts
      for (let p = FENCE_L + 6; p < FENCE_R; p += 18) { px(c, p, FENCE_T - 3, 2, 4, "#5a3a1a"); px(c, p, FENCE_B - 1, 2, 4, "#5a3a1a"); }
      for (let p = FENCE_T + 6; p < FENCE_B; p += 18) { px(c, FENCE_L - 3, p, 4, 2, "#5a3a1a"); px(c, FENCE_R - 1, p, 4, 2, "#5a3a1a"); }

      // Pen interior — slightly different ground color to mark the goal
      c.fillStyle = "#3a8530"; c.fillRect(PEN.x + 3, PEN.y, PEN.w - 3, PEN.h);
      c.fillStyle = "rgba(180,200,80,0.06)"; c.fillRect(PEN.x + 3, PEN.y, PEN.w - 3, PEN.h);

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

      // Gate opening — bright ground path to draw the eye
      c.fillStyle = "rgba(180,200,80,0.18)";
      c.fillRect(PEN.x - 10, PEN.gateY + 1, 14, PEN.gateH - 2);
      c.fillStyle = "rgba(220,240,120,0.12)";
      c.fillRect(PEN.x - 6, PEN.gateY + 3, 8, PEN.gateH - 6);
      // Gate post highlights
      c.fillStyle = "#8a6a3a";
      c.fillRect(PEN.x - 1, PEN.gateY - 2, 4, 3);
      c.fillRect(PEN.x - 1, PEN.gateY + PEN.gateH - 1, 4, 3);
      // Small chevron arrows pointing into the gate
      const gMidY = PEN.gateY + PEN.gateH / 2;
      c.fillStyle = "rgba(200,220,100,0.22)";
      for (let ci = -1; ci <= 1; ci++) {
        const cy = gMidY + ci * 14;
        if (cy < PEN.gateY + 4 || cy > PEN.gateY + PEN.gateH - 4) continue;
        c.fillRect(PEN.x - 10, cy, 1, 1);
        c.fillRect(PEN.x - 9, cy - 1, 1, 1);
        c.fillRect(PEN.x - 9, cy + 1, 1, 1);
      }

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
      sorted.forEach(s => drawSheep(c, s));

      // Dog collie
      drawDog(c, g.dog, g.tick, getWhistle());

      // Particles
      g.particles.forEach(p => {
        c.globalAlpha = clamp(p.life, 0, 1);
        c.fillStyle = p.color;
        c.fillRect(Math.floor(p.x), Math.floor(p.y), Math.ceil(p.size), Math.ceil(p.size));
      });
      c.globalAlpha = 1;
    }

    // Scenario mode: render one frame, switch to target state, signal ready
    if (scenario) {
      if (scenario.sprites) {
        renderSprites(ctx, scenario.sprites);
      } else {
        render(ctx);
      }
      if (scenarioNeedsCanvas && scenario.gameState !== "playing") {
        setGameState(scenario.gameState);
      }
      window.__HERD_READY = true;
      return;
    }

    function loop(now) {
      const dt = Math.min((now - lastTime) / 1000, 0.05);
      lastTime = now;
      const g = gameRef.current;
      if (!g) { animId = requestAnimationFrame(loop); return; }
      if (g.won) {
        g.winDelay += dt;
        localUpdateParticles(dt);
        render(ctx);
        if (g.winDelay > 2) setGameState(qualifies(g.numSheep, g.finalTime) ? "enterName" : "won");
        animId = requestAnimationFrame(loop); return;
      }

      g.tick++;
      const cmd = getWhistle();

      if (!g.started && cmd) g.started = true;

      if (g.started) {
        timerAccum += dt;
        if (timerAccum >= 1) { timerAccum -= 1; setTimer(t => t + 1); }
      }

      if (cmd && cmd !== lastWhistleRef.current) {
        const ac = ensureAudio();
        if (cmd === "comebye") makeWhistle(ac, 780, 0.35);
        else if (cmd === "away") makeWhistle(ac, 580, 0.35, 0.8);
        else if (cmd === "walkup") makeWhistle(ac, 1050, 0.2, 1.5);
      }
      lastWhistleRef.current = cmd;
      setActiveWhistle(cmd);

      if (g.started) localUpdateDog(g.dog, g.sheep, cmd, dt);
      localUpdateSheep(g.sheep, g.started ? g.dog : { x: -999, y: -999 }, dt);
      localUpdateParticles(dt);

      const settled = g.sheep.filter(s => s.settled && !s.popOut).length;
      setSheepCount(settled);
      if (settled === g.numSheep && !g.won && g.popQueue.length === 0) {
        g.won = true; g.winDelay = 0; g.finalTime = timer;
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

      // Process pop queue — staggered spawning/removing of sheep
      if (g.popQueue.length > 0) {
        g.popQueueTimer = (g.popQueueTimer || 0) + dt;
        while (g.popQueue.length > 0 && g.popQueueTimer >= 0.06) {
          g.popQueueTimer -= 0.06;
          const item = g.popQueue.shift();
          if (item.type === "add") {
            const s = item.sheep;
            s.scale = 0.01;
            s.popIn = true;
            g.sheep.push(s);
            popSound(audioRef.current, true);
          } else if (item.type === "remove") {
            item.sheep.popOut = true;
            popSound(audioRef.current, false);
          }
        }
      }

      // Animate pop scales
      for (let i = g.sheep.length - 1; i >= 0; i--) {
        const s = g.sheep[i];
        if (s.popIn) {
          s.scale = Math.min(s.scale + dt * 6, 1);
          if (s.scale >= 1) {
            s.scale = 1; s.popIn = false;
            // Pop-in particles
            for (let p = 0; p < 6; p++) {
              const a = (p / 6) * Math.PI * 2;
              g.particles.push({
                x: s.x, y: s.y,
                vx: Math.cos(a) * (18 + Math.random() * 12),
                vy: Math.sin(a) * (18 + Math.random() * 12) - 10,
                life: 0.6, color: ["#ffd740", "#4CAF50", "#fff"][p % 3],
                size: 1 + Math.random() * 0.5,
              });
            }
          }
        }
        if (s.popOut) {
          s.scale = Math.max(s.scale - dt * 7, 0);
          if (s.scale <= 0) {
            // Pop-out particles
            for (let p = 0; p < 6; p++) {
              const a = (p / 6) * Math.PI * 2;
              g.particles.push({
                x: s.x, y: s.y,
                vx: Math.cos(a) * (12 + Math.random() * 8),
                vy: Math.sin(a) * (12 + Math.random() * 8) - 8,
                life: 0.4, color: ["#e0e0d0", "#c8d8a0", "#fff"][p % 3],
                size: 1 + Math.random() * 0.3,
              });
            }
            g.sheep.splice(i, 1);
          }
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
    comebye: { bg: "#36562a", active: "#5aaa40", text: "#c8d8a0", glow: "#70c050", border: "#4a7a30" },
    away: { bg: "#2a4a36", active: "#40aa6a", text: "#a8d8c0", glow: "#50c080", border: "#307a4a" },
    walkup: { bg: "#3a5030", active: "#70b050", text: "#d0dca0", glow: "#90d060", border: "#5a8a38" },
  };

  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      minHeight: "100vh",
      background: "radial-gradient(ellipse at center, #162010 0%, #0a0e04 100%)",
      fontFamily: "'Courier New', monospace",
      padding: "6px", boxSizing: "border-box", userSelect: "none",
    }}>
      {gameState !== "title" && (<div style={{
        display: "flex", alignItems: "center", justifyContent: "center",
        gap: 12, marginBottom: 3, width: "100%", maxWidth: W * 3 + 4,
        position: "relative", padding: "0 32px", zIndex: 20,
      }}>
        <span style={{ color: "#c8d8a0", fontSize: 15, fontWeight: "bold", fontVariantNumeric: "tabular-nums" }}>{fmtTime(timer)}</span>
        <span style={{ color: "#a0b878", fontSize: 12, letterSpacing: 1, fontWeight: "bold" }}>HERD</span>
        <span style={{ color: "#c8d8a0", fontSize: 15, fontWeight: "bold" }}>{sheepCount}<span style={{ color: "#7a8a58", fontSize: 11 }}>/{totalSheep}</span></span>
        {gameState === "playing" && (
          <div style={{ position: "absolute", right: 0, top: "50%", transform: "translateY(-50%)" }}>
            <button onClick={() => setShowSettings(v => !v)} style={{
              background: showSettings ? "#3a4a20" : "none", border: "none", color: "#8a9868",
              fontSize: 16, padding: "4px 6px", cursor: "pointer", lineHeight: 1,
            }}>{showSettings ? "✕" : "\u2699"}</button>
            {showSettings && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 10,
                background: "#1a2410", border: "1px solid #3a4a20", borderRadius: 3,
                padding: "10px 14px", minWidth: 180,
              }}>
                <div style={{ color: "#a0b878", fontSize: 10, marginBottom: 6 }}>SHEEP COUNT</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {SHEEP_OPTIONS.map(n => (
                    <button key={n} onClick={() => {
                      if (n === totalSheep) return;
                      const g = gameRef.current;
                      if (!g) return;
                      ensureAudio();
                      // Cancel any pending pops and remove any mid-pop-out sheep
                      g.popQueue = [];
                      g.popQueueTimer = 0;
                      g.sheep = g.sheep.filter(s => !s.popOut);
                      g.sheep.forEach(s => { if (s.popIn) { s.popIn = false; s.scale = 1; } });
                      const currentCount = g.sheep.length;
                      const diff = n - currentCount;
                      if (diff > 0) {
                        // Add sheep with staggered pop-in
                        for (let i = 0; i < diff; i++) {
                          const s = createSheep(1)[0];
                          g.popQueue.push({ type: "add", sheep: s });
                        }
                      } else if (diff < 0) {
                        // Remove non-settled sheep first, preferring those furthest from pen
                        const removable = g.sheep
                          .filter(s => !s.settled && !s.popOut)
                          .sort((a, b) => {
                            const da = Math.sqrt((a.x - PEN.x) ** 2 + (a.y - PEN.y) ** 2);
                            const db = Math.sqrt((b.x - PEN.x) ** 2 + (b.y - PEN.y) ** 2);
                            return db - da; // furthest first
                          });
                        const toRemove = removable.slice(0, Math.abs(diff));
                        toRemove.forEach(s => g.popQueue.push({ type: "remove", sheep: s }));
                      }
                      g.numSheep = n;
                      setTotalSheep(n);
                    }} style={{
                      background: n === totalSheep ? "#4a6828" : "#222e14",
                      color: n === totalSheep ? "#d0dca8" : "#8a9868",
                      border: `1px solid ${n === totalSheep ? "#6a8a3a" : "#3a4a20"}`,
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
                  background: "#1e2a12", color: "#94a870", border: "1px solid #3a4a20",
                  padding: "5px 14px", fontSize: 11, fontFamily: "'Courier New', monospace",
                  cursor: "pointer", borderRadius: 2, width: "100%", letterSpacing: 1, marginTop: 4,
                }}>MAIN MENU</button>
              </div>
            )}
          </div>
        )}
      </div>)}

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
          <div style={{ color: "#94a870", fontSize: 11, marginBottom: 14, textAlign: "center", lineHeight: 1.8, maxWidth: 380 }}>
            Command your collie with three whistles.<br />
            The dog circles or approaches sheep — they flee from it.<br />
            Position the dog to push sheep through the gate into the pen.<br />
            Release all whistles to let the dog rest and refocus.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <span style={{ color: "#8a9868", fontSize: 10, marginRight: 4 }}>SHEEP:</span>
            {SHEEP_OPTIONS.map(n => (
              <button key={n} onClick={() => setTotalSheep(n)} style={{
                background: n === totalSheep ? "#4a6828" : "#1e2a12",
                color: n === totalSheep ? "#d0dca8" : "#8a9868",
                border: `1px solid ${n === totalSheep ? "#6a8a3a" : "#3a4a20"}`,
                borderRadius: 2, padding: "4px 10px", fontSize: 12,
                fontFamily: "'Courier New', monospace", cursor: "pointer",
                transition: "all 0.15s",
              }}>{n}</button>
            ))}
          </div>
          {(() => {
            const scores = getScores(totalSheep);
            const display = scores.length > 0 ? scores : [null];
            return (
              <div style={{ marginBottom: 10, minWidth: 160 }}>
                <div style={{ color: "#8a9868", fontSize: 9, textAlign: "center", marginBottom: 4, letterSpacing: 2 }}>
                  TOP SCORES — {totalSheep} SHEEP
                </div>
                {display.map((s, i) => (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    color: s ? "#94a870" : "#5a6838", fontSize: 11,
                    fontFamily: "'Courier New', monospace", padding: "1px 0",
                  }}>
                    <span>{i + 1}. {s ? s.name : "---"}</span>
                    <span>{s ? fmtTime(s.time) : "-:--"}</span>
                  </div>
                ))}
              </div>
            );
          })()}
          <button onClick={() => initGame()} style={{
            background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
            padding: "10px 40px", fontSize: 14, fontFamily: "'Courier New', monospace",
            cursor: "pointer", letterSpacing: 3, borderRadius: 2,
          }}>START</button>
          <div style={{ color: "#6a7848", fontSize: 9, marginTop: 8 }}>Q / W / E &nbsp;or&nbsp; 1 / 2 / 3 &nbsp;&nbsp;·&nbsp;&nbsp; R = reset</div>
        </div>
      )}

      {gameState !== "title" && (
      <div style={{ position: "relative", border: "2px solid #2a3818", borderRadius: 2, lineHeight: 0, overflow: "hidden" }}>
        <canvas ref={canvasRef} width={W} height={H} style={{
          width: "100%", maxWidth: W * 3, height: "auto",
          aspectRatio: `${W} / ${H}`, imageRendering: "pixelated", display: "block",
        }} />

        {gameState === "enterName" && (() => {
          const ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
          const spin = (i, dir) => { setNameCursor(i); setNameChars(c => { const n = [...c]; n[i] = (n[i] + dir + 26) % 26; return n; }); };
          const submitName = () => {
            const name = nameChars.map(i => ALPHA[i]).join("");
            const scores = saveScore(totalSheep, name, timer);
            setLastScore({ name, time: timer });
            setGameState("won");
          };
          return (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(10, 16, 5, 0.92)", lineHeight: "normal",
          }}>
            <div style={{ color: "#ffd740", fontSize: 20, fontWeight: "bold", letterSpacing: 4, marginBottom: 2 }}>ALL PENNED!</div>
            <div style={{ color: "#a0b878", fontSize: 13, marginBottom: 2 }}>{totalSheep} sheep — {fmtTime(timer)}</div>
            <div style={{ color: "#ffd740", fontSize: 11, marginBottom: 10 }}>NEW HIGH SCORE!</div>
            <div style={{ color: "#8a9868", fontSize: 10, marginBottom: 8 }}>ENTER YOUR NAME</div>
            <div style={{ display: "flex", gap: 6, marginBottom: 10 }}>
              {nameChars.map((ci, i) => (
                <div key={i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                  <button onClick={() => spin(i, -1)} style={{
                    background: "none", border: "1px solid #3a4a20", color: "#a0b878",
                    fontSize: 14, width: 28, height: 20, cursor: "pointer",
                    fontFamily: "'Courier New', monospace",
                  }}>{"\u25B2"}</button>
                  <button style={{
                    color: nameCursor === i ? "#ffd740" : "#d0dca8", fontSize: 24, fontWeight: "bold",
                    fontFamily: "'Courier New', monospace", width: 28, textAlign: "center",
                    background: nameCursor === i ? "rgba(255,215,64,0.1)" : "none",
                    border: `1px solid ${nameCursor === i ? "#ffd740" : "#3a4a20"}`,
                    padding: "2px 0", cursor: "pointer",
                  }} onClick={() => setNameCursor(i)}>{ALPHA[ci]}</button>
                  <button onClick={() => spin(i, 1)} style={{
                    background: "none", border: "1px solid #3a4a20", color: "#a0b878",
                    fontSize: 14, width: 28, height: 20, cursor: "pointer",
                    fontFamily: "'Courier New', monospace",
                  }}>{"\u25BC"}</button>
                </div>
              ))}
            </div>
            <button onClick={submitName} style={{
              background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
              padding: "8px 30px", fontSize: 12, fontFamily: "'Courier New', monospace",
              cursor: "pointer", letterSpacing: 2, borderRadius: 2,
            }}>OK</button>
          </div>);
        })()}

        {gameState === "won" && (() => {
          const scores = getScores(totalSheep);
          return (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(10, 16, 5, 0.88)", lineHeight: "normal",
            padding: "8px 0",
          }}>
            <div style={{ color: "#ffd740", fontSize: 20, fontWeight: "bold", letterSpacing: 4, marginBottom: 2 }}>ALL PENNED!</div>
            <div style={{ color: "#a0b878", fontSize: 13, marginBottom: 2 }}>{totalSheep} sheep — {fmtTime(timer)}</div>
            <div style={{ color: "#8a9868", fontSize: 10, marginBottom: 6 }}>
              {timer < 25 ? "Lightning fast!" : timer < 45 ? "Sharp herding!" : timer < 90 ? "Well done!" : "Patience pays off!"}
            </div>
            {(() => {
              const display = scores.length > 0 ? scores : [null];
              return (
              <div style={{ marginBottom: 6, minWidth: 160 }}>
                <div style={{ color: "#8a9868", fontSize: 9, textAlign: "center", marginBottom: 3, letterSpacing: 2 }}>TOP SCORES</div>
                {display.map((s, i) => {
                  const isThis = s && lastScore && s.name === lastScore.name && s.time === lastScore.time;
                  return (
                  <div key={i} style={{
                    display: "flex", justifyContent: "space-between", gap: 12,
                    color: isThis ? "#ffd740" : s ? "#94a870" : "#5a6838", fontSize: 11,
                    fontFamily: "'Courier New', monospace", padding: "1px 0",
                  }}>
                    <span>{i + 1}. {s ? s.name : "---"}</span>
                    <span>{s ? fmtTime(s.time) : "-:--"}</span>
                  </div>);
                })}
              </div>);
            })()}
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => initGame()} style={{
                background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
                padding: "6px 20px", fontSize: 12, fontFamily: "'Courier New', monospace",
                cursor: "pointer", letterSpacing: 2, borderRadius: 2,
              }}>AGAIN</button>
              <button onClick={() => setGameState("title")} style={{
                background: "#1e2a12", color: "#94a870", border: "2px solid #3a4a20",
                padding: "6px 20px", fontSize: 12, fontFamily: "'Courier New', monospace",
                cursor: "pointer", letterSpacing: 2, borderRadius: 2,
              }}>MENU</button>
            </div>
            <a href="https://jkershaw.com" target="_blank" rel="noopener noreferrer" style={{ color: "#6a7848", fontSize: 9, marginTop: 6, textDecoration: "none" }}>jkershaw.com</a>
          </div>);
        })()}
      </div>
      )}

      <div style={{ display: "flex", gap: 6, marginTop: 6, width: "100%", maxWidth: W * 3 + 4, justifyContent: "center" }}>
        {[
          { cmd: "comebye", label: "circle left", icon: "\u21B6", key: "Q/1" },
          { cmd: "away", label: "circle right", icon: "\u21B7", key: "W/2" },
          { cmd: "walkup", label: "approach", icon: "\u2191", key: "E/3" },
        ].map(({ cmd, label, icon, key }) => {
          const cl = wColors[cmd];
          const on = activeWhistle === cmd;
          return (
            <button key={cmd}
              onPointerDown={(e) => { e.preventDefault(); wDown(cmd); }}
              onPointerUp={wUp} onPointerLeave={wUp} onContextMenu={e => e.preventDefault()}
              style={{
                background: on ? cl.active : cl.bg,
                color: on ? "#f0ffe0" : cl.text,
                border: `2px solid ${on ? cl.glow : cl.border}`,
                borderRadius: 4, padding: IS_TOUCH ? "14px 8px" : "10px 11px",
                fontFamily: "'Courier New', monospace", fontSize: 11, fontWeight: "bold",
                cursor: "pointer", textAlign: "center", flex: 1, maxWidth: 140,
                minHeight: IS_TOUCH ? 60 : 44,
                transition: "all 0.08s",
                transform: on ? "scale(0.97)" : "scale(1)",
                boxShadow: on ? `0 0 24px ${cl.glow}70, inset 0 0 12px ${cl.glow}40` : `inset 0 -2px 0 rgba(0,0,0,0.25), 0 1px 3px rgba(0,0,0,0.3)`,
                touchAction: "none",
                filter: on ? "brightness(1.3)" : "none",
              }}>
              <div style={{ fontSize: 18, lineHeight: 1, marginBottom: 3 }}>{icon}</div>
              <div style={{ fontSize: IS_TOUCH ? 10 : 9, fontWeight: "normal", opacity: 0.85, textTransform: "uppercase", letterSpacing: 0.5 }}>
                {label}{!IS_TOUCH ? ` [${key}]` : ""}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SheepHerdingGame />);
