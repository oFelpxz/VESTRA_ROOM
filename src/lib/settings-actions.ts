"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { parseSettingsForm, SETTINGS_FIELDS } from "@/lib/store-settings";

export type SettingsFormState = {
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

/** Item 25: grava a linha única de configurações (id "default"). */
export async function saveSettingsAction(
  _prev: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  await requireAdmin();

  const fields = Object.fromEntries(
    SETTINGS_FIELDS.map((f) => [f, String(formData.get(f) ?? "")]),
  );
  const parsed = parseSettingsForm(fields);
  if ("error" in parsed) return { error: parsed.error, values: fields };

  await prisma.storeSettings.upsert({
    where: { id: "default" },
    create: { id: "default", ...parsed.data },
    update: parsed.data,
  });

  // Frete, prazos, políticas e provador aparecem em várias telas.
  revalidatePath("/", "layout");
  return { success: true };
}
