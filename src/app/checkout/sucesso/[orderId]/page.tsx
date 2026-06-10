import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getOrderById } from "@/lib/order-actions";
import { formatBRL } from "@/lib/format";
import { PaymentStatusPoller } from "@/components/checkout/payment-status-poller";

export const metadata = { title: "Pedido confirmado" };

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CREDIT_CARD: "Cartão de crédito",
  DEBIT_CARD: "Débito",
  BOLETO: "Boleto",
};

export default async function CheckoutSucessoPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const { orderId } = await params;
  const order = await getOrderById(orderId);
  if (!order) notFound();

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA ROOM
      </p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase tracking-tight md:text-5xl">
        Pedido enviado
      </h1>
      <p className="mt-3 max-w-lg text-sm text-muted-foreground">
        Recebemos seu pedido <strong className="font-mono text-foreground">#{order.id.slice(-8).toUpperCase()}</strong>{" "}
        e estamos aguardando a confirmação do pagamento.
      </p>

      <div className="mt-8">
        <PaymentStatusPoller
          orderId={order.id}
          initial={{
            orderStatus: order.status,
            paymentStatus: order.payment?.status ?? null,
          }}
        />
      </div>

      <div className="mt-10 grid gap-8 md:grid-cols-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Resumo
          </p>
          <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
            <li className="flex items-baseline justify-between py-3">
              <span className="text-muted-foreground">Subtotal</span>
              <span>
                {formatBRL(
                  Number(order.totalAmount) - Number(order.shippingAmount),
                )}
              </span>
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

        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            Pagamento
          </p>
          <div className="mt-4 rounded-sm border border-border p-5 text-sm">
            <p className="font-medium">
              {METHOD_LABEL[order.payment?.method ?? ""] ?? "—"}
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Provedor: {order.payment?.provider ?? "—"}
            </p>
          </div>

          {order.shippingAddress && (
            <>
              <p className="mt-6 text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Entrega
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
                  {order.shippingAddress.city} · {order.shippingAddress.state}
                </p>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="mt-10">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Itens
        </p>
        <ul className="mt-4 divide-y divide-border border-y border-border">
          {order.items.map((i) => (
            <li
              key={i.id}
              className="flex items-center justify-between py-3 text-sm"
            >
              <div>
                <p className="font-medium">{i.productName}</p>
                <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {i.color} · Tam {i.size} · {i.quantity}x
                </p>
              </div>
              <p>{formatBRL(Number(i.totalPrice))}</p>
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-10 flex flex-wrap gap-3">
        <Link
          href="/perfil/pedidos"
          className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Ver meus pedidos
        </Link>
        <Link
          href="/catalogo"
          className="inline-flex h-12 items-center justify-center rounded-sm border border-border px-6 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:border-foreground"
        >
          Continuar comprando
        </Link>
      </div>
    </section>
  );
}
