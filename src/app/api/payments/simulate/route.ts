import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { syncOrderPayment } from "@/lib/payments";

/**
 * Status do pagamento para a página de sucesso, consultado a cada 2 s.
 *
 * A consulta também faz a reconciliação (`syncOrderPayment`): o pagamento
 * simulado (PIX, ou a loja sem chave do Stripe) é aprovado depois de 3 s, e o
 * do Stripe ainda pendente é conferido no próprio Stripe (no máximo a cada
 * 10 s por pedido). Pagamento do Stripe só é confirmado pelo Stripe.
 *
 * Antes havia aqui um POST, sem login, que marcava como pago qualquer pedido
 * simulado; ele saiu junto com a chamada "solta" que o checkout fazia.
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
