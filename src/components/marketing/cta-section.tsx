import Link from "next/link";

export function CtaSection() {
  return (
    <section className="bg-secondary">
      <div className="mx-auto max-w-7xl px-4 py-24 text-center md:px-6 md:py-32">
        <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold uppercase leading-tight tracking-tight md:text-6xl">
          Entre no seu espaço de prova digital.
        </h2>
        <p className="mx-auto mt-6 max-w-lg text-muted-foreground">
          Seu caimento. Sua medida. Sua escolha.
        </p>
        <Link
          href="/catalogo"
          className="mt-10 inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-10 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Explorar coleção
        </Link>
      </div>
    </section>
  );
}
