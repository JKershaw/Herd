// Screenshot scenario definitions.
// Each scenario declares the UI state to render and capture.
//
// Fields:
//   name         — screenshot filename stem (e.g. "title-default" → title-default-desktop.png)
//   description  — what this screenshot shows (printed in runner output)
//   state        — object injected as window.__HERD_SCENARIO (overrides useState defaults)
//                  state.scores — optional {n: [{name, time}, ...]} to override getScores()
//   setup        — optional async function(page) run after mount, before capture
//   viewports    — optional array of viewport names to restrict to (default: all)

const mockScores7 = [
  { name: "ACE", time: 28 },
  { name: "SAM", time: 35 },
  { name: "JOE", time: 42 },
  { name: "MAX", time: 51 },
  { name: "ZOE", time: 67 },
];

const mockScores15 = [
  { name: "PRO", time: 55 },
  { name: "VET", time: 72 },
  { name: "OLD", time: 88 },
];

const PI = Math.PI;

export default [
  // --- Character sprite sheets ---
  {
    name: "sprites-sheep",
    description: "Sheep in different states",
    canvasOnly: true,
    state: {
      gameState: "playing",
      sprites: [
        { type: "sheep", label: "Walking", overrides: { headDir: 0, wobble: 0.8 } },
        { type: "sheep", label: "Grazing", overrides: { isGrazing: true, wobble: 1.5, headDir: PI / 2 } },
        { type: "sheep", label: "Panicking", overrides: { panic: 0.8, headDir: -0.5, wobble: 2.0 } },
        { type: "sheep", label: "Settled", overrides: { settled: true, headDir: 0 } },
      ],
    },
    viewports: ["desktop"],
  },
  {
    name: "sprites-dog",
    description: "Dog in different poses and directions",
    canvasOnly: true,
    state: {
      gameState: "playing",
      sprites: [
        { type: "dog", label: "Right", overrides: { renderDir: 0 } },
        { type: "dog", label: "Down", overrides: { renderDir: PI / 2 } },
        { type: "dog", label: "Left", overrides: { renderDir: PI } },
        { type: "dog", label: "Up", overrides: { renderDir: -PI / 2 } },
        { type: "dog", label: "Whistle", overrides: { renderDir: 0 }, whistleActive: true, tick: 105 },
        { type: "dog", label: "Looking", overrides: { renderDir: 0, idleTime: 1.1, lookDir: 0.3 } },
      ],
    },
    viewports: ["desktop"],
  },
  {
    name: "title-default",
    description: "Title screen with default settings",
    state: { gameState: "title", totalSheep: 7 },
  },
  {
    name: "title-with-scores",
    description: "Title screen with high score table populated",
    state: { gameState: "title", totalSheep: 7, scores: { 7: mockScores7 } },
  },
  {
    name: "playing-start",
    description: "Game just started, sheep scattered across field",
    state: { gameState: "playing", totalSheep: 7, timer: 0, sheepCount: 0 },
  },
  {
    name: "playing-whistle",
    description: "Playing with come-bye whistle active",
    state: { gameState: "playing", totalSheep: 7, timer: 12, sheepCount: 0, activeWhistle: "comebye" },
  },
  {
    name: "playing-progress",
    description: "Mid-game with some sheep penned",
    state: { gameState: "playing", totalSheep: 7, timer: 38, sheepCount: 3 },
  },
  {
    name: "settings-open",
    description: "Playing state with settings dropdown visible",
    state: { gameState: "playing", totalSheep: 7, timer: 15, sheepCount: 1, showSettings: true },
  },
  {
    name: "enter-name",
    description: "Name entry overlay after qualifying high score",
    state: { gameState: "enterName", totalSheep: 7, timer: 32, sheepCount: 7, nameChars: [9, 0, 25], nameCursor: 1 },
  },
  {
    name: "won-screen",
    description: "Victory screen with two scores, current highlighted",
    state: {
      gameState: "won", totalSheep: 7, timer: 42, sheepCount: 7,
      lastScore: { name: "ACE", time: 42 },
      scores: { 7: [{ name: "ACE", time: 42 }, { name: "SAM", time: 55 }] },
    },
  },

  // --- High score result states ---
  {
    name: "won-new-record",
    description: "Victory with new #1 high score (Lightning fast!)",
    state: {
      gameState: "won", totalSheep: 7, timer: 18, sheepCount: 7,
      lastScore: { name: "GOD", time: 18 },
      scores: { 7: [{ name: "GOD", time: 18 }, ...mockScores7] },
    },
  },
  {
    name: "won-last-place",
    description: "Victory with score that just made #5 on the board",
    state: {
      gameState: "won", totalSheep: 7, timer: 64, sheepCount: 7,
      lastScore: { name: "MEH", time: 64 },
      scores: { 7: [...mockScores7.slice(0, 4), { name: "MEH", time: 64 }] },
    },
  },
  {
    name: "won-no-highscore",
    description: "Victory without qualifying for the high score board",
    state: {
      gameState: "won", totalSheep: 7, timer: 95, sheepCount: 7,
      scores: { 7: mockScores7 },
    },
  },
  {
    name: "won-slow",
    description: "Victory with slow time (Patience pays off!)",
    state: {
      gameState: "won", totalSheep: 15, timer: 142, sheepCount: 15,
      lastScore: { name: "SLO", time: 142 },
      scores: { 15: [...mockScores15, { name: "SLO", time: 142 }] },
    },
  },
  {
    name: "won-full-board",
    description: "Victory with a full 5-entry high score board, new score highlighted mid-table",
    state: {
      gameState: "won", totalSheep: 7, timer: 40, sheepCount: 7,
      lastScore: { name: "NEW", time: 40 },
      scores: {
        7: [
          { name: "ACE", time: 28 },
          { name: "SAM", time: 35 },
          { name: "NEW", time: 40 },
          { name: "JOE", time: 42 },
          { name: "MAX", time: 51 },
        ],
      },
    },
  },
  {
    name: "enter-name-first-score",
    description: "Name entry when board is empty (first ever score)",
    state: { gameState: "enterName", totalSheep: 7, timer: 45, sheepCount: 7, nameChars: [0, 0, 0], nameCursor: 0 },
  },
  {
    name: "title-scores-15-sheep",
    description: "Title screen showing high scores for 15-sheep mode",
    state: { gameState: "title", totalSheep: 15, scores: { 15: mockScores15 } },
  },
  {
    name: "onboarding-overlay",
    description: "First-play onboarding overlay on top of game field",
    state: { gameState: "playing", totalSheep: 7, timer: 0, sheepCount: 0 },
    setup: async (page) => {
      await page.evaluate(() => {
        const overlay = document.createElement("div");
        overlay.style.cssText = "position:fixed;inset:0;z-index:100;display:flex;flex-direction:column;align-items:center;justify-content:center;background:rgba(10,16,5,0.85);cursor:pointer;";
        overlay.innerHTML = '<div style="background:#1a2a10;border:2px solid #3a5a20;border-radius:6px;padding:20px 24px;max-width:320px;text-align:center;font-family:Courier New,monospace">' +
          '<div style="color:#c8d8a0;font-size:16px;font-weight:bold;margin-bottom:10px">HOW TO PLAY</div>' +
          '<div style="color:#a0b878;font-size:12px;line-height:1.7;margin-bottom:12px">' +
          '<strong style="color:#d0dca8">HOLD</strong> a button to command your dog.<br/>' +
          '<strong style="color:#d0dca8">RELEASE</strong> to let the dog pause &amp; refocus.<br/><br/>' +
          'Push all sheep through the <strong style="color:#ddc060">gate</strong> into the pen on the right side of the field.</div>' +
          '<div style="display:flex;justify-content:center;gap:16px;margin-bottom:12px">' +
          '<div style="text-align:center"><div style="font-size:20px">\u21B6</div><div style="color:#8a9868;font-size:9px">CIRCLE LEFT</div></div>' +
          '<div style="text-align:center"><div style="font-size:20px">\u21B7</div><div style="color:#8a9868;font-size:9px">CIRCLE RIGHT</div></div>' +
          '<div style="text-align:center"><div style="font-size:20px">\u2191</div><div style="color:#8a9868;font-size:9px">APPROACH</div></div></div>' +
          '<div style="color:#6a7848;font-size:10px">Tap anywhere to start</div></div>';
        document.body.appendChild(overlay);
      });
    },
  },
];
