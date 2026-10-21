"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { notifyInTx } from "@/lib/notifications";
import { shortOrderCode } from "@/lib/payment-rules";
import { needsManualRefund } from "@/lib/payments";
import { loadReturnRefund } from "@/lib/return-refund";
import {
  availableToReturn,
  detectImageType,
  IMAGE_EXT,
  KIND_LABEL,
  MAX_PHOTO_BYTES,
  MAX_PHOTOS,
  parseReturnForm,
  type ReturnKind,
  type ReturnStatus,
} from "@/lib/returns";
import { refundOnce, StripeError } from "@/lib/stripe";
import { deleteModelObject, storageConfigured, uploadModelObject } from "@/lib/storage";
import { getStoreSettings } from "@/lib/store-settings-db";

export type ReturnFormState = { error?: string; success?: boolean };

const ADMIN_MESSAGE_LIMIT = 2000;

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

/** Erro de regra dentro da transação: desfaz tudo e vira mensagem na tela. */
class ReturnRuleError extends Error {}

function revalidateReturn(id: string, orderId: string) {
  revalidatePath("/admin/trocas");
  revalidatePath(`/admin/trocas/${id}`);
  revalidatePath("/perfil/trocas");
  revalidatePath(`/perfil/trocas/${id}`);
  revalidatePath(`/perfil/pedidos/${orderId}`);
}

const returnHref = (id: string) => `/perfil/trocas/${id}`;

// --- Cliente (item 21) -------------------------------------------------------

/**
 * O cliente pede troca ou devolução de uma peça de pedido entregue.
 * formData: orderItemId, quantity, reason, reasonText, kind,
 * exchangeVariantId, photos (até 3 arquivos, já reduzidos no navegador).
 */
