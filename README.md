# Herd

A pixel-art sheep herding game built with React and HTML5 Canvas. Guide your sheepdog using traditional whistle commands to herd the flock into the pen.

## How to Play

You control a sheepdog by issuing whistle commands. Each command directs the dog to move in a specific pattern relative to the sheep:

| Command | Action | Keyboard | Button |
|---------|--------|----------|--------|
| **Come-bye** | Dog circles left around the flock | Q or 1 | On-screen |
| **Away to me** | Dog circles right around the flock | W or 2 | On-screen |
| **Walk up** | Dog approaches the flock directly | E or 3 | On-screen |

**Other controls:**
- **Space** — Start the game from the title screen
- **R** — Restart the current game

### Tips

- **Hold** a whistle command to keep the dog moving; **release** to let the dog pause and refocus on the nearest group.
- The dog automatically targets the largest cluster of unsettled sheep.
- Push sheep through the open gate on the right side of the pen.
- You can adjust the number of sheep (5, 7, 10, or 15) from the title screen or the in-game settings menu.

## Running Locally

No build step is required. Simply open `index.html` in a modern browser:

```
open index.html
```

The page loads React 18 and Babel from CDNs to compile the JSX at runtime.

### Running with a local server

If you need to work offline or want faster loading, install local copies of the dependencies and serve with any static server:

```bash
npm install react@18 react-dom@18 @babel/standalone
```

Then update the `<script>` tags in `index.html` to point to the local paths:

```html
<script src="./node_modules/react/umd/react.production.min.js"></script>
<script src="./node_modules/react-dom/umd/react-dom.production.min.js"></script>
<script src="./node_modules/@babel/standalone/babel.min.js"></script>
```

Serve with any static file server (e.g. `npx serve .` or `python3 -m http.server`), since Babel's `text/babel` script type requires HTTP to fetch `app.jsx`.

## Tests

Unit tests use Node's built-in test runner (`node:test`) — no test framework dependencies needed. Pure game logic (math, physics, clustering, AI, flocking) is extracted into `game.js` and tested in `tests/`.

```bash
npm test
```

## Screenshots (Playwright)

A self-contained Playwright script captures the game at desktop (1280x800) and mobile (375x812) viewports. It inlines `app.jsx` and local vendor copies of React/Babel so Chromium needs zero network access.

```bash
# One-time: download vendor files and install Chromium
mkdir -p vendor
curl -sL https://unpkg.com/react@18/umd/react.production.min.js -o vendor/react.production.min.js
curl -sL https://unpkg.com/react-dom@18/umd/react-dom.production.min.js -o vendor/react-dom.production.min.js
curl -sL https://unpkg.com/@babel/standalone/babel.min.js -o vendor/babel.min.js
npx playwright install chromium

# Capture screenshots
node screenshot.mjs
```

Screenshot files (`*.png`) are excluded from git via `.gitignore`.

## Project Structure

```
index.html          — Entry point, loads React/Babel from CDN
app.jsx             — Game component (adapted for CDN globals)
game.js             — Pure functions extracted from app.jsx (ES module exports for tests)
sheep-herder.jsx    — Original React component (ES module format, reference only)
tests/              — Unit tests (Node built-in test runner)
screenshot.mjs      — Playwright screenshot capture script
vendor/             — Local React/Babel copies for offline screenshots (gitignored)
```

### Architecture

The game is a single React component (`SheepHerdingGame`) that manages three screens:

- **Title** — Sheep count selector and start button (rendered as a normal flow element)
- **Playing** — HTML5 Canvas with game loop driven by `requestAnimationFrame`
- **Won** — Victory overlay with time and replay options

Game state lives in a `useRef` object (sheep positions, dog AI, particles) while UI state uses `useState` (game screen, timer, score). The canvas renders at 280x210 pixels and scales responsively to fit the screen while preserving its 4:3 aspect ratio.

### Mobile Support

The UI is designed to be touch-friendly:

- Whistle buttons use `pointerDown`/`pointerUp` events for press-and-hold interaction
- `touch-action: manipulation` on all buttons prevents double-tap zoom
- `-webkit-tap-highlight-color: transparent` removes iOS tap highlight
- `-webkit-touch-callout: none` prevents long-press context menus
- Viewport is set to `user-scalable=no` to prevent accidental zoom during gameplay
- Canvas scales responsively via `width: 100%` with `aspect-ratio` to maintain proportions

## GitHub Pages

This project is configured to deploy via GitHub Pages. Once enabled in your repository settings (Settings > Pages > Source: branch / root), the game will be available at:

```
https://<username>.github.io/Herd/
```

## Tech Stack

- **React 18** — UI and game state management
- **HTML5 Canvas** — Pixel-art rendering at 280x210, scaled to fit viewport
- **Web Audio API** — Synthesised whistle sounds and win fanfare
- **Playwright** (dev) — Screenshot testing across viewport sizes
