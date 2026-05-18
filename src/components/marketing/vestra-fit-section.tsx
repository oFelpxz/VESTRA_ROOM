import Link from "next/link";

const features = [
  {
    title: "Visualize em 3D",
    desc: "Gire, aproxime e veja cada peça em todos os ângulos.",
  },
  {
    title: "Caimento estimado",
    desc: "Veja como a roupa veste antes de finalizar a compra.",
  },
  {
    title: "Tamanho com segurança",
    desc: "Compare suas medidas e escolha o tamanho ideal.",
  },
];

export function VestraFitSection() {
  return (
    <section className="bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-24 md:px-6 md:py-32">
        <p className="mb-4 inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-acid">
          O provador da marca
        </p>

        <h2 className="font-heading text-4xl font-bold uppercase tracking-tight md:text-6xl">
          VESTRA FIT
        </h2>

        <p className="mt-6 max-w-xl text-background/60 md:text-lg">
          Entre no seu espaço de prova digital. Visualize peças em 3D, veja o
          caimento estimado e escolha o tamanho com mais confiança.
        </p>

        <div className="mt-16 grid gap-px overflow-hidden rounded-sm border border-background/10 bg-background/10 md:grid-cols-3">
          {features.map((f) => (
            <div key={f.title} className="bg-foreground p-8">
              <h3 className="font-heading text-lg font-semibold uppercase tracking-wide">
                {f.title}
              </h3>
              <p className="mt-3 text-sm text-background/55">{f.desc}</p>
            </div>
          ))}
        </div>

        <div className="mt-12">
          <Link
            href="/teste-3d"
            className="inline-flex h-12 items-center justify-center rounded-sm bg-acid px-8 text-xs font-semibold uppercase tracking-[0.15em] text-foreground transition-opacity hover:opacity-90"
          >
            Experimentar em 3D
          </Link>
        </div>
      </div>
    </section>
  );
}
