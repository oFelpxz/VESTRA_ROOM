/**
 * Onde vai o logo A1 em cada peça (lista 9). A versão vem do nome da cor
 * cadastrada: "Preto Street" = linha Street (logo grande nas costas e pequeno
 * no peito); "Preto / Lima" = linha Sport (faixa lima). Os outros nomes
 * ("Preto", "Verde Militar") são a peça lisa.
 *
 * Medidas em metros, no corpo de referência (avatar_base, de frente para +z):
 * centro (x, y) e largura do logo; a altura sai da proporção do desenho.
 */

import type { LogoKind } from "./brand-logo";

export type GarmentLook = "street" | "sport";

export function lookOf(colorName: string | null | undefined): GarmentLook | null {
  const name = colorName?.trim() ?? "";
  if (/\bstreet$/i.test(name)) return "street";
  if (/\/\s*lima$/i.test(name)) return "sport";
  return null;
}

export type PrintSpot = {
  kind: LogoKind;
  center: [number, number];
  width: number;
  side: "frente" | "costas";
};

// Camiseta: logo grande no meio das costas, abaixo da gola.
const BACK_TEE: PrintSpot = { kind: "costas", center: [0, 1.22], width: 0.24, side: "costas" };
// Logo pequeno no peito esquerdo de quem veste (x > 0: a peça olha para +z).
const CHEST_TEE: PrintSpot = { kind: "peito", center: [0.09, 1.3], width: 0.09, side: "frente" };

/** Por arquivo do modelo (sem a extensão) e versão. */
const SPOTS: Record<string, Partial<Record<GarmentLook, PrintSpot[]>>> = {
  boxy_tee_01: { street: [CHEST_TEE, BACK_TEE] },
  // Mesma malha da boxy.
  "relugar-t-shirt-v1": { street: [CHEST_TEE, BACK_TEE] },
  // O capuz cai nas costas até ~1,25 m: o logo fica abaixo dele.
  "hoodie-core-v3": {
    street: [
      { kind: "peito", center: [0.1, 1.3], width: 0.09, side: "frente" },
      { kind: "costas", center: [0, 1.14], width: 0.24, side: "costas" },
    ],
  },
  // Na placa lisa de cima: mais baixo, o logo cruzava as tiras.
  tech_vest: {
    street: [
      { kind: "peito", center: [0.1, 1.3], width: 0.08, side: "frente" },
      { kind: "costas", center: [0, 1.335], width: 0.18, side: "costas" },
    ],
  },
  // Linha Sport: só o logo do peito aqui; a faixa das mangas é outra coisa.
  track_jacket: {
    sport: [{ kind: "peito", center: [0.1, 1.3], width: 0.09, side: "frente" }],
  },
};

/** Estampas da peça `modelUrl` na versão `look` (vazio = peça lisa). */
export function printSpots(modelUrl: string, look: GarmentLook | null): PrintSpot[] {
  if (!look) return [];
  const file = modelUrl.match(/([^/?#]+)\.glb(?:[?#]|$)/i)?.[1];
  return (file && SPOTS[file]?.[look]) || [];
}
