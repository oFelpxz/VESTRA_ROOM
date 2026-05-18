import Link from "next/link";

function FooterCol({
  title,
  links,
}: {
  title: string;
  links: [string, string][];
}) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-[0.15em] text-background/40">
        {title}
      </p>
      <ul className="mt-4 space-y-2">
        {links.map(([label, href]) => (
          <li key={href}>
            <Link
              href={href}
              className="text-sm text-background/70 transition-colors hover:text-background"
            >
              {label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function Footer() {
  return (
    <footer className="overflow-hidden bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-acid">
              <span className="inline-block size-1.5 rounded-full bg-acid" />
              Provador virtual 3D
            </p>
            <p className="mt-4 text-sm text-background/60">
              Vista antes de comprar. Uma experiência de moda digital com peças
              em 3D e provador virtual VESTRA FIT.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-10 text-sm sm:grid-cols-3">
            <FooterCol
              title="Loja"
              links={[
                ["Shop", "/catalogo"],
                ["VESTRA FIT", "/teste-3d"],
                ["Lookbook", "/lookbook"],
              ]}
            />
            <FooterCol
              title="Conta"
              links={[
                ["Entrar", "/login"],
                ["Cadastrar", "/cadastro"],
                ["Perfil", "/perfil"],
              ]}
            />
            <FooterCol title="Marca" links={[["Sobre", "/sobre"]]} />
          </div>
        </div>

        <div className="mt-16 flex flex-col gap-2 border-t border-background/15 pt-6 text-xs text-background/50 md:flex-row md:justify-between">
          <p>
            © {new Date().getFullYear()} VESTRA ROOM. Todos os direitos
            reservados.
          </p>
          <p>Seu caimento · sua medida · sua escolha</p>
        </div>
      </div>

      {/* wordmark monumental */}
      <div
        className="select-none px-2 pb-2"
        aria-hidden="true"
      >
        <p className="font-heading font-bold uppercase leading-[0.78] tracking-tighter text-background/[0.06] [font-size:23vw]">
          VESTRA ROOM
        </p>
      </div>
    </footer>
  );
}