export async function createReturnRequestAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: "Faça login novamente." };

  const orderItemId = str(formData.get("orderItemId"));
  const item = await prisma.orderItem.findUnique({
    where: { id: orderItemId },
    select: {
      id: true,
      quantity: true,
      productVariantId: true,
      productVariant: { select: { productId: true } },
      order: { select: { id: true, userId: true, status: true, deliveredAt: true } },
      returnRequests: { select: { quantity: true, status: true } },
    },
  });
  if (!item || item.order.userId !== userId) return { error: "Peça não encontrada." };

  const photos = formData
    .getAll("photos")
    .filter((f): f is File => f instanceof File && f.size > 0);

  const settings = await getStoreSettings();
  const parsed = parseReturnForm(
    {
      quantity: str(formData.get("quantity")),
      reason: str(formData.get("reason")),
      reasonText: str(formData.get("reasonText")),
      kind: str(formData.get("kind")),
      exchangeVariantId: str(formData.get("exchangeVariantId")),
      photoCount: photos.length,
    },
    {
      orderStatus: item.order.status,
      deliveredAt: item.order.deliveredAt,
      now: new Date(),
      deadlines: settings,
      available: availableToReturn(
        item.quantity,
        item.returnRequests.map((r) => ({ ...r, status: r.status as ReturnStatus })),
      ),
      currentVariantId: item.productVariantId,
    },
  );
  if ("error" in parsed) return { error: parsed.error };
  const data = parsed.data;

  // Troca: a variante tem que ser do mesmo produto e estar à venda.
  let exchange: { color: string; size: string } | null = null;
  if (data.exchangeVariantId) {
    const variant = await prisma.productVariant.findUnique({
      where: { id: data.exchangeVariantId },
      select: { productId: true, color: true, size: true, status: true },
    });
    if (
      !variant ||
      variant.status !== "ACTIVE" ||
      !item.productVariant ||
      variant.productId !== item.productVariant.productId
    ) {
      return { error: "Essa cor ou tamanho não está disponível para troca." };
    }
    exchange = { color: variant.color, size: variant.size };
  }

  // Fotos: confere o tipo pelos bytes e o tamanho antes de enviar.
  const files: { bytes: Uint8Array; type: string }[] = [];
  for (const photo of photos.slice(0, MAX_PHOTOS)) {
    if (photo.size > MAX_PHOTO_BYTES) return { error: "Cada foto pode ter até 5 MB." };
    const bytes = new Uint8Array(await photo.arrayBuffer());
    const type = detectImageType(bytes);
    if (!type) return { error: "As fotos precisam ser JPG, PNG ou WEBP." };
    files.push({ bytes, type });
  }
  if (files.length > 0 && !storageConfigured()) {
    return { error: "O envio de fotos está indisponível agora. Tente mais tarde." };
  }

  // Envia as fotos antes de gravar (o caminho usa uma pasta nova); se a
  // gravação falhar, apaga o que subiu.
  const folder = `trocas/${userId}/${randomUUID()}`;
  const uploaded: { path: string; contentType: string; sizeBytes: number }[] = [];
  try {
    for (const [i, f] of files.entries()) {
      const path = `${folder}/${i + 1}.${IMAGE_EXT[f.type]}`;
      await uploadModelObject(path, f.bytes, f.type);
      uploaded.push({ path, contentType: f.type, sizeBytes: f.bytes.length });
    }
  } catch (e) {
    console.error("[trocas] upload de foto falhou", e);
    await removePhotos(uploaded.map((u) => u.path));
    return { error: "Não foi possível enviar as fotos. Tente de novo." };
  }

  let requestId: string;
  try {
    requestId = await prisma.$transaction(async (tx) => {
      // Trava a linha do item: dois pedidos ao mesmo tempo não passam da
      // quantidade comprada.
      await tx.$queryRaw`SELECT "id" FROM "OrderItem" WHERE "id" = ${item.id} FOR UPDATE`;
      const current = await tx.returnRequest.findMany({
        where: { orderItemId: item.id },
        select: { quantity: true, status: true },
      });
      const left = availableToReturn(
        item.quantity,
        current.map((r) => ({ ...r, status: r.status as ReturnStatus })),
      );
      if (data.quantity > left) {
        throw new ReturnRuleError(
          left > 0 ? `Dá para pedir no máximo ${left} desta peça.` : "Esta peça já está num pedido de troca.",
        );
      }
      const created = await tx.returnRequest.create({
        data: {
          orderId: item.order.id,
          orderItemId: item.id,
          userId,
          quantity: data.quantity,
          reason: data.reason,
          reasonText: data.reasonText,
          kind: data.kind,
          exchangeVariantId: data.exchangeVariantId,
          exchangeColor: exchange?.color ?? null,
          exchangeSize: exchange?.size ?? null,
          photos: { create: uploaded },
        },
        select: { id: true },
      });
      await notifyInTx(tx, {
        userId,
        title: `Pedido de ${KIND_LABEL[data.kind].toLowerCase()} recebido · Pedido #${shortOrderCode(item.order.id)}`,
        body: "A loja vai analisar e você recebe a resposta aqui.",
        href: returnHref(created.id),
      });
      return created.id;
    });
  } catch (e) {
    await removePhotos(uploaded.map((u) => u.path));
    if (e instanceof ReturnRuleError) return { error: e.message };
    throw e;
  }

  revalidateReturn(requestId, item.order.id);
  redirect(returnHref(requestId));
}

async function removePhotos(paths: string[]) {
  for (const path of paths) {
    try {
      await deleteModelObject(path);
    } catch (e) {
      console.error("[trocas] não apagou a foto", path, e);
    }
  }
}

/** O cliente desiste enquanto a loja não respondeu. */
export async function cancelReturnRequestAction(formData: FormData) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return;
  const id = str(formData.get("id"));

  const req = await prisma.returnRequest.findUnique({
    where: { id },
    select: { userId: true, orderId: true },
  });
  if (!req || req.userId !== userId) return;

  await prisma.returnRequest.updateMany({
    where: { id, userId, status: "OPEN" },
    data: { status: "CANCELED" },
  });
  revalidateReturn(id, req.orderId);
}

