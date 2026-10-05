import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { markPaidInTx, shortOrderCode } from "@/lib/payment-rules";
import { notifyInTx } from "@/lib/notifications";
import { syncOrderPayment } from "@/lib/payments";

/**
 * Gateway simulado: aguarda alguns segundos e marca o pagamento como PAID.
 * Vale só para pagamentos do provedor SIMULATED (PIX, ou a loja sem chave do
 * Stripe). Pagamento do Stripe só é confirmado pelo Stripe (webhook real em
 * /api/webhooks/stripe), nunca por esta rota.
 *
 * Body: { orderId: string }
 */
export async function POST(request: Request) {
  let body: { orderId?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido." }, { status: 400 });
  }

  const orderId = body.orderId?.trim();
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { payment: true },
  });
  if (!order || !order.payment) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }
  if (order.payment.provider !== "SIMULATED") {
    return NextResponse.json(
      { error: "Este pagamento é confirmado pelo gateway." },
      { status: 409 },
    );
  }
  if (order.payment.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Espera 3s para simular processamento do gateway
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const paymentId = order.payment.id;

  // Só confirma se o pedido ainda estiver aguardando pagamento: se o cliente
  // cancelou durante a espera, o cancelamento vale e nada muda aqui.
  const confirmed = await prisma.$transaction(async (tx) => {
    const result = await markPaidInTx(tx, {
      orderId,
      paymentId,
      externalPaymentId: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      method: null,
      now: new Date(),
      allowLate: false,
    });
    if (result !== "paid") return false;
    await notifyInTx(tx, {
      userId: order.userId,
      title: `Pagamento confirmado · Pedido #${shortOrderCode(orderId)}`,
      body: "Pagamento simulado aprovado. Avisamos quando o pedido for enviado.",
      href: `/perfil/pedidos/${orderId}`,
    });
    return true;
  });
  if (!confirmed) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Permite que a página de sucesso consulte o status atual do pagamento via
 * polling. Para pagamento do Stripe ainda pendente, confere também no próprio
 * Stripe (reconciliação, no máximo a cada 10 s por pedido).
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório." }, { status: 400 });
  }

  const session = await auth();
  const owner = await prisma.order.findUnique({
    where: { id: orderId },
    select: { userId: true },
  });
  if (!owner || !session?.user?.id || owner.userId !== session.user.id) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  await syncOrderPayment(orderId);

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      status: true,
      payment: { select: { status: true, paidAt: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    orderStatus: order.status,
    paymentStatus: order.payment?.status ?? null,
    paidAt: order.payment?.paidAt ?? null,
  });
}

export const runtime = "nodejs";
