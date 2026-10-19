import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById, cancelOrderAction } from "@/lib/order-actions";
import { canCustomerCancel } from "@/lib/order-cancel";
import { formatBRL, formatCep } from "@/lib/format";
import { orderShippingLabel } from "@/lib/shipping";
import { OrderTimeline } from "@/components/profile/order-timeline";
import { OrderRefresh } from "@/components/profile/order-refresh";
import { PaymentDetails } from "@/components/checkout/payment-details";
import { syncOrderPayment } from "@/lib/payments";
import { prisma } from "@/lib/prisma";
import {
  availableToReturn,
  openReasons,
  STATUS_LABEL,
  type ReturnStatus,
} from "@/lib/returns";
import { getStoreSettings } from "@/lib/store-settings-db";

export default async function PedidoDetalhePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const { orderId } = await params;
  let order = await getOrderById(orderId);
  if (!order) notFound();
  // Reconciliação com o Stripe: pagamento ainda pendente é conferido lá
  // (no máximo a cada 10 s) antes de mostrar.
  if (order.payment?.provider === "STRIPE" && order.payment.status === "PENDING") {
    await syncOrderPayment(orderId);
    order = (await getOrderById(orderId)) ?? order;
  }

  const subtotal =
    Number(order.totalAmount) -
    Number(order.shippingAmount) +
    Number(order.discountAmount);
  const canCancel = canCustomerCancel(order.status);

  // Itens 21: trocas e devoluções deste pedido.
  const [settings, returns] = await Promise.all([
    getStoreSettings(),
    prisma.returnRequest.findMany({
      where: { orderId: order.id },
      orderBy: { createdAt: "desc" },
      select: { id: true, orderItemId: true, quantity: true, status: true, kind: true },
    }),
  ]);
  const canReturn =
    order.status === "DELIVERED" &&
    openReasons(order.deliveredAt, new Date(), settings).length > 0;

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
              <div className="flex flex-col items-end gap-1">
                <p className="text-sm">{formatBRL(Number(i.totalPrice))}</p>
                {canReturn &&
                  availableToReturn(
                    i.quantity,
                    returns
                      .filter((r) => r.orderItemId === i.id)
                      .map((r) => ({ ...r, status: r.status as ReturnStatus })),
                  ) > 0 && (
                    <Link
                      href={`/perfil/pedidos/${order.id}/troca/${i.id}`}
                      className="text-xs font-medium uppercase tracking-wide text-foreground/70 underline-offset-4 hover:text-foreground hover:underline"
                    >
                      Trocar ou devolver
                    </Link>
                  )}
              </div>
            </li>
          ))}
        </ul>
        {order.status === "DELIVERED" && !canReturn && returns.length === 0 && (
          <p className="mt-3 text-xs text-muted-foreground">
            O prazo de troca deste pedido terminou. Veja a{" "}
            <Link href="/trocas" className="underline hover:text-foreground">
              política de trocas
            </Link>
            .
          </p>
        )}
      </div>

      {returns.length > 0 && (
        <div className="mt-12">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Trocas e devoluções
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border">
            {returns.map((r) => {
              const item = order.items.find((i) => i.id === r.orderItemId);
              return (
                <li key={r.id} className="flex items-center justify-between gap-3 py-3 text-sm">
                  <span>
                    {r.kind === "EXCHANGE" ? "Troca" : "Devolução"} · {item?.productName} ·{" "}
                    {r.quantity}x
                  </span>
                  <Link
                    href={`/perfil/trocas/${r.id}`}
                    className="text-xs font-medium uppercase tracking-wide underline-offset-4 hover:underline"
                  >
                    {STATUS_LABEL[r.status as ReturnStatus]} →
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      )}

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
            {Number(order.discountAmount) > 0 && (
              <li className="flex items-baseline justify-between py-3">
                <span className="text-muted-foreground">
                  Desconto{order.coupon && ` · ${order.coupon.code}`}
                </span>
                <span>− {formatBRL(Number(order.discountAmount))}</span>
              </li>
            )}
            <li className="flex items-baseline justify-between py-3">
              <span className="text-muted-foreground">
                Frete · {orderShippingLabel(order)}
              </span>
              <span>
                {Number(order.shippingAmount) === 0
                  ? "Grátis"
                  : formatBRL(Number(order.shippingAmount))}
              </span>
            </li>
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
              <div className="mt-4">
                <PaymentDetails payment={order.payment} orderStatus={order.status} />
              </div>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
