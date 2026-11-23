import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { closeUpY, hemY } from "./close-up";

const anchors = { chestY: 1.3, shoulderY: 1.45, hipY: 0.95 };
const tee = { minY: 0.85, maxY: 1.5 };
const shorts = { minY: 0.5, maxY: 1.0 };
const beanie = { minY: 1.6, maxY: 1.8 };

describe("hemY", () => {
  it("camiseta no look com bermuda: barra da camiseta", () => {
    assert.equal(hemY([tee, shorts, beanie], "top", anchors), 0.85 + 0.04);
  });

  it("provador da bermuda: barra da bermuda", () => {
    assert.equal(hemY([tee, shorts, beanie], "bottom", anchors), 0.5 + 0.04);
  });

  it("touca não conta", () => {
    assert.equal(hemY([beanie], "top", anchors), anchors.hipY);
  });

  it("sem a peça esperada, usa o que estiver vestido", () => {
    assert.equal(hemY([shorts], "top", anchors), 0.5 + 0.04);
  });
});

describe("closeUpY", () => {
  it("peito: entre o peito e o ombro (pega a gola)", () => {
    assert.equal(closeUpY("chest", [tee], "top", anchors), (1.3 + 1.45) / 2);
  });
});
