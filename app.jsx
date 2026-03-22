const { useState, useEffect, useRef, useCallback } = React;

// Constants and pure game functions are loaded from game.js as globals.

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

    function localUpdateDog(dog, sheep, cmd, dt) {
      const result = updateDog(dog, sheep, cmd, dt);
      gameRef.current.clusters = result.clusters;
      setFocusInfo(result.focusInfo);
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
        localUpdateParticles(dt);
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

      localUpdateDog(g.dog, g.sheep, cmd, dt);
      localUpdateSheep(g.sheep, g.dog, dt);
      localUpdateParticles(dt);

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
      <div style={{ display: "flex", gap: 16, marginBottom: 4, color: "#94a870", fontSize: 11, alignItems: "center" }}>
        <span>{fmtTime(timer)}</span>
        <span style={{ color: "#a0b878" }}>{sheepCount}/{totalSheep} penned</span>
        {focusInfo && gameState === "playing" && <span style={{ color: "#7a8858", fontSize: 10 }}>{focusInfo}</span>}
        {gameState === "playing" && (
          <div style={{ position: "relative", marginLeft: 4 }}>
            <button onClick={() => setShowSettings(v => !v)} style={{
              background: showSettings ? "#3a4a20" : "none", border: "1px solid #3a4a20", color: "#a0b878",
              fontSize: 10, padding: "2px 8px", fontFamily: "'Courier New', monospace",
              cursor: "pointer", borderRadius: 2,
            }}>{showSettings ? "✕" : "⚙"} Settings</button>
            {showSettings && (
              <div style={{
                position: "absolute", top: "100%", right: 0, marginTop: 4, zIndex: 10,
                background: "#1a2410", border: "1px solid #3a4a20", borderRadius: 3,
                padding: "10px 14px", minWidth: 180,
              }}>
                <div style={{ color: "#a0b878", fontSize: 10, marginBottom: 6 }}>SHEEP COUNT</div>
                <div style={{ display: "flex", gap: 4, marginBottom: 10 }}>
                  {[5, 7, 10, 15].map(n => (
                    <button key={n} onClick={() => { setTotalSheep(n); }} style={{
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
                <div style={{ color: "#6a7848", fontSize: 8, marginTop: 6, textAlign: "center" }}>
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
          <div style={{ color: "#94a870", fontSize: 11, marginBottom: 14, textAlign: "center", lineHeight: 1.8, maxWidth: 380 }}>
            Command your collie with three whistles.<br />
            The dog circles or approaches sheep — they flee from it.<br />
            Position the dog to push sheep through the gate into the pen.<br />
            Release all whistles to let the dog rest and refocus.
          </div>
          <div style={{ display: "flex", gap: 6, marginBottom: 12, alignItems: "center" }}>
            <span style={{ color: "#8a9868", fontSize: 10, marginRight: 4 }}>SHEEP:</span>
            {[5, 7, 10, 15].map(n => (
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

        {gameState === "won" && (
          <div style={{
            position: "absolute", inset: 0, display: "flex", flexDirection: "column",
            alignItems: "center", justifyContent: "center", background: "rgba(10, 16, 5, 0.88)",
          }}>
            <div style={{ color: "#ffd740", fontSize: 24, fontWeight: "bold", letterSpacing: 4, marginBottom: 4 }}>ALL PENNED!</div>
            <div style={{ color: "#a0b878", fontSize: 15, marginBottom: 3 }}>{totalSheep} sheep — {fmtTime(timer)}</div>
            <div style={{ color: "#8a9868", fontSize: 10, marginBottom: 14 }}>
              {timer < 25 ? "Lightning fast!" : timer < 45 ? "Sharp herding!" : timer < 90 ? "Well done!" : "Patience pays off!"}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              <button onClick={() => initGame()} style={{
                background: "#3a5820", color: "#d0dca8", border: "2px solid #5a7a38",
                padding: "8px 24px", fontSize: 12, fontFamily: "'Courier New', monospace",
                cursor: "pointer", letterSpacing: 2, borderRadius: 2,
              }}>AGAIN</button>
              <button onClick={() => setGameState("title")} style={{
                background: "#1e2a12", color: "#94a870", border: "2px solid #3a4a20",
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
      <div style={{ color: "#5a6838", fontSize: 8, marginTop: 5, textAlign: "center", maxWidth: 460, lineHeight: 1.5 }}>
        Hold a whistle to command · Release to let the dog pause & refocus · Push sheep through the gate
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")).render(<SheepHerdingGame />);
