import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { shortOrderCode } from "@/lib/payment-rules";
import {
  ACTIVE_STATUSES,
  KIND_LABEL,
  REASON_LABEL,
  STATUS_LABEL,
  type ReturnStatus,
} from "@/lib/returns";

export const metadata = { title: "Trocas e devoluções" };

const ALL: ReturnStatus[] = ["OPEN", "APPROVED", "RECEIVED", "COMPLETED", "DENIED", "CANCELED"];

const STATUS_STYLE: Record<ReturnStatus, string> = {
  OPEN: "bg-acid text-foreground",
  APPROVED: "bg-secondary text-foreground",
  RECEIVED: "bg-foreground text-background",
  COMPLETED: "bg-muted text-muted-foreground",
  DENIED: "bg-destructive/10 text-destructive",
  CANCELED: "bg-destructive/10 text-destructive",
};

export default async function AdminTrocasPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>;
}) {
  const session = await auth();
  if (session?.user?.role !== "ADMIN") redirect("/admin");

  const sp = await searchParams;
  const raw = typeof sp.status === "string" ? sp.status.toUpperCase() : undefined;
  const filter = raw === "ALL" ? "ALL" : ALL.find((s) => s === raw);

  const where =
    filter === "ALL" ? {} : filter ? { status: filter } : { status: { in: ACTIVE_STATUSES } };

  const [requests, counts] = await Promise.all([
    prisma.returnRequest.findMany({
      where,
      orderBy: { createdAt: "asc" },
      take: 200,
      select: {
        id: true,
        orderId: true,
        status: true,
        kind: true,
        reason: true,
        quantity: true,
        createdAt: true,
        user: { select: { name: true, email: true } },
        orderItem: { select: { productName: true, color: true, size: true } },
        _count: { select: { photos: true } },
      },
    }),
    prisma.returnRequest.groupBy({ by: ["status"], _count: { _all: true } }),
  ]);
  const countMap = Object.fromEntries(counts.map((c) => [c.status, c._count._all])) as Record<
    string,
    number
  >;

  const pills = [
    {
      href: "/admin/trocas",
      label: "Em andamento",
      active: !filter,
      count: ACTIVE_STATUSES.reduce((s, k) => s + (countMap[k] ?? 0), 0),
    },
    { href: "/admin/trocas?status=all", label: "Todos", active: filter === "ALL" },
    ...ALL.map((s) => ({
      href: `/admin/trocas?status=${s.toLowerCase()}`,
      label: STATUS_LABEL[s],
      active: filter === s,
      count: countMap[s] ?? 0,
    })),
  ];

  return (
    <div>
      <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Trocas e devoluções
      </h1>
      <p className="mt-2 text-sm text-muted-foreground">
        Pedidos dos clientes, do mais antigo para o mais novo. Aprovar, negar, receber a peça e
        concluir (com o reembolso).
      </p>

      <div className="mt-8 flex flex-wrap items-center gap-2">
        {pills.map((p) => (
          <Link
            key={p.href}
            href={p.href}
            className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
              p.active
                ? "bg-foreground text-background"
                : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
            }`}
          >
            {p.label}
            {p.count !== undefined && (
              <span
                className={`rounded-sm px-1.5 py-0.5 text-[10px] ${
                  p.active ? "bg-background/15 text-background" : "bg-muted text-muted-foreground"
                }`}
              >
                {p.count}
              </span>
            )}
          </Link>
        ))}
      </div>

      <ul className="mt-8 divide-y divide-border border-y border-border">
        {requests.length === 0 && (
          <li className="py-10 text-center text-sm text-muted-foreground">
            Nenhum pedido de troca aqui.
          </li>
        )}
        {requests.map((r) => (
          <li key={r.id} className="py-4">
            <Link
              href={`/admin/trocas/${r.id}`}
              className="flex flex-col gap-2 md:flex-row md:items-center md:gap-6"
            >
              <div className="flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">
                    {r.quantity}× {r.orderItem.productName} · {r.orderItem.color} · Tam{" "}
                    {r.orderItem.size}
                  </p>
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${STATUS_STYLE[r.status]}`}
                  >
                    {STATUS_LABEL[r.status]}
                  </span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {KIND_LABEL[r.kind]} · {REASON_LABEL[r.reason]}
                  {r._count.photos > 0 && ` · ${r._count.photos} foto(s)`} · Pedido #
                  {shortOrderCode(r.orderId)}
                </p>
                <p className="text-[11px] text-muted-foreground">
                  {r.user.name} · <span className="font-mono">{r.user.email}</span> ·{" "}
                  {r.createdAt.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}
                </p>
              </div>
              <span className="hidden text-foreground/40 md:inline">→</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
