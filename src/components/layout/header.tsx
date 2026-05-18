import Link from "next/link";
import { ShoppingBag, User, LogOut } from "lucide-react";
import { auth } from "@/auth";
import { logoutAction } from "@/lib/auth-actions";

const navItems = [
  { label: "Shop", href: "/catalogo" },
  { label: "VESTRA FIT", href: "/teste-3d" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "Sobre", href: "/sobre" },
];

export async function Header() {
  const session = await auth();
  const isLoggedIn = !!session?.user;
  const isAdmin = session?.user?.role === "ADMIN";

  return (
    <header className="sticky top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 md:px-6">
        <Link
          href="/"
          className="font-heading text-lg font-bold uppercase tracking-[0.2em]"
        >
          VESTRA ROOM
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
          {isAdmin && (
            <Link
              href="/admin"
              className="text-xs font-medium uppercase tracking-[0.15em] text-acid transition-opacity hover:opacity-80"
            >
              Admin
            </Link>
          )}
        </nav>

        <div className="flex items-center gap-4">
          <Link
            href={isLoggedIn ? "/perfil" : "/login"}
            aria-label={isLoggedIn ? "Perfil" : "Entrar"}
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            <User className="size-5" strokeWidth={1.5} />
          </Link>

          {isLoggedIn && (
            <form action={logoutAction} className="flex">
              <button
                type="submit"
                aria-label="Sair"
                className="text-foreground/80 transition-colors hover:text-foreground"
              >
                <LogOut className="size-5" strokeWidth={1.5} />
              </button>
            </form>
          )}

          <button
            type="button"
            aria-label="Sacola"
            className="text-foreground/80 transition-colors hover:text-foreground"
          >
            <ShoppingBag className="size-5" strokeWidth={1.5} />
          </button>
        </div>
      </div>
    </header>
  );
}
