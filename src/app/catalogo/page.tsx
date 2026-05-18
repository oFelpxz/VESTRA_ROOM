import { ProductCard } from "@/components/product/product-card";
import { ProductFilters } from "@/components/product/product-filters";
import {
  getProducts,
  getCategories,
  getFilterOptions,
  type ProductFilters as Filters,
} from "@/lib/products";

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;

  const filters: Filters = {
    categoria: typeof sp.categoria === "string" ? sp.categoria : undefined,
    tamanho: typeof sp.tamanho === "string" ? sp.tamanho : undefined,
    cor: typeof sp.cor === "string" ? sp.cor : undefined,
    preco: typeof sp.preco === "string" ? sp.preco : undefined,
  };

  const [products, categories, { sizes, colors }] = await Promise.all([
    getProducts(filters),
    getCategories(),
    getFilterOptions(),
  ]);

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <div className="mb-10">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          VESTRA ROOM
        </p>
        <h1 className="font-heading mt-2 text-4xl font-bold uppercase tracking-tight md:text-6xl">
          Shop
        </h1>
        <p className="mt-4 max-w-md text-muted-foreground">
          Roupas criadas para serem vistas em todos os ângulos.
        </p>
      </div>

      <ProductFilters
        categories={categories}
        sizes={sizes}
        colors={colors}
        current={filters}
      />

      <div className="mt-10">
        {products.length === 0 ? (
          <p className="py-20 text-center text-sm text-muted-foreground">
            Nenhum produto encontrado com esses filtros.
          </p>
        ) : (
          <>
            <p className="mb-6 text-xs uppercase tracking-[0.15em] text-muted-foreground">
              {products.length}{" "}
              {products.length === 1 ? "peça" : "peças"}
            </p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
              {products.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
