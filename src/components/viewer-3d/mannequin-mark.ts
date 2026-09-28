import type { Object3D } from "three";

/**
 * Marca de peça ajustada ao manequim (item 3D-04).
 *
 * Quem ajusta a roupa no Blender cria, nas Custom Properties da cena,
 * `vestra_fit = "avatar_base"`: a peça foi posicionada sobre o
 * `avatar_base.glb` e está nas mesmas coordenadas do manequim. O exportador
 * glTF grava a propriedade em `extras`, o GLTFLoader copia para `userData`,
 * e ela sobrevive à compressão do upload (`model-optimizer.ts`).
 */
export const MANNEQUIN_FIT_MARK = "avatar_base";

/** Aceita a marca na cena ou em qualquer objeto dela. */
export function isFittedToMannequin(root: Object3D) {
  let fitted = false;
  root.traverse((obj) => {
    if (obj.userData?.vestra_fit === MANNEQUIN_FIT_MARK) fitted = true;
  });
  return fitted;
}
