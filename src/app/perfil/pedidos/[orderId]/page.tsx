import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, cancelOrderAction } from "@/lib/order-actions";
import { formatBRL, formatCep } from "@/lib/format";
import { OrderTimeline } from "@/components/profile/order-timeline";
import { OrderRefresh } from "@/components/profile/order-refresh";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Débito",
  BOLETO: "Boleto",
};

const PAYMENT_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  PAID: "bg-acid/30 text-foreground",
  FAILED: "bg-destructive/10 text-destructive",
  REFUNDED: "bg-destructive/10 text-destructive",
};

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();

  const subtotal = Number(order.totalAmount) - Number(order.shippingAmount);
  const canCancel = ["PENDING_PAYMENT", "PAID"].includes(order.status);

  return (
    <section className="mx-auto max-w-4xl px-4 py-12 md:px-6">
      <OrderRefresh status={order.status} />

      {/* Header */}
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link
          href="/perfil/pedidos"
          className="underline-offset-4 hover:underline"
        >
          Meus pedidos
        </Link>{" "}
        / #{order.id.slice(-8).toUpperCase()}
      </p>

      <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-4xl">
            Pedido #{order.id.slice(-8).toUpperCase()}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Feito em{" "}
            {order.createdAt.toLocaleString("pt-BR", {
              dateStyle: "long",
              timeStyle: "short",
            })}
          </p>
        </div>

        {canCancel && (
          <form action={cancelOrderAction}>
            <input type="hidden" name="orderId" value={order.id} />
            <button
              type="submit"
              className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
            >
              Cancelar pedido
            </button>
          </form>
        )}
      </div>

      {/* Timeline */}
      <div className="mt-8">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Status do pedido
        </p>
        <div className="mt-4">
          <OrderTimeline status={order.status} />
        </div>
        {order.trackingCode && (
          <p className="mt-4 text-sm">
            <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Código de rastreio:
            </span>{" "}
            <code className="font-mono text-foreground">
              {order.trackingCode}
            </code>
          </p>
        )}
      </div>

      {/* Itens */}
      <div className="mt-12">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Itens
        </p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {order.items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between py-4"
            >
              <div>
                <p className="text-sm font-medium">{i.productName}</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {i.color} · Tam {i.size} · {i.quantity}x ·{" "}
                  {formatBRL(Number(i.unitPrice))}
                </p>
              </div>
              <p className="text-sm">{formatBRL(Number(i.totalPrice))}</p>
            </li>
          ))}
        </ul>
      </div>

      {/* Resumo + endereço + pagamento */}
      <div className="mt-12 grid gap-10 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Valores
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
            <li className="flex items-baseline justify-between py-3">
              <span className="text-muted-foreground">Subtotal</span>
              <span>{formatBRL(subtotal)}</span>
            </li>
            <li className="flex items-baseline justify-between py-3">
              <span className="text-muted-foreground">Frete</span>
              <span>
                {Number(order.shippingAmount) === 0
                  ? "Grátis"
                  : formatBRL(Number(order.shippingAmount))}
              </span>
            </li>
            {Number(order.discountAmount) > 0 && (
              <li className="flex items-baseline justify-between py-3">
                <span className="text-muted-foreground">Desconto</span>
                <span>− {formatBRL(Number(order.discountAmount))}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between py-3">
              <span className="font-semibold uppercase tracking-wide">
                Total
              </span>
              <span className="font-heading text-lg font-bold">
                {formatBRL(Number(order.totalAmount))}
              </span>
            </li>
          </ul>
        </div>

        <div className="flex flex-col gap-8">
          {order.shippingAddress && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Endereço de entrega
              </p>
              <div className="mt-4 rounded-sm border border-border p-5 text-sm">
                <p className="font-medium">
                  {order.shippingAddress.recipient}
                </p>
                <p className="mt-1 text-muted-foreground">
                  {order.shippingAddress.line1}
                  {order.shippingAddress.line2
                    ? ` · ${order.shippingAddress.line2}`
                    : ""}
                </p>
                <p className="text-muted-foreground">
                  {order.shippingAddress.city} ·{" "}
                  {order.shippingAddress.state} · CEP{" "}
                  {formatCep(order.shippingAddress.postalCode)}
                </p>
              </div>
            </div>
          )}

          {order.payment && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Pagamento
              </p>
              <div className="mt-4 rounded-sm border border-border p-5 text-sm">
                <div className="flex items-center justify-between">
                  <p className="font-medium">
                    {METHOD_LABEL[order.payment.method] ?? order.payment.method}
                  </p>
                  <span
                    className={`rounded-sm px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] ${
                      PAYMENT_BADGE[order.payment.status]
                    }`}
                  >
                    {order.payment.status}
                  </span>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Provedor: {order.payment.provider}
                </p>
                {order.payment.paidAt && (
                  <p className="text-xs text-muted-foreground">
                    Pago em{" "}
                    {order.payment.paidAt.toLocaleString("pt-BR")}
                  </p>
                )}
                {order.payment.externalPaymentId && (
                  <p className="mt-1 font-mono text-[10px] text-muted-foreground">
                    ID: {order.payment.externalPaymentId}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
