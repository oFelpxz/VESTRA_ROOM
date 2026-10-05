import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { formatBRL } from "@/lib/format";
import { spDayKey } from "@/lib/dashboard";
import { formatDay, parseReportRange, type ReportRange } from "@/lib/reports";
import {
  getSalesReport,
  getStockReport,
  ORDER_STATUS_LABEL,
  type ReportKind,
} from "@/lib/report-data";
import { PAYMENT_METHOD_LABEL } from "@/components/checkout/payment-details";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

/** Quantas linhas aparecem na tela; o CSV traz todas. */
const PREVIEW_ROWS = 50;
const SHORTCUTS = [7, 30, 90];
const DAY_MS = 24 * 60 * 60 * 1000;

function csvHref(kind: ReportKind, range: ReportRange) {
  return `/admin/relatorios/csv?relatorio=${kind}&de=${range.from}&ate=${range.to}`;
}

export default async function AdminRelatoriosPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string | string[]; ate?: string | string[] }>;
}) {
  const [session, sp] = await Promise.all([auth(), searchParams]);
  if (session?.user?.role !== "ADMIN") redirect("/admin");

  const now = new Date();
  const range = parseReportRange(sp.de, sp.ate, now);
  const [sales, stock] = await Promise.all([getSalesReport(range), getStockReport()]);
  const today = spDayKey(now);
  const stockAlerts = stock.rows
    .filter((r) => r.situation !== "OK")
    .sort((a, b) => a.quantity - b.quantity);

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Relatórios
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Vendas por período e estoque atual, com download em CSV (abre no Excel
        e no Google Planilhas).
      </p>

      {/* Período */}
      <form method="get" className="mt-8 flex flex-wrap items-end gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="de">De</Label>
          <Input id="de" name="de" type="date" max={today} defaultValue={range.from} />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="ate">Até</Label>
          <Input id="ate" name="ate" type="date" max={today} defaultValue={range.to} />
        </div>
        <Button type="submit">Aplicar</Button>
        <div className="flex flex-wrap items-center gap-2">
          {SHORTCUTS.map((d) => {
            const from = spDayKey(new Date(now.getTime() - (d - 1) * DAY_MS));
            const current = range.to === today && range.from === from;
            return (
              <Link
                key={d}
                href={`/admin/relatorios?de=${from}&ate=${today}`}
                aria-current={current ? "page" : undefined}
                className={`rounded-sm border px-3 py-1.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                  current
                    ? "border-foreground bg-foreground text-background"
                    : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                }`}
              >
                {d} dias
              </Link>
            );
          })}
        </div>
      </form>
      {range.notice && (
        <p className="mt-3 rounded-sm bg-muted px-3 py-2 text-sm" role="status">
          {range.notice}
        </p>
      )}

      {/* Vendas */}
      <Section
        title={`Vendas · ${formatDay(range.from)} a ${formatDay(range.to)}`}
        action={
          <div className="flex flex-wrap gap-4">
            <Download href={csvHref("vendas", range)}>Pedidos (CSV)</Download>
            <Download href={csvHref("produtos", range)}>Por produto (CSV)</Download>
          </div>
        }
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Faturamento" value={formatBRL(sales.summary.revenue)} />
          <Stat label="Vendas" value={sales.summary.salesCount} />
          <Stat label="Ticket médio" value={formatBRL(sales.summary.averageTicket)} />
          <Stat label="Peças vendidas" value={sales.summary.units} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          Vendas = pedidos pagos, em preparação, enviados ou entregues, pela
          data do pedido (horário de Brasília). Descontos de cupom no período:{" "}
          {formatBRL(sales.summary.discount)} · frete cobrado:{" "}
          {formatBRL(sales.summary.shipping)}.
        </p>

        {sales.orders.length === 0 ? (
          <Empty>Nenhuma venda no período.</Empty>
        ) : (
          <>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[640px] text-sm">
                <caption className="sr-only">Pedidos vendidos no período</caption>
                <thead>
                  <tr className="border-b border-border text-left text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                    <th scope="col" className="py-2 pr-4 font-medium">Data</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Pedido</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Cliente</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Status</th>
                    <th scope="col" className="py-2 pr-4 font-medium">Pagamento</th>
                    <th scope="col" className="py-2 pr-4 text-right font-medium">Peças</th>
                    <th scope="col" className="py-2 text-right font-medium">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {sales.orders.slice(0, PREVIEW_ROWS).map((o) => (
                    <tr key={o.id}>
                      <td className="py-2.5 pr-4 text-muted-foreground">{formatDay(o.day)}</td>
                      <td className="py-2.5 pr-4 font-mono">
                        <Link
                          href={`/admin/pedidos/${o.id}`}
                          className="underline-offset-4 hover:underline"
                        >
                          #{o.number}
                        </Link>
                      </td>
                      <td className="py-2.5 pr-4">{o.customer}</td>
                      <td className="py-2.5 pr-4">{ORDER_STATUS_LABEL[o.status] ?? o.status}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {o.method ? (PAYMENT_METHOD_LABEL[o.method] ?? o.method) : "—"}
                      </td>
                      <td className="py-2.5 pr-4 text-right">{o.units}</td>
                      <td className="py-2.5 text-right font-medium">{formatBRL(o.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {sales.orders.length > PREVIEW_ROWS && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Mostrando {PREVIEW_ROWS} de {sales.orders.length} pedidos. O CSV
                traz todos.
              </p>
            )}

            <h3 className="mt-8 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Por produto
            </h3>
            <ol className="mt-3 divide-y divide-border border-y border-border text-sm">
              {sales.products.slice(0, 10).map((p, i) => (
                <li key={p.name} className="flex items-baseline gap-3 py-2.5">
                  <span className="w-5 text-muted-foreground">{i + 1}</span>
                  <span className="flex-1 truncate">{p.name}</span>
                  <span className="text-muted-foreground">{p.units} un.</span>
                  <span className="w-24 text-right font-medium">{formatBRL(p.revenue)}</span>
                </li>
              ))}
            </ol>
            {sales.products.length > 10 && (
              <p className="mt-2 text-[11px] text-muted-foreground">
                Os 10 que mais venderam. O CSV traz os {sales.products.length}.
              </p>
            )}
          </>
        )}
      </Section>

      {/* Estoque */}
      <Section
        title="Estoque · agora"
        action={<Download href={csvHref("estoque", range)}>Estoque completo (CSV)</Download>}
      >
        <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
          <Stat label="Variantes" value={stock.summary.variants} />
          <Stat label="Peças em estoque" value={stock.summary.units} />
          <Stat label="Estoque baixo" value={stock.summary.low} danger={stock.summary.low > 0} />
          <Stat label="Esgotadas" value={stock.summary.soldOut} danger={stock.summary.soldOut > 0} />
        </div>
        <p className="mt-2 text-[11px] text-muted-foreground">
          O estoque não tem histórico guardado: o relatório é sempre a foto de
          agora, sem depender do período escolhido.
        </p>

        {stockAlerts.length === 0 ? (
          <Empty>Nenhuma variante abaixo do limite.</Empty>
        ) : (
          <ul className="mt-6 divide-y divide-border border-y border-border text-sm">
            {stockAlerts.slice(0, PREVIEW_ROWS).map((r) => (
              <li key={r.id} className="flex items-baseline gap-3 py-2.5">
                <span className="flex-1 truncate">
                  {r.product}
                  <span className="text-muted-foreground">
                    {" "}
                    · {r.color} · {r.size} · <span className="font-mono">{r.sku}</span>
                  </span>
                </span>
                <span
                  className={`font-medium ${r.situation === "Esgotado" ? "text-destructive" : ""}`}
                >
                  {r.situation === "Esgotado" ? "Esgotado" : `${r.quantity} un.`}
                </span>
                <span className="w-16 text-right text-[11px] text-muted-foreground">
                  mín. {r.threshold}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
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
      <div className="mb-4 flex flex-wrap items-baseline justify-between gap-4">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Download({ href, children }: { href: string; children: React.ReactNode }) {
  // <a> comum, não <Link>: é um arquivo, não uma página.
  return (
    <a
      href={href}
      download
      className="text-xs font-medium underline underline-offset-4 hover:text-foreground"
    >
      ↓ {children}
    </a>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-6 rounded-sm border border-dashed border-border p-4 text-sm text-muted-foreground">
      {children}
    </p>
  );
}

function Stat({
  label,
  value,
  danger,
}: {
  label: string;
  value: string | number;
  danger?: boolean;
}) {
  return (
    <div
      className={`rounded-sm border p-6 ${
        danger ? "border-destructive/30 bg-destructive/5" : "border-border"
      }`}
    >
      <p
        className={`font-heading text-2xl font-bold md:text-3xl ${
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
}
