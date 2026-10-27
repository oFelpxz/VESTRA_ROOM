/**
 * Onde vai o logo A1 em cada peça (lista 9). A versão vem do nome da cor
 * cadastrada: "Preto Street" = linha Street (logo grande nas costas e pequeno
 * no peito); "Preto / Lima" = linha Sport (logo no peito e faixa lima nas
 * mangas). Os outros nomes
 * ("Preto", "Verde Militar") são a peça lisa.
 *
 * Medidas em metros, no corpo de referência (avatar_base, de frente para +z):
 * centro (x, y) e largura do logo; a altura sai da proporção do desenho.
 */

import type { LogoKind } from "./brand-logo";

export type GarmentLook = "street" | "sport";

/** O que cada versão tem, para a legenda dos botões de cor. */
export const LOOK_INFO: Record<GarmentLook, string> = {
  street: "Street: logo grande nas costas e pequeno no peito",
  sport: "Sport: logo no peito e faixa lima nas mangas",
};

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
  // Linha Sport: só o logo do peito; a faixa das mangas está em STRIPES.
  track_jacket: {
    sport: [{ kind: "peito", center: [0.1, 1.3], width: 0.09, side: "frente" }],
  },
};

/** Faixa de manga: linha de fora da manga do lado +x, do ombro ao punho. */
export type StripeSpot = {
  from: [number, number, number];
  to: [number, number, number];
  width: number;
};

const STRIPES: Record<string, Partial<Record<GarmentLook, StripeSpot>>> = {
  // Medida no arquivo: o ponto mais de fora da manga em cada altura.
  track_jacket: { sport: { from: [0.2, 1.42, 0.005], to: [0.465, 0.94, 0.08], width: 0.024 } },
};

function modelFile(modelUrl: string) {
  return modelUrl.match(/([^/?#]+)\.glb(?:[?#]|$)/i)?.[1];
}

/** Estampas da peça `modelUrl` na versão `look` (vazio = peça lisa). */
export function printSpots(modelUrl: string, look: GarmentLook | null): PrintSpot[] {
  const file = modelFile(modelUrl);
  return (look && file && SPOTS[file]?.[look]) || [];
}

/** Faixa das mangas da peça na versão `look`, se tiver. */
export function stripeSpot(modelUrl: string, look: GarmentLook | null): StripeSpot | null {
  const file = modelFile(modelUrl);
  return (look && file && STRIPES[file]?.[look]) || null;
}
