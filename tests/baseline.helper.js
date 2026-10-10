// Deterministic end-to-end simulation used by the collie baseline test.
// Seeds Math.random so createSheep/updateSheep are reproducible, then drives
// updateDog + updateSheep in the same order as app.jsx's game loop.
// (Not a *.test.js file, so `npm test` does not run it directly.)
import { createSheep, updateDog, updateSheep } from "../game.js";

function mulberry32(seed) {
  return function () {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Whistle schedule: each command held for 150 frames at 60fps.
const SCHEDULE = ["comebye", "walkup", "away", null, "walkup", "comebye"];

export function runBaseline(makeDog, { seed = 20, frames = 900 } = {}) {
  const realRandom = Math.random;
  Math.random = mulberry32(seed);
  try {
    const sheep = createSheep(7);
    const dog = makeDog();
    const dt = 1 / 60;
    let settledCount = 0;
    for (let f = 0; f < frames; f++) {
      const cmd = SCHEDULE[Math.floor(f / 150) % SCHEDULE.length];
      updateDog(dog, sheep, cmd, dt);
      settledCount = updateSheep(sheep, dog, dt, f).settledCount;
    }
    return {
      dog: {
        x: dog.x, y: dog.y, vx: dog.vx, vy: dog.vy,
        angle: dog.angle, distFromFocus: dog.distFromFocus, renderDir: dog.renderDir,
      },
      sheep: sheep.map(s => [s.x, s.y, s.panic, s.settled]),
      settledCount,
    };
  } finally {
    Math.random = realRandom;
  }
}
