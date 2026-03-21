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
- You can adjust the number of sheep (3–30) from the settings menu before starting.

## Running Locally

No build step is required. Simply open `index.html` in a modern browser:

```
open index.html
```

The page loads React 18 and Babel from CDNs to compile the JSX at runtime.

## Project Structure

```
index.html          — Entry point, loads React/Babel from CDN
app.jsx             — Standalone game (adapted for CDN globals)
sheep-herder.jsx    — Original React component (ES module format)
```

## GitHub Pages

This project is configured to deploy via GitHub Pages. Once enabled in your repository settings (Settings → Pages → Source: branch / root), the game will be available at:

```
https://<username>.github.io/Herd/
```

## Tech Stack

- **React 18** — UI and game state management
- **HTML5 Canvas** — Pixel-art rendering at 280×210 resolution, scaled 2×
- **Web Audio API** — Whistle sound effects and win fanfare
