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
    <footer className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
        <div className="flex flex-col gap-10 md:flex-row md:justify-between">
          <div className="max-w-sm">
            <p className="font-heading text-2xl font-bold uppercase tracking-[0.2em]">
              VESTRA ROOM
            </p>
            <p className="mt-4 text-sm text-background/60">
              Vista antes de comprar. Uma experiência de moda digital com peças
              em 3D e provador virtual.
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
          <p>© {new Date().getFullYear()} VESTRA ROOM. Todos os direitos reservados.</p>
          <p>Provador virtual 3D — VESTRA FIT</p>
        </div>
      </div>
    </footer>
  );
}
