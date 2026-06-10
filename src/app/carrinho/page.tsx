import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCartWithItems } from "@/lib/cart";
import { formatBRL } from "@/lib/format";
import { CartItemRow } from "@/components/cart/cart-item-row";

export const metadata = {
  title: "Sacola",
};

export default async function CarrinhoPage() {
  const session = await auth();
  if (!session?.user) {
    redirect("/login");
  }

  const cart = await getActiveCartWithItems(session.user.id);
  const items = cart?.items ?? [];

  const subtotal = items.reduce(
    (sum, i) => sum + Number(i.unitPrice) * i.quantity,
    0,
  );

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
              <div className="mt-2 flex items-baseline justify-between">
                <span className="text-sm text-muted-foreground">Frete</span>
                <span className="text-sm text-muted-foreground">
                  Calculado no checkout
                </span>
              </div>
              <div className="mt-6 flex items-baseline justify-between border-t border-border pt-4">
                <span className="text-xs font-semibold uppercase tracking-[0.15em]">
                  Total
                </span>
                <span className="text-lg font-semibold">
                  {formatBRL(subtotal)}
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
