import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { lerp, dist, clamp, angleDiff } from "../game.js";

describe("lerp", () => {
  it("returns a when t=0", () => {
    assert.equal(lerp(10, 20, 0), 10);
  });

  it("returns b when t=1", () => {
    assert.equal(lerp(10, 20, 1), 20);
  });

  it("returns midpoint when t=0.5", () => {
    assert.equal(lerp(0, 100, 0.5), 50);
  });

  it("extrapolates beyond 0-1 range", () => {
    assert.equal(lerp(0, 10, 2), 20);
    assert.equal(lerp(0, 10, -1), -10);
  });
});

describe("dist", () => {
  it("returns 0 for same point", () => {
    assert.equal(dist({ x: 5, y: 5 }, { x: 5, y: 5 }), 0);
  });

  it("calculates horizontal distance", () => {
    assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 0 }), 3);
  });

  it("calculates 3-4-5 triangle", () => {
    assert.equal(dist({ x: 0, y: 0 }, { x: 3, y: 4 }), 5);
  });

  it("is symmetric", () => {
    const a = { x: 1, y: 2 }, b = { x: 7, y: 9 };
    assert.equal(dist(a, b), dist(b, a));
  });
});

describe("clamp", () => {
  it("returns value when within range", () => {
    assert.equal(clamp(5, 0, 10), 5);
  });

  it("clamps to minimum", () => {
    assert.equal(clamp(-5, 0, 10), 0);
  });

  it("clamps to maximum", () => {
    assert.equal(clamp(15, 0, 10), 10);
  });

  it("handles equal lo and hi", () => {
    assert.equal(clamp(5, 3, 3), 3);
  });
});

describe("angleDiff", () => {
  it("returns 0 for identical angles", () => {
    assert.equal(angleDiff(1, 1), 0);
  });

  it("returns positive for counter-clockwise", () => {
    const d = angleDiff(0, Math.PI / 2);
    assert.ok(Math.abs(d - Math.PI / 2) < 1e-10);
  });

  it("returns negative for clockwise", () => {
    const d = angleDiff(Math.PI / 2, 0);
    assert.ok(Math.abs(d + Math.PI / 2) < 1e-10);
  });

  it("wraps around correctly (shortest path)", () => {
    // Going from just below PI to just above -PI should be a small positive step
    const d = angleDiff(Math.PI - 0.1, -Math.PI + 0.1);
    assert.ok(Math.abs(d - 0.2) < 1e-10);
  });

  it("result is always in (-PI, PI]", () => {
    for (let a = -Math.PI; a < Math.PI; a += 0.3) {
      for (let b = -Math.PI; b < Math.PI; b += 0.3) {
        const d = angleDiff(a, b);
        assert.ok(d > -Math.PI && d <= Math.PI, `angleDiff(${a}, ${b}) = ${d}`);
      }
    }
  });
});
