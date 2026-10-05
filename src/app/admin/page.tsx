import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";
import { ADMIN_ROUTES, isStaffRole, type StaffRole } from "@/lib/admin-access";
import {
  countByStatus,
  dailyRevenue,
  DASHBOARD_PERIODS,
  parsePeriod,
  periodStart,
  SOLD_STATUSES,
  startOfSpDay,
  summarizeSales,
} from "@/lib/dashboard";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando",
  PAID: "Pago",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const SHORTCUT_DESCRIPTION: Record<string, string> = {
  "/admin/pedidos": "Acompanhar e atualizar status dos pedidos",
  "/admin/estoque": "Inventário por variante e ajustes manuais",
  "/admin/produtos": "Cadastrar produtos, variantes, imagens e modelo 3D",
  "/admin/modelos-3d": "Upload, revisão e validação dos arquivos .glb",
  "/admin/categorias": "Criar, listar e remover categorias de produtos",
  "/admin/medidas": "Definir medidas por tamanho de cada produto",
};

/** Variantes ativas abaixo do limite de cada uma (mesma regra da tela de Estoque). */
async function getLowStock() {
  const variants = await prisma.productVariant.findMany({
    where: { status: "ACTIVE" },
    select: {
      id: true,
      sku: true,
      color: true,
      size: true,
      stockQuantity: true,
      lowStockThreshold: true,
      product: { select: { name: true } },
    },
  });
  const low = variants
    .filter((v) => v.stockQuantity < v.lowStockThreshold)
    .sort((a, b) => a.stockQuantity - b.stockQuantity);
  return { count: low.length, top: low.slice(0, 5) };
}

async function get3DCounts() {
  const [published, pending, activeProducts] = await Promise.all([
    prisma.product.count({
      where: {
        status: "ACTIVE",
        model3D: { status: { in: ["VALIDATED", "OPTIMIZED"] } },
      },
    }),
    prisma.model3D.count({ where: { status: "PENDING" } }),
    prisma.product.count({ where: { status: "ACTIVE" } }),
  ]);
  return { published, pending, activeProducts };
}

export default async function AdminHomePage({
  searchParams,
}: {
  searchParams: Promise<{ periodo?: string | string[] }>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  // Layout e página rodam em paralelo: a página confere o papel por conta
  // própria antes de consultar qualquer número.
  const role = session?.user?.role;
  if (!isStaffRole(role)) redirect("/login");

  const today = new Date().toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    timeZone: "America/Sao_Paulo",
  });

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Painel
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Visão geral da loja — {today}
      </p>

      {role === "ADMIN" && <AdminView period={parsePeriod(sp.periodo)} />}
      {role === "STOCK_OPERATOR" && <LogisticsView />}
      {role === "MODEL_3D" && <Model3DView />}

      <Shortcuts role={role} />
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Admin: vendas, status, mais vendidos, estoque e 3D                  */
/* ------------------------------------------------------------------ */

