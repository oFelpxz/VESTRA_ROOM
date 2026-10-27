/**
 * Looks prontos da marca (lista 10): 2 da linha Street e 2 da Sport, com as
 * cores da lista 9. Cada peça é o slug do produto + o nome da cor cadastrada;
 * o tamanho sai da medida de quem prova (ou do molde, sem login). A linha do
 * look é a da peça de cima (`lookOf` da cor). Sem desconto: o look custa a
 * soma das peças. Regras puras, sem banco.
 */

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

/** A linha que a cor da peça de cima diz (confere o cadastro do look). */
export function lineOfTop(look: BrandLook): GarmentLook | null {
  return lookOf(look.top.color);
}
