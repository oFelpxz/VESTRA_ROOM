"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type PaymentMethodFormState = { error?: string; success?: boolean };

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

function luhnValid(digits: string): boolean {
  let sum = 0;
  let alt = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let n = Number(digits[i]);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

function detectBrand(digits: string): string {
  if (/^4/.test(digits)) return "Visa";
  if (/^(5[1-5]|2[2-7])/.test(digits)) return "Mastercard";
  if (/^3[47]/.test(digits)) return "Amex";
  if (/^(636368|438935|504175|451416|509\d{3}|6363\d{2})/.test(digits)) return "Elo";
  return "Cartão";
}

/**
 * Salva um cartão de forma tokenizada: o número completo e o CVV passam
 * por esta função mas NUNCA são persistidos — só derivamos bandeira,
 * últimos 4 dígitos e um token opaco. Em produção o token viria do
 * gateway real (Mercado Pago/Stripe/Pagar.me — item 16, Sprint 4).
 */
export async function createSavedPaymentMethodAction(
  _prev: PaymentMethodFormState,
  formData: FormData,
): Promise<PaymentMethodFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada." };
  const userId = session.user.id;

  const holderName = str(formData.get("holderName"));
  const cardNumber = str(formData.get("cardNumber")).replace(/\D/g, "");
  const expMonth = Number(str(formData.get("expMonth")));
  const expYear = Number(str(formData.get("expYear")));
  const cvv = str(formData.get("cvv")).replace(/\D/g, "");

  if (!holderName) return { error: "Informe o nome impresso no cartão." };
  if (cardNumber.length < 13 || cardNumber.length > 19 || !luhnValid(cardNumber)) {
    return { error: "Número de cartão inválido." };
  }
  if (!expMonth || expMonth < 1 || expMonth > 12) {
    return { error: "Mês de validade inválido." };
  }
  const currentYear = new Date().getFullYear();
  if (!expYear || expYear < currentYear || expYear > currentYear + 20) {
    return { error: "Ano de validade inválido." };
  }
  if (cvv.length < 3 || cvv.length > 4) {
    return { error: "CVV inválido." };
  }

  const brand = detectBrand(cardNumber);
  const last4 = cardNumber.slice(-4);
  // Token opaco simulado — nada do cardNumber/cvv sobrevive além daqui.
  const token = `tok_sim_${randomUUID()}`;

  const isFirst = (await prisma.savedPaymentMethod.count({ where: { userId } })) === 0;
  const wantsDefault = formData.get("isDefault") === "on" || isFirst;

  await prisma.$transaction(async (tx) => {
    if (wantsDefault) {
      await tx.savedPaymentMethod.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.savedPaymentMethod.create({
      data: { userId, brand, last4, expMonth, expYear, holderName, token, isDefault: wantsDefault },
    });
  });

  revalidatePath("/perfil/pagamento");
  revalidatePath("/perfil");
  revalidatePath("/checkout");
  return { success: true };
}

export async function setDefaultSavedPaymentMethodAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const id = str(formData.get("id"));
  if (!id) return;

  const method = await prisma.savedPaymentMethod.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!method || method.userId !== userId) return;

  await prisma.$transaction([
    prisma.savedPaymentMethod.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.savedPaymentMethod.update({ where: { id }, data: { isDefault: true } }),
  ]);

  revalidatePath("/perfil/pagamento");
  revalidatePath("/checkout");
}

export async function deleteSavedPaymentMethodAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const id = str(formData.get("id"));
  if (!id) return;

  const method = await prisma.savedPaymentMethod.findUnique({
    where: { id },
    select: { userId: true, isDefault: true },
  });
  if (!method || method.userId !== userId) return;

  await prisma.savedPaymentMethod.delete({ where: { id } });

  if (method.isDefault) {
    const next = await prisma.savedPaymentMethod.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.savedPaymentMethod.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidatePath("/perfil/pagamento");
  revalidatePath("/checkout");
}

export async function listMySavedPaymentMethods() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.savedPaymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