// --- Admin (item 22) ---------------------------------------------------------

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

async function loadRequest(id: string) {
  return prisma.returnRequest.findUnique({
    where: { id },
    select: {
      id: true,
      orderId: true,
      orderItemId: true,
      userId: true,
      status: true,
      kind: true,
      approvedKind: true,
      reason: true,
      quantity: true,
      exchangeVariantId: true,
      stockReserved: true,
      orderItem: { select: { productVariantId: true, productName: true, size: true } },
    },
  });
}

/**
 * Aprova com instruções de envio. Troca: a peça nova sai do estoque agora
 * (fica reservada). Sem estoque, só dá para aprovar como devolução do valor.
 * formData: id, approvedKind, message.
 */
export async function approveReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const approvedKind = str(formData.get("approvedKind")) as ReturnKind;
  const message = str(formData.get("message")).replace(/\r\n/g, "\n");

  if (approvedKind !== "EXCHANGE" && approvedKind !== "REFUND") {
    return { error: "Escolha troca ou devolução do valor." };
  }
  if (message.length < 10) return { error: "Escreva as instruções de envio para o cliente." };
  if (message.length > ADMIN_MESSAGE_LIMIT) {
    return { error: `As instruções podem ter até ${ADMIN_MESSAGE_LIMIT} caracteres.` };
  }

  const req = await loadRequest(id);
  if (!req) return { error: "Pedido de troca não encontrado." };
  if (req.status !== "OPEN") return { error: "Este pedido já foi respondido. Atualize a página." };
  if (approvedKind === "EXCHANGE" && (req.kind !== "EXCHANGE" || !req.exchangeVariantId)) {
    return { error: "O cliente pediu a devolução do valor, não troca." };
  }

  try {
    await prisma.$transaction(async (tx) => {
      if (approvedKind === "EXCHANGE") {
        const reserved = await tx.productVariant.updateMany({
          where: { id: req.exchangeVariantId!, stockQuantity: { gte: req.quantity } },
          data: { stockQuantity: { decrement: req.quantity } },
        });
        if (reserved.count === 0) {
          throw new ReturnRuleError(
            "Sem estoque da peça pedida na troca. Aprove como devolução do valor.",
          );
        }
      }
      const moved = await tx.returnRequest.updateMany({
        where: { id, status: "OPEN" },
        data: {
          status: "APPROVED",
          approvedKind,
          adminMessage: message,
          stockReserved: approvedKind === "EXCHANGE",
          answeredAt: new Date(),
        },
      });
      if (moved.count === 0) throw new ReturnRuleError("Este pedido já foi respondido.");
      await notifyInTx(tx, {
        userId: req.userId,
        title: `${KIND_LABEL[approvedKind]} aprovada · Pedido #${shortOrderCode(req.orderId)}`,
        body:
          approvedKind !== req.kind
            ? "A peça pedida acabou: vamos devolver o valor. Veja como enviar a peça."
            : "Veja como enviar a peça de volta.",
        href: returnHref(id),
      });
    });
  } catch (e) {
    if (e instanceof ReturnRuleError) return { error: e.message };
    throw e;
  }

  revalidateReturn(id, req.orderId);
  revalidatePath("/admin/estoque");
  return { success: true };
}

/** Nega com justificativa (o cliente vê). formData: id, message. */
export async function denyReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const message = str(formData.get("message")).replace(/\r\n/g, "\n");
  if (message.length < 10) return { error: "Explique ao cliente por que o pedido foi negado." };
  if (message.length > ADMIN_MESSAGE_LIMIT) {
    return { error: `A justificativa pode ter até ${ADMIN_MESSAGE_LIMIT} caracteres.` };
  }

  const req = await loadRequest(id);
  if (!req) return { error: "Pedido de troca não encontrado." };

  const done = await prisma.$transaction(async (tx) => {
    const moved = await tx.returnRequest.updateMany({
      where: { id, status: "OPEN" },
      data: { status: "DENIED", adminMessage: message, answeredAt: new Date() },
    });
    if (moved.count === 0) return false;
    await notifyInTx(tx, {
      userId: req.userId,
      title: `Pedido de troca negado · Pedido #${shortOrderCode(req.orderId)}`,
      body: "Veja o motivo informado pela loja.",
      href: returnHref(id),
    });
    return true;
  });
  if (!done) return { error: "Este pedido já foi respondido. Atualize a página." };

  revalidateReturn(id, req.orderId);
  return { success: true };
}

