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

  return {
    amount,
    free: false,
    estimatedDays: isCapital(postalCode) ? 4 : 8,
  };
}

// Aproximação: CEPs iniciados por essas faixas → capital (entrega mais rápida).
const capitalPrefixes = ["01", "02", "03", "04", "05", "20", "21", "22", "30"];

function isCapital(postalCode?: string | null) {
  const clean = postalCode?.replace(/\D/g, "") ?? "";
  return capitalPrefixes.includes(clean.slice(0, 2));
}

/** Só dígitos, exatamente 8 — ou null se não for um CEP válido. */
export function normalizePostalCode(value?: string | null): string | null {
  const clean = value?.replace(/\D/g, "") ?? "";
  return clean.length === 8 ? clean : null;
}

// --- Modalidades (item 14) ---------------------------------------------------

export type ShippingMethod = "ECONOMICO" | "EXPRESSO";

export type ShippingOption = ShippingQuote & {
  method: ShippingMethod;
  label: string;
};

const EXPRESS_BASE = 25;
const EXPRESS_PER_ITEM = 3;

/** Lê a modalidade vinda de formulário. Qualquer valor desconhecido vira ECONOMICO. */
export function parseShippingMethod(value?: string | null): ShippingMethod {
  return value?.toUpperCase() === "EXPRESSO" ? "EXPRESSO" : "ECONOMICO";
}

/**
 * Cotação de todas as modalidades. O Econômico é exatamente a regra de
 * `calculateShipping`; o Expresso nunca é grátis e chega na metade do prazo.
 */
export function quoteShippingOptions(input: ShippingInput): ShippingOption[] {
  const capital = isCapital(input.postalCode);
  return [
    {
      method: "ECONOMICO",
      label: shippingMethodLabel("ECONOMICO"),
      ...calculateShipping(input),
    },
    {
      method: "EXPRESSO",
      label: shippingMethodLabel("EXPRESSO"),
      amount: EXPRESS_BASE + input.itemCount * EXPRESS_PER_ITEM,
      free: false,
      estimatedDays: capital ? 2 : 4,
    },
  ];
}

/** Cotação da modalidade escolhida — fonte única para checkout e criação do pedido. */
export function quoteShippingFor(
  method: ShippingMethod,
  input: ShippingInput,
): ShippingOption {
  const options = quoteShippingOptions(input);
  return options.find((o) => o.method === method) ?? options[0];
}

export function shippingMethodLabel(method: ShippingMethod): string {
  return method === "EXPRESSO" ? "Expresso" : "Econômico";
}
