import Link from "next/link";
import { notFound } from "next/navigation";
import { getOrderById } from "@/lib/order-actions";
import { formatBRL } from "@/lib/format";
import { OrderTimeline } from "@/components/profile/order-timeline";
import { OrderStatusActions } from "@/components/admin/order-status-actions";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Débito",
  BOLETO: "Boleto",
};

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

export default async function AdminPedidoDetalhePage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();

  const subtotal = Number(order.totalAmount) - Number(order.shippingAmount);

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Link
            href="/admin/pedidos"
            className="underline-offset-4 hover:underline"
          >
            Pedidos
          </Link>{" "}
          / #{order.id.slice(-8).toUpperCase()}
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-4xl">
                #{order.id.slice(-8).toUpperCase()}
              </h1>
              <span
                className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${
                  STATUS_STYLE[order.status]
                }`}
              >
                {STATUS_LABEL[order.status]}
              </span>
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              {order.createdAt.toLocaleString("pt-BR", {
                dateStyle: "long",
                timeStyle: "short",
              })}
            </p>
          </div>
        </div>
      </div>

      {/* Timeline */}
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Status
        </p>
        <div className="mt-4">
          <OrderTimeline status={order.status as never} />
        </div>
      </div>

      {/* Grid principal */}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div className="flex flex-col gap-10">
          {/* Cliente */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Cliente
            </p>
            <div className="mt-4 rounded-sm border border-border p-5 text-sm">
              <p className="font-medium">{order.user.name}</p>
              <p className="mt-1 font-mono text-xs text-muted-foreground">
                {order.user.email}
              </p>
            </div>
          </div>

          {/* Itens */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Itens ({order.items.length})
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

          {/* Endereço */}
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
                {order.shippingAddress.phone && (
                  <p className="mt-1 text-muted-foreground">
                    Tel: {order.shippingAddress.phone}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Valores */}
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
        </div>

        {/* Coluna lateral: ações + pagamento + rastreio */}
        <div className="flex flex-col gap-8">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              Ações
            </p>
            <div className="mt-4">
              <OrderStatusActions
                orderId={order.id}
                status={order.status as never}
                trackingCode={order.trackingCode}
              />
            </div>
          </div>

          {order.payment && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Pagamento
              </p>
              <div className="mt-4 rounded-sm border border-border p-5 text-sm">
                <p className="font-medium">
                  {METHOD_LABEL[order.payment.method] ?? order.payment.method}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Status: {order.payment.status} · {order.payment.provider}
                </p>
                {order.payment.paidAt && (
                  <p className="mt-1 text-xs text-muted-foreground">
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

          {order.trackingCode && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Rastreio
              </p>
              <div className="mt-4 rounded-sm border border-border p-5">
                <code className="font-mono text-sm">{order.trackingCode}</code>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function formatCep(cep: string) {
  const clean = cep.replace(/\D/g, "");
  if (clean.length !== 8) return cep;
  return `${clean.slice(0, 5)}-${clean.slice(5)}`;
}
