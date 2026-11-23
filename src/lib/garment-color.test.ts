import assert from "node:assert/strict";
import { describe, it } from "node:test";
import * as THREE from "three";
import { keepsOwnColor, tintMaterial } from "./garment-color";

describe("cor da peça", () => {
  it("o tecido muda para a cor escolhida", () => {
    const m = tintMaterial(new THREE.MeshStandardMaterial({ name: "Body" }), "#ff0000");
    assert.equal((m as THREE.MeshStandardMaterial).color.getHexString(), "ff0000");
  });

  it("o botão fica na cor do arquivo", () => {
    const source = new THREE.MeshStandardMaterial({ name: "Botao", color: 0xeeeeee });
    assert.ok(keepsOwnColor(source));
    const m = tintMaterial(source, "#ff0000");
    assert.equal((m as THREE.MeshStandardMaterial).color.getHexString(), "eeeeee");
  });
});
