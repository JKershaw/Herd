import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createSheep, createDog } from "../game.js";

describe("createSheep", () => {
  it("creates the requested number of sheep", () => {
    assert.equal(createSheep(5).length, 5);
    assert.equal(createSheep(15).length, 15);
    assert.equal(createSheep(0).length, 0);
  });

  it("each sheep has required properties", () => {
    const sheep = createSheep(3);
    for (const s of sheep) {
      assert.equal(typeof s.x, "number");
      assert.equal(typeof s.y, "number");
      assert.equal(s.vx, 0);
      assert.equal(s.vy, 0);
      assert.equal(s.settled, false);
      assert.equal(s.settleTimer, 0);
      assert.equal(s.panic, 0);
      assert.equal(s.fleeTimer, 0);
      assert.equal(s.isGrazing, false);
      assert.equal(typeof s.wobble, "number");
      assert.equal(typeof s.grazeTimer, "number");
      assert.equal(typeof s.headDir, "number");
    }
  });

  it("sheep spawn within expected bounds", () => {
    const sheep = createSheep(100);
    for (const s of sheep) {
      assert.ok(s.x >= 28 && s.x <= 178, `x=${s.x}`);
      assert.ok(s.y >= 30 && s.y <= 180, `y=${s.y}`);
    }
  });

  it("sheep have varied initial states (not all identical)", () => {
    const sheep = createSheep(10);
    const xs = new Set(sheep.map(s => s.x));
    assert.ok(xs.size > 1, "sheep should have varied x positions");
  });
});

describe("createDog", () => {
  it("returns a dog with expected initial position", () => {
    const dog = createDog();
    assert.equal(dog.x, 110);
    assert.equal(dog.y, 185);
  });

  it("starts with zero velocity", () => {
    const dog = createDog();
    assert.equal(dog.vx, 0);
    assert.equal(dog.vy, 0);
  });

  it("has all required properties", () => {
    const dog = createDog();
    const requiredProps = [
      "x", "y", "vx", "vy", "targetX", "targetY",
      "angle", "distFromFocus", "wobble", "focusIndex",
      "idleTime", "lookDir", "lookTarget", "tailWag", "renderDir",
    ];
    for (const prop of requiredProps) {
      assert.ok(prop in dog, `missing property: ${prop}`);
    }
  });
});
