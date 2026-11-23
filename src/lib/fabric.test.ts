import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { clothMaterial } from "./fabric";

test("cetim: brilho esticado ao longo do fio e reflexo mais fraco que o látex (lista 12)", () => {
  const m = clothMaterial(new THREE.MeshStandardMaterial(), "#ffffff", "cetim");
  assert.ok(m.anisotropy > 0.5);
  assert.ok(m.specularIntensity < 0.6 && m.roughness > 0.3);
  assert.match(m.customProgramCacheKey(), /aniso/);
});

test("algodão e jeans continuam com brilho redondo", () => {
  for (const f of ["algodao", "denim"] as const) {
    const m = clothMaterial(new THREE.MeshStandardMaterial(), "#336699", f);
    assert.equal(m.anisotropy, 0);
    assert.doesNotMatch(m.customProgramCacheKey(), /aniso/);
  }
});
