/**
 * Regras de cupom (itens 12 e 13) — lógica pura, sem banco, para poder ser
 * testada isoladamente. As ações que gravam ficam em `coupon-actions.ts`.
 */

import { formatBRL } from "@/lib/format";

export type CouponType = "PERCENT" | "FIXED";

export type CouponInput = {
  code: string;
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  expiresAt: Date | null;
  usageLimit: number | null;
};

/** Forma mínima de um cupom vindo do banco (Decimal convertido para number). */
export type CouponLike = {
  type: CouponType;
  value: number;
  minOrderAmount: number | null;
  expiresAt: Date | null;
  usageLimit: number | null;
  usedCount: number;
  active: boolean;
};

export type CouponStatus = "ACTIVE" | "DISABLED" | "EXPIRED" | "EXHAUSTED";

const CODE_PATTERN = /^[A-Z0-9]{3,20}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// Tetos das colunas no Postgres: DECIMAL(10,2) e INTEGER. Acima disso o banco
// recusa a gravação com erro técnico em vez de mensagem amigável.
const MAX_AMOUNT = 99_999_999.99;
const MAX_USAGE_LIMIT = 2_147_483_647;

export function normalizeCouponCode(raw: string): string {
  return raw.trim().toUpperCase();
}

function parseAmount(raw: string): number | null {
  const s = raw.trim().replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
}

/**
 * "2026-10-31" → fim daquele dia no horário de Brasília (UTC-3, sem horário
 * de verão desde 2019). Retorna null se a data não existir no calendário.
 */
export function endOfDayBrasilia(isoDate: string): Date | null {
  if (!DATE_PATTERN.test(isoDate)) return null;
  const date = new Date(`${isoDate}T23:59:59.999-03:00`);
  if (Number.isNaN(date.getTime())) return null;
  // Rejeita datas que o JS "corrige" sozinho, como 2026-02-31.
  const [y, m, d] = isoDate.split("-").map(Number);
  const check = new Date(Date.UTC(y, m - 1, d));
  return check.getUTCMonth() === m - 1 && check.getUTCDate() === d ? date : null;
}

/** Valida o formulário de criação. Retorna os dados prontos ou a mensagem de erro. */
export function parseCouponForm(
  fields: Record<string, string>,
  now: Date = new Date(),
): { data: CouponInput } | { error: string } {
  const code = normalizeCouponCode(fields.code ?? "");
  if (!CODE_PATTERN.test(code)) {
    return { error: "Código deve ter de 3 a 20 letras ou números, sem espaços." };
  }

  const type = fields.type;
  if (type !== "PERCENT" && type !== "FIXED") {
    return { error: "Escolha o tipo do cupom." };
  }

  const value = parseAmount(fields.value ?? "");
  if (value === null || Number.isNaN(value) || value <= 0) {
    return { error: "Informe um valor de desconto maior que zero." };
  }
  if (type === "PERCENT" && value > 100) {
    return { error: "Desconto percentual não pode passar de 100%." };
  }
  if (value > MAX_AMOUNT) {
    return { error: "Valor de desconto alto demais." };
  }

  const minOrderAmount = parseAmount(fields.minOrderAmount ?? "");
  if (
    Number.isNaN(minOrderAmount) ||
    (minOrderAmount !== null && (minOrderAmount < 0 || minOrderAmount > MAX_AMOUNT))
  ) {
    return { error: "Pedido mínimo inválido." };
  }

  let expiresAt: Date | null = null;
  const rawDate = (fields.expiresAt ?? "").trim();
  if (rawDate) {
    expiresAt = endOfDayBrasilia(rawDate);
    if (!expiresAt) return { error: "Data de validade inválida." };
    if (expiresAt < now) return { error: "A validade não pode estar no passado." };
  }

  let usageLimit: number | null = null;
  const rawLimit = (fields.usageLimit ?? "").trim();
  if (rawLimit) {
    usageLimit = Number(rawLimit);
    if (!Number.isInteger(usageLimit) || usageLimit < 1 || usageLimit > MAX_USAGE_LIMIT) {
      return { error: "Limite de usos deve ser um número inteiro a partir de 1." };
    }
  }

  return {
    data: {
      code,
      type,
      value,
      minOrderAmount: minOrderAmount && minOrderAmount > 0 ? minOrderAmount : null,
      expiresAt,
      usageLimit,
    },
  };
}

export function couponStatus(coupon: CouponLike, now: Date = new Date()): CouponStatus {
  if (!coupon.active) return "DISABLED";
  if (coupon.expiresAt && coupon.expiresAt < now) return "EXPIRED";
  if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
    return "EXHAUSTED";
  }
  return "ACTIVE";
}

export const COUPON_STATUS_LABEL: Record<CouponStatus, string> = {
  ACTIVE: "Ativo",
  DISABLED: "Desativado",
  EXPIRED: "Expirado",
  EXHAUSTED: "Esgotado",
};

export function formatCouponValue(coupon: Pick<CouponLike, "type" | "value">): string {
  return coupon.type === "PERCENT"
    ? `${coupon.value.toLocaleString("pt-BR")}%`
    : formatBRL(coupon.value);
}

/** Ex.: "10% · mínimo R$ 150,00 · até 31/10/2026 · 3 de 50 usos". */
export function describeCoupon(coupon: CouponLike): string {
  const parts = [formatCouponValue(coupon)];
  if (coupon.minOrderAmount) parts.push(`mínimo ${formatBRL(coupon.minOrderAmount)}`);
  if (coupon.expiresAt) {
    parts.push(
      `até ${coupon.expiresAt.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}`,
    );
  }
  parts.push(
    coupon.usageLimit !== null
      ? `${coupon.usedCount} de ${coupon.usageLimit} usos`
      : `${coupon.usedCount} ${coupon.usedCount === 1 ? "uso" : "usos"}`,
  );
  return parts.join(" · ");
}
