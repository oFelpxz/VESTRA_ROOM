import Image from "next/image";
import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";

const announce = [
  "Vista antes de comprar",
  "Experimente em 3D",
  "Seu caimento · sua medida · sua escolha",
  "VESTRA FIT",
];

const baseMenu = [
  { label: "New In", href: "/catalogo" },
  { label: "Shop", href: "/catalogo" },
  { label: "VESTRA FIT", href: "/teste-3d" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "Sobre", href: "/sobre" },
];

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="flex h-[100svh] flex-col">
      {/* faixa superior */}
      <div className="overflow-hidden border-b border-border bg-background py-2">
        <div className="animate-marquee flex w-max">
          {[0, 1].map((k) => (
            <div key={k} className="flex shrink-0 items-center">
              {announce.map((p, i) => (
                <span
                  key={i}
                  className="flex items-center gap-6 whitespace-nowrap px-6 text-[10px] font-medium uppercase tracking-[0.25em]"
                >
                  {p}
                  <span className="size-1 rounded-full bg-acid" />
                </span>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* tela imersiva */}
      <div className="relative flex-1 overflow-hidden">
        <Image
          src="/images/hero-photo.jpg"
          alt="VESTRA ROOM"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/45 via-black/10 to-black/55" />

        {/* chrome sobreposto */}
        <div className="absolute inset-0 z-10 flex flex-col px-5 py-6 text-white md:px-10 md:py-8">
          {/* topo: estado da conta */}
          <div className="flex items-start justify-end gap-5 text-[10px] font-medium uppercase tracking-[0.25em] text-white/80">
            {isLoggedIn ? (
              <>
                <Link
                  href="/perfil"
                  className="transition-colors hover:text-white"
                >
                  Perfil
                </Link>
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="uppercase tracking-[0.25em] text-white/70 transition-colors hover:text-white"
                  >
                    Sair
                  </button>
                </form>
              </>
            ) : (
              <>
                <Link
                  href="/login"
                  className="transition-colors hover:text-white"
                >
                  Entrar
                </Link>
                <Link
                  href="/cadastro"
                  className="transition-colors hover:text-white"
                >
                  Cadastrar
                </Link>
              </>
            )}
            <span className="text-white/40">Sacola (0)</span>
          </div>

          {/* logo + menu vertical */}
          <div className="mt-8 flex flex-1 flex-col md:mt-12">
            <Link
              href="/"
              className="font-heading w-fit text-2xl font-bold uppercase leading-none tracking-[0.15em] md:text-4xl"
            >
              VESTRA ROOM
              <sup className="ml-1 align-super text-[0.4em] tracking-normal">
                ®
              </sup>
            </Link>

            <nav className="mt-8 flex flex-col gap-2 md:mt-10 md:gap-3">
              {baseMenu.map((item) => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="w-fit text-sm font-medium uppercase tracking-[0.2em] text-white/85 transition-colors hover:text-acid md:text-base"
                >
                  {item.label}
                </Link>
              ))}
              {isAdmin && (
                <Link
                  href="/admin"
                  className="w-fit text-sm font-semibold uppercase tracking-[0.2em] text-acid transition-opacity hover:opacity-80 md:text-base"
                >
                  Admin
                </Link>
              )}
            </nav>
          </div>

          {/* rodapé sobreposto */}
          <div className="mt-auto flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
            <form
              className="flex max-w-xs items-center border-b border-white/40 pb-1"
              aria-label="Newsletter"
            >
              <input
                type="email"
                placeholder="E-MAIL"
                className="w-full bg-transparent text-[11px] uppercase tracking-[0.2em] text-white placeholder:text-white/50 focus:outline-none"
              />
              <button
                type="submit"
                className="shrink-0 text-[11px] font-semibold uppercase tracking-[0.2em] text-white/80 transition-colors hover:text-white"
              >
                Assinar
              </button>
            </form>

            <div className="flex flex-wrap gap-x-5 gap-y-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/70">
              <Link href="/teste-3d" className="hover:text-white">
                VESTRA FIT
              </Link>
              <Link href="/lookbook" className="hover:text-white">
                Lookbook
              </Link>
              <Link href="/sobre" className="hover:text-white">
                Sobre
              </Link>
              <Link href="/catalogo" className="hover:text-white">
                Catálogo
              </Link>
            </div>
          </div>
        </div>

        {/* CTA central */}
        <Link
          href="/catalogo"
          className="absolute left-1/2 top-1/2 z-20 inline-flex -translate-x-1/2 -translate-y-1/2 items-center justify-center border border-white/60 bg-black/20 px-8 py-3 text-xs font-semibold uppercase tracking-[0.25em] text-white backdrop-blur-sm transition-colors hover:bg-white hover:text-black md:px-10"
        >
          Shop Now
        </Link>
      </div>
    </div>
  );
}
