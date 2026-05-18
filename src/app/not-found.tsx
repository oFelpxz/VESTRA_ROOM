import Link from "next/link";

export default function NotFound() {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Erro 404
      </p>
      <h1 className="font-heading mt-3 text-5xl font-bold uppercase tracking-tight md:text-7xl">
        Página não encontrada
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        A peça que você procura saiu do provador. Volte e explore a coleção.
      </p>
      <div className="mt-10 flex flex-col gap-3 sm:flex-row">
        <Link
          href="/"
          className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          Voltar ao início
        </Link>
        <Link
          href="/catalogo"
          className="inline-flex h-12 items-center justify-center rounded-sm border border-foreground/20 px-8 text-xs font-semibold uppercase tracking-[0.15em] transition-colors hover:bg-secondary"
        >
          Ver catálogo
        </Link>
      </div>
    </section>
  );
}
