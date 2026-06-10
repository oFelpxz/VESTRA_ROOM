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

  await prisma.$transaction([
    prisma.payment.update({
      where: { id: order.payment.id },
      data: {
        status: "PAID",
        paidAt: new Date(),
        externalPaymentId: `SIM-${Math.random().toString(36).slice(2, 10).toUpperCase()}`,
      },
    }),
    prisma.order.update({
      where: { id: orderId },
      data: { status: "PAID" },
    }),
  ]);

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
