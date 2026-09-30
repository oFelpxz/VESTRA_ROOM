"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseCouponForm } from "@/lib/coupons";

export type CouponFormState = {
  error?: string;
  success?: boolean;
  /** Valores digitados, devolvidos no erro para o formulário não se apagar. */
  values?: Record<string, string>;
};

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

const FIELDS = ["code", "type", "value", "minOrderAmount", "expiresAt", "usageLimit"];

export async function createCouponAction(
  _prev: CouponFormState,
  formData: FormData,
): Promise<CouponFormState> {
  await requireAdmin();

  const fields = Object.fromEntries(
    FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  );
  const parsed = parseCouponForm(fields);
  if ("error" in parsed) return { error: parsed.error, values: fields };

  const duplicate = {
    error: `Já existe um cupom com o código ${parsed.data.code}.`,
    values: fields,
  };
  const exists = await prisma.coupon.findUnique({
    where: { code: parsed.data.code },
    select: { id: true },
  });
  if (exists) return duplicate;

  try {
    await prisma.coupon.create({ data: parsed.data });
  } catch (e) {
    // Dois admins criando o mesmo código ao mesmo tempo: o índice único barra.
    if ((e as { code?: string }).code === "P2002") return duplicate;
    throw e;
  }

  revalidatePath("/admin/cupons");
  return { success: true };
}

/** formData: id, active ("true" | "false") — valor explícito, não inverte às cegas. */
export async function setCouponActiveAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const active = formData.get("active") === "true";

  // updateMany: se outro admin acabou de remover o cupom, não faz nada em vez de lançar erro.
  await prisma.coupon.updateMany({ where: { id }, data: { active } });
  revalidatePath("/admin/cupons");
}

/** Só remove cupom que nunca foi usado — cupom com uso só pode ser desativado. */
export async function deleteCouponAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;

  // Condição e remoção numa única operação: nenhum pedido consegue usar o
  // cupom entre a checagem e o delete.
  await prisma.coupon.deleteMany({
    where: { id, usedCount: 0, orders: { none: {} } },
  });
  revalidatePath("/admin/cupons");
}
