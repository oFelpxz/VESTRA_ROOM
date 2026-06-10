"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type AddressFormState = { error?: string; success?: boolean; id?: string };

function str(v: FormDataEntryValue | null) {
  return v === null ? "" : String(v).trim();
}

export async function createAddressAction(
  _prev: AddressFormState,
  formData: FormData,
): Promise<AddressFormState> {
  const session = await auth();
  if (!session?.user?.id) return { error: "Sessão expirada." };

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

  const addr = await prisma.address.create({
    data: {
      userId: session.user.id,
      recipient,
      line1,
      line2,
      city,
      state,
      postalCode,
      phone,
    },
  });

  revalidatePath("/checkout");
  revalidatePath("/perfil");
  return { success: true, id: addr.id };
}

export async function deleteAddressAction(formData: FormData) {
  const session = await auth();
  if (!session?.user?.id) return;

  const id = str(formData.get("id"));
  if (!id) return;

  const addr = await prisma.address.findUnique({
    where: { id },
    select: { userId: true },
  });
  if (!addr || addr.userId !== session.user.id) return;

  await prisma.address.delete({ where: { id } });
  revalidatePath("/checkout");
  revalidatePath("/perfil");
}

export async function listMyAddresses() {
  const session = await auth();
  if (!session?.user?.id) return [];
  return prisma.address.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
  });
}
