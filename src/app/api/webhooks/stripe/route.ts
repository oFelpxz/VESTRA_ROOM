import { NextResponse } from "next/server";
import {
  retrieveCheckoutSession,
  stripeConfigured,
  verifyStripeSignature,
  type StripeEvent,
} from "@/lib/stripe";
import { syncCheckoutSession } from "@/lib/payments";

/**
 * Webhook do Stripe (item 16): é por aqui que o gateway avisa que o cliente
 * pagou, que o boleto foi pago ou venceu, ou que a página de pagamento
 * expirou.
 *
 * - A assinatura (`Stripe-Signature`) é conferida com STRIPE_WEBHOOK_SECRET:
 *   aviso sem assinatura válida é recusado, então ninguém marca pedido como
 *   pago chamando esta rota por fora.
 * - O conteúdo do aviso não é usado direto: a sessão é buscada de novo no
 *   Stripe e aplicada por `syncCheckoutSession` — a mesma função da
 *   reconciliação. Avisos repetidos ou fora de ordem dão o mesmo resultado.
 * - Erro ao aplicar responde 500, e o Stripe reenvia o aviso depois.
 */

const SESSION_EVENTS = new Set([
  "checkout.session.completed",
  "checkout.session.async_payment_succeeded",
  "checkout.session.async_payment_failed",
  "checkout.session.expired",
]);

export async function POST(request: Request) {
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret || !stripeConfigured()) {
    return NextResponse.json({ error: "Stripe não configurado." }, { status: 503 });
  }

  // Corpo cru: a assinatura é calculada sobre os bytes exatos recebidos.
  const payload = await request.text();
  if (!verifyStripeSignature(payload, request.headers.get("stripe-signature"), secret)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  if (SESSION_EVENTS.has(event.type)) {
    const sessionId = event.data?.object?.id;
    if (typeof sessionId !== "string") {
      return NextResponse.json({ error: "Evento sem sessão." }, { status: 400 });
    }
    try {
      await syncCheckoutSession(await retrieveCheckoutSession(sessionId));
    } catch (e) {
      console.error("[stripe] webhook", event.type, sessionId, e);
      return NextResponse.json({ error: "Falha ao aplicar." }, { status: 500 });
    }
  }

  // Outros eventos (ex.: charge.refunded, que a própria loja pediu) são
  // aceitos sem ação, para o Stripe não ficar reenviando.
  return NextResponse.json({ received: true });
}

export const runtime = "nodejs";
