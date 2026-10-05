/**
 * Cotação de frete real pelo Melhor Envio (item 18), no sandbox.
 *
 * Sem MELHOR_ENVIO_TOKEN no .env, ou se a API falhar, `quoteCarriers`
 * devolve null e a loja usa a tabela própria de `shipping.ts` — o checkout
 * nunca trava por causa do frete.
 */

const DEFAULT_BASE_URL = "https://sandbox.melhorenvio.com.br";
/** CEP de onde a loja envia (Av. Paulista, SP), se o .env não disser outro. */
const DEFAULT_FROM_CEP = "01310100";

/**
 * O cadastro de produto não tem peso nem medidas: cada peça vai como um
 * pacote de roupa dobrada. O Melhor Envio junta as peças em caixas.
 */
export const PACKAGE_PER_ITEM = { width: 20, height: 4, length: 30, weight: 0.4 };

export type CarrierService = {
  id: number;
  /** Ex.: "Correios PAC", "Jadlog .Package". */
  name: string;
  price: number;
  days: number;
};

export function melhorEnvioConfigured() {
  return Boolean(process.env.MELHOR_ENVIO_TOKEN);
}

/** Corpo do pedido de cotação. */
export function calculateBody(input: {
  fromCep: string;
  toCep: string;
  itemCount: number;
  subtotal: number;
}) {
  const quantity = Math.max(1, input.itemCount);
  return {
    from: { postal_code: input.fromCep },
    to: { postal_code: input.toCep },
    products: [
      {
        id: "pedido",
        ...PACKAGE_PER_ITEM,
        // Seguro pelo valor das peças (dividido por unidade).
        insurance_value: Math.round((input.subtotal / quantity) * 100) / 100,
        quantity,
      },
    ],
    options: { receipt: false, own_hand: false },
  };
}

type RawService = {
  id?: number;
  name?: string;
  price?: string | number;
  custom_price?: string | number;
  delivery_time?: number;
  custom_delivery_time?: number;
  error?: string;
  company?: { name?: string };
};

/**
 * Lê a resposta da API. Serviços com erro (ex.: "Transportadora não atende
 * este trecho") ou sem preço ficam de fora. Usa o preço e prazo "custom",
 * que já incluem as regras configuradas na conta.
 */
export function parseServices(json: unknown): CarrierService[] {
  if (!Array.isArray(json)) return [];
  const out: CarrierService[] = [];
  for (const s of json as RawService[]) {
    if (!s || s.error || typeof s.id !== "number") continue;
    const price = Number(s.custom_price ?? s.price);
    const days = Number(s.custom_delivery_time ?? s.delivery_time);
    if (!Number.isFinite(price) || price <= 0 || !Number.isFinite(days) || days <= 0) continue;
    const company = s.company?.name?.trim();
    const name = s.name?.trim() ?? "";
    out.push({
      id: s.id,
      name: company && !name.startsWith(company) ? `${company} ${name}` : name || company || "Transportadora",
      price,
      days,
    });
  }
  return out;
}

/**
 * Escolhe os serviços das duas modalidades da loja:
 * - Econômico: o mais barato (empate: o mais rápido);
 * - Expresso: o mais rápido (empate: o mais barato), só se chegar antes do
 *   Econômico — senão não há o que oferecer como expresso.
 */
export function pickModalities(services: CarrierService[]): {
  ECONOMICO: CarrierService;
  EXPRESSO: CarrierService | null;
} | null {
  if (services.length === 0) return null;
  const cheapest = [...services].sort((a, b) => a.price - b.price || a.days - b.days)[0];
  const fastest = [...services].sort((a, b) => a.days - b.days || a.price - b.price)[0];
  return {
    ECONOMICO: cheapest,
    EXPRESSO: fastest.days < cheapest.days ? fastest : null,
  };
}

// Cotação muda pouco: guarda por 10 min para o carrinho, o checkout e o
// pedido (que cotam o mesmo CEP em sequência) não chamarem a API 3 vezes.
const cache = new Map<string, { at: number; services: CarrierService[] }>();
const CACHE_MS = 10 * 60 * 1000;

/** Serviços disponíveis para o CEP, ou null se não deu para cotar. */
export async function quoteCarriers(input: {
  toCep: string;
  itemCount: number;
  subtotal: number;
}): Promise<CarrierService[] | null> {
  const token = process.env.MELHOR_ENVIO_TOKEN;
  if (!token) return null;

  const key = `${input.toCep}|${input.itemCount}|${input.subtotal.toFixed(2)}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit.services;

  const base = process.env.MELHOR_ENVIO_BASE_URL || DEFAULT_BASE_URL;
  const fromCep = (process.env.MELHOR_ENVIO_FROM_CEP || DEFAULT_FROM_CEP).replace(/\D/g, "");
  try {
    const res = await fetch(`${base}/api/v2/me/shipment/calculate`, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
        // O Melhor Envio exige identificar a aplicação.
        "User-Agent": "VESTRA ROOM (projeto academico)",
      },
      body: JSON.stringify(calculateBody({ ...input, fromCep })),
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) {
      console.error("[melhor-envio] cotação respondeu", res.status);
      return null;
    }
    const services = parseServices(await res.json());
    if (services.length === 0) return null;
    cache.set(key, { at: Date.now(), services });
    return services;
  } catch (e) {
    console.error("[melhor-envio] cotação falhou", e);
    return null;
  }
}
