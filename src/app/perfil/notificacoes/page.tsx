import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { listNotifications } from "@/lib/notifications";
import { markAllNotificationsReadAction } from "@/lib/notification-actions";

export const metadata = { title: "Avisos" };

/** Avisos ao cliente (item 20): pagamento confirmado, boleto, cancelamento e reembolso. */
export default async function NotificacoesPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const notifications = await listNotifications(session.user.id);
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <Link href="/perfil" className="underline-offset-4 hover:underline">
          Minha conta
        </Link>{" "}
        / Avisos
      </p>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-4xl">
          Avisos
        </h1>
        {unread > 0 && (
          <form action={markAllNotificationsReadAction}>
            <button
              type="submit"
              className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
            >
              Marcar como lidos
            </button>
          </form>
        )}
      </div>

      {notifications.length === 0 ? (
        <p className="mt-10 text-sm text-muted-foreground">
          Nenhum aviso por enquanto. Aqui aparecem confirmações de pagamento,
          boletos, cancelamentos e reembolsos dos seus pedidos.
        </p>
      ) : (
        <ul className="mt-8 divide-y divide-border border-y border-border">
          {notifications.map((n) => (
            <li key={n.id} className="flex gap-3 py-4">
              <span
                className={`mt-1.5 inline-block size-2 shrink-0 rounded-full ${
                  n.readAt ? "bg-transparent" : "bg-acid"
                }`}
                aria-label={n.readAt ? undefined : "Não lido"}
              />
              <div className="min-w-0 flex-1">
                <p className={`text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.title}</p>
                <p className="mt-1 text-sm text-muted-foreground">{n.body}</p>
                <p className="mt-1 text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
                  {n.createdAt.toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                    timeZone: "America/Sao_Paulo",
                  })}
                  {n.href && (
                    <>
                      {" · "}
                      <Link href={n.href} className="underline underline-offset-4">
                        Ver pedido
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
