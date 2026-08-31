// Fonte única da matriz de acesso do painel admin — usada tanto pelo
// middleware (segurança real, em src/auth.config.ts) quanto pela navegação
// (UX, em src/components/admin/admin-nav.tsx). Mantendo os dois num só
// lugar evita que a sidebar esconda um link que a rota ainda deixaria abrir.

export type StaffRole = "ADMIN" | "STOCK_OPERATOR" | "MODEL_3D";

export const ALL_STAFF_ROLES: StaffRole[] = ["ADMIN", "STOCK_OPERATOR", "MODEL_3D"];

type AdminRoute = {
  href: string;
  label: string;
  index: string;
  roles: StaffRole[];
};

// Ordem importa para a navegação; para a checagem de rota, o match é por
// prefixo mais específico primeiro (por isso "/admin" fica por último).
export const ADMIN_ROUTES: AdminRoute[] = [
  { href: "/admin/categorias", label: "Categorias", index: "02", roles: ["ADMIN"] },
  { href: "/admin/produtos", label: "Produtos", index: "03", roles: ["ADMIN"] },
  { href: "/admin/modelos-3d", label: "Modelos 3D", index: "04", roles: ["ADMIN", "MODEL_3D"] },
  { href: "/admin/pedidos", label: "Pedidos", index: "05", roles: ["ADMIN", "STOCK_OPERATOR"] },
  { href: "/admin/estoque", label: "Estoque", index: "06", roles: ["ADMIN", "STOCK_OPERATOR"] },
  { href: "/admin/medidas", label: "Tabela de medidas", index: "07", roles: ["ADMIN"] },
  { href: "/admin", label: "Painel", index: "01", roles: ALL_STAFF_ROLES },
];

/** Roles autorizadas a acessar `path`. Rota desconhecida falha fechado (só ADMIN). */
export function rolesForAdminPath(path: string): StaffRole[] {
  const match = ADMIN_ROUTES.find(
    (r) => r.href !== "/admin" && path.startsWith(r.href),
  );
  if (match) return match.roles;
  if (path === "/admin") return ALL_STAFF_ROLES;
  return ["ADMIN"];
}

export function isStaffRole(role: string | undefined): role is StaffRole {
  return !!role && (ALL_STAFF_ROLES as string[]).includes(role);
}
