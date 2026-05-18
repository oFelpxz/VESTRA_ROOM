"use client";

export default function Error({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-2xl flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Algo deu errado
      </p>
      <h1 className="font-heading mt-3 text-5xl font-bold uppercase tracking-tight md:text-7xl">
        Erro inesperado
      </h1>
      <p className="mt-4 max-w-md text-muted-foreground">
        Tivemos um problema ao carregar esta página. Tente novamente.
      </p>
      <button
        type="button"
        onClick={() => reset()}
        className="mt-10 inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
      >
        Tentar de novo
      </button>
    </section>
  );
}
