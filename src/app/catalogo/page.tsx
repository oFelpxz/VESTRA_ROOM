import Link from "next/link";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";
import { ProductCard } from "@/components/product/product-card";
import {
  getProducts,
  getCategories,
  getFilterOptions,
  PRICE_OPTIONS,
  type ProductFilters as Filters,
} from "@/lib/products";

type Current = Record<string, string | undefined>;

function hrefWith(current: Current, key: string, value: string) {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(current)) if (v) params.set(k, v);
  if (current[key] === value) params.delete(key);
  else params.set(key, value);
  const qs = params.toString();
  return qs ? `/catalogo?${qs}` : "/catalogo";
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string;
  active?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground"
          : "flex items-center gap-2 text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-foreground"
      }
    >
      {active && <span className="size-1 rounded-full bg-acid" />}
      {children}
    </Link>
  );
}

function Section({
  index,
  title,
  children,
}: {
  index: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.15em]">
        <span className="text-muted-foreground">|{index}|</span> {title}
      </p>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

export default async function CatalogoPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const current: Current = {
    categoria: typeof sp.categoria === "string" ? sp.categoria : undefined,
    tamanho: typeof sp.tamanho === "string" ? sp.tamanho : undefined,
    cor: typeof sp.cor === "string" ? sp.cor : undefined,
    preco: typeof sp.preco === "string" ? sp.preco : undefined,
  };
  const filters: Filters = current;

  const [session, products, categories, { sizes, colors }] =
    await Promise.all([
      auth(),
      getProducts(filters),
      getCategories(),
      getFilterOptions(),
    ]);

  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <div className="min-h-screen px-5 py-6 md:px-8">
      {/* topo: marca + ações */}
      <div className="flex items-start justify-between border-b border-border pb-5">
        <Link
          href="/"
          className="font-heading text-lg font-bold uppercase tracking-[0.2em]"
        >
          VESTRA ROOM
        </Link>
        <div className="flex items-center gap-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
          <span>Pesquisa</span>
          <span>Cesto 0</span>
          {isAdmin && (
            <Link
              href="/admin"
              className="font-semibold text-acid transition-opacity hover:opacity-80"
            >
              Admin
            </Link>
          )}
          {isLoggedIn ? (
            <>
              <Link href="/perfil" className="hover:text-foreground">
                Perfil
              </Link>
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="uppercase tracking-[0.2em] hover:text-foreground"
                >
                  Sair
                </button>
              </form>
            </>
          ) : (
            <>
              <Link href="/login" className="hover:text-foreground">
                Iniciar sessão
              </Link>
              <Link href="/cadastro" className="hover:text-foreground">
                Criar conta
              </Link>
            </>
          )}
          <Link href="/sobre" className="hover:text-foreground">
            Ajuda
          </Link>
        </div>
      </div>

      <div className="mt-8 lg:grid lg:grid-cols-[230px_1fr] lg:gap-12">
        {/* rail esquerda */}
        <aside className="lg:sticky lg:top-6 lg:h-fit">
          {/* grafismo decorativo */}
          <div className="mb-8 hidden lg:block">
            <div className="flex h-24 w-40 -skew-x-12 items-end bg-foreground p-3">
              <span className="skew-x-12 font-mono text-[10px] uppercase tracking-[0.2em] text-background/70">
                26 · 1 · 18
              </span>
            </div>
          </div>

          <div className="flex gap-8 overflow-x-auto pb-4 lg:flex-col lg:gap-10 lg:overflow-visible lg:pb-0">
            <Section index="00" title="Navegar">
              <NavLink href="/">Início</NavLink>
              <NavLink href="/teste-3d">VESTRA FIT</NavLink>
              <NavLink href="/lookbook">Lookbook</NavLink>
              <NavLink href="/sobre">Sobre</NavLink>
            </Section>

            <Section index="01" title="Coleção">
              <NavLink href="/catalogo" active={!current.categoria}>
                Ver tudo
              </NavLink>
              {categories.map((c) => (
                <NavLink
                  key={c.id}
                  href={hrefWith(current, "categoria", c.slug)}
                  active={current.categoria === c.slug}
                >
                  {c.name}
                </NavLink>
              ))}
            </Section>

            <Section index="02" title="Tamanho">
              {sizes.map((s) => (
                <NavLink
                  key={s}
                  href={hrefWith(current, "tamanho", s)}
                  active={current.tamanho === s}
                >
                  {s}
                </NavLink>
              ))}
            </Section>

            <Section index="03" title="Cor">
              {colors.map((c) => (
                <NavLink
                  key={c}
                  href={hrefWith(current, "cor", c)}
                  active={current.cor === c}
                >
                  {c}
                </NavLink>
              ))}
            </Section>

            <Section index="04" title="Preço">
              {PRICE_OPTIONS.map((p) => (
                <NavLink
                  key={p.value}
                  href={hrefWith(current, "preco", p.value)}
                  active={current.preco === p.value}
                >
                  {p.label}
                </NavLink>
              ))}
            </Section>
          </div>
        </aside>

        {/* grid */}
        <div className="mt-8 lg:mt-0">
          {products.length === 0 ? (
            <p className="py-24 text-center text-sm text-muted-foreground">
              Nenhuma peça encontrada com esses filtros.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-x-5 gap-y-12 md:grid-cols-3">
              {products.map((p) => (
                <ProductCard key={p.id} {...p} />
              ))}
            </div>
          )}

          <div className="mt-16 flex items-center justify-between border-t border-border pt-5 text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
            <span>
              {products.length} {products.length === 1 ? "peça" : "peças"}
            </span>
            <Link href="/catalogo" className="hover:text-foreground">
              Ver tudo
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
