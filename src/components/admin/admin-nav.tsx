"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { logoutAction } from "@/lib/auth-actions";

type Role = "ADMIN" | "STOCK_OPERATOR" | "MODEL_3D" | "CUSTOMER";

type Item = {
  label: string;
  href: string;
  index: string;
  roles: Role[];
};

const ALL_ITEMS: Item[] = [
  { label: "Painel", href: "/admin", index: "01", roles: ["ADMIN", "STOCK_OPERATOR", "MODEL_3D"] },
  { label: "Categorias", href: "/admin/categorias", index: "02", roles: ["ADMIN"] },
  { label: "Produtos", href: "/admin/produtos", index: "03", roles: ["ADMIN"] },
  { label: "Modelos 3D", href: "/admin/modelos-3d", index: "04", roles: ["ADMIN", "MODEL_3D"] },
  { label: "Pedidos", href: "/admin/pedidos", index: "05", roles: ["ADMIN", "STOCK_OPERATOR"] },
  { label: "Estoque", href: "/admin/estoque", index: "06", roles: ["ADMIN", "STOCK_OPERATOR"] },
  { label: "Tabela de medidas", href: "/admin/medidas", index: "07", roles: ["ADMIN"] },
];

export function AdminNav({ role }: { role: Role }) {
  const pathname = usePathname();
  const items = ALL_ITEMS.filter((it) => it.roles.includes(role));

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
