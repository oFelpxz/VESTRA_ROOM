import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getActiveCartWithItems } from "@/lib/cart";
import { formatBRL, formatCep } from "@/lib/format";
import { normalizePostalCode, quoteShippingOptions } from "@/lib/shipping";
import { evaluateCoupon, toCouponLike } from "@/lib/coupons";
import { CartItemRow } from "@/components/cart/cart-item-row";
import { ShippingEstimator } from "@/components/cart/shipping-estimator";
import { CouponField } from "@/components/cart/coupon-field";

export const metadata = {
  title: "Sacola",
};

export default async function CarrinhoPage({
  searchParams,
}: {
  searchParams: Promise<{ cep?: string | string[] }>;
}) {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  // Parâmetro repetido na URL (?cep=1&cep=2) chega como lista — só texto vale.
  const { cep: rawCep } = await searchParams;
  const cepParam = typeof rawCep === "string" ? rawCep : undefined;

  const cart = await getActiveCartWithItems(session.user.id);
  const items = cart?.items ?? [];

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  );
  const itemCount = items.reduce((s, i) => s + i.quantity, 0);

  // CEP digitado tem prioridade; sem ele, usa o do endereço padrão.
  let cepInput = cepParam ?? "";
  let cepError: string | null = null;
  if (cepParam === undefined) {
    const defaultAddress = await prisma.address.findFirst({
      where: { userId: session.user.id },
      orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
      select: { postalCode: true },
    });
    cepInput = defaultAddress ? formatCep(defaultAddress.postalCode) : "";
  } else if (!normalizePostalCode(cepParam)) {
    cepError = "CEP inválido. Digite os 8 números.";
  }
  const cep = normalizePostalCode(cepInput);

  const shippingOptions = cep
    ? quoteShippingOptions({ subtotal, itemCount, postalCode: cep })
    : [];
  const selectedMethod = cart?.shippingMethod ?? "ECONOMICO";
  const selectedShipping = shippingOptions.find(
    (o) => o.method === selectedMethod,
  );

  // Cupom aplicado é reavaliado a cada visita: se deixou de valer, fica
  // listado com o motivo e sem desconto.
  const couponEvaluation = cart?.coupon
    ? evaluateCoupon(toCouponLike(cart.coupon), subtotal)
    : null;
  const discount = couponEvaluation?.ok ? couponEvaluation.discount : 0;

  const total = subtotal - discount + (selectedShipping?.amount ?? 0);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA ROOM
      </p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase tracking-tight md:text-5xl">
        Sacola
      </h1>

      {items.length === 0 ? (
        <div className="mt-12 flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            Sua sacola está vazia.
          </p>
          <Link
            href="/catalogo"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
          >
            Explorar coleção
          </Link>
        </div>
      ) : (
        <div className="mt-10 grid gap-10 lg:grid-cols-[1fr_320px]">
          {/* itens */}
          <ul className="divide-y divide-border border-y border-border">
            {items.map((item) => {
              const variant = item.productVariant;
              const product = variant.product;
              const lineTotal = Number(item.unitPrice) * item.quantity;

              return (
                <li
                  key={item.id}
                  className="flex flex-col gap-4 py-6 sm:flex-row sm:gap-6"
                >
                  <div className="aspect-square w-28 shrink-0 bg-secondary" />

                  <div className="flex flex-1 flex-col gap-2">
                    <Link
                      href={`/produto/${product.slug}`}
                      className="font-heading text-sm font-semibold uppercase tracking-wide"
                    >
                      {product.name}
                    </Link>
                    <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      {variant.color} · Tam {variant.size}
                    </p>
                    <p className="text-sm">
                      {formatBRL(Number(item.unitPrice))}
                    </p>

                    <div className="mt-2">
                      <CartItemRow
                        cartItemId={item.id}
                        quantity={item.quantity}
                        maxStock={variant.stockQuantity}
                      />
                    </div>
                  </div>

                  <div className="text-right text-sm font-medium sm:min-w-24">
                    {formatBRL(lineTotal)}
                  </div>
                </li>
              );
            })}
          </ul>

          {/* resumo */}
          <aside className="lg:sticky lg:top-24 lg:h-fit">
            <div className="border border-border p-6">
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Resumo
              </p>
              <div className="mt-4 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="text-sm">{formatBRL(subtotal)}</span>
              </div>
              {discount > 0 && cart?.coupon && (
                <div className="mt-2 flex items-baseline justify-between">
                  <span className="text-sm text-muted-foreground">
                    Desconto · {cart.coupon.code}
                  </span>
                  <span className="text-sm">− {formatBRL(discount)}</span>
                </div>
              )}
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">
                  Frete
                  {selectedShipping && ` · ${selectedShipping.label}`}
                </span>
                <span
                  className={`text-sm ${selectedShipping ? "" : "text-muted-foreground"}`}
                >
                  {!selectedShipping
                    ? "Informe o CEP"
                    : selectedShipping.free
                      ? "Grátis"
                      : formatBRL(selectedShipping.amount)}
                </span>
              </div>

              <ShippingEstimator
                cepInput={cepInput}
                cep={cep}
                error={cepError}
                options={shippingOptions}
                selected={selectedMethod}
              />

              <CouponField
                applied={
                  cart?.coupon
                    ? {
                        code: cart.coupon.code,
                        warning:
                          couponEvaluation && !couponEvaluation.ok
                            ? couponEvaluation.message
                            : null,
                      }
                    : null
                }
              />

              <div className="mt-6 flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  {selectedShipping ? "Total" : "Total sem frete"}
                </span>
                <span className="text-lg font-semibold">
                  {formatBRL(total)}
                </span>
              </div>

              <Link
                href="/checkout"
                className="mt-6 inline-flex h-12 w-full items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Ir para checkout
              </Link>
              <Link
                href="/catalogo"
                className="mt-2 inline-flex h-12 w-full items-center justify-center text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
              >
                Continuar comprando
              </Link>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
}
