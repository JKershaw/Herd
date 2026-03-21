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

- `app.jsx` — The game. Single React component using CDN globals (React, ReactDOM).
- `sheep-herder.jsx` — Original ES module version. Reference only, not loaded.
- `index.html` — Entry point. Loads React 18 + Babel from unpkg CDN.

Only `app.jsx` is the live game code. Do not add imports/exports to it — it uses CDN globals (`React`, `ReactDOM`).

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

## Screenshots (Playwright)

```bash
npm install playwright
npx playwright install chromium
```

Serve locally, then use Playwright to capture at different viewports:
- Mobile: `{ width: 375, height: 812 }`
- Desktop: `{ width: 1280, height: 800 }`

Click START via `page.evaluate()` to capture gameplay. Screenshots are gitignored.

## Style conventions

- Constants: UPPERCASE (`W`, `H`, `PEN`, `FENCE_L`)
- Functions: camelCase (`clusterSheep`, `updateDog`)
- All styling is inline via JSX style prop — no CSS files
- Colours as hex strings (`#3a7d28`, `#8B5E3C`)