async function AdminView({ period }: { period: number }) {
  const now = new Date();
  const start = periodStart(now, period);

  const [orders, topSellers, toShip, lowStock, models] = await Promise.all([
    prisma.order.findMany({
      where: { createdAt: { gte: start } },
      select: { createdAt: true, status: true, totalAmount: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productName"],
      where: {
        order: { createdAt: { gte: start }, status: { in: [...SOLD_STATUSES] } },
      },
      _sum: { quantity: true, totalPrice: true },
      // Empate em unidades: desempata pelo valor vendido.
      orderBy: [{ _sum: { quantity: "desc" } }, { _sum: { totalPrice: "desc" } }],
      take: 5,
    }),
    prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    getLowStock(),
    get3DCounts(),
  ]);

  const rows = orders.map((o) => ({ ...o, totalAmount: Number(o.totalAmount) }));
  const sales = summarizeSales(rows);
  const byStatus = countByStatus(rows);
  const series = dailyRevenue(rows, now, period);

  return (
    <>
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <span className="mr-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
          Período
        </span>
        {DASHBOARD_PERIODS.map((d) => (
          <Link
            key={d}
            href={d === 30 ? "/admin" : `/admin?periodo=${d}`}
            aria-current={d === period ? "page" : undefined}
            className={`rounded-sm border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
              d === period
                ? "border-foreground bg-foreground text-background"
                : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {d} dias
          </Link>
        ))}
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Faturamento" value={formatBRL(sales.revenue)} big />
        <StatCard label="Vendas" value={sales.salesCount} />
        <StatCard label="Ticket médio" value={formatBRL(sales.averageTicket)} big />
        <StatCard
          label="A despachar"
          value={toShip}
          highlight={toShip > 0}
          href="/admin/pedidos"
        />
      </div>
      <p className="mt-2 text-[11px] text-muted-foreground">
        Vendas = pedidos pagos, em preparação, enviados ou entregues. Valores
        com frete e já com desconto de cupom.
      </p>

      <Section title={`Faturamento por dia · últimos ${period} dias`}>
        <RevenueChart series={series} />
      </Section>

      <div className="grid gap-8 lg:grid-cols-2">
        <Section title="Pedidos por status · no período">
          <ul className="divide-y divide-border border-y border-border text-sm">
            {Object.keys(STATUS_LABEL).map((s) => (
              <li key={s}>
                <Link
                  href={`/admin/pedidos?status=${s.toLowerCase()}`}
                  className="flex items-baseline justify-between py-2.5 hover:text-foreground"
                >
                  <span className="text-muted-foreground">{STATUS_LABEL[s]}</span>
                  <span className="font-medium">{byStatus[s] ?? 0}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Mais vendidos · no período">
          {topSellers.length === 0 ? (
            <Empty>Nenhuma venda no período.</Empty>
          ) : (
            <ol className="divide-y divide-border border-y border-border text-sm">
              {topSellers.map((t, i) => (
                <li key={t.productName} className="flex items-baseline gap-3 py-2.5">
                  <span className="w-4 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{t.productName}</span>
                  <span className="text-muted-foreground">
                    {t._sum.quantity ?? 0} un.
                  </span>
                  <span className="w-24 text-right font-medium">
                    {formatBRL(Number(t._sum.totalPrice ?? 0))}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>
      </div>

      <div className="grid gap-8 lg:grid-cols-2">
        <LowStockSection lowStock={lowStock} />
        <Model3DSection models={models} />
      </div>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Operador de estoque: só logística (sem faturamento)                 */
/* ------------------------------------------------------------------ */

async function LogisticsView() {
  const [ordersToday, toShip, inTransit, lowStock] = await Promise.all([
    prisma.order.count({
      where: { createdAt: { gte: startOfSpDay(new Date()) } },
    }),
    prisma.order.count({ where: { status: { in: ["PAID", "PREPARING"] } } }),
    prisma.order.count({ where: { status: "SHIPPED" } }),
    getLowStock(),
  ]);

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="Pedidos hoje" value={ordersToday} highlight={ordersToday > 0} />
        <StatCard
          label="A despachar"
          value={toShip}
          highlight={toShip > 0}
          href="/admin/pedidos"
        />
        <StatCard
          label="Em trânsito"
          value={inTransit}
          href="/admin/pedidos?status=shipped"
        />
        <StatCard
          label="Estoque baixo"
          value={lowStock.count}
          danger={lowStock.count > 0}
          href="/admin/estoque?baixo=1"
        />
      </div>
      <LowStockSection lowStock={lowStock} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Equipe 3D: fila de validação                                        */
/* ------------------------------------------------------------------ */

async function Model3DView() {
  const models = await get3DCounts();
  return <Model3DSection models={models} />;
}

/* ------------------------------------------------------------------ */
/* Blocos compartilhados                                               */
/* ------------------------------------------------------------------ */

function LowStockSection({
  lowStock,
}: {
  lowStock: Awaited<ReturnType<typeof getLowStock>>;
}) {
  return (
    <Section
      title="Alertas de estoque baixo"
      action={
        lowStock.count > 0 ? (
          <Link
            href="/admin/estoque?baixo=1"
            className="text-xs text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Ver todos ({lowStock.count}) →
          </Link>
        ) : null
      }
    >
      {lowStock.count === 0 ? (
        <Empty>Nenhuma variante abaixo do limite.</Empty>
      ) : (
        <ul className="divide-y divide-border border-y border-border text-sm">
          {lowStock.top.map((v) => (
            <li key={v.id} className="flex items-baseline gap-3 py-2.5">
              <span className="flex-1 truncate">
                {v.product.name}
                <span className="text-muted-foreground">
                  {" "}
                  · {v.color} · {v.size}
                </span>
              </span>
              <span
                className={`font-medium ${v.stockQuantity === 0 ? "text-destructive" : ""}`}
              >
                {v.stockQuantity === 0 ? "Esgotado" : `${v.stockQuantity} un.`}
              </span>
              <span className="w-16 text-right text-[11px] text-muted-foreground">
                mín. {v.lowStockThreshold}
              </span>
            </li>
          ))}
        </ul>
      )}
    </Section>
  );
}

function Model3DSection({
  models,
}: {
  models: Awaited<ReturnType<typeof get3DCounts>>;
}) {
  return (
    <Section title="Provador 3D">
      <div className="grid grid-cols-2 gap-4">
        <StatCard
          label={`Produtos com 3D · de ${models.activeProducts} ativos`}
          value={models.published}
        />
        <StatCard
          label="3D pendentes"
          value={models.pending}
          highlight={models.pending > 0}
          href="/admin/modelos-3d?status=pending"
        />
      </div>
    </Section>
  );
}

function RevenueChart({
  series,
}: {
  series: { day: string; revenue: number; salesCount: number }[];
}) {
  const max = Math.max(...series.map((d) => d.revenue));
  const fmtDay = (key: string) => `${key.slice(8, 10)}/${key.slice(5, 7)}`;

  if (max === 0) return <Empty>Nenhuma venda no período.</Empty>;

  return (
    <figure>
      <div
        role="img"
        aria-label={`Faturamento diário de ${fmtDay(series[0].day)} a ${fmtDay(series[series.length - 1].day)}; maior dia ${formatBRL(max)}.`}
        className="flex h-40 items-end gap-px border-b border-border"
      >
        {series.map((d) => (
          <div
            key={d.day}
            title={`${fmtDay(d.day)} · ${formatBRL(d.revenue)} · ${d.salesCount} ${d.salesCount === 1 ? "venda" : "vendas"}`}
            className="group flex h-full flex-1 items-end"
          >
            <div
              className={`w-full transition-colors group-hover:bg-foreground ${
                d.revenue > 0 ? "bg-foreground/70" : "bg-border"
              }`}
              style={{ height: d.revenue > 0 ? `${Math.max((d.revenue / max) * 100, 2)}%` : "1px" }}
            />
          </div>
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-muted-foreground">
        <span>{fmtDay(series[0].day)}</span>
        <span>maior dia: {formatBRL(max)}</span>
        <span>{fmtDay(series[series.length - 1].day)}</span>
      </figcaption>
    </figure>
  );
}

function Shortcuts({ role }: { role: StaffRole }) {
  // Só atalhos para telas que o papel pode abrir (mesma matriz do menu).
  const items = ADMIN_ROUTES.filter(
    (r) => SHORTCUT_DESCRIPTION[r.href] && r.roles.includes(role),
  ).sort((a, b) => a.index.localeCompare(b.index));

  return (
    <div className="mt-10 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {items.map((r) => (
        <Link key={r.href} href={r.href} className="block">
          <Card className="h-full transition-shadow hover:shadow-md">
            <CardHeader>
              <CardTitle>{r.label}</CardTitle>
              <CardDescription>{SHORTCUT_DESCRIPTION[r.href]}</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Gerenciar →
            </CardContent>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function Section({
  title,
  action,
  children,
}: {
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-10">
      <div className="mb-4 flex items-baseline justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function StatCard({
  label,
  value,
  highlight,
  danger,
  big,
  href,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
  big?: boolean;
  href?: string;
}) {
  const content = (
    <div
      className={`h-full rounded-sm border p-6 transition-colors ${
        danger
          ? "border-destructive/30 bg-destructive/5"
          : highlight
            ? "border-foreground bg-secondary/40"
            : "border-border"
      } ${href ? "hover:border-foreground" : ""}`}
    >
      <p
        className={`font-heading font-bold ${big ? "text-2xl md:text-3xl" : "text-3xl"} ${
          danger ? "text-destructive" : "text-foreground"
        }`}
      >
        {value}
      </p>
      <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </p>
    </div>
  );

  if (href) return <Link href={href}>{content}</Link>;
  return content;
}
