import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { verifyWebhookSignature } from "@/lib/webhook-signature";

/**
 * Webhook simulado: aguarda alguns segundos e marca pagamento como PAID.
 * Em produção, isso seria substituído por um webhook real de Mercado Pago/Stripe.
 *
 * Body: { orderId: string }
 * Header: `x-webhook-signature` — HMAC-SHA256 do corpo cru, ver src/lib/webhook-signature.ts.
 * Sem assinatura válida, qualquer um poderia marcar um pedido como pago sem
 * nunca ter pago nada.
 */
export async function POST(request: Request) {
  const rawBody = await request.text();
  const signature = request.headers.get("x-webhook-signature");
  if (!verifyWebhookSignature(rawBody, signature)) {
    return NextResponse.json({ error: "Assinatura inválida." }, { status: 401 });
  }

  let body: { orderId?: string };
  try {
    body = JSON.parse(rawBody);
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
 * Exige sessão + ser o dono do pedido (ou staff) — mesma regra de `getOrderById`.
 */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const orderId = searchParams.get("orderId");
  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório." }, { status: 400 });
  }

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    select: {
      userId: true,
      status: true,
      payment: { select: { status: true, paidAt: true } },
    },
  });
  if (!order) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  const isOwner = order.userId === session.user.id;
  const isStaff =
    session.user.role === "ADMIN" || session.user.role === "STOCK_OPERATOR";
  if (!isOwner && !isStaff) {
    return NextResponse.json({ error: "Pedido não encontrado." }, { status: 404 });
  }

  return NextResponse.json({
    orderStatus: order.status,
    paymentStatus: order.payment?.status ?? null,
    paidAt: order.payment?.paidAt ?? null,
  });
}

export const runtime = "nodejs";
