import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Cliente mínimo da API do Stripe (itens 16, 17 e 20), em modo de teste.
 *
 * Usa a API REST direto (fetch), sem o pacote `stripe`: são poucas chamadas
 * e assim o projeto não ganha mais uma dependência. Sem STRIPE_SECRET_KEY no
 * .env, `stripeConfigured()` é falso e a loja continua no pagamento simulado.
 */

const API = "https://api.stripe.com/v1";

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export class StripeError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
    readonly param?: string,
  ) {
    super(message);
  }
}

type FormValue = string | number | boolean | null | undefined | FormObject | FormValue[];
type FormObject = { [key: string]: FormValue };

/**
 * Codifica parâmetros aninhados no formato do Stripe:
 * `{ a: { b: [ { c: 1 } ] } }` → `a[b][0][c]=1`. Valores null/undefined são omitidos.
 */
export function encodeStripeForm(params: FormObject): string {
  const out = new URLSearchParams();
  const walk = (prefix: string, value: FormValue) => {
    if (value === null || value === undefined) return;
    if (Array.isArray(value)) {
      value.forEach((v, i) => walk(`${prefix}[${i}]`, v));
    } else if (typeof value === "object") {
      for (const [k, v] of Object.entries(value)) {
        walk(prefix ? `${prefix}[${k}]` : k, v);
      }
    } else {
      out.append(prefix, String(value));
    }
  };
  walk("", params);
  return out.toString();
}

async function stripeRequest<T>(
  method: "GET" | "POST",
  path: string,
  params: FormObject = {},
  idempotencyKey?: string,
): Promise<T> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new StripeError("Stripe não configurado.", 0);

  const body = encodeStripeForm(params);
  const url = method === "GET" && body ? `${API}${path}?${body}` : `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
    },
    body: method === "POST" ? body : undefined,
    cache: "no-store",
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json?.error ?? {};
    throw new StripeError(
      err.message ?? `Stripe respondeu ${res.status}.`,
      res.status,
      err.code,
      err.param,
    );
  }
  return json as T;
}

// --- Tipos (só os campos que a loja usa) -------------------------------------

export type StripeCharge = {
  id: string;
  refunded: boolean;
  payment_method_details?: {
    type: string;
    card?: { funding?: string; wallet?: { type: string } | null };
  } | null;
};

export type StripePaymentIntent = {
  id: string;
  status: string;
  latest_charge?: string | StripeCharge | null;
  next_action?: {
    boleto_display_details?: {
      hosted_voucher_url?: string;
      expires_at?: number;
    };
  } | null;
};

export type StripeCheckoutSession = {
  id: string;
  url: string | null;
  status: "open" | "complete" | "expired";
  payment_status: "paid" | "unpaid" | "no_payment_required";
  client_reference_id: string | null;
  metadata: Record<string, string> | null;
  payment_intent: string | StripePaymentIntent | null;
};

export type StripeRefund = { id: string; status: string };

export type StripeEvent = {
  id: string;
  type: string;
  data: { object: Record<string, unknown> };
};

// --- Chamadas ----------------------------------------------------------------

export function createCheckoutSession(params: FormObject, idempotencyKey: string) {
  return stripeRequest<StripeCheckoutSession>(
    "POST",
    "/checkout/sessions",
    params,
    idempotencyKey,
  );
}

/** Sessão com o PaymentIntent e a cobrança expandidos (forma real e boleto). */
export function retrieveCheckoutSession(id: string) {
  return stripeRequest<StripeCheckoutSession>(
    "GET",
    `/checkout/sessions/${encodeURIComponent(id)}`,
    { expand: ["payment_intent", "payment_intent.latest_charge"] },
  );
}

export function expireCheckoutSession(id: string) {
  return stripeRequest<StripeCheckoutSession>(
    "POST",
    `/checkout/sessions/${encodeURIComponent(id)}/expire`,
  );
}

export function cancelPaymentIntent(id: string) {
  return stripeRequest<StripePaymentIntent>(
    "POST",
    `/payment_intents/${encodeURIComponent(id)}/cancel`,
  );
}

/** Estorno total. A chave de idempotência impede estorno em dobro. */
export function createRefund(paymentIntentId: string, idempotencyKey: string) {
  return stripeRequest<StripeRefund>(
    "POST",
    "/refunds",
    { payment_intent: paymentIntentId },
    idempotencyKey,
  );
}

// --- Webhook -----------------------------------------------------------------

/**
 * Confere a assinatura do webhook (cabeçalho `Stripe-Signature`), como o SDK
 * oficial faz: HMAC-SHA256 de `${t}.${corpo}` com o segredo `whsec_...`, e
 * recusa avisos com mais de `toleranceSec` (contra reenvio de aviso antigo).
 */
export function verifyStripeSignature(
  payload: string,
  header: string | null,
  secret: string,
  nowSec = Math.floor(Date.now() / 1000),
  toleranceSec = 300,
): boolean {
  if (!header || !secret) return false;
  let timestamp: number | null = null;
  const signatures: string[] = [];
  for (const part of header.split(",")) {
    const [k, v] = part.split("=", 2);
    if (k === "t") timestamp = Number(v);
    if (k === "v1" && v) signatures.push(v);
  }
  if (timestamp === null || !Number.isFinite(timestamp) || signatures.length === 0) {
    return false;
  }
  if (Math.abs(nowSec - timestamp) > toleranceSec) return false;

  const expected = Buffer.from(
    createHmac("sha256", secret).update(`${timestamp}.${payload}`).digest("hex"),
  );
  return signatures.some((s) => {
    const got = Buffer.from(s);
    return got.length === expected.length && timingSafeEqual(got, expected);
  });
}
