import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { formatBRL } from "@/lib/format";
import { getFavoritesWithProducts } from "@/lib/favorites";
import { FavoriteButton } from "@/components/product/favorite-button";
import { FavoriteQuickAdd } from "@/components/product/favorite-quick-add";
import { ProductPlaceholder } from "@/components/product/product-placeholder";

export const metadata = { title: "Favoritos" };

export default async function FavoritosPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const favorites = await getFavoritesWithProducts(session.user.id);

  return (
    <section className="mx-auto max-w-5xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA ROOM
      </p>
      <h1 className="font-heading mt-2 text-4xl font-bold uppercase tracking-tight md:text-5xl">
        Favoritos
      </h1>

      {favorites.length === 0 ? (
        <div className="mt-12 flex flex-col items-start gap-4">
          <p className="text-muted-foreground">
            Você ainda não favoritou nenhuma peça. Toque no coração de um
            produto para guardá-lo aqui.
          </p>
          <Link
            href="/catalogo"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
          >
            Explorar coleção
          </Link>
        </div>
      ) : (
        <ul className="mt-10 divide-y divide-border border-y border-border">
          {favorites.map(({ product }) => {
            const available = product.status === "ACTIVE";
            const price = Number(product.promotionalPrice ?? product.basePrice);
            const imageUrl = product.images[0]?.url;

            return (
              <li
                key={product.id}
                className="flex flex-col gap-4 py-6 sm:flex-row sm:gap-6"
              >
                <Link
                  href={`/produto/${product.slug}`}
                  className="relative aspect-square w-28 shrink-0 overflow-hidden bg-secondary"
                >
                  {imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={imageUrl} alt={product.name} className="h-full w-full object-cover" />
                  ) : (
                    <ProductPlaceholder />
                  )}
                </Link>

                <div className="flex flex-1 flex-col gap-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <Link
                        href={`/produto/${product.slug}`}
                        className="font-heading text-sm font-semibold uppercase tracking-wide"
                      >
                        {product.name}
                      </Link>
                      <p className="mt-1 text-sm">{formatBRL(price)}</p>
                    </div>
                    <FavoriteButton
                      productId={product.id}
                      isFavorite
                      isLoggedIn
                      className="text-foreground/70 hover:text-foreground"
                    />
                  </div>

                  <div className="mt-2 max-w-sm">
                    {available ? (
                      <FavoriteQuickAdd variants={product.variants} />
                    ) : (
                      <p className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                        Indisponível no momento
                      </p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
