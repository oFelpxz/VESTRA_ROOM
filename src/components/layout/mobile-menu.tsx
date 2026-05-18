"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { logoutAction } from "@/lib/auth-actions";

type NavItem = { label: string; href: string };

export function MobileMenu({
  navItems,
  isLoggedIn,
  isAdmin,
}: {
  navItems: NavItem[];
  isLoggedIn: boolean;
  isAdmin: boolean;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Abrir menu"
        onClick={() => setOpen(true)}
        className="text-foreground/80 transition-colors hover:text-foreground"
      >
        <Menu className="size-5" strokeWidth={1.5} />
      </button>

      {open && (
        <div className="fixed inset-0 z-[60] flex flex-col bg-background">
          <div className="flex h-16 items-center justify-between border-b border-border px-4">
            <span className="font-heading text-lg font-bold uppercase tracking-[0.2em]">
              VESTRA ROOM
            </span>
            <button
              type="button"
              aria-label="Fechar menu"
              onClick={() => setOpen(false)}
              className="text-foreground/80 transition-colors hover:text-foreground"
            >
              <X className="size-5" strokeWidth={1.5} />
            </button>
          </div>

          <nav className="flex flex-1 flex-col gap-1 px-4 py-8">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setOpen(false)}
                className="py-3 font-heading text-2xl font-semibold uppercase tracking-tight"
              >
                {item.label}
              </Link>
            ))}
            {isAdmin && (
              <Link
                href="/admin"
                onClick={() => setOpen(false)}
                className="py-3 font-heading text-2xl font-semibold uppercase tracking-tight text-acid"
              >
                Admin
              </Link>
            )}

            <div className="mt-auto flex flex-col gap-3 border-t border-border pt-6">
              {isLoggedIn ? (
                <>
                  <Link
                    href="/perfil"
                    onClick={() => setOpen(false)}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/70"
                  >
                    Meu perfil
                  </Link>
                  <form action={logoutAction}>
                    <button
                      type="submit"
                      className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/70"
                    >
                      Sair
                    </button>
                  </form>
                </>
              ) : (
                <>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/70"
                  >
                    Entrar
                  </Link>
                  <Link
                    href="/cadastro"
                    onClick={() => setOpen(false)}
                    className="text-xs font-medium uppercase tracking-[0.15em] text-foreground/70"
                  >
                    Cadastrar
                  </Link>
                </>
              )}
            </div>
          </nav>
        </div>
      )}
    </div>
  );
}
