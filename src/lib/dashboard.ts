/**
 * Cálculos do painel do Admin (item 28). Funções puras — a página busca os
 * dados no banco e passa para cá, o que permite testar sem banco.
 */

/** Pedidos que contam como venda: pagos em diante, sem cancelados/reembolsados. */
export const SOLD_STATUSES = ["PAID", "PREPARING", "SHIPPED", "DELIVERED"] as const;

export const DASHBOARD_PERIODS = [7, 30, 90] as const;
export type DashboardPeriod = (typeof DASHBOARD_PERIODS)[number];

/** `?periodo=7|30|90`; qualquer outra coisa cai nos 30 dias. */
export function parsePeriod(raw: unknown): DashboardPeriod {
  const n = Number(raw);
  return (DASHBOARD_PERIODS as readonly number[]).includes(n)
    ? (n as DashboardPeriod)
    : 30;
}

// O servidor (Vercel) roda em UTC; o "dia" da loja é o de Brasília. O Brasil
// não tem horário de verão desde 2019, então o fuso é fixo em -03:00.
const SP_OFFSET_MS = -3 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

/** Dia (AAAA-MM-DD) de `date` no horário de Brasília. */
export function spDayKey(date: Date) {
  return new Date(date.getTime() + SP_OFFSET_MS).toISOString().slice(0, 10);
}

/** Meia-noite (horário de Brasília) do dia de `date`, como instante UTC. */
export function startOfSpDay(date: Date) {
  return new Date(Date.parse(`${spDayKey(date)}T00:00:00.000Z`) - SP_OFFSET_MS);
}

/** Início do período: meia-noite de (hoje − dias + 1), contando hoje. */
export function periodStart(now: Date, days: number) {
  return new Date(startOfSpDay(now).getTime() - (days - 1) * DAY_MS);
}

type SaleLike = { createdAt: Date; status: string; totalAmount: number };

function isSold(status: string) {
  return (SOLD_STATUSES as readonly string[]).includes(status);
}

/** Faturamento, nº de vendas e ticket médio (só pedidos vendidos). */
export function summarizeSales(orders: SaleLike[]) {
  const sold = orders.filter((o) => isSold(o.status));
  const revenue = sold.reduce((s, o) => s + o.totalAmount, 0);
  return {
    revenue,
    salesCount: sold.length,
    averageTicket: sold.length > 0 ? revenue / sold.length : 0,
  };
}

/** Quantidade de pedidos em cada status (todos os status). */
export function countByStatus(orders: { status: string }[]) {
  const counts: Record<string, number> = {};
  for (const o of orders) counts[o.status] = (counts[o.status] ?? 0) + 1;
  return counts;
}

/** Faturamento dia a dia no período, com zero nos dias sem venda. */
export function dailyRevenue(orders: SaleLike[], now: Date, days: number) {
  const start = periodStart(now, days);
  const series = Array.from({ length: days }, (_, i) => {
    const day = spDayKey(new Date(start.getTime() + i * DAY_MS));
    return { day, revenue: 0, salesCount: 0 };
  });
  const byDay = new Map(series.map((d) => [d.day, d]));
  for (const o of orders) {
    if (!isSold(o.status)) continue;
    const bucket = byDay.get(spDayKey(o.createdAt));
    if (!bucket) continue;
    bucket.revenue += o.totalAmount;
    bucket.salesCount += 1;
  }
  return series;
}
