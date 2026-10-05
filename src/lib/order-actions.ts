"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { quoteShippingForLive } from "@/lib/shipping";
import { evaluateCoupon, toCouponLike } from "@/lib/coupons";
import { cancelOrderInTx, CUSTOMER_CANCELABLE } from "@/lib/order-cancel";
import { PAY_METHODS, usesStripe, type PayMethod } from "@/lib/payment-rules";
import { stripeConfigured } from "@/lib/stripe";
import { afterOrderCanceled, startStripeCheckout } from "@/lib/payments";

/** Lançado dentro da transação para desfazer tudo quando o cupom deixa de valer no último instante. */
class CouponUnavailableError extends Error {}

export type CheckoutState = {
  error?: string;
  unavailable?: { name: string; color: string; size: string; available: number }[];
};

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

/** Endereço da loja como o cliente acessou (localhost, Vercel...), para o Stripe voltar para cá. */
async function requestOrigin() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (host) {
    const proto =
      h.get("x-forwarded-proto") ??
      (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return process.env.NEXT_PUBLIC_BASE_URL ?? "http://localhost:3000";
}

/**
 * Finaliza o carrinho ativo e cria o pedido.
 * - Valida estoque (todos os itens)
 * - Calcula totais
 * - Em transação: cria Order + OrderItems, decrementa estoque, marca cart como CONVERTED,
 *   cria Payment PENDING e abre carrinho novo vazio
 * - Com Stripe configurado (itens 16 e 17), cartão, boleto e carteira vão
 *   para a página de pagamento do Stripe; o pedido só vira Pago quando o
 *   Stripe avisar (webhook). PIX, ou a loja sem chave, seguem simulados:
 *   o gateway simulado fecha o pagamento em ~3s.
 *
 * Redireciona para o Stripe ou para /checkout/sucesso/[orderId].
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
  if (!PAY_METHODS.includes(paymentMethod as PayMethod)) {
    return { error: "Selecione um método de pagamento." };
  }
  const method = paymentMethod as PayMethod;
  const viaStripe = usesStripe(method, stripeConfigured());
  // Carteira digital só existe pelo Stripe (Link, Google Pay, Apple Pay).
  if (method === "WALLET" && !viaStripe) {
    return { error: "Carteira digital indisponível no momento. Escolha outra forma." };
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
  // Modalidade vem do carrinho; preço e prazo são sempre cotados de novo
  // aqui (Melhor Envio, ou a tabela própria se ele estiver fora).
  const shipping = await quoteShippingForLive(cart.shippingMethod, {
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
          shippingService: shipping.service,
          shippingDays: shipping.estimatedDays,
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
              provider: viaStripe ? "STRIPE" : "SIMULATED",
              method,
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

  if (viaStripe) {
    let checkoutUrl: string;
    try {
      checkoutUrl = await startStripeCheckout({
        orderId: order.id,
        paymentId: order.payment!.id,
        method,
        totalAmount: total,
        itemsSummary: cart.items
          .map((i) => `${i.quantity}x ${i.productVariant.product.name} (${i.productVariant.color}, ${i.productVariant.size})`)
          .join(", "),
        customerEmail: session.user.email ?? "",
        baseUrl: await requestOrigin(),
      });
    } catch (e) {
      // Não deu para abrir o pagamento: nada foi cobrado. Desfaz a reserva
      // (estoque e cupom) e devolve a sacola como estava.
      console.error("[stripe] abrir pagamento", order.id, e);
      await prisma.$transaction(async (tx) => {
        await cancelOrderInTx(
          tx,
          {
            id: order.id,
            status: "PENDING_PAYMENT",
            items: cart.items.map((i) => ({
              productVariantId: i.productVariantId,
              quantity: i.quantity,
            })),
            payment: order.payment,
            couponId: order.couponId,
          },
          { allowedFrom: ["PENDING_PAYMENT"], restock: true },
        );
        await tx.cart.deleteMany({
          where: { userId, status: "ACTIVE", id: { not: cart.id }, items: { none: {} } },
        });
        await tx.cart.update({ where: { id: cart.id }, data: { status: "ACTIVE" } });
      });
      revalidatePath("/", "layout");
      return {
        error:
          "Não foi possível abrir o pagamento agora. Nenhum valor foi cobrado e sua sacola continua igual. Tente de novo em instantes.",
      };
    }
    revalidatePath("/", "layout");
    redirect(checkoutUrl);
  }

  // Gateway simulado (não bloqueia a redirect)
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

  // Cliente cancela só antes da separação; estoque sempre volta.
  const canceled = await prisma.$transaction((tx) =>
    cancelOrderInTx(tx, order, {
      allowedFrom: CUSTOMER_CANCELABLE,
      restock: true,
    }),
  );
  // Fora da transação: estorno no gateway (item 20) e fechamento do que
  // ficou aberto no Stripe. Se o estorno falhar, o pedido fica Cancelado com
  // pagamento Pago, e o Admin vê o botão para tentar de novo.
  if (canceled) await afterOrderCanceled(orderId, "customer");

  revalidatePath(`/perfil/pedidos/${orderId}`);
  revalidatePath("/perfil/pedidos");
  revalidatePath("/", "layout");
}
