import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import { deinterleave } from "./deinterleave";

describe("deinterleave", () => {
  it("posição e normal entrelaçadas viram arrays próprios", () => {
    // 2 vértices: x y z | nx ny nz
    const buffer = new THREE.InterleavedBuffer(
      new Float32Array([1, 2, 3, 0, 1, 0, 4, 5, 6, 0, 0, 1]),
      6,
    );
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.InterleavedBufferAttribute(buffer, 3, 0));
    g.setAttribute("normal", new THREE.InterleavedBufferAttribute(buffer, 3, 3));
    deinterleave(g);
    assert.deepEqual([...g.attributes.position.array], [1, 2, 3, 4, 5, 6]);
    assert.deepEqual([...g.attributes.normal.array], [0, 1, 0, 0, 0, 1]);
    assert.equal(g.attributes.position.count, 2);
  });

  it("atributo comum fica como está", () => {
    const g = new THREE.BufferGeometry();
    const position = new THREE.BufferAttribute(new Float32Array([1, 2, 3]), 3);
    g.setAttribute("position", position);
    deinterleave(g);
    assert.equal(g.attributes.position, position);
  });
});
