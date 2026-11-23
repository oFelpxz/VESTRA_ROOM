/**
 * Filtro de preço do catálogo. Fica fora de `products.ts` (que usa o banco)
 * para poder ser testado.
 */

// Faixas de preço (presets usados nos filtros).
const PRICE_RANGES: Record<string, { min?: number; max?: number }> = {
  "ate-200": { max: 200 },
  "200-350": { min: 200, max: 350 },
  "350-mais": { min: 350 },
};

export const PRICE_OPTIONS = [
  { value: "ate-200", label: "Até R$ 200" },
  { value: "200-350", label: "R$ 200 – 350" },
  { value: "350-mais", label: "R$ 350+" },
];

type Bounds = { gte?: number; lte?: number };

export type PriceWhere = {
  OR: [
    { promotionalPrice: Bounds },
    { promotionalPrice: null; basePrice: Bounds },
  ];
};

/**
 * Condição do Prisma para a faixa `?preco=`. A faixa vale para o preço que o
 * cliente paga: o promocional, se houver; senão o preço base. Faixa
 * desconhecida ou vazia: sem filtro (null).
 */
export function priceRangeWhere(preco?: string): PriceWhere | null {
  // hasOwn: `?preco=constructor` não pode achar o que vem do Object.
  if (!preco || !Object.hasOwn(PRICE_RANGES, preco)) return null;
  const range = PRICE_RANGES[preco];
  const bounds: Bounds = {
    ...(range.min !== undefined ? { gte: range.min } : {}),
    ...(range.max !== undefined ? { lte: range.max } : {}),
  };
  return {
    OR: [
      { promotionalPrice: bounds },
      { promotionalPrice: null, basePrice: bounds },
    ],
  };
}
