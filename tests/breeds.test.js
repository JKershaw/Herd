import { describe, it } from "node:test";
import assert from "node:assert/strict";
import {
  BREEDS, BREED_IDS, DEFAULT_BREED, getBreed, normalizeBreedId,
  createDog, updateDog, updateSheep, addScore, scoreBreed,
} from "../game.js";

const TRAITS = ["runSpeed", "idleSpeed", "circleRate", "circleDist", "walkupDist", "turnResponse", "presence"];

function makeSheep(x, y) {
  return { x, y, vx: 0, vy: 0, settled: false, wobble: 0, grazeTimer: 100, isGrazing: false, headDir: 0, settleTimer: 0, panic: 0, fleeTimer: 0 };
}

describe("BREEDS table", () => {
  it("lists collie, corgi and kelpie, with collie as the default", () => {
    assert.deepEqual(BREED_IDS, ["collie", "corgi", "kelpie"]);
    assert.equal(DEFAULT_BREED, "collie");
  });

  it("every breed has every tuning trait as a positive finite number", () => {
    for (const id of BREED_IDS) {
      const b = BREEDS[id];
      assert.equal(b.id, id);
      for (const t of TRAITS) {
        assert.equal(typeof b[t], "number", `${id}.${t}`);
        assert.ok(Number.isFinite(b[t]) && b[t] > 0, `${id}.${t}=${b[t]}`);
      }
    }
  });

  it("every breed has display data: name, short tag, blurb, palette and look flags", () => {
    for (const id of BREED_IDS) {
      const b = BREEDS[id];
      assert.equal(typeof b.name, "string");
      assert.equal(typeof b.short, "string");
      assert.equal(typeof b.blurb, "string");
      for (const k of ["coat", "white", "eye", "ear", "nose", "tailTip"])
        assert.match(b.colors[k], /^#[0-9a-f]{3,6}$/i, `${id}.colors.${k}`);
      assert.ok(["folded", "upright"].includes(b.look.ears), `${id}.look.ears`);
      assert.ok(["standard", "short", "slim"].includes(b.look.body), `${id}.look.body`);
      assert.ok(["plume", "stub"].includes(b.look.tail), `${id}.look.tail`);
    }
  });

  it("collie equals the legacy hard-coded constants", () => {
    const c = BREEDS.collie;
    assert.equal(c.runSpeed, 80);
    assert.equal(c.idleSpeed, 22);
    assert.equal(c.circleRate, 1.7);
    assert.equal(c.circleDist, 48);
    assert.equal(c.walkupDist, 20);
    assert.equal(c.turnResponse, 0.12);
    assert.equal(c.presence, 1);
  });

  it("collie keeps the legacy black/white sprite palette", () => {
    assert.deepEqual(BREEDS.collie.colors, {
      coat: "#1a1a1a", white: "#eee8dd", eye: "#d4a040", ear: "#111", nose: "#222", tailTip: "#eee8dd",
    });
    assert.deepEqual(BREEDS.collie.look, { ears: "folded", body: "standard", tail: "plume" });
  });

  it("breeds are not cosmetic: corgi and kelpie each differ from collie on every trait", () => {
    for (const id of ["corgi", "kelpie"])
      for (const t of TRAITS)
        assert.notEqual(BREEDS[id][t], BREEDS.collie[t], `${id}.${t} should differ from collie`);
  });

  it("the table is frozen so a live game cannot mutate shared tuning", () => {
    assert.ok(Object.isFrozen(BREEDS));
    for (const id of BREED_IDS) assert.ok(Object.isFrozen(BREEDS[id]), id);
  });
});

describe("getBreed / normalizeBreedId", () => {
  it("returns the matching breed for known ids", () => {
    for (const id of BREED_IDS) assert.equal(getBreed(id), BREEDS[id]);
  });

  it("falls back to collie for missing, unknown or malformed ids", () => {
    for (const bad of [undefined, null, "", "poodle", "COLLIE", 42, {}, "__proto__", "toString", "constructor"]) {
      assert.equal(getBreed(bad), BREEDS.collie, `getBreed(${String(bad)})`);
      assert.equal(normalizeBreedId(bad), "collie", `normalizeBreedId(${String(bad)})`);
    }
  });

  it("normalizeBreedId passes known ids through", () => {
    for (const id of BREED_IDS) assert.equal(normalizeBreedId(id), id);
  });
});

describe("createDog breed", () => {
  it("defaults to collie", () => {
    assert.equal(createDog().breed, "collie");
  });

  it("stamps the requested breed", () => {
    assert.equal(createDog("corgi").breed, "corgi");
    assert.equal(createDog("kelpie").breed, "kelpie");
  });

  it("stamps collie for unknown ids", () => {
    assert.equal(createDog("poodle").breed, "collie");
  });

  it("breed does not change starting position or state", () => {
    const base = createDog();
    for (const id of BREED_IDS) assert.deepEqual({ ...createDog(id), breed: "collie" }, base);
  });
});

describe("breed tuning changes the simulation", () => {
  function groundCovered(breed, cmd, frames = 90) {
    const dog = createDog(breed);
    const sheep = [makeSheep(60, 50), makeSheep(64, 54)];
    let covered = 0;
    for (let i = 0; i < frames; i++) {
      const px = dog.x, py = dog.y;
      updateDog(dog, sheep, cmd, 1 / 60);
      covered += Math.hypot(dog.x - px, dog.y - py);
    }
    return covered;
  }

  it("a kelpie covers more ground than a corgi on walk-up", () => {
    const kelpie = groundCovered("kelpie", "walkup");
    const collie = groundCovered("collie", "walkup");
    const corgi = groundCovered("corgi", "walkup");
    assert.ok(kelpie > collie && collie > corgi, `kelpie=${kelpie} collie=${collie} corgi=${corgi}`);
  });

  it("idle drift speed follows idleSpeed", () => {
    const kelpie = groundCovered("kelpie", null);
    const corgi = groundCovered("corgi", null);
    assert.ok(kelpie > corgi, `kelpie=${kelpie} corgi=${corgi}`);
  });

  it("settled circling radius under come-bye is ordered corgi < collie < kelpie", () => {
    function circleRadius(breed) {
      const dog = createDog(breed);
      const sheep = [makeSheep(120, 105)];
      let sum = 0, n = 0;
      for (let i = 0; i < 1200; i++) {
        updateDog(dog, sheep, "comebye", 1 / 60);
        if (i >= 900) { sum += Math.hypot(dog.x - 120, dog.y - 105); n++; }
      }
      return sum / n;
    }
    const corgi = circleRadius("corgi"), collie = circleRadius("collie"), kelpie = circleRadius("kelpie");
    assert.ok(corgi < collie && collie < kelpie, `corgi=${corgi} collie=${collie} kelpie=${kelpie}`);
  });

  it("circling angular rate follows circleRate", () => {
    function swept(breed) {
      const dog = createDog(breed);
      const a0 = dog.angle;
      updateDog(dog, [makeSheep(120, 105)], "comebye", 0.5);
      return dog.angle - a0;
    }
    assert.ok(Math.abs(swept("corgi") - 1.9 * 0.5) < 1e-12);
    assert.ok(Math.abs(swept("collie") - 1.7 * 0.5) < 1e-12);
    assert.ok(Math.abs(swept("kelpie") - 1.5 * 0.5) < 1e-12);
  });

  it("presence scales the sheep flee radius: a sheep at 60px flees a kelpie but not a collie", () => {
    for (const [breed, flees] of [["kelpie", true], ["collie", false], ["corgi", false]]) {
      const sheep = [makeSheep(100, 100)];
      const dog = { x: 160, y: 100, breed };
      updateSheep(sheep, dog, 1 / 60, 0);
      assert.equal(sheep[0].fleeTimer > 0, flees, `${breed}: fleeTimer=${sheep[0].fleeTimer}`);
    }
  });

  it("a weaker presence lets a sheep at 50px stay calm near a corgi but not a collie", () => {
    // corgi flee radius 56 * 0.85 = 47.6
    for (const [breed, flees] of [["corgi", false], ["collie", true]]) {
      const sheep = [makeSheep(100, 100)];
      updateSheep(sheep, { x: 150, y: 100, breed }, 1 / 60, 0);
      assert.equal(sheep[0].fleeTimer > 0, flees, breed);
    }
  });

  it("switching breed live on an existing dog takes effect on the next update", () => {
    const dog = createDog("collie");
    const sheep = [makeSheep(120, 105)];
    updateDog(dog, sheep, "comebye", 1 / 60);
    const before = { x: dog.x, y: dog.y, focusIndex: dog.focusIndex };
    dog.breed = "kelpie";
    const a0 = dog.angle;
    updateDog(dog, sheep, "comebye", 0.5);
    assert.ok(Math.abs(dog.angle - a0 - 1.5 * 0.5) < 1e-12, "kelpie circleRate should apply immediately");
    assert.equal(dog.focusIndex, before.focusIndex);
  });
});

describe("high scores with breed tags", () => {
  it("addScore tags the new entry with its breed", () => {
    const list = addScore([], "ace", 30, "corgi");
    assert.deepEqual(list, [{ name: "ACE", time: 30, breed: "corgi" }]);
  });

  it("addScore normalizes an unknown breed to collie", () => {
    assert.equal(addScore([], "ACE", 30, "poodle")[0].breed, "collie");
    assert.equal(addScore([], "ACE", 30)[0].breed, "collie");
  });

  it("keeps one shared board: mixed breeds sort together by time, top 5", () => {
    let list = [];
    list = addScore(list, "AAA", 50, "collie");
    list = addScore(list, "BBB", 20, "kelpie");
    list = addScore(list, "CCC", 40, "corgi");
    list = addScore(list, "DDD", 10, "corgi");
    list = addScore(list, "EEE", 30, "collie");
    list = addScore(list, "FFF", 25, "kelpie");
    assert.deepEqual(list.map(e => e.name), ["DDD", "BBB", "FFF", "EEE", "CCC"]);
    assert.deepEqual(list.map(e => e.breed), ["corgi", "kelpie", "kelpie", "collie", "corgi"]);
  });

  it("preserves legacy ordering: a tie goes after the existing entry", () => {
    const list = addScore([{ name: "OLD", time: 30 }], "NEW", 30, "corgi");
    assert.deepEqual(list.map(e => e.name), ["OLD", "NEW"]);
  });

  it("does not rewrite untagged legacy entries and does not mutate the input", () => {
    const legacy = [{ name: "OLD", time: 30 }];
    const list = addScore(legacy, "NEW", 40, "kelpie");
    assert.deepEqual(legacy, [{ name: "OLD", time: 30 }]);
    assert.deepEqual(list[0], { name: "OLD", time: 30 });
  });

  it("scoreBreed treats untagged or unknown entries as collie", () => {
    assert.equal(scoreBreed({ name: "OLD", time: 30 }), BREEDS.collie);
    assert.equal(scoreBreed({ name: "X", time: 1, breed: "poodle" }), BREEDS.collie);
    assert.equal(scoreBreed({ name: "X", time: 1, breed: "kelpie" }), BREEDS.kelpie);
  });
});
