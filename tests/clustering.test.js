import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { clusterSheep } from "../game.js";

function makeSheep(x, y, settled = false) {
  return { x, y, vx: 0, vy: 0, settled, wobble: 0, grazeTimer: 0, isGrazing: false, headDir: 0, settleTimer: 0, panic: 0, fleeTimer: 0 };
}

describe("clusterSheep", () => {
  it("returns empty array for no sheep", () => {
    assert.deepEqual(clusterSheep([]), []);
  });

  it("returns empty array when all sheep are settled", () => {
    const sheep = [makeSheep(50, 50, true), makeSheep(60, 60, true)];
    assert.deepEqual(clusterSheep(sheep), []);
  });

  it("groups nearby sheep into one cluster", () => {
    // All within threshold (40px)
    const sheep = [makeSheep(50, 50), makeSheep(60, 50), makeSheep(55, 55)];
    const clusters = clusterSheep(sheep);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].size, 3);
  });

  it("separates distant sheep into different clusters", () => {
    // Far apart (>40px)
    const sheep = [makeSheep(10, 10), makeSheep(200, 200)];
    const clusters = clusterSheep(sheep);
    assert.equal(clusters.length, 2);
    assert.equal(clusters[0].size, 1);
    assert.equal(clusters[1].size, 1);
  });

  it("computes cluster centroid correctly", () => {
    const sheep = [makeSheep(40, 60), makeSheep(60, 40)];
    const clusters = clusterSheep(sheep);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].x, 50);
    assert.equal(clusters[0].y, 50);
  });

  it("ignores settled sheep in clustering", () => {
    const sheep = [
      makeSheep(50, 50, false),
      makeSheep(55, 55, true),  // settled — should be excluded
      makeSheep(150, 150, false),
    ];
    const clusters = clusterSheep(sheep);
    // The settled sheep at (55,55) should not bridge the two active sheep
    assert.equal(clusters.length, 2);
  });

  it("handles transitive clustering (chain)", () => {
    // A-B close, B-C close, but A-C far => all one cluster via union-find
    const sheep = [makeSheep(10, 10), makeSheep(40, 10), makeSheep(70, 10)];
    const clusters = clusterSheep(sheep);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].size, 3);
  });

  it("single sheep forms a cluster of size 1", () => {
    const clusters = clusterSheep([makeSheep(100, 100)]);
    assert.equal(clusters.length, 1);
    assert.equal(clusters[0].size, 1);
    assert.equal(clusters[0].x, 100);
    assert.equal(clusters[0].y, 100);
  });
});
