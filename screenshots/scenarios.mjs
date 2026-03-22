// Screenshot scenario definitions.
// Each scenario declares the UI state to render and capture.
//
// Fields:
//   name         — screenshot filename stem (e.g. "title-default" → title-default-desktop.png)
//   description  — what this screenshot shows (printed in runner output)
//   state        — object injected as window.__HERD_SCENARIO (overrides useState defaults)
//   localStorage — optional object to inject into localStorage before mount
//   setup        — optional async function(page) run after mount, before capture
//   viewports    — optional array of viewport names to restrict to (default: all)

const HS_KEY = "herd-highscores";

const mockScores = {
  7: [
    { name: "ACE", time: 28 },
    { name: "SAM", time: 35 },
    { name: "JOE", time: 42 },
    { name: "MAX", time: 51 },
    { name: "ZOE", time: 67 },
  ],
};

export default [
  {
    name: "title-default",
    description: "Title screen with default settings",
    state: { gameState: "title", totalSheep: 7 },
  },
  {
    name: "title-with-scores",
    description: "Title screen with high score table populated",
    state: { gameState: "title", totalSheep: 7 },
    localStorage: { [HS_KEY]: JSON.stringify(mockScores) },
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
    description: "Victory screen with high scores",
    state: { gameState: "won", totalSheep: 7, timer: 42, sheepCount: 7, lastScore: { name: "ACE", time: 42 } },
    localStorage: {
      [HS_KEY]: JSON.stringify({
        7: [
          { name: "ACE", time: 42 },
          { name: "SAM", time: 55 },
        ],
      }),
    },
  },
];