/** Aprovado, mas a peça nunca chegou: encerra e devolve a reserva ao estoque. */
export async function closeApprovedReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const req = await loadRequest(id);
  if (!req) return { error: "Pedido de troca não encontrado." };

  const done = await prisma.$transaction(async (tx) => {
    const moved = await tx.returnRequest.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "CANCELED", stockReserved: false },
    });
    if (moved.count === 0) return false;
    if (req.stockReserved && req.exchangeVariantId) {
      await tx.productVariant.updateMany({
        where: { id: req.exchangeVariantId },
        data: { stockQuantity: { increment: req.quantity } },
      });
    }
    await notifyInTx(tx, {
      userId: req.userId,
      title: `Troca encerrada · Pedido #${shortOrderCode(req.orderId)}`,
      body: "A peça não chegou no prazo e o pedido de troca foi encerrado. Fale com a loja se já enviou.",
      href: returnHref(id),
    });
    return true;
  });
  if (!done) return { error: "O pedido mudou de status. Atualize a página." };

  revalidateReturn(id, req.orderId);
  revalidatePath("/admin/estoque");
  return { success: true };
}

/** A peça chegou. Em bom estado, volta ao estoque. formData: id, goodCondition. */
export async function receiveReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const goodCondition = formData.get("goodCondition") === "on";
  const req = await loadRequest(id);
  if (!req) return { error: "Pedido de troca não encontrado." };

  const done = await prisma.$transaction(async (tx) => {
    const moved = await tx.returnRequest.updateMany({
      where: { id, status: "APPROVED" },
      data: { status: "RECEIVED", goodCondition, receivedAt: new Date() },
    });
    if (moved.count === 0) return false;
    if (goodCondition && req.orderItem.productVariantId) {
      await tx.productVariant.updateMany({
        where: { id: req.orderItem.productVariantId },
        data: { stockQuantity: { increment: req.quantity } },
      });
    }
    await notifyInTx(tx, {
      userId: req.userId,
      title: `Recebemos a peça · Pedido #${shortOrderCode(req.orderId)}`,
      body:
        req.approvedKind === "EXCHANGE"
          ? "Agora enviamos a peça nova."
          : "Agora devolvemos o valor.",
      href: returnHref(id),
    });
    return true;
  });
  if (!done) return { error: "O pedido mudou de status. Atualize a página." };

  revalidateReturn(id, req.orderId);
  revalidatePath("/admin/estoque");
  return { success: true };
}

/**
 * Conclui. Troca: informa o rastreio da peça nova (opcional). Devolução:
 * estorna a parte do pedido (item 22 ligado ao reembolso do item 20).
 * formData: id, trackingCode, manual ("on" = valor devolvido fora do gateway).
 */
export async function completeReturnAction(
  _prev: ReturnFormState,
  formData: FormData,
): Promise<ReturnFormState> {
  await requireAdmin();
  const id = str(formData.get("id"));
  const req = await loadRequest(id);
  if (!req) return { error: "Pedido de troca não encontrado." };
  if (req.status !== "RECEIVED") return { error: "Marque a peça como recebida antes." };

  if (req.approvedKind === "EXCHANGE") {
    const trackingCode = str(formData.get("trackingCode")).slice(0, 60) || null;
    const done = await prisma.$transaction(async (tx) => {
      const moved = await tx.returnRequest.updateMany({
        where: { id, status: "RECEIVED" },
        data: { status: "COMPLETED", trackingCode, completedAt: new Date() },
      });
      if (moved.count === 0) return false;
      await notifyInTx(tx, {
        userId: req.userId,
        title: `Peça nova enviada · Pedido #${shortOrderCode(req.orderId)}`,
        body: trackingCode ? `Código de rastreio: ${trackingCode}.` : "A troca foi concluída.",
        href: returnHref(id),
      });
      return true;
    });
    if (!done) return { error: "O pedido mudou de status. Atualize a página." };
    revalidateReturn(id, req.orderId);
    return { success: true };
  }

  return completeRefund(req, formData.get("manual") === "on");
}

