import { test } from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { withSoftShadows } from "./soft-shadow";

const original = THREE.ShaderChunk.shadowmap_pars_fragment;

test("troca só a sombra PCF do three pela sombra com penumbra (lista 12, item 8)", () => {
  const soft = withSoftShadows(original);
  assert.equal(soft.match(/float getShadow\( sampler2DShadow/g)?.length, 1);
  assert.match(soft, /vestraBlocked/);
  // O PCF de 5 amostras saiu; as outras sombras (VSM, básica, ponto) continuam.
  const fiveTaps = (s: string) => s.split("vogelDiskSample( 4, 5, phi )").length;
  assert.equal(fiveTaps(soft), fiveTaps(original) - 1);
  for (const kept of ["SHADOWMAP_TYPE_VSM", "SHADOWMAP_TYPE_BASIC", "getPointShadow"]) assert.match(soft, new RegExp(kept));
});

test("se o three mudar o trecho de sombra, avisa em vez de quebrar o shader", () => {
  assert.throws(() => withSoftShadows("#ifdef USE_SHADOWMAP\n#endif"), /mudou/);
});
