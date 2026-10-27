import { NodeIO } from "@gltf-transform/core";
import { Matrix4, Quaternion, Vector3 } from "three";
import type { AvatarParams } from "@/lib/avatar-builder";

/**
 * Lê o corpo do avatar de um .glb no Node (testes e scripts), como o
 * `readMorphBody` faz no navegador: posições e shape keys em coordenadas da
 * cena (y para cima, frente +z). Só para Node — usa o disco.
 */

type MorphKey = keyof AvatarParams["morphs"];
const KEYS: MorphKey[] = [
  "height", "weight", "chest", "waist", "hip", "shoulder", "armLength", "legLength", "male", "female",
];

export async function readAvatarGlb(path: string) {
  const doc = await new NodeIO().read(path);
  const node = doc.getRoot().listNodes().find((n) => n.getMesh())!;
  const matrix = new Matrix4().compose(
    new Vector3(...node.getTranslation()),
    new Quaternion(...node.getRotation()),
    new Vector3(...node.getScale()),
  );
  const linear = new Matrix4().extractRotation(matrix).scale(new Vector3(...node.getScale()));
  const mesh = node.getMesh()!;
  const prim = mesh.listPrimitives()[0];
  const names = (mesh.getExtras() as { targetNames?: string[] }).targetNames ?? [];
  const v = new Vector3();
  const each = (src: ArrayLike<number>, m: Matrix4) => {
    const out = new Float32Array(src.length);
    for (let i = 0; i < src.length / 3; i++) v.fromArray(src, i * 3).applyMatrix4(m).toArray(out, i * 3);
    return out;
  };
  const base = each(prim.getAttribute("POSITION")!.getArray()!, matrix);
  const deltas = prim.listTargets().map((t) => each(t.getAttribute("POSITION")!.getArray()!, linear));
  const keys = names.map((n) => (KEYS as string[]).includes(n) ? (n as MorphKey) : null);
  const index = Array.from(prim.getIndices()!.getArray()!);
  return { base, deltas, keys, index };
}
