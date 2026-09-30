"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { quoteShippingFor } from "@/lib/shipping";
import { evaluateCoupon, toCouponLike } from "@/lib/coupons";

/** Lançado dentro da transação para desfazer tudo quando o cupom deixa de valer no último instante. */
class CouponUnavailableError extends Error {}

export type CheckoutState = {
  error?: string;
  unavailable?: { name: string; color: string; size: string; available: number }[];
};

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

/**
 * Finaliza o carrinho ativo e cria o pedido.
 * - Valida estoque (todos os itens)
 * - Calcula totais
 * - Em transação: cria Order + OrderItems, decrementa estoque, marca cart como CONVERTED,
 *   cria Payment PENDING e abre carrinho novo vazio
 * - Dispara webhook simulado para fechar o pagamento em ~3s
 *
 * Retorna o orderId via redirect para /checkout/sucesso/[orderId].
 */
export async function createOrderFromCartAction(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Faça login para finalizar." };
  }
  const userId = session.user.id;

  // A sessão (JWT) vale por até 30 dias e não sabe de bloqueio feito depois do
  // login; por isso a compra confere o status direto no banco (item 23).
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: { status: true },
  });
  if (account?.status !== "ACTIVE") {
    return {
      error:
        "Não é possível finalizar compras com esta conta. Entre em contato com a loja.",
    };
  }

  const addressId = str(formData.get("addressId"));
  const paymentMethod = str(formData.get("paymentMethod")).toUpperCase();
  if (!addressId) return { error: "Selecione um endereço." };
  if (!["PIX", "CREDIT_CARD", "DEBIT_CARD", "BOLETO"].includes(paymentMethod)) {
    return { error: "Selecione um método de pagamento." };
  }

  // Endereço pertence ao usuário?
  const address = await prisma.address.findUnique({
    where: { id: addressId },
    select: { userId: true, postalCode: true },
  });
  if (!address || address.userId !== userId) {
    return { error: "Endereço inválido." };
  }

  // Carrega o carrinho ativo
  const cart = await prisma.cart.findFirst({
    where: { userId, status: "ACTIVE" },
    include: {
      coupon: true,
      items: {
        include: {
          productVariant: {
            include: { product: { select: { name: true } } },
          },
        },
      },
    },
  });
  if (!cart || cart.items.length === 0) {
    return { error: "Seu carrinho está vazio." };
  }

  // Valida estoque
  const unavailable: NonNullable<CheckoutState["unavailable"]> = [];
  for (const item of cart.items) {
    if (item.quantity > item.productVariant.stockQuantity) {
      unavailable.push({
        name: item.productVariant.product.name,
        color: item.productVariant.color,
        size: item.productVariant.size,
        available: item.productVariant.stockQuantity,
      });
    }
  }
  if (unavailable.length > 0) {
    return {
      error: "Alguns itens estão sem estoque suficiente.",
      unavailable,
    };
  }

  // Totais
  const subtotal = cart.items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  );
  const itemCount = cart.items.reduce((s, i) => s + i.quantity, 0);
  // Modalidade vem do carrinho; o preço é sempre recalculado aqui.
  const shipping = quoteShippingFor(cart.shippingMethod, {
    subtotal,
    itemCount,
    postalCode: address.postalCode,
  });

  // Cupom: revalidado aqui. Se deixou de valer, bloqueia em vez de cobrar
  // sem o desconto que o cliente viu na tela.
  const now = new Date();
  let discount = 0;
  if (cart.coupon) {
    const evaluation = evaluateCoupon(toCouponLike(cart.coupon), subtotal, now);
    if (!evaluation.ok) {
      return {
        error: `O cupom ${cart.coupon.code} não pode ser usado: ${evaluation.message} Remova-o na sacola para continuar.`,
      };
    }
    discount = evaluation.discount;
  }

  const total = subtotal - discount + shipping.amount;

  // Transação
  let order;
  try {
    order = await prisma.$transaction(async (tx) => {
      // Reserva um uso do cupom numa única operação: só incrementa se ainda
      // houver uso disponível. Dois pedidos simultâneos não passam do limite.
      if (cart.coupon) {
        const claimed = await tx.coupon.updateMany({
          where: {
            id: cart.coupon.id,
            active: true,
            AND: [
              { OR: [{ expiresAt: null }, { expiresAt: { gte: now } }] },
              {
                OR: [
                  { usageLimit: null },
                  { usedCount: { lt: prisma.coupon.fields.usageLimit } },
                ],
              },
            ],
          },
          data: { usedCount: { increment: 1 } },
        });
        if (claimed.count === 0) throw new CouponUnavailableError();
      }

      const created = await tx.order.create({
        data: {
          userId,
          status: "PENDING_PAYMENT",
          totalAmount: total,
          shippingAmount: shipping.amount,
          shippingMethod: shipping.method,
          discountAmount: discount,
          couponId: cart.coupon?.id ?? null,
          shippingAddressId: addressId,
          items: {
            create: cart.items.map((i) => ({
              productVariantId: i.productVariantId,
              productName: i.productVariant.product.name,
              color: i.productVariant.color,
              size: i.productVariant.size,
              quantity: i.quantity,
              unitPrice: i.unitPrice,
              totalPrice: Number(i.unitPrice) * i.quantity,
            })),
          },
          payment: {
            create: {
              provider: "SIMULATED",
              method: paymentMethod as
                | "PIX"
                | "CREDIT_CARD"
                | "DEBIT_CARD"
                | "BOLETO",
              status: "PENDING",
              amount: total,
            },
          },
        },
        include: { payment: true },
      });

      // Decrementa estoque das variantes
      for (const i of cart.items) {
        await tx.productVariant.update({
          where: { id: i.productVariantId },
          data: { stockQuantity: { decrement: i.quantity } },
        });
      }

      // Marca carrinho como CONVERTED e cria um novo vazio
      await tx.cart.update({
        where: { id: cart.id },
        data: { status: "CONVERTED" },
      });
      await tx.cart.create({ data: { userId } });

      return created;
    });
  } catch (e) {
    if (e instanceof CouponUnavailableError) {
      return {
        error: `O cupom ${cart.coupon?.code} acabou de ficar indisponível (esgotou, expirou ou foi desativado). Remova-o na sacola para continuar.`,
      };
    }
    throw e;
  }

  // Dispara webhook simulado (não bloqueia a redirect)
  try {
    const base =
      process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
    fetch(`${base}/api/payments/simulate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    }).catch(() => {
      // ignora — usuário verá status PENDING e pode atualizar
    });
  } catch {
    // idem
  }

  revalidatePath("/", "layout");
  redirect(`/checkout/sucesso/${order.id}`);
}

export async function listMyOrders() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.order.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    include: {
      items: { take: 1 },
      payment: { select: { status: true, method: true } },
    },
  });
}

export async function getOrderById(orderId: string) {
  const session = await auth();
  if (!session?.user?.id) return null;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: true,
      payment: true,
      shippingAddress: true,
      coupon: { select: { code: true } },
      user: { select: { id: true, name: true, email: true } },
    },
  });
  if (!order) return null;

  const role = session.user.role;
  const isOwner = order.userId === session.user.id;
  const isStaff = role === "ADMIN" || role === "STOCK_OPERATOR";
  if (!isOwner && !isStaff) return null;

  return order;
}

export async function cancelOrderAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const orderId = str(formData.get("orderId"));
  if (!orderId) return;

  const order = await prisma.order.findUnique({
    where: { id: orderId },
    include: { items: true, payment: true },
  });
  if (!order || order.userId !== session.user.id) return;
  if (!["PENDING_PAYMENT", "PAID"].includes(order.status)) return;

  await prisma.$transaction(async (tx) => {
    // Devolve estoque
    for (const i of order.items) {
      if (i.productVariantId) {
        await tx.productVariant.update({
          where: { id: i.productVariantId },
          data: { stockQuantity: { increment: i.quantity } },
        });
      }
    }
    await tx.order.update({
      where: { id: orderId },
      data: { status: "CANCELED" },
    });
    if (order.payment && order.payment.status === "PAID") {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: "REFUNDED" },
      });
    } else if (order.payment) {
      await tx.payment.update({
        where: { id: order.payment.id },
        data: { status: "FAILED" },
      });
    }
  });

  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
}
