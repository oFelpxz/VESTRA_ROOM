"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";
import { ADMIN_ROUTES, type StaffRole } from "@/lib/admin-access";

// Ordem de exibição no menu: Painel primeiro, depois o resto na ordem
// declarada em ADMIN_ROUTES (que lista "/admin" por último por causa do
// matching por prefixo usado no middleware).
const NAV_ITEMS = [...ADMIN_ROUTES].sort((a, b) =>
  a.index.localeCompare(b.index),
);

export function AdminNav({ role }: { role: StaffRole }) {
  const pathname = usePathname();
  const items = NAV_ITEMS.filter((it) => it.roles.includes(role));

  return (
    <div className="flex flex-1 flex-col">
      <nav className="flex flex-col gap-1">
        {items.map((it) => {
          const active =
            it.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              className={`flex items-center gap-3 rounded-sm px-3 py-2.5 text-xs font-medium uppercase tracking-[0.15em] transition-colors ${
                active
                  ? "bg-background/10 text-background"
                  : "text-background/55 hover:text-background"
              }`}
            >
              <span
                className={active ? "text-acid" : "text-background/30"}
              >
                |{it.index}|
              </span>
              {it.label}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto flex flex-col gap-1 border-t border-background/15 pt-4">
        <Link
          href="/"
          className="rounded-sm px-3 py-2.5 text-xs font-medium uppercase tracking-[0.15em] text-background/55 transition-colors hover:text-background"
        >
          Voltar à loja
        </Link>
        <form action={logoutAction}>
          <button
            type="submit"
            className="w-full rounded-sm px-3 py-2.5 text-left text-xs font-medium uppercase tracking-[0.15em] text-background/55 transition-colors hover:text-background"
          >
            Sair
          </button>
        </form>
      </div>
    </div>
  );
}
