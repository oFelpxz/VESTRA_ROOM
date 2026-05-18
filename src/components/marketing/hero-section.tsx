import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative overflow-hidden bg-background">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-36">
        <p className="mb-6 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          <span className="inline-block size-1.5 rounded-full bg-acid" />
          VESTRA FIT · Provador virtual 3D
        </p>

        <h1 className="font-heading text-5xl font-bold uppercase leading-[0.95] tracking-tight md:text-8xl">
          Vista antes
          <br />
          de comprar.
        </h1>

        <p className="mt-8 max-w-xl text-base text-muted-foreground md:text-lg">
          Uma experiência de moda digital com peças em 3D, medidas inteligentes
          e provador virtual.
        </p>

        <div className="mt-10 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/catalogo"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
          >
            Explorar coleção
          </Link>
          <Link
            href="/teste-3d"
            className="inline-flex h-12 items-center justify-center rounded-sm border border-foreground/20 px-8 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-secondary"
          >
            Ver VESTRA FIT
          </Link>
        </div>
      </div>
    </section>
  );
}
