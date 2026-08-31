import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { AvatarPreview } from "@/components/viewer-3d/avatar-preview";

export const metadata = { title: "VESTRA FIT" };

// Medidas de referência caso o usuário não esteja logado ou ainda não tenha
// preenchido o perfil — gera um avatar genérico só pra ilustração.
const REFERENCE = {
  heightCm: 172,
  weightKg: 70,
  chestCm: 96,
  waistCm: 80,
  hipCm: 96,
  shoulderCm: 45,
  armLengthCm: 60,
  legLengthCm: 80,
};

export default async function Teste3DPage() {
  const session = await auth();

  let measures = REFERENCE;
  let hasOwnMeasures = false;
  let acceptedTerms = false;

  if (session?.user?.id) {
    const profile = await prisma.measurementProfile.findUnique({
      where: { userId: session.user.id },
    });
    if (profile && profile.heightCm) {
      measures = {
        heightCm: profile.heightCm,
        weightKg: profile.weightKg ?? REFERENCE.weightKg,
        chestCm: profile.chestCm ?? REFERENCE.chestCm,
        waistCm: profile.waistCm ?? REFERENCE.waistCm,
        hipCm: profile.hipCm ?? REFERENCE.hipCm,
        shoulderCm: profile.shoulderCm ?? REFERENCE.shoulderCm,
        armLengthCm: profile.armLengthCm ?? REFERENCE.armLengthCm,
        legLengthCm: profile.legLengthCm ?? REFERENCE.legLengthCm,
      };
      hasOwnMeasures = true;
      acceptedTerms = profile.acceptedTerms;
    }
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-acid" />
        VESTRA FIT
      </p>
      <h1 className="font-heading mt-3 text-4xl font-bold uppercase tracking-tight md:text-6xl">
        Seu avatar virtual
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        {hasOwnMeasures
          ? "Esse é o boneco gerado a partir das suas medidas. Em qualquer produto com modelo 3D validado, você pode vestir a peça aqui no provador."
          : "Arraste para girar. Cadastre suas medidas para que o avatar reflita o seu corpo nos provadores."}
      </p>

      <div className="mt-10 grid gap-8 lg:grid-cols-[1fr_320px]">
        <div className="relative h-[600px] w-full overflow-hidden rounded-sm border border-border bg-muted">
          <span className="absolute left-4 top-4 z-10 text-[10px] font-medium uppercase tracking-[0.2em] text-foreground/50">
            VESTRA ROOM · 3D
          </span>
          <span className="absolute bottom-4 right-4 z-10 text-[10px] uppercase tracking-[0.2em] text-foreground/50">
            arraste para girar · scroll para zoom
          </span>
          <AvatarPreview measures={measures} />
        </div>

        {/* Painel lateral */}
        <aside className="flex flex-col gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {hasOwnMeasures ? "Suas medidas" : "Medidas de referência"}
            </p>
            <ul className="mt-3 divide-y divide-border border-y border-border text-sm">
              <Measure label="Altura" value={`${measures.heightCm} cm`} />
              <Measure label="Peso" value={`${measures.weightKg} kg`} />
              <Measure label="Tórax" value={`${measures.chestCm} cm`} />
              <Measure label="Cintura" value={`${measures.waistCm} cm`} />
              <Measure label="Quadril" value={`${measures.hipCm} cm`} />
              <Measure label="Ombros" value={`${measures.shoulderCm} cm`} />
              <Measure label="Braço" value={`${measures.armLengthCm} cm`} />
              <Measure label="Perna" value={`${measures.legLengthCm} cm`} />
            </ul>
          </div>

          {!session?.user ? (
            <div className="flex flex-col gap-3 rounded-sm border border-border bg-secondary/40 p-5">
              <p className="text-sm">
                Entre para ver o avatar com{" "}
                <strong className="font-semibold">suas medidas reais</strong>.
              </p>
              <Link
                href="/login?next=/teste-3d"
                className="inline-flex h-11 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Entrar
              </Link>
            </div>
          ) : !hasOwnMeasures ? (
            <div className="flex flex-col gap-3 rounded-sm border border-border bg-secondary/40 p-5">
              <p className="text-sm">
                Você ainda não cadastrou suas medidas — esse avatar é de
                referência.
              </p>
              <Link
                href="/perfil/medidas"
                className="inline-flex h-11 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Cadastrar minhas medidas
              </Link>
            </div>
          ) : !acceptedTerms ? (
            <div className="flex flex-col gap-3 rounded-sm border border-destructive/30 bg-destructive/5 p-5">
              <p className="text-sm">
                Você precisa autorizar o uso das medidas para usar o provador
                em produtos reais.
              </p>
              <Link
                href="/perfil/medidas"
                className="inline-flex h-11 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Aceitar termos
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-3 rounded-sm border border-acid bg-acid/10 p-5">
              <p className="text-sm">
                Tudo pronto. Vá para o catálogo e experimente uma peça com 3D.
              </p>
              <Link
                href="/catalogo"
                className="inline-flex h-11 items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90"
              >
                Ver catálogo
              </Link>
            </div>
          )}
        </aside>
      </div>
    </section>
  );
}

function Measure({ label, value }: { label: string; value: string }) {
  return (
    <li className="flex items-center justify-between py-2.5">
      <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className="font-medium">{value}</span>
    </li>
  );
}
