import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { formatBRL } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando",
  PAID: "Pago",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

const STATUS_STYLE: Record<string, string> = {
  PENDING_PAYMENT: "bg-muted text-muted-foreground",
  PAID: "bg-acid/30 text-foreground",
  PREPARING: "bg-secondary text-foreground",
  SHIPPED: "bg-foreground text-background",
  DELIVERED: "bg-acid text-foreground",
  CANCELED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-destructive/10 text-destructive",
};

const ALL_STATUSES = [
  "PENDING_PAYMENT",
  "PAID",
  "PREPARING",
  "SHIPPED",
  "DELIVERED",
  "CANCELED",
  "REFUNDED",
] as const;

const ACTIVE_DEFAULT = ["PAID", "PREPARING", "SHIPPED"];

export default async function AdminPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const filter = sp.status?.toUpperCase();
  const q = sp.q?.trim();

  const whereStatus = filter && filter !== "ALL"
    ? { status: filter as (typeof ALL_STATUSES)[number] }
    : filter === "ALL"
      ? {}
      : { status: { in: ACTIVE_DEFAULT as unknown as (typeof ALL_STATUSES)[number][] } };

  const whereSearch = q
    ? {
        OR: [
          { user: { name: { contains: q, mode: "insensitive" as const } } },
          { user: { email: { contains: q, mode: "insensitive" as const } } },
        ],
      }
    : {};

  const [orders, counts] = await Promise.all([
    prisma.order.findMany({
      where: { ...whereStatus, ...whereSearch },
      include: {
        user: { select: { name: true, email: true } },
        items: { select: { id: true }, take: 1 },
        payment: { select: { method: true, status: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.order.groupBy({
      by: ["status"],
      _count: { _all: true },
    }),
  ]);

  const countMap = Object.fromEntries(
    counts.map((c) => [c.status, c._count._all]),
  ) as Record<string, number>;

  return (
    <div>
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
            Pedidos
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Gestão de status, rastreio e logística.
          </p>
        </div>

        <form
          action="/admin/pedidos"
          method="GET"
          className="flex w-full max-w-md items-center gap-2"
        >
          <input
            type="text"
            name="q"
            defaultValue={q ?? ""}
            placeholder="Buscar por nome ou e-mail do cliente..."
            className="h-9 flex-1 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring"
          />
          {filter && (
            <input type="hidden" name="status" value={filter.toLowerCase()} />
          )}
          <button
            type="submit"
            className="rounded-sm bg-foreground px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
          >
            Buscar
          </button>
        </form>
      </div>

      {/* Filtros */}
      <div className="mt-8 flex flex-wrap items-center gap-2">
        <FilterPill
          href="/admin/pedidos"
          label="Ativos"
          active={!filter}
          count={ACTIVE_DEFAULT.reduce((s, k) => s + (countMap[k] ?? 0), 0)}
        />
        <FilterPill
          href="/admin/pedidos?status=all"
          label="Todos"
          active={filter === "ALL"}
        />
        <span className="mx-2 h-4 w-px bg-border" />
        {ALL_STATUSES.map((s) => (
          <FilterPill
            key={s}
            href={`/admin/pedidos?status=${s.toLowerCase()}`}
            label={STATUS_LABEL[s]}
            active={filter === s}
            count={countMap[s] ?? 0}
          />
        ))}
      </div>

      {/* Lista */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          {orders.length}{" "}
          {orders.length === 1 ? "pedido encontrado" : "pedidos encontrados"}
        </p>

        <ul className="mt-4 divide-y divide-border border-y border-border">
          {orders.length === 0 && (
            <li className="py-10 text-center text-sm text-muted-foreground">
              Nenhum pedido encontrado.
            </li>
          )}
          {orders.map((o) => (
            <li key={o.id} className="py-4">
              <Link
                href={`/admin/pedidos/${o.id}`}
                className="flex flex-col gap-3 md:flex-row md:items-center md:gap-6"
              >
                <div className="flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-mono text-sm font-semibold">
                      #{o.id.slice(-8).toUpperCase()}
                    </p>
                    <span
                      className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                        STATUS_STYLE[o.status]
                      }`}
                    >
                      {STATUS_LABEL[o.status]}
                    </span>
                    {o.trackingCode && (
                      <span className="rounded-sm border border-foreground/15 px-2 py-0.5 text-[10px] font-mono text-foreground/70">
                        {o.trackingCode}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {o.user.name} ·{" "}
                    <span className="font-mono">{o.user.email}</span>
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {o.createdAt.toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </p>
                </div>

                <div className="text-right">
                  <p className="font-heading text-lg font-bold">
                    {formatBRL(Number(o.totalAmount))}
                  </p>
                  {o.payment && (
                    <p className="text-[10px] uppercase tracking-[0.15em] text-muted-foreground">
                      {o.payment.method} · {o.payment.status}
                    </p>
                  )}
                </div>

                <span className="text-foreground/40 md:ml-4">→</span>
              </Link>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterPill({
  href,
  label,
  active,
  count,
}: {
  href: string;
  label: string;
  active: boolean;
  count?: number;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
        active
          ? "bg-foreground text-background"
          : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
      }`}
    >
      {label}
      {count !== undefined && (
        <span
          className={`rounded-sm px-1.5 py-0.5 text-[10px] ${
            active
              ? "bg-background/15 text-background"
              : "bg-muted text-muted-foreground"
          }`}
        >
          {count}
        </span>
      )}
    </Link>
  );
}
