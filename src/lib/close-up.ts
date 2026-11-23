/**
 * "Ver tecido de perto" no provador: para onde a câmera olha.
 *
 * - peito: entre o peito e o ombro, para pegar a gola;
 * - barra: ponto mais baixo da peça do provador. As caixas são das malhas
 *   com material de tecido já vestidas (em metros, Y para cima). Peça de
 *   cima chega acima do peito; peça de baixo, não; acessório (touca) fica
 *   todo acima dos ombros e é ignorado. Vestido conta como peça de cima.
 *
 * Arquivo sem three.js para dar para testar no Node.
 */

export type Box = { minY: number; maxY: number };

export type CloseUp = "chest" | "hem";

/** Distância da câmera até o tecido no close (m). */
export const CLOSE_DISTANCE = 0.8;

export function hemY(
  boxes: Box[],
  primary: "top" | "bottom",
  anchors: { chestY: number; shoulderY: number; hipY: number },
): number {
  const worn = boxes.filter((b) => b.minY < anchors.shoulderY);
  const own = worn.filter((b) => (primary === "top" ? b.maxY > anchors.chestY : b.maxY <= anchors.chestY));
  const pick = own.length ? own : worn;
  if (!pick.length) return anchors.hipY;
  // Um pouco acima da borda, para a barra ficar no meio da tela.
  return Math.min(...pick.map((b) => b.minY)) + 0.04;
}

export function closeUpY(
  which: CloseUp,
  boxes: Box[],
  primary: "top" | "bottom",
  anchors: { chestY: number; shoulderY: number; hipY: number },
): number {
  return which === "chest" ? (anchors.chestY + anchors.shoulderY) / 2 : hemY(boxes, primary, anchors);
}
