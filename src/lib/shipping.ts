/**
 * Mock simples de cálculo de frete para o MVP.
 * Regra:
 *  - subtotal >= R$ 300: grátis
 *  - senão: R$ 15 fixo + R$ 2 por item
 *
 * Em produção, substituir por integração real (Melhor Envio, Correios, etc.).
 */

export type ShippingInput = {
  subtotal: number;
  itemCount: number;
  postalCode?: string | null;
};

export type ShippingQuote = {
  amount: number;
  free: boolean;
  estimatedDays: number;
  reason?: string;
};

const FREE_THRESHOLD = 300;
const FIXED_BASE = 15;
const PER_ITEM = 2;

export function calculateShipping({
  subtotal,
  itemCount,
  postalCode,
}: ShippingInput): ShippingQuote {
  if (subtotal >= FREE_THRESHOLD) {
    return {
      amount: 0,
      free: true,
      estimatedDays: 5,
      reason: `Frete grátis acima de R$ ${FREE_THRESHOLD}.`,
    };
  }

  const amount = FIXED_BASE + itemCount * PER_ITEM;
  const isCapital = postalCode ? capitalPrefixes.includes(postalCode.slice(0, 2)) : false;

  return {
    amount,
    free: false,
    estimatedDays: isCapital ? 4 : 8,
  };
}

// Aproximação: CEPs iniciados por essas faixas → capital (entrega mais rápida).
const capitalPrefixes = ["01", "02", "03", "04", "05", "20", "21", "22", "30"];
