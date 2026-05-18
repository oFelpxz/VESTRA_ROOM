import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";

const adminNav = [
  { label: "Painel", href: "/admin" },
  { label: "Categorias", href: "/admin/categorias" },
  { label: "Tabela de medidas", href: "/admin/medidas" },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // Defesa extra além do proxy.ts.
  if (session?.user?.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="mx-auto max-w-7xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-acid">
        VESTRA ROOM · Admin
      </p>
      <nav className="mt-4 flex flex-wrap gap-2 border-b border-border pb-6">
        {adminNav.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            className="rounded-sm border border-foreground/15 px-3 py-1.5 text-xs font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            {item.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">{children}</div>
    </div>
  );
}
