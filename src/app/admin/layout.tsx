import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AdminNav } from "@/components/admin/admin-nav";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  const role = session?.user?.role;
  if (role !== "ADMIN" && role !== "MODEL_3D" && role !== "STOCK_OPERATOR") {
    redirect("/login");
  }

  const user = session!.user!;

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      {/* sidebar unificada */}
      <aside className="flex shrink-0 flex-col gap-8 bg-foreground px-6 py-7 text-background lg:sticky lg:top-0 lg:h-screen lg:w-64">
        <div>
          <p className="font-heading text-base font-bold uppercase tracking-[0.2em]">
            VESTRA ROOM
          </p>
          <p className="mt-1 inline-flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.3em] text-acid">
            <span className="inline-block size-1 rounded-full bg-acid" />
            Admin
          </p>
        </div>

        <div className="border-y border-background/15 py-4">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="mt-0.5 text-xs text-background/50">{user.email}</p>
          <span className="mt-2 inline-block rounded-sm bg-background/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.15em] text-background/70">
            {user.role}
          </span>
        </div>

        <AdminNav role={role as "ADMIN" | "STOCK_OPERATOR" | "MODEL_3D"} />
      </aside>

      {/* conteúdo */}
      <main className="flex-1 px-5 py-8 md:px-10 md:py-12">{children}</main>
    </div>
  );
}
