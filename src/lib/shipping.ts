import {
  pickModalities,
  quoteCarriers,
  type CarrierService,
} from "@/lib/melhor-envio";

/**
 * Frete da loja.
 *
 * Com MELHOR_ENVIO_TOKEN (item 18), preço e prazo vêm das transportadoras
 * pelo Melhor Envio (`quoteShippingOptionsLive`). Sem token, ou se a API
 * falhar, vale a tabela própria abaixo:
 *  - subtotal >= R$ 300: grátis
 *  - senão: R$ 15 fixo + R$ 2 por item
 *
 * Nos dois casos o Econômico é grátis a partir de R$ 300 (a loja paga).
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
  /** Serviço da transportadora (ex.: "Correios PAC"); null na tabela própria. */
  service: string | null;
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
      service: null,
      ...calculateShipping(input),
    },
    {
      method: "EXPRESSO",
      label: shippingMethodLabel("EXPRESSO"),
      service: null,
      amount: EXPRESS_BASE + input.itemCount * EXPRESS_PER_ITEM,
      free: false,
      estimatedDays: capital ? 2 : 4,
    },
  ];
}

/**
 * Modalidades a partir dos serviços cotados no Melhor Envio. O Expresso só
 * aparece se houver serviço mais rápido que o Econômico.
 */
export function optionsFromCarriers(
  services: CarrierService[],
  subtotal: number,
): ShippingOption[] {
  const picked = pickModalities(services);
  if (!picked) return [];
  const free = subtotal >= FREE_THRESHOLD;
  const options: ShippingOption[] = [
    {
      method: "ECONOMICO",
      label: `${shippingMethodLabel("ECONOMICO")} · ${picked.ECONOMICO.name}`,
      service: picked.ECONOMICO.name,
      amount: free ? 0 : round2(picked.ECONOMICO.price),
      free,
      estimatedDays: picked.ECONOMICO.days,
      reason: free ? `Frete grátis acima de R$ ${FREE_THRESHOLD}.` : undefined,
    },
  ];
  if (picked.EXPRESSO) {
    options.push({
      method: "EXPRESSO",
      label: `${shippingMethodLabel("EXPRESSO")} · ${picked.EXPRESSO.name}`,
      service: picked.EXPRESSO.name,
      amount: round2(picked.EXPRESSO.price),
      free: false,
      estimatedDays: picked.EXPRESSO.days,
    });
  }
  return options;
}

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

/** Cotação real (Melhor Envio) com a tabela própria como reserva. */
export async function quoteShippingOptionsLive(
  input: ShippingInput,
): Promise<ShippingOption[]> {
  const cep = normalizePostalCode(input.postalCode);
  if (cep) {
    const services = await quoteCarriers({
      toCep: cep,
      itemCount: input.itemCount,
      subtotal: input.subtotal,
    });
    const options = services ? optionsFromCarriers(services, input.subtotal) : [];
    if (options.length > 0) return options;
  }
  return quoteShippingOptions(input);
}

/**
 * Cotação real da modalidade escolhida — fonte única para checkout e
 * criação do pedido. Se a modalidade não estiver disponível para o CEP,
 * cai no Econômico.
 */
export async function quoteShippingForLive(
  method: ShippingMethod,
  input: ShippingInput,
): Promise<ShippingOption> {
  const options = await quoteShippingOptionsLive(input);
  return options.find((o) => o.method === method) ?? options[0];
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

/** Frete gravado no pedido, para as telas: "Econômico · Correios PAC · até 5 dias úteis". */
export function orderShippingLabel(order: {
  shippingMethod: ShippingMethod;
  shippingService?: string | null;
  shippingDays?: number | null;
}): string {
  return [
    shippingMethodLabel(order.shippingMethod),
    order.shippingService,
    order.shippingDays ? `até ${order.shippingDays} dias úteis` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}
