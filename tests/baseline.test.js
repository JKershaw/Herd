// Characterization test: the default dog (Border Collie) must behave exactly
// like the pre-breeds game. The snapshot below was captured from the legacy
// code (commit 90c9a5b, before breeds existed) by running runBaseline() with a
// plain createDog(). Any drift in collie tuning or in how updateDog/updateSheep
// read it shows up here as a float mismatch.
import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createDog } from "../game.js";
import { runBaseline } from "./baseline.helper.js";

const LEGACY_SNAPSHOT = {
  dog: {
    x: 207.35602807037017, y: 125.2717759142897,
    vx: 74.8353539849368, vy: 14.955544730722314,
    angle: 5.4512955282811095, distFromFocus: 47.710626314591835,
    renderDir: -0.047592096645405244,
  },
  sheep: [
    [210.28520385201017, 137.7645097323214, 0, false],
    [221, 193, 0, false],
    [59.05159048768816, 17.011061539390646, 0, false],
    [220.94502021465897, 174.44337145942688, 0.6, false],
    [20.724866936798563, 54.09328147166215, 0, false],
    [202.06776874512443, 169.1843026778874, 0, false],
    [84.66398855196961, 21.3726657188673, 0, false],
  ],
  settledCount: 0,
};

describe("collie baseline (legacy behaviour unchanged)", () => {
  it("createDog() with no breed reproduces the legacy simulation exactly", () => {
    assert.deepEqual(runBaseline(() => createDog()), LEGACY_SNAPSHOT);
  });

  it("createDog('collie') reproduces the legacy simulation exactly", () => {
    assert.deepEqual(runBaseline(() => createDog("collie")), LEGACY_SNAPSHOT);
  });

  it("a dog object with no breed field (pre-breeds shape) falls back to collie", () => {
    assert.deepEqual(runBaseline(() => { const d = createDog(); delete d.breed; return d; }), LEGACY_SNAPSHOT);
  });

  it("an unknown breed id falls back to collie behaviour", () => {
    assert.deepEqual(runBaseline(() => createDog("poodle")), LEGACY_SNAPSHOT);
  });
});
