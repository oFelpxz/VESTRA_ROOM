import { cache } from "react";
import { prisma } from "@/lib/prisma";
import { DEFAULT_SETTINGS, type EditableSettings } from "@/lib/store-settings";

/**
 * Configurações da loja lidas do banco (item 25). Uma leitura por
 * requisição (`cache`). Sem a linha, ou se o banco falhar, valem os padrões
 * de `store-settings.ts` — a loja continua funcionando.
 */
export const getStoreSettings = cache(async (): Promise<EditableSettings> => {
  try {
    const row = await prisma.storeSettings.findUnique({ where: { id: "default" } });
    if (!row) return DEFAULT_SETTINGS;
    return {
      storeName: row.storeName,
      cnpj: row.cnpj,
      email: row.email,
      phone: row.phone,
      returnAddress: row.returnAddress,
      returnPolicy: row.returnPolicy,
      privacyPolicy: row.privacyPolicy,
      regretDays: row.regretDays,
      exchangeDays: row.exchangeDays,
      defectDays: row.defectDays,
      boletoDays: row.boletoDays,
      freeShippingFrom: Number(row.freeShippingFrom),
      lowStockThreshold: row.lowStockThreshold,
      fitToleranceCm: row.fitToleranceCm,
    };
  } catch (e) {
    console.error("getStoreSettings:", e);
    return DEFAULT_SETTINGS;
  }
});
