import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getProductDetail } from "@/lib/products";
import { TryOnExperience } from "@/components/viewer-3d/tryon-experience";

export const metadata = { title: "Provador virtual | VESTRA FIT" };

export default async function ProvadorPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?next=/produto/${id}/provador`);
  }

  const userId = session.user.id;

  const [product, profile] = await Promise.all([
    getProductDetail(id),
    prisma.measurementProfile.findUnique({ where: { userId } }),
  ]);

  if (!product) notFound();

  // Guard: perfil de medidas obrigatório
  if (!profile || !profile.acceptedTerms) {
    return (
      <Gate
        title="Cadastre suas medidas"
        message="Para usar o provador virtual VESTRA FIT, você precisa preencher suas medidas e aceitar os termos."
        cta={{ label: "Preencher medidas", href: "/perfil/medidas" }}
        secondary={{ label: "Voltar ao produto", href: `/produto/${id}` }}
      />
    );
  }

  // Guard: produto precisa estar habilitado e ter modelo 3D
  if (!product.has3D || !product.modelUrl) {
    return (
      <Gate
        title="Provador indisponível"
        message="Este produto ainda não tem modelo 3D validado para o provador virtual."
        cta={{ label: "Voltar ao produto", href: `/produto/${id}` }}
      />
    );
  }

  const sizeRows = product.sizeChart?.rows ?? [];

  return (
    <TryOnExperience
      productId={product.id}
      productName={product.name}
      variants={product.variants}
      colors={product.colors}
      sizes={product.sizes}
      garmentUrl={product.modelUrl}
      profile={{
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        chestCm: profile.chestCm,
        waistCm: profile.waistCm,
        hipCm: profile.hipCm,
        shoulderCm: profile.shoulderCm,
        armLengthCm: profile.armLengthCm,
        legLengthCm: profile.legLengthCm,
        fitPreference: profile.fitPreference,
      }}
      sizeChart={sizeRows}
    />
  );
}

function Gate({
  title,
  message,
  cta,
  secondary,
}: {
  title: string;
  message: string;
  cta: { label: string; href: string };
  secondary?: { label: string; href: string };
}) {
  return (
    <section className="mx-auto flex min-h-[60vh] max-w-2xl flex-col items-start justify-center px-4 py-12 md:px-6">
      <p className="text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        VESTRA FIT
      </p>
      <h1 className="font-heading mt-2 text-3xl font-bold uppercase tracking-tight md:text-5xl">
        {title}
      </h1>
      <p className="mt-4 max-w-lg text-sm text-muted-foreground">{message}</p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href={cta.href}
          className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
        >
          {cta.label}
        </Link>
        {secondary && (
          <Link
            href={secondary.href}
            className="inline-flex h-12 items-center justify-center rounded-sm border border-border px-6 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-colors hover:border-foreground"
          >
            {secondary.label}
          </Link>
        )}
      </div>
    </section>
  );
}
