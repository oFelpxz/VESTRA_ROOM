import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { PaymentMethodList } from "@/components/profile/payment-method-list";

export const metadata = { title: "Formas de pagamento | VESTRA ROOM" };

export default async function PagamentoPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const methods = await prisma.savedPaymentMethod.findMany({
    where: { userId: session.user.id },
    orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
  });

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        href="/perfil"
        className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Voltar ao perfil
      </Link>

      <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        Minha conta
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Formas de pagamento
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Guardamos apenas a bandeira e os 4 últimos dígitos dos seus cartões.
        O número completo e o CVV nunca são armazenados.
      </p>

      <div className="mt-10">
        <PaymentMethodList methods={methods} />
      </div>
    </section>
  );
}
