"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AddressFormState = { error?: string; success?: boolean; id?: string };

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

type AddressInput = {
  recipient: string;
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  postalCode: string;
  phone: string | null;
};

function parseAddressInput(formData: FormData): AddressInput | { error: string } {
  const recipient = str(formData.get("recipient"));
  const line1 = str(formData.get("line1"));
  const line2 = str(formData.get("line2")) || null;
  const city = str(formData.get("city"));
  const state = str(formData.get("state")).toUpperCase();
  const postalCode = str(formData.get("postalCode")).replace(/\D/g, "");
  const phone = str(formData.get("phone")) || null;

  if (!recipient) return { error: "Informe o nome do destinatário." };
  if (!line1) return { error: "Informe o endereço." };
  if (!city) return { error: "Informe a cidade." };
  if (state.length !== 2) return { error: "UF deve ter 2 letras (ex: SP)." };
  if (postalCode.length !== 8) return { error: "CEP deve ter 8 dígitos." };

  return { recipient, line1, line2, city, state, postalCode, phone };
}

export async function createAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada." };
  const userId = session.user.id;

  const parsed = parseAddressInput(formData);
  if ("error" in parsed) return parsed;

  const isFirst = (await prisma.address.count({ where: { userId } })) === 0;
  const wantsDefault = formData.get("isDefault") === "on" || isFirst;

  const addr = await prisma.$transaction(async (tx) => {
    if (wantsDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    return tx.address.create({
      data: { userId, ...parsed, isDefault: wantsDefault },
    });
  });

  revalidatePath("/checkout");
  revalidatePath("/perfil");
  revalidatePath("/perfil/enderecos");
  return { success: true, id: addr.id };
}

export async function updateAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada." };
  const userId = session.user.id;

  const id = str(formData.get("id"));
  if (!id) return { error: "Endereço inválido." };

  const existing = await prisma.address.findUnique({ where: { id } });
  if (!existing || existing.userId !== userId) {
    return { error: "Endereço não encontrado." };
  }

  const parsed = parseAddressInput(formData);
  if ("error" in parsed) return parsed;

  const wantsDefault = formData.get("isDefault") === "on";

  await prisma.$transaction(async (tx) => {
    if (wantsDefault && !existing.isDefault) {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }
    await tx.address.update({
      where: { id },
      data: { ...parsed, isDefault: wantsDefault },
    });
  });

  revalidatePath("/checkout");
  revalidatePath("/perfil");
  revalidatePath("/perfil/enderecos");
  return { success: true, id };
}

export async function setDefaultAddressAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const id = str(formData.get("id"));
  if (!id) return;

  const addr = await prisma.address.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!addr || addr.userId !== userId) return;

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({ where: { id }, data: { isDefault: true } }),
  ]);

  revalidatePath("/checkout");
  revalidatePath("/perfil");
  revalidatePath("/perfil/enderecos");
}

export async function deleteAddressAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;
  const userId = session.user.id;

  const id = str(formData.get("id"));
  if (!id) return;

  const addr = await prisma.address.findUnique({
    where: { id },
    select: { userId: true, isDefault: true },
  });
  if (!addr || addr.userId !== userId) return;

  await prisma.address.delete({ where: { id } });

  // Se o excluído era o padrão, promove o mais recente restante.
  if (addr.isDefault) {
    const next = await prisma.address.findFirst({
      where: { userId },
      orderBy: { createdAt: "desc" },
    });
    if (next) {
      await prisma.address.update({
        where: { id: next.id },
        data: { isDefault: true },
      });
    }
  }

  revalidatePath("/checkout");
  revalidatePath("/perfil");
  revalidatePath("/perfil/enderecos");
}

export async function listMyAddresses() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });
}
