"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { calculateShipping } from "@/lib/shipping";

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
  const shipping = calculateShipping({
    subtotal,
    itemCount,
    postalCode: address.postalCode,
  });
  const total = subtotal + shipping.amount;

  // Transação
  const order = await prisma.$transaction(async (tx) => {
    const created = await tx.order.create({
      data: {
        userId,
        status: "PENDING_PAYMENT",
        totalAmount: total,
        shippingAmount: shipping.amount,
        discountAmount: 0,
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
