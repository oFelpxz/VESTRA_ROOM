import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Document, NodeIO } from "@gltf-transform/core";
import { markFabricGlb } from "./model-optimizer";

const io = new NodeIO();

async function glb(extras: Record<string, unknown> = {}) {
  const doc = new Document();
  doc.createBuffer();
  doc.createScene("peça").setExtras(extras).addChild(doc.createNode("malha"));
  return io.writeBinary(doc);
}

describe("markFabricGlb", () => {
  it("grava o tecido na cena", async () => {
    const out = await markFabricGlb(await glb(), "denim");
    assert.equal(out.marked, true);
    const scene = (await io.readBinary(out.data)).getRoot().listScenes()[0];
    assert.equal(scene.getExtras().vestra_tecido, "denim");
  });

  it("troca a marca antiga e mantém os outros extras", async () => {
    const out = await markFabricGlb(await glb({ vestra_tecido: "algodao", outro: 1 }), "cetim");
    const extras = (await io.readBinary(out.data)).getRoot().listScenes()[0].getExtras();
    assert.deepEqual(extras, { vestra_tecido: "cetim", outro: 1 });
  });

  it("arquivo quebrado: devolve como veio", async () => {
    const bad = new Uint8Array([1, 2, 3]);
    const out = await markFabricGlb(bad, "sarja");
    assert.equal(out.marked, false);
    assert.equal(out.data, bad);
  });
});
