import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  MeasurementForm,
  type MeasurementInitial,
} from "@/components/profile/measurement-form";

export default async function MedidasPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const profile = await prisma.measurementProfile.findUnique({
    where: { userId: session.user.id },
  });

  const initial: MeasurementInitial = profile
    ? {
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        chestCm: profile.chestCm,
        waistCm: profile.waistCm,
        hipCm: profile.hipCm,
        shoulderCm: profile.shoulderCm,
        armLengthCm: profile.armLengthCm,
        legLengthCm: profile.legLengthCm,
        fitPreference: profile.fitPreference,
        acceptedTerms: profile.acceptedTerms,
      }
    : null;

  return (
    <section className="mx-auto max-w-3xl px-4 py-12 md:px-6">
      <Link
        href="/perfil"
        className="text-xs font-medium uppercase tracking-[0.15em] text-muted-foreground underline-offset-4 hover:underline"
      >
        ← Voltar ao perfil
      </Link>

      <p className="mt-6 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA FIT
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        Medidas corporais
      </h1>
      <p className="mt-3 max-w-xl text-sm text-muted-foreground">
        Suas medidas são usadas para recomendar o tamanho ideal e para o
        provador virtual. Você pode editar ou limpar quando quiser.
      </p>

      <MeasurementForm initial={initial} />
    </section>
  );
}
