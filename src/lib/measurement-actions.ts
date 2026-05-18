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

  return { success: true };
}
