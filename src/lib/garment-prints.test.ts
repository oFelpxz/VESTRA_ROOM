import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { lookOf, printSpots, stripeSpot } from "./garment-prints";

describe("estampas por versão da peça", () => {
  it("a versão sai do nome da cor", () => {
    assert.equal(lookOf("Preto Street"), "street");
    assert.equal(lookOf("Off-white Street "), "street");
    assert.equal(lookOf("Preto / Lima"), "sport");
    assert.equal(lookOf("Off-white/Lima"), "sport");
    assert.equal(lookOf("Lima"), null);
    assert.equal(lookOf("Verde Militar"), null);
    assert.equal(lookOf(null), null);
  });

  it("Street põe o logo grande nas costas", () => {
    const back = printSpots("/models/boxy_tee_01.glb", "street").find((s) => s.side === "costas")!;
    assert.equal(back.kind, "costas");
    assert.equal(back.center[0], 0);
  });

  it("Street também põe o logo pequeno no peito esquerdo de quem veste", () => {
    const chest = printSpots("/models/boxy_tee_01.glb", "street").find((s) => s.side === "frente");
    assert.equal(chest?.kind, "peito");
    assert.ok(chest!.center[0] > 0);
  });

  it("track jacket Sport: só o peito, sem logo nas costas", () => {
    const spots = printSpots("/models/track_jacket.glb", "sport");
    assert.deepEqual(spots.map((s) => s.kind), ["peito"]);
    assert.deepEqual(printSpots("/models/track_jacket.glb", "street"), []);
  });

  it("faixa lima só nas mangas da track jacket Sport", () => {
    const stripe = stripeSpot("/models/track_jacket.glb", "sport");
    assert.ok(stripe && stripe.from[1] > stripe.to[1], "desce do ombro ao punho");
    assert.ok(stripe.from[0] > 0 && stripe.to[0] > stripe.from[0], "lado +x, abrindo para fora");
    assert.equal(stripeSpot("/models/track_jacket.glb", "street"), null);
    assert.equal(stripeSpot("/models/track_jacket.glb", null), null);
    assert.equal(stripeSpot("/models/hoodie-core-v3.glb", "street"), null);
    assert.equal(stripeSpot("/models/cargo_pant_02.glb", "sport"), null);
  });

  it("acha o arquivo também numa URL completa", () => {
    const url = "https://cdn.exemplo.com/storage/v1/hoodie-core-v3.glb?v=2";
    assert.ok(printSpots(url, "street").length > 0);
  });

  it("peça lisa e peça sem mapa ficam sem estampa", () => {
    assert.deepEqual(printSpots("/models/boxy_tee_01.glb", null), []);
    assert.deepEqual(printSpots("/models/cargo_pant_02.glb", "street"), []);
  });
});
