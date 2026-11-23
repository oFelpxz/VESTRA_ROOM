/**
 * Tom de pele do avatar (lista 11): 6 tons, do mais claro ao mais escuro.
 * Escolhido no provador e salvo no perfil de medidas (`skinTone`); sem
 * escolha, vale o tom 2 (o de sempre). Cada tom traz a cor da pele e a do
 * brilho avermelhado nas bordas contra a luz (`sheen`), que nos tons escuros
 * precisa ser mais fechado ou a pele fica acinzentada. Regras puras, sem banco.
 */

export type SkinTone = {
  id: string;
  name: string;
  color: string;
  sheen: string;
  /** Íris (lista 12): castanho, mais claro nos tons claros, como no brasileiro médio. */
  iris: string;
};

export const SKIN_TONES: SkinTone[] = [
  { id: "t1", name: "Tom 1", color: "#ecd2c0", sheen: "#f0a08a", iris: "#7a5636" },
  { id: "t2", name: "Tom 2", color: "#d9bba4", sheen: "#e58f73", iris: "#684629" },
  { id: "t3", name: "Tom 3", color: "#c29a7b", sheen: "#d27e5c", iris: "#5a3b22" },
  { id: "t4", name: "Tom 4", color: "#a0765a", sheen: "#b8653f", iris: "#4b301b" },
  { id: "t5", name: "Tom 5", color: "#7a5440", sheen: "#93492c", iris: "#3e2716" },
  { id: "t6", name: "Tom 6", color: "#56392a", sheen: "#70351f", iris: "#332012" },
];

export const DEFAULT_SKIN_TONE = "t2";

export function isSkinTone(id: unknown): id is string {
  return typeof id === "string" && SKIN_TONES.some((t) => t.id === id);
}

/** Tom salvo no perfil; vazio ou desconhecido (tom removido) vira o padrão. */
export function skinTone(id: string | null | undefined): SkinTone {
  return SKIN_TONES.find((t) => t.id === id) ?? SKIN_TONES.find((t) => t.id === DEFAULT_SKIN_TONE)!;
}
