import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listMyOrders } from "@/lib/order-actions";
import { formatBRL } from "@/lib/format";

const STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando pagamento",
  PAID: "Pago",
  PREPARING: "Em preparação",
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

export const metadata = { title: "Meus pedidos" };

export default async function MeusPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const sp = await searchParams;
  const filter = sp.status?.toUpperCase();
  const orders = await listMyOrders();
  const filtered = filter
    ? orders.filter((o) => o.status === filter)
    : orders;

  const filterOptions = [
    { key: undefined, label: "Todos" },
    { key: "PENDING_PAYMENT", label: "Aguardando" },
    { key: "PAID", label: "Pago" },
    { key: "PREPARING", label: "Preparando" },
    { key: "SHIPPED", label: "Enviado" },
    { key: "DELIVERED", label: "Entregue" },
    { key: "CANCELED", label: "Cancelado" },
  ];

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/perfil" className="underline-offset-4 hover:underline">
          Minha conta
        </Link>{" "}
        / Pedidos
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Meus pedidos
      </h1>

      {/* Filtros */}
      <div className="mt-8 flex flex-wrap gap-2">
        {filterOptions.map((opt) => {
          const active = (opt.key ?? "") === (filter ?? "");
          const href = opt.key
            ? `/perfil/pedidos?status=${opt.key.toLowerCase()}`
            : "/perfil/pedidos";
          return (
            <Link
              key={opt.label}
              href={href}
              className={`rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
                active
                  ? "bg-foreground text-background"
                  : "border border-border text-muted-foreground hover:border-foreground hover:text-foreground"
              }`}
            >
              {opt.label}
            </Link>
          );
        })}
      </div>

      <div className="mt-8">
        {filtered.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border p-10 text-center text-sm text-muted-foreground">
            {orders.length === 0 ? (
              <>
                Você ainda não fez nenhum pedido.{" "}
                <Link
                  href="/catalogo"
                  className="font-medium text-foreground underline-offset-4 hover:underline"
                >
                  Explorar coleção →
                </Link>
              </>
            ) : (
              "Nenhum pedido neste filtro."
            )}
          </div>
        ) : (
          <ul className="divide-y divide-border border-y border-border">
            {filtered.map((o) => (
              <li key={o.id} className="py-4">
                <Link
                  href={`/perfil/pedidos/${o.id}`}
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
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {o.createdAt.toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                      {o.items[0] && ` · ${o.items[0].productName}`}
                      {o.items.length > 1 && ` + ${o.items.length - 1}`}
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
        )}
      </div>
    </section>
  );
}
