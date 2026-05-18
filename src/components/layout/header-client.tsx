"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ShoppingBag, User, LogOut } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";
import { MobileMenu } from "@/components/layout/mobile-menu";
import { Logo } from "@/components/layout/logo";

const navItems = [
  { label: "Shop", href: "/catalogo" },
  { label: "VESTRA FIT", href: "/teste-3d" },
  { label: "Lookbook", href: "/lookbook" },
  { label: "Sobre", href: "/sobre" },
];

export function HeaderClient({
  isLoggedIn,
  isAdmin,
}: {
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 16);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 transition-all duration-300 ${
        scrolled
          ? "border-b border-border/60 bg-background/80 backdrop-blur"
          : "border-b border-transparent bg-transparent"
      }`}
    >
      <div
        className={`mx-auto flex max-w-7xl items-center justify-between px-4 transition-all duration-300 md:px-6 ${
          scrolled ? "h-16" : "h-20"
        }`}
      >
        <Logo />

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
            className="hidden text-foreground/80 transition-colors hover:text-foreground md:block"
          >
            <User className="size-5" strokeWidth={1.5} />
          </Link>

          {isLoggedIn && (
            <form action={logoutAction} className="hidden md:flex">
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

          <MobileMenu
            navItems={navItems}
            isLoggedIn={isLoggedIn}
            isAdmin={isAdmin}
          />
        </div>
      </div>
    </header>
  );
}
