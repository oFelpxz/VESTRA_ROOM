"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

async function requireAdmin() {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") {
    throw new Error("Acesso negado.");
  }
}

/**
 * Bloqueia ou desbloqueia um cliente (item 23).
 *
 * formData: id, blocked ("true" | "false").
 *
 * A condição inteira fica no WHERE, numa única operação: só clientes (nunca
 * staff — o que também impede o admin de bloquear a si mesmo), e só as
 * transições ACTIVE ↔ BLOCKED — conta excluída (INACTIVE) nunca é reativada.
 */
export async function setCustomerBlockedAction(formData: FormData) {
  await requireAdmin();

  const id = String(formData.get("id") ?? "");
  if (!id) return;
  const blocked = formData.get("blocked") === "true";

  await prisma.user.updateMany({
    where: {
      id,
      role: "CUSTOMER",
      status: blocked ? "ACTIVE" : "BLOCKED",
    },
    data: { status: blocked ? "BLOCKED" : "ACTIVE" },
  });

  revalidatePath("/admin/clientes");
  revalidatePath(`/admin/clientes/${id}`);
}
