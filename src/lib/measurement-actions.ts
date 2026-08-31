"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type MeasurementFormState = {
  error?: string;
  success?: boolean;
};

type Fit = "SLIM" | "REGULAR" | "OVERSIZED";

function parseNum(value: FormDataEntryValue | null): number | null {
  if (value === null) return null;
  const s = String(value).trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

export async function saveMeasurementsAction(
  _prevState: MeasurementFormState,
  formData: FormData,
): Promise<MeasurementFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  const acceptedTerms = formData.get("acceptedTerms") === "on";
  if (!acceptedTerms) {
    return {
      error:
        "Você precisa aceitar o uso dos seus dados corporais para salvar.",
    };
  }

  const fitRaw = String(formData.get("fitPreference") ?? "REGULAR");
  const fitPreference: Fit = (
    ["SLIM", "REGULAR", "OVERSIZED"].includes(fitRaw) ? fitRaw : "REGULAR"
  ) as Fit;

  const data = {
    heightCm: parseNum(formData.get("heightCm")),
    weightKg: parseNum(formData.get("weightKg")),
    chestCm: parseNum(formData.get("chestCm")),
    waistCm: parseNum(formData.get("waistCm")),
    hipCm: parseNum(formData.get("hipCm")),
    shoulderCm: parseNum(formData.get("shoulderCm")),
    armLengthCm: parseNum(formData.get("armLengthCm")),
    legLengthCm: parseNum(formData.get("legLengthCm")),
    fitPreference,
    acceptedTerms: true,
  };

  await prisma.measurementProfile.upsert({
    where: { userId: session.user.id },
    update: data,
    create: { userId: session.user.id, ...data },
  });

  revalidatePath("/perfil/medidas");
  revalidatePath("/perfil");
  revalidatePath("/teste-3d");

  return { success: true };
}

/**
 * Apaga o perfil de medidas do usuário. Como o avatar do VESTRA FIT é
 * gerado em tempo real a partir dessas medidas (não existe um "avatar"
 * persistido à parte), remover o perfil já faz o /teste-3d voltar a
 * mostrar o avatar de referência genérico.
 */
export async function deleteMeasurementsAction(
  _prevState: MeasurementFormState,
): Promise<MeasurementFormState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: "Sessão expirada. Faça login novamente." };
  }

  await prisma.measurementProfile.deleteMany({
    where: { userId: session.user.id },
  });

  revalidatePath("/perfil/medidas");
  revalidatePath("/perfil");
  revalidatePath("/teste-3d");

  return { success: true };
}
