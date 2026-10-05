/**
 * Consultas dos relatórios do Admin (item 24), usadas pela página e pelo
 * download em CSV — assim os dois mostram sempre os mesmos números.
 */

import { prisma } from "@/lib/prisma";
import { SOLD_STATUSES, spDayKey, summarizeSales } from "@/lib/dashboard";
import {
  csvMoney,
  formatDay,
  stockSituation,
  toCsv,
  type ReportRange,
} from "@/lib/reports";
import { PAYMENT_METHOD_LABEL } from "@/components/checkout/payment-details";

export const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PREPARING: "Em preparação",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

function timeOfDay(date: Date) {
  return date.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Sao_Paulo",
  });
}

/** Pedidos vendidos no período (mesma regra de venda do painel). */
export async function getSalesReport(range: ReportRange) {
  const orders = await prisma.order.findMany({
    where: {
      createdAt: { gte: range.start, lt: range.end },
      status: { in: [...SOLD_STATUSES] },
    },
    select: {
      id: true,
      createdAt: true,
      status: true,
      totalAmount: true,
      discountAmount: true,
      shippingAmount: true,
      user: { select: { name: true } },
      payment: { select: { method: true } },
      coupon: { select: { code: true } },
      items: {
        select: { productName: true, quantity: true, totalPrice: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  const rows = orders.map((o) => {
    const items = o.items.map((i) => ({
      productName: i.productName,
      quantity: i.quantity,
      totalPrice: Number(i.totalPrice),
    }));
    return {
      id: o.id,
      number: o.id.slice(-8).toUpperCase(),
      createdAt: o.createdAt,
      day: spDayKey(o.createdAt),
      status: o.status,
      customer: o.user.name,
      method: o.payment?.method ?? null,
      coupon: o.coupon?.code ?? null,
      units: items.reduce((s, i) => s + i.quantity, 0),
      subtotal: items.reduce((s, i) => s + i.totalPrice, 0),
      discount: Number(o.discountAmount),
      shipping: Number(o.shippingAmount),
      total: Number(o.totalAmount),
      items,
    };
  });

  // Vendas por produto, pelo nome gravado no pedido (a peça pode ter sido
  // renomeada ou apagada depois).
  const byProduct = new Map<string, { units: number; revenue: number }>();
  for (const r of rows) {
    for (const i of r.items) {
      const p = byProduct.get(i.productName) ?? { units: 0, revenue: 0 };
      p.units += i.quantity;
      p.revenue += i.totalPrice;
      byProduct.set(i.productName, p);
    }
  }
  const products = [...byProduct.entries()]
    .map(([name, p]) => ({ name, ...p }))
    .sort((a, b) => b.units - a.units || b.revenue - a.revenue);

  return {
    orders: rows,
    products,
    summary: {
      ...summarizeSales(rows.map((r) => ({ ...r, totalAmount: r.total }))),
      units: rows.reduce((s, r) => s + r.units, 0),
      discount: rows.reduce((s, r) => s + r.discount, 0),
      shipping: rows.reduce((s, r) => s + r.shipping, 0),
    },
  };
}

/** Foto do estoque agora, de todas as variantes. */
export async function getStockReport() {
  const variants = await prisma.productVariant.findMany({
    select: {
      id: true,
      sku: true,
      color: true,
      size: true,
      status: true,
      stockQuantity: true,
      lowStockThreshold: true,
      product: {
        select: { name: true, status: true, category: { select: { name: true } } },
      },
    },
    orderBy: [{ product: { name: "asc" } }, { color: "asc" }, { size: "asc" }],
  });

  const rows = variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    product: v.product.name,
    category: v.product.category.name,
    color: v.color,
    size: v.size,
    quantity: v.stockQuantity,
    threshold: v.lowStockThreshold,
    situation: stockSituation(v.stockQuantity, v.lowStockThreshold),
    active: v.status === "ACTIVE" && v.product.status === "ACTIVE",
  }));

  return {
    rows,
    summary: {
      variants: rows.length,
      units: rows.reduce((s, r) => s + Math.max(r.quantity, 0), 0),
      low: rows.filter((r) => r.situation === "Baixo").length,
      soldOut: rows.filter((r) => r.situation === "Esgotado").length,
    },
  };
}

export const REPORT_KINDS = ["vendas", "produtos", "estoque"] as const;
export type ReportKind = (typeof REPORT_KINDS)[number];

/** Nome do arquivo e conteúdo do CSV de cada relatório. */
export async function buildReportCsv(kind: ReportKind, range: ReportRange) {
  const period = `${range.from}_a_${range.to}`;

  if (kind === "estoque") {
    const { rows } = await getStockReport();
    return {
      filename: `vestra-estoque-${range.to}.csv`,
      csv: toCsv(
        ["Produto", "Categoria", "Cor", "Tamanho", "SKU", "Estoque", "Limite", "Situação", "À venda"],
        rows.map((r) => [
          r.product,
          r.category,
          r.color,
          r.size,
          r.sku,
          r.quantity,
          r.threshold,
          r.situation,
          r.active ? "Sim" : "Não",
        ]),
      ),
    };
  }

  const sales = await getSalesReport(range);

  if (kind === "produtos") {
    return {
      filename: `vestra-produtos-vendidos-${period}.csv`,
      csv: toCsv(
        ["Produto", "Unidades", "Valor vendido (R$)"],
        sales.products.map((p) => [p.name, p.units, csvMoney(p.revenue)]),
      ),
    };
  }

  return {
    filename: `vestra-vendas-${period}.csv`,
    csv: toCsv(
      [
        "Data",
        "Hora",
        "Pedido",
        "Cliente",
        "Status",
        "Pagamento",
        "Cupom",
        "Peças",
        "Subtotal (R$)",
        "Desconto (R$)",
        "Frete (R$)",
        "Total (R$)",
      ],
      sales.orders.map((o) => [
        formatDay(o.day),
        timeOfDay(o.createdAt),
        o.number,
        o.customer,
        ORDER_STATUS_LABEL[o.status] ?? o.status,
        o.method ? (PAYMENT_METHOD_LABEL[o.method] ?? o.method) : "",
        o.coupon,
        o.units,
        csvMoney(o.subtotal),
        csvMoney(o.discount),
        csvMoney(o.shipping),
        csvMoney(o.total),
      ]),
    ),
  };
}
