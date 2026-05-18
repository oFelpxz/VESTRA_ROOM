import Image from "next/image";
import Link from "next/link";

export function CtaSection() {
  return (
    <section className="relative h-[78vh] min-h-[480px] w-full overflow-hidden">
      <Image
        src="/images/red-place-girl.jpg"
        alt="VESTRA ROOM — provador virtual"
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/45" />

      <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col items-center justify-center px-4 text-center md:px-6">
        <h2 className="font-heading mx-auto max-w-3xl text-4xl font-bold uppercase leading-tight tracking-tight text-white md:text-6xl">
          Entre no seu espaço de prova digital.
        </h2>
        <p className="mx-auto mt-5 max-w-lg text-sm text-white/70 md:text-base">
          Seu caimento · sua medida · sua escolha.
        </p>
        <Link
          href="/catalogo"
          className="mt-9 inline-flex h-12 items-center justify-center rounded-sm bg-white px-10 text-xs font-semibold uppercase tracking-[0.15em] text-black transition-opacity hover:opacity-90"
        >
          Explorar coleção
        </Link>
      </div>
    </section>
  );
}
