/**
 * Looks prontos da marca (lista 10): 2 da linha Street e 2 da Sport, com as
 * cores da lista 9. Cada peça é o slug do produto + o nome da cor cadastrada;
 * o tamanho sai da medida de quem prova (ou do molde, sem login). A linha do
 * look é a da peça de cima (`lookOf` da cor). Sem desconto: o look custa a
 * soma das peças. Regras puras, sem banco.
 */

import { colorToHex } from "./color-names";
import { lookOf, type GarmentLook } from "./garment-prints";

export type BrandLookPiece = { product: string; color: string };

export type BrandLook = {
  slug: string;
  name: string;
  line: GarmentLook;
  caption: string;
  top: BrandLookPiece;
  bottom: BrandLookPiece;
  accessory: BrandLookPiece | null;
};

export const BRAND_LOOKS: BrandLook[] = [
  {
    slug: "street-noite",
    name: "Street Noite",
    line: "street",
    caption: "Moletom com logo nas costas, cargo verde militar e touca",
    top: { product: "hoodie-core", color: "Preto Street" },
    bottom: { product: "cargo-pant-02", color: "Verde Militar" },
    accessory: { product: "knit-beanie", color: "Preto" },
  },
  {
    slug: "street-dia",
    name: "Street Dia",
    line: "street",
    caption: "Camiseta boxy off-white e jeans wide índigo",
    top: { product: "boxy-tee-01", color: "Off-white Street" },
    bottom: { product: "wide-denim", color: "Índigo" },
    accessory: null,
  },
  {
    slug: "sport-pista",
    name: "Sport Pista",
    line: "sport",
    caption: "Jaqueta de pista preta com faixa lima, cargo preta e touca lima",
    top: { product: "track-jacket", color: "Preto / Lima" },
    bottom: { product: "cargo-pant-02", color: "Preto" },
    accessory: { product: "knit-beanie", color: "Lima" },
  },
  {
    slug: "sport-verao",
    name: "Sport Verão",
    line: "sport",
    caption: "Jaqueta de pista off-white, bermuda utility e touca lima",
    top: { product: "track-jacket", color: "Off-white / Lima" },
    bottom: { product: "bermuda-utility", color: "Preto" },
    accessory: { product: "knit-beanie", color: "Lima" },
  },
];

export function brandLookPieces(look: BrandLook): BrandLookPiece[] {
  return look.accessory ? [look.top, look.bottom, look.accessory] : [look.top, look.bottom];
}

export function brandLookBySlug(slug: string): BrandLook | null {
  return BRAND_LOOKS.find((l) => l.slug === slug) ?? null;
}

/** Looks prontos que levam este produto (para "Complete o look"). */
export function brandLooksWith(productSlug: string): BrandLook[] {
  return BRAND_LOOKS.filter((l) => brandLookPieces(l).some((p) => p.product === productSlug));
}

/** "Experimentar este look": o provador da peça de cima, já vestido com o look. */
export function brandLookTryOnHref(look: BrandLook): string {
  return `/produto/${look.top.product}/provador?marca=${look.slug}`;
}

/** A linha que a cor da peça de cima diz (confere o cadastro do look). */
export function lineOfTop(look: BrandLook): GarmentLook | null {
  return lookOf(look.top.color);
}

/** Peça do look vestida no 3D: modelo, cor (hex) e versão com estampa. */
export type OutfitPiece = { url: string; color: string; look: GarmentLook | null };
export type BrandLookOutfit = { top: OutfitPiece | null; bottom: OutfitPiece | null; accessory: OutfitPiece | null };

/**
 * Monta o look para o manequim. Sem o molde 3D de alguma peça, não há look
 * para vestir (null): o manequim pela metade enganaria quem compra.
 */
export function brandLookOutfit(
  items: { role: "top" | "bottom" | "accessory"; modelUrl: string | null; color: string }[],
): BrandLookOutfit | null {
  const outfit: BrandLookOutfit = { top: null, bottom: null, accessory: null };
  for (const item of items) {
    if (!item.modelUrl) return null;
    outfit[item.role] = { url: item.modelUrl, color: colorToHex(item.color), look: lookOf(item.color) };
  }
  return outfit.top || outfit.bottom ? outfit : null;
}

/** Preço do look: a soma das peças, sem desconto (em centavos inteiros). */
export function brandLookTotal(prices: number[]): number {
  return prices.reduce((sum, p) => sum + Math.round(p * 100), 0) / 100;
}