async function completeRefund(
  req: NonNullable<Awaited<ReturnType<typeof loadRequest>>>,
  manual: boolean,
): Promise<ReturnFormState> {
  const loaded = await loadReturnRefund(req);
  if (!loaded.ok) return { error: loaded.error };
  const { payment, refund } = loaded;

  let refundId: string | null;
  if (manual) {
    refundId = null;
  } else if (needsManualRefund(payment)) {
    return {
      error:
        "Boleto não tem estorno automático. Devolva o valor por PIX e marque \"Valor devolvido fora do Stripe\".",
    };
  } else if (payment.provider === "STRIPE") {
    if (!payment.externalPaymentId?.startsWith("pi_")) {
      return { error: "Pagamento sem identificador do Stripe." };
    }
    try {
      // Um estorno por devolução: a segunda devolução do mesmo pedido não
      // repete a primeira, o clique duplo não estorna duas vezes e, depois de
      // um erro, dá para tentar de novo (ver `refundOnce`).
      const r = await refundOnce(payment.externalPaymentId, `return-${req.id}`, refund.cents);
      if (r.status === "failed" || r.status === "canceled") {
        return { error: "O Stripe recusou o estorno." };
      }
      refundId = r.id;
    } catch (e) {
      console.error("[stripe] estorno da devolução falhou", req.id, e);
      const msg = e instanceof StripeError || e instanceof Error ? e.message : "erro";
      return { error: `O Stripe não aceitou o estorno agora (${msg}). Tente de novo.` };
    }
  } else {
    refundId = `SIM-REF-${Math.random().toString(36).slice(2, 10).toUpperCase()}`;
  }

  const now = new Date();
  const paidCents = Math.round(Number(payment.amount) * 100);
  const totalRefundedCents = Math.round(Number(payment.refundedAmount) * 100) + refund.cents;

  const done = await prisma.$transaction(async (tx) => {
    const moved = await tx.returnRequest.updateMany({
      where: { id: req.id, status: "RECEIVED" },
      data: {
        status: "COMPLETED",
        refundAmount: refund.amount,
        refundShipping: refund.shipping > 0,
        refundId,
        refundedAt: now,
        completedAt: now,
      },
    });
    if (moved.count === 0) return false;
    await tx.payment.update({
      where: { id: payment.id },
      data: {
        refundedAmount: { increment: refund.amount },
        // Tudo devolvido: o pagamento fica Reembolsado (o pedido continua Entregue).
        ...(totalRefundedCents >= paidCents
          ? { status: "REFUNDED", refundedAt: now, refundId }
          : {}),
      },
    });
    await notifyInTx(tx, {
      userId: req.userId,
      title: `Reembolso de ${formatBRL(refund.amount)} · Pedido #${shortOrderCode(req.orderId)}`,
      body: manual
        ? "A loja devolveu o valor por PIX."
        : payment.method === "PIX" || payment.provider === "SIMULATED"
          ? "O valor foi devolvido."
          : "O estorno foi pedido à operadora do cartão. Ele aparece em até 2 faturas, conforme o banco.",
      href: returnHref(req.id),
    });
    return true;
  });
  if (!done) return { error: "O pedido mudou de status. Atualize a página." };

  revalidateReturn(req.id, req.orderId);
  revalidatePath(`/admin/pedidos/${req.orderId}`);
  return { success: true };
}
