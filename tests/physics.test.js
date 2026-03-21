import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  fenceCollide, wallInfo, isInPen,
  W, H, PEN, FENCE_L, FENCE_R, FENCE_T, FENCE_B,
} from "../game.js";

describe("fenceCollide", () => {
  it("leaves points inside field unchanged", () => {
    const { x, y } = fenceCollide(100, 100, 3);
    assert.equal(x, 100);
    assert.equal(y, 100);
  });

  it("clamps to left fence", () => {
    const { x } = fenceCollide(0, 100, 3);
    assert.equal(x, FENCE_L + 3);
  });

  it("clamps to right fence", () => {
    const { x } = fenceCollide(W, 100, 3);
    assert.equal(x, FENCE_R - 3);
  });

  it("clamps to top fence", () => {
    const { y } = fenceCollide(100, 0, 3);
    assert.equal(y, FENCE_T + 3);
  });

  it("clamps to bottom fence", () => {
    const { y } = fenceCollide(100, H, 3);
    assert.equal(y, FENCE_B - 3);
  });

  it("allows passage through the pen gate", () => {
    // Point in the gate opening should not be blocked by pen left wall
    const gateMiddleY = PEN.gateY + PEN.gateH / 2;
    const { x } = fenceCollide(PEN.x + 1, gateMiddleY, 2);
    // Should pass through gate, not be pushed away from pen wall
    assert.ok(x >= PEN.x - 2, `x=${x} should be near/inside gate`);
  });

  it("blocks passage through pen left wall outside gate", () => {
    // Point just above the gate, trying to enter pen through wall
    const aboveGateY = PEN.y + 5;
    const { x } = fenceCollide(PEN.x + 1, aboveGateY, 2);
    // Should be pushed to one side of the wall
    assert.ok(
      x <= PEN.x - 2 || x >= PEN.x + 3 + 2,
      `x=${x} should be pushed away from pen wall`
    );
  });
});

describe("wallInfo", () => {
  it("detects proximity to left fence", () => {
    const wi = wallInfo(FENCE_L + 5, 100, 10);
    assert.equal(wi.nearL, true);
    assert.equal(wi.nearR, false);
  });

  it("detects proximity to right fence", () => {
    const wi = wallInfo(FENCE_R - 5, 100, 10);
    assert.equal(wi.nearR, true);
    assert.equal(wi.nearL, false);
  });

  it("detects proximity to top fence", () => {
    const wi = wallInfo(100, FENCE_T + 5, 10);
    assert.equal(wi.nearT, true);
    assert.equal(wi.nearB, false);
  });

  it("detects proximity to bottom fence", () => {
    const wi = wallInfo(100, FENCE_B - 5, 10);
    assert.equal(wi.nearB, true);
    assert.equal(wi.nearT, false);
  });

  it("returns all false for center of field", () => {
    const wi = wallInfo(W / 2, H / 2, 10);
    assert.equal(wi.nearL, false);
    assert.equal(wi.nearR, false);
    assert.equal(wi.nearT, false);
    assert.equal(wi.nearB, false);
    assert.equal(wi.nearPenL, false);
    assert.equal(wi.nearPenB, false);
  });

  it("does not flag pen wall at gate opening", () => {
    const gateMiddleY = PEN.gateY + PEN.gateH / 2;
    const wi = wallInfo(PEN.x + 2, gateMiddleY, 10);
    assert.equal(wi.nearPenL, false);
  });
});

describe("isInPen", () => {
  it("returns true for pen center", () => {
    assert.equal(isInPen(PEN.x + PEN.w / 2, PEN.y + PEN.h / 2), true);
  });

  it("returns false for field center", () => {
    assert.equal(isInPen(W / 2, H / 2), false);
  });

  it("returns false just outside pen left edge", () => {
    assert.equal(isInPen(PEN.x + 1, PEN.y + PEN.h / 2), false);
  });

  it("returns true just inside pen", () => {
    assert.equal(isInPen(PEN.x + 3, PEN.y + 3), true);
  });
});
