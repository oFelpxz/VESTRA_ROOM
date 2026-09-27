// Ordenação de tamanhos de vestuário — lógica pura, sem banco.

const LETTER_SIZES = ["PP", "P", "M", "G", "GG", "XG", "XGG", "EXG"];

/** Ordem de vestuário: PP < P < M < G < GG…, depois numéricos, depois o resto. */
function sizeRank(size: string): [number, number, string] {
  const upper = size.toUpperCase();
  const letter = LETTER_SIZES.indexOf(upper);
  if (letter >= 0) return [0, letter, ""];
  const numeric = Number(size);
  if (Number.isFinite(numeric)) return [1, numeric, ""];
  return [2, 0, upper];
}

export function compareVariants(
  a: { color: string; size: string },
  b: { color: string; size: string },
) {
  const byColor = a.color.localeCompare(b.color, "pt-BR");
  if (byColor !== 0) return byColor;
  const [ga, na, sa] = sizeRank(a.size);
  const [gb, nb, sb] = sizeRank(b.size);
  return ga - gb || na - nb || sa.localeCompare(sb, "pt-BR");
}
