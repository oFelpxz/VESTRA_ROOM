import type { PrismaClient } from "../../src/generated/prisma/client";

/**
 * Cupons de exemplo da Sprint 3 (itens 12 e 13). Os "DEMO…" existem para
 * demonstrar cada mensagem de erro do carrinho sem precisar preparar nada.
 */
export const SPRINT3_COUPONS = [
  // Uso normal.
  { code: "BEMVINDO10", type: "PERCENT", value: 10 },
  // Pedido mínimo: carrinho abaixo de R$ 150 mostra "Faltam R$ X…".
  { code: "VESTRA20", type: "FIXED", value: 20, minOrderAmount: 150, usageLimit: 100 },
  // "Este cupom expirou."
  {
    code: "DEMOEXPIRADO",
    type: "PERCENT",
    value: 15,
    expiresAt: new Date("2026-01-31T23:59:59.999-03:00"),
  },
  // "Este cupom esgotou."
  { code: "DEMOESGOTADO", type: "PERCENT", value: 10, usageLimit: 1, usedCount: 1 },
  // Desativado aparece para o cliente como "Cupom inválido."
  { code: "DEMODESATIVADO", type: "PERCENT", value: 10, active: false },
  // Teste de limite com compras simultâneas: o segundo pedido deve ser recusado.
  { code: "LIMITE1", type: "PERCENT", value: 5, usageLimit: 1 },
] as const;

/**
 * Só cria os cupons que ainda não existem — nunca altera um cupom já no banco
 * (ex.: o contador de usos de testes anteriores continua como está).
 */
export async function seedCoupons(prisma: PrismaClient) {
  for (const coupon of SPRINT3_COUPONS) {
    await prisma.coupon.upsert({
      where: { code: coupon.code },
      update: {},
      create: coupon,
    });
  }
  return SPRINT3_COUPONS.map((c) => c.code);
}
