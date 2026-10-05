import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

/**
 * Webhook simulado: aguarda alguns segundos e marca pagamento como PAID.
 * Em produção, isso seria substituído por um webhook real de Mercado Pago/Stripe.
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
  if (order.payment.status !== "PENDING") {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  // Espera 3s para simular processamento do gateway
  await new Promise((resolve) => setTimeout(resolve, 3000));

  const paymentId = order.payment.id;

  // Só confirma se o pedido ainda estiver aguardando pagamento: se o cliente
  // cancelou durante a espera, o cancelamento vale e nada muda aqui.
  const confirmed = await prisma.$transaction(async (tx) => {
    const moved = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING_PAYMENT" },
      data: { status: "PAID" },
    });
    if (moved.count === 0) return false;
    await tx.payment.updateMany({
      where: { id: paymentId, status: "PENDING" },
      data: {
        status: "PAID",
        paidAt: new Date(),
        externalPaymentId: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      },
    });
    return true;
  });
  if (!confirmed) {
    return NextResponse.json({ ok: true, alreadyProcessed: true });
  }

  return NextResponse.json({ ok: true });
}

/**
 * Permite que a página de sucesso consulte o status atual do pagamento via polling.
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório." }, { status: 400 });
  }

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
