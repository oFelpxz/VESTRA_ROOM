import { createHmac, timingSafeEqual } from "node:crypto";

/**
 * Assinatura HMAC do webhook simulado de pagamento (item C1).
 *
 * Em produção com um gateway real (Mercado Pago/Stripe/Pagar.me), o provedor
 * assina o corpo da notificação e o endpoint verifica antes de confiar nela —
 * isso simula o mesmo contrato, com um segredo compartilhado só entre a
 * server action que dispara o webhook e a própria rota que o recebe.
 */

function getSecret(): string {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "PAYMENT_WEBHOOK_SECRET não definida — obrigatória em produção.",
    );
  }
  return "dev-only-insecure-webhook-secret";
}

export function signWebhookPayload(rawBody: string): string {
  return createHmac("sha256", getSecret()).update(rawBody).digest("hex");
}

export function verifyWebhookSignature(
  rawBody: string,
  signature: string | null,
): boolean {
  if (!signature) return false;

  const expected = signWebhookPayload(rawBody);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;

  return timingSafeEqual(a, b);
}
