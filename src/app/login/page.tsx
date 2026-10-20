import { LoginForm } from "@/components/auth/login-form";
import { safeNextPath } from "@/lib/safe-next";

export const metadata = { title: "Entrar" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string; callbackUrl?: string }>;
}) {
  // `next` vem dos links da loja; `callbackUrl`, do NextAuth (área /perfil e /admin).
  const { next, callbackUrl } = await searchParams;

  return (
    <section className="mx-auto flex min-h-[calc(100vh-12rem)] max-w-md items-center px-4 py-12">
      <div className="w-full">
        <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
          VESTRA ROOM
        </p>
        <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight">
          Entrar
        </h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Acesse seu espaço de prova digital.
        </p>

        <LoginForm next={safeNextPath(next ?? callbackUrl)} />
      </div>
    </section>
  );
}
