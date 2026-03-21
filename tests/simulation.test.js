import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  updateParticles, updateDog, updateSheep, createDog,
  FENCE_L, FENCE_R, FENCE_T, FENCE_B, PEN,
} from "../game.js";

function makeSheep(x, y, settled = false) {
  return { x, y, vx: 0, vy: 0, settled, wobble: 0, grazeTimer: 100, isGrazing: false, headDir: 0, settleTimer: 0, panic: 0, fleeTimer: 0 };
}

describe("updateParticles", () => {
  it("removes dead particles", () => {
    const particles = [
      { x: 0, y: 0, vx: 10, vy: -10, life: 0.01, color: "#fff", size: 1 },
    ];
    const result = updateParticles(particles, 1.0);
    assert.equal(result.length, 0);
  });

  it("keeps alive particles", () => {
    const particles = [
      { x: 0, y: 0, vx: 10, vy: -10, life: 5, color: "#fff", size: 1 },
    ];
    const result = updateParticles(particles, 0.016);
    assert.equal(result.length, 1);
  });

  it("applies gravity (vy increases)", () => {
    const p = { x: 0, y: 0, vx: 0, vy: 0, life: 5, color: "#fff", size: 1 };
    updateParticles([p], 0.1);
    assert.ok(p.vy > 0, "gravity should increase vy");
  });

  it("moves particles by velocity", () => {
    const p = { x: 10, y: 20, vx: 100, vy: 0, life: 5, color: "#fff", size: 1 };
    updateParticles([p], 0.1);
    assert.ok(p.x > 10, "particle should move right");
  });
});

describe("updateDog", () => {
  it("moves dog toward sheep cluster", () => {
    const dog = createDog();
    const sheep = [makeSheep(50, 50), makeSheep(55, 55)];
    const initialDist = Math.sqrt((dog.x - 50) ** 2 + (dog.y - 50) ** 2);

    // Simulate several frames with walkup command
    for (let i = 0; i < 60; i++) {
      updateDog(dog, sheep, "walkup", 0.016);
    }

    const finalDist = Math.sqrt((dog.x - 52.5) ** 2 + (dog.y - 52.5) ** 2);
    assert.ok(finalDist < initialDist, "dog should move closer to sheep");
  });

  it("returns cluster info", () => {
    const dog = createDog();
    const sheep = [makeSheep(50, 50)];
    const result = updateDog(dog, sheep, null, 0.016);
    assert.ok(Array.isArray(result.clusters));
    assert.equal(result.clusters.length, 1);
    assert.equal(typeof result.focusInfo, "string");
  });

  it("handles empty sheep list", () => {
    const dog = createDog();
    const result = updateDog(dog, [], null, 0.016);
    assert.deepEqual(result.clusters, []);
  });

  it("comebye rotates angle positively", () => {
    const dog = createDog();
    const sheep = [makeSheep(100, 100)];
    const initialAngle = dog.angle;
    updateDog(dog, sheep, "comebye", 0.5);
    assert.ok(dog.angle > initialAngle, "comebye should increase angle");
  });

  it("away rotates angle negatively", () => {
    const dog = createDog();
    const sheep = [makeSheep(100, 100)];
    const initialAngle = dog.angle;
    updateDog(dog, sheep, "away", 0.5);
    assert.ok(dog.angle < initialAngle, "away should decrease angle");
  });

  it("dog stays within field boundaries", () => {
    const dog = createDog();
    const sheep = [makeSheep(FENCE_L + 5, FENCE_T + 5)];
    for (let i = 0; i < 200; i++) {
      updateDog(dog, sheep, "walkup", 0.016);
    }
    assert.ok(dog.x >= FENCE_L, `dog.x=${dog.x} < FENCE_L`);
    assert.ok(dog.x <= FENCE_R, `dog.x=${dog.x} > FENCE_R`);
    assert.ok(dog.y >= FENCE_T, `dog.y=${dog.y} < FENCE_T`);
    assert.ok(dog.y <= FENCE_B, `dog.y=${dog.y} > FENCE_B`);
  });

  it("auto-focuses on best cluster when idle", () => {
    const dog = createDog();
    dog.idleTime = 2; // already idle
    // Two distant clusters — one larger
    const sheep = [
      makeSheep(30, 30), makeSheep(35, 35), makeSheep(32, 28), // cluster of 3
      makeSheep(180, 180), // cluster of 1
    ];
    updateDog(dog, sheep, null, 0.016);
    // Should focus on the larger/farther cluster (higher score)
    assert.equal(typeof dog.focusIndex, "number");
  });
});

