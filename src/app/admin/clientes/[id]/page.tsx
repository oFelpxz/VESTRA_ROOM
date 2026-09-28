import Link from "next/link";
import { notFound } from "next/navigation";
import { getCustomerDetail } from "@/lib/customers";
import { setCustomerBlockedAction } from "@/lib/customer-actions";
import { formatBRL } from "@/lib/format";
import { CustomerStatusBadge } from "@/components/admin/customer-status-badge";

const dateFormat = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo" });

const ORDER_STATUS_LABEL: Record<string, string> = {
  PENDING_PAYMENT: "Aguardando",
  PAID: "Pago",
  PREPARING: "Preparando",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  CANCELED: "Cancelado",
  REFUNDED: "Reembolsado",
};

export default async function AdminClienteDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await getCustomerDetail(id);
  if (!customer) notFound();

  const blocked = customer.status === "BLOCKED";

  return (
    <div>
      <Link
        href="/admin/clientes"
        className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground hover:text-foreground"
      >
        ← Clientes
      </Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
            {customer.name}
          </h1>
          <div className="mt-2">
            <CustomerStatusBadge blocked={blocked} />
          </div>
        </div>

        <form action={setCustomerBlockedAction}>
          <input type="hidden" name="id" value={customer.id} />
          <input type="hidden" name="blocked" value={blocked ? "false" : "true"} />
          <button
            type="submit"
            className={`rounded-sm border px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.15em] transition-colors ${
              blocked
                ? "border-foreground hover:bg-foreground hover:text-background"
                : "border-destructive text-destructive hover:bg-destructive hover:text-background"
            }`}
          >
            {blocked ? "Desbloquear" : "Bloquear"}
          </button>
        </form>
      </div>

      {blocked && (
        <p className="mt-4 max-w-xl rounded-sm bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Cliente bloqueado: não consegue entrar na conta nem finalizar pedidos.
          Uma sessão já aberta continua navegando até expirar, mas qualquer
          tentativa de compra é recusada.
        </p>
      )}

      <div className="mt-10 grid gap-10 md:grid-cols-[280px_1fr]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Contato
          </p>
          <dl className="mt-4 flex flex-col gap-3 text-sm">
            <div>
              <dt className="text-xs text-muted-foreground">E-mail</dt>
              <dd>{customer.email}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Telefone</dt>
              <dd>{customer.phone ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Cliente desde</dt>
              <dd>{dateFormat.format(customer.createdAt)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">Total gasto</dt>
              <dd>{formatBRL(customer.totalSpent)}</dd>
            </div>
          </dl>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Histórico de compras ({customer.orders.length})
          </p>
          {customer.orders.length === 0 ? (
            <p className="mt-4 text-sm text-muted-foreground">Nenhum pedido ainda.</p>
          ) : (
            <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
              {customer.orders.map((o) => (
                <li key={o.id} className="flex items-center justify-between gap-4 py-3">
                  <div>
                    <Link
                      href={`/admin/pedidos/${o.id}`}
                      className="font-mono underline-offset-4 hover:underline"
                    >
                      #{o.id.slice(-8).toUpperCase()}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {dateFormat.format(o.createdAt)} · {o._count.items}{" "}
                      {o._count.items === 1 ? "item" : "itens"} ·{" "}
                      {ORDER_STATUS_LABEL[o.status] ?? o.status}
                    </p>
                  </div>
                  <span>{formatBRL(Number(o.totalAmount))}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
