import Link from "next/link";
import { HeroSection } from "@/components/marketing/hero-section";
import { VestraFitSection } from "@/components/marketing/vestra-fit-section";
import { CtaSection } from "@/components/marketing/cta-section";
import { ProductCard } from "@/components/product/product-card";
import { getProducts } from "@/lib/products";

export default async function Home() {
  const featured = (await getProducts()).slice(0, 4);

  return (
    <>
      <HeroSection />

      <section className="mx-auto max-w-7xl px-4 py-24 md:px-6">
        <div className="mb-12 flex items-end justify-between">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
              Coleção
            </p>
            <h2 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
              Em destaque
            </h2>
          </div>
          <Link
            href="/catalogo"
            className="hidden text-xs font-semibold uppercase tracking-[0.15em] text-foreground underline-offset-4 hover:underline sm:block"
          >
            Ver tudo
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-4">
          {featured.map((p) => (
            <ProductCard key={p.id} {...p} />
          ))}
        </div>
      </section>

      <VestraFitSection />
      <CtaSection />
    </>
  );
}