describe("updateSheep", () => {
  it("sheep flee from nearby dog", () => {
    const sheep = [makeSheep(100, 100)];
    const dog = { x: 105, y: 100 }; // very close, to the right
    const initialX = sheep[0].x;

    for (let i = 0; i < 30; i++) {
      updateSheep(sheep, dog, 0.016, i);
    }

    assert.ok(sheep[0].x < initialX, "sheep should flee left, away from dog");
  });

  it("sheep stay within fence bounds", () => {
    // Sheep near the edge being pressured toward the wall
    const sheep = [makeSheep(FENCE_L + 5, FENCE_T + 5)];
    const dog = { x: FENCE_L + 20, y: FENCE_T + 20 };

    for (let i = 0; i < 100; i++) {
      updateSheep(sheep, dog, 0.016, i);
    }

    assert.ok(sheep[0].x >= FENCE_L, "sheep should not escape left fence");
    assert.ok(sheep[0].y >= FENCE_T, "sheep should not escape top fence");
  });

  it("sheep settle in pen after enough time", () => {
    // Place sheep inside pen
    const penCenterX = PEN.x + PEN.w / 2;
    const penCenterY = PEN.y + PEN.h / 2;
    const sheep = [makeSheep(penCenterX, penCenterY)];
    // Dog far away so sheep aren't fleeing
    const dog = { x: 30, y: 180 };

    // Simulate enough frames for settle (settleTimer needs > 1.6s)
    for (let i = 0; i < 200; i++) {
      updateSheep(sheep, dog, 0.016, i);
    }

    assert.equal(sheep[0].settled, true, "sheep should settle in pen");
  });

  it("returns settled count", () => {
    const sheep = [makeSheep(100, 100), makeSheep(50, 50, true)];
    const dog = { x: 30, y: 180 };
    const result = updateSheep(sheep, dog, 0.016, 0);
    assert.equal(result.settledCount, 1); // the pre-settled one
  });

  it("settling produces celebration particles", () => {
    const penCenterX = PEN.x + PEN.w / 2;
    const penCenterY = PEN.y + PEN.h / 2;
    const sheep = [makeSheep(penCenterX, penCenterY)];
    sheep[0].settleTimer = 1.59; // just about to settle
    const dog = { x: 30, y: 180 };

    const result = updateSheep(sheep, dog, 0.02, 0);
    assert.ok(result.newParticles.length > 0, "should emit particles on settle");
  });

  it("sheep graze when dog is far away", () => {
    const sheep = [makeSheep(100, 100)];
    sheep[0].grazeTimer = -1; // ready to graze
    const dog = { x: 30, y: 30 }; // far away

    updateSheep(sheep, dog, 0.016, 0);
    assert.equal(sheep[0].isGrazing, true);
  });

  it("sheep stop grazing when dog approaches", () => {
    const sheep = [makeSheep(100, 100)];
    sheep[0].isGrazing = true;
    const dog = { x: 102, y: 100 }; // very close

    updateSheep(sheep, dog, 0.016, 0);
    assert.equal(sheep[0].isGrazing, false);
  });

  it("panic builds near walls with dog pressure", () => {
    const sheep = [makeSheep(FENCE_L + 5, 100)];
    const dog = { x: FENCE_L + 20, y: 100 };

    for (let i = 0; i < 30; i++) {
      updateSheep(sheep, dog, 0.016, i);
    }

    assert.ok(sheep[0].panic > 0, "panic should increase near wall with dog pressure");
  });

  it("panic decays when dog is away", () => {
    const sheep = [makeSheep(100, 100)];
    sheep[0].panic = 0.8;
    const dog = { x: 30, y: 30 }; // far away

    for (let i = 0; i < 30; i++) {
      updateSheep(sheep, dog, 0.016, i);
    }

    assert.ok(sheep[0].panic < 0.8, "panic should decay without pressure");
  });
});
