# CLAUDE.md

## Project

Pixel-art sheep herding game. Single-page React 18 app with HTML5 Canvas, no build step.

## Running locally

Open `index.html` in a browser (loads React/Babel from CDN). For offline dev:

```bash
npm install
# Then serve via any static server — Babel needs HTTP to fetch app.jsx:
npx serve .
```

## Files

- `game.js` — Single source of truth for all pure game logic (constants, math, physics, simulation). Loaded as `<script type="module">` in the browser (exposes globals via `window`) and imported by tests via ES module exports.
- `app.jsx` — React component, rendering, audio, and game loop. Uses globals from `game.js` and CDN globals (`React`, `ReactDOM`). Do not add imports/exports to it.
- `sheep-herder.jsx` — Original ES module version. Reference only, not loaded.
- `index.html` — Entry point. Loads React 18 + Babel from unpkg CDN, then `game.js`, then `app.jsx`.
- `screenshot.mjs` — Playwright script to capture screenshots at desktop and mobile viewports.
- `tests/` — Unit tests using Node's built-in test runner (`node:test`).
- `vendor/` — Local copies of React/Babel for offline screenshot capture (gitignored).

All pure game logic lives in `game.js`. When changing game logic, edit `game.js` — app.jsx calls it via thin wrappers. Do not duplicate logic between the two files.

## Architecture

Single `SheepHerdingGame` component with three screens: "title", "playing", "won".

- **useState** for UI state (gameState, timer, sheepCount) — triggers re-renders.
- **useRef** for game simulation (sheep[], dog, particles) — updated every frame without re-renders.
- Game loop runs via `requestAnimationFrame` with clamped delta time.

The title screen is a standalone flow element (not inside the canvas container). The canvas only renders during "playing" and "won" states.

## Canvas

- Resolution: 280x210 pixels, scaled responsively via CSS (`width: 100%`, `max-width: 840px`, `aspect-ratio`).
- `imageRendering: "pixelated"` for crisp pixel art. `imageSmoothingEnabled = false` on context.
- Entities rendered sorted by Y-coordinate for depth.

## Mobile

- Whistle buttons use `pointerDown`/`pointerUp`/`pointerLeave` (not click) for press-and-hold.
- `touch-action: manipulation` on all buttons (set in index.html CSS).
- iOS-specific: `-webkit-tap-highlight-color: transparent`, `-webkit-touch-callout: none`.
- Do not use `onMouseOver`/`onMouseOut` — causes stuck hover states on touch devices.

## Audio

AudioContext is lazy-initialized on first user interaction (browser autoplay policy). Use `ensureAudio()` before playing sounds.

## Tests

Uses Node's built-in test runner (zero dependencies). Pure game logic is extracted into `game.js` and tested in `tests/`.

```bash
npm test
```

Covers: math utilities, fence/wall collision, pen detection, union-find clustering, entity factories, dog AI, sheep flocking/fleeing/settling, particle physics.

## Screenshots (Playwright)

Scenario-based screenshot system. Each scenario in `screenshots/scenarios.mjs` declares a UI state to capture — no gameplay interaction needed. The runner injects state via `window.__HERD_SCENARIO`, renders a frozen frame, and captures the result.

```bash
# One-time: download vendor files
mkdir -p vendor
curl -sL https://unpkg.com/react@18/umd/react.production.min.js -o vendor/react.production.min.js
curl -sL https://unpkg.com/react-dom@18/umd/react-dom.production.min.js -o vendor/react-dom.production.min.js
curl -sL https://unpkg.com/@babel/standalone/babel.min.js -o vendor/babel.min.js

# Capture all screenshots
npx playwright install chromium
npm run screenshots

# Filter by name pattern
node screenshot.mjs title
```

### Adding a scenario

Add an object to `screenshots/scenarios.mjs`:

```js
{
  name: "my-state",              // → screenshots/my-state-desktop.png, my-state-mobile.png
  description: "What this shows",
  state: {                       // overrides SheepHerdingGame useState defaults
    gameState: "playing",        // "title" | "playing" | "won" | "enterName"
    totalSheep: 7, timer: 0, sheepCount: 0,
    activeWhistle: null,         // "comebye" | "away" | "walkup" | null
    showSettings: false,
    nameChars: [0, 0, 0], nameCursor: 0,
    lastScore: null,
    scores: { 7: [{name, time}] }, // optional: overrides getScores()
  setup: async (page) => {},     // optional: Playwright interactions after mount
  viewports: ["desktop", "mobile"], // optional: default is both
  canvasOnly: false,             // optional: capture only the canvas element
}
```

#### Sprite sheets

Use `state.sprites` to render individual characters on a clean background instead of the normal game field. Combine with `canvasOnly: true` for clean output.

```js
{
  name: "sprites-sheep",
  canvasOnly: true,
  state: {
    gameState: "playing",
    sprites: [
      { type: "sheep", label: "Walking", overrides: { headDir: 0, wobble: 0.8 } },
      { type: "sheep", label: "Grazing", overrides: { isGrazing: true, wobble: 1.5, headDir: PI / 2 } },
      // type: "dog" also supported, with whistleActive and tick options
    ],
  },
  viewports: ["desktop"],
}
```

Sprites are laid out in an auto-grid (up to 5 columns) with labels. Entity overrides map to the properties on sheep/dog objects (see `createSheep`/`createDog` in `game.js`).

Viewports: Mobile `375x812`, Desktop `1280x800`. Screenshots in `screenshots/` are gitignored.

### Scenario mode in app.jsx

When `window.__HERD_SCENARIO` is set, the component uses its values as initial state, renders one canvas frame, then freezes (no game loop). This is transparent to normal gameplay — the flag is only set by the screenshot runner.

## Style conventions

- Constants: UPPERCASE (`W`, `H`, `PEN`, `FENCE_L`)
- Functions: camelCase (`clusterSheep`, `updateDog`)
- All styling is inline via JSX style prop — no CSS files
- Colours as hex strings (`#3a7d28`, `#8B5E3C`)
