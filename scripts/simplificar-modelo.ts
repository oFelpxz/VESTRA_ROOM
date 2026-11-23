import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { dedup, prune, simplify, weld } from "@gltf-transform/functions";
import { MeshoptSimplifier } from "meshoptimizer";

// Reduz a malha de um .glb pesado demais para o provador (a Tech Vest veio do
// Sketchfab com 386 mil vértices: 38 MB e ~15 s para aparecer). Junta os
// conjuntos de UV iguais num só, tira as tangentes (o three calcula o relevo
// sem elas) e simplifica até o erro dado. Mantém os créditos (asset.extras).
//
// Uso: npx tsx scripts/simplificar-modelo.ts <entrada.glb> <saída.glb> [proporção=0.1] [erro=0.005]

async function main() {
  const [src, dst, ratio = "0.1", error = "0.005"] = process.argv.slice(2);
  if (!src || !dst) throw new Error("uso: simplificar-modelo.ts <entrada.glb> <saída.glb> [proporção] [erro]");

  const io = new NodeIO().registerExtensions(ALL_EXTENSIONS);
  const doc = await io.read(src);
  const count = () =>
    doc
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives())
      .reduce((n, p) => n + (p.getAttribute("POSITION")?.getCount() ?? 0), 0);
  const before = count();

  for (const prim of doc.getRoot().listMeshes().flatMap((m) => m.listPrimitives())) {
    const uv0 = prim.getAttribute("TEXCOORD_0")?.getArray();
    for (const name of ["TEXCOORD_1", "TEXCOORD_2", "TEXCOORD_3"]) {
      const uv = prim.getAttribute(name)?.getArray();
      if (!uv) continue;
      if (!uv0 || uv.some((v, i) => Math.abs(v - uv0[i]) > 1e-6)) {
        throw new Error(`${name} diferente do TEXCOORD_0: não dá para juntar`);
      }
      prim.setAttribute(name, null);
    }
    prim.setAttribute("TANGENT", null);
  }
  for (const mat of doc.getRoot().listMaterials()) {
    for (const info of [
      mat.getBaseColorTextureInfo(),
      mat.getMetallicRoughnessTextureInfo(),
      mat.getNormalTextureInfo(),
      mat.getOcclusionTextureInfo(),
      mat.getEmissiveTextureInfo(),
    ]) {
      info?.setTexCoord(0);
    }
  }

  await MeshoptSimplifier.ready;
  await doc.transform(
    weld(),
    simplify({ simplifier: MeshoptSimplifier, ratio: Number(ratio), error: Number(error) }),
    prune(),
    dedup(),
  );
  await io.write(dst, doc);
  console.log(`${before} → ${count()} vértices`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
