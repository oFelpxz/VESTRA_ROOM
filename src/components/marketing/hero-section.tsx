import Image from "next/image";
import Link from "next/link";

export function HeroSection() {
  return (
    <section className="relative h-[100svh] min-h-[600px] w-full overflow-hidden">
      <Image
        src="/images/hero-photo.jpg"
        alt="VESTRA ROOM"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/55" />

      <div className="absolute inset-0 mx-auto flex max-w-7xl flex-col justify-between px-4 py-7 md:px-8 md:py-10">
        {/* topo: marca + meta (estilo estúdio/agência) */}
        <div className="flex items-start justify-between text-[10px] font-medium uppercase tracking-[0.3em] text-white/70">
          <span>VESTRA ROOM</span>
          <span className="hidden sm:block text-right">
            Provador virtual 3D
            <br />
            Est. 2026
          </span>
        </div>

        {/* declaração central */}
        <div className="max-w-4xl">
          <p className="mb-6 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.35em] text-white/70">
            <span className="inline-block size-1 rounded-full bg-acid" />
            Moda digital · 3D · VESTRA FIT
          </p>
          <h1 className="font-heading text-[13vw] font-bold uppercase leading-[0.85] tracking-tight text-white sm:text-7xl md:text-8xl">
            Vista antes
            <br />
            de comprar
          </h1>

          <div className="mt-10 flex flex-wrap items-center gap-x-8 gap-y-3">
            <Link
              href="/catalogo"
              className="group inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white"
            >
              Explorar coleção
              <span className="inline-block h-px w-10 bg-white transition-all duration-300 group-hover:w-16" />
            </Link>
            <Link
              href="/teste-3d"
              className="group inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em] text-white/70 transition-colors hover:text-white"
            >
              Ver VESTRA FIT
              <span className="inline-block h-px w-10 bg-white/60 transition-all duration-300 group-hover:w-16" />
            </Link>
          </div>
        </div>

        {/* rodapé: indicador de scroll */}
        <div className="flex items-center justify-between text-[10px] font-medium uppercase tracking-[0.3em] text-white/60">
          <span>Role para explorar</span>
          <span className="hidden sm:block">(01 — 04)</span>
        </div>
      </div>
    </section>
  );
}
