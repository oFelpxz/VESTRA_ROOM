import { ProductCard } from "@/components/product/product-card";
import { getProducts } from "@/lib/products";

export default async function LookbookPage() {
  const products = await getProducts();

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Lookbook
      </p>
      <h1 className="font-heading mt-3 text-4xl font-bold uppercase tracking-tight md:text-6xl">
        VESTRA ROOM
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Em breve: editoriais e looks completos. Por enquanto, explore as peças.
      </p>

      <div className="mt-12 grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
        {products.map((p) => (
          <ProductCard key={p.id} {...p} />
        ))}
      </div>
    </section>
  );
}
