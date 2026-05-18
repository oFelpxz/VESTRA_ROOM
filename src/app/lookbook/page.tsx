import Image from "next/image";
import Link from "next/link";

const looks = [
  {
    image: "/images/street-wear-girl.jpg",
    index: "01",
    title: "Street",
    caption: "Oversized — uso diário",
  },
  {
    image: "/images/wall-guy.jpg",
    index: "02",
    title: "Core",
    caption: "Básicos premium — neutros",
  },
  {
    image: "/images/red-place-girl.jpg",
    index: "03",
    title: "Statement",
    caption: "Peças de assinatura — presença",
  },
];

export default function LookbookPage() {
  return (
    <>
      {/* header minimalista */}
      <section className="mx-auto max-w-7xl px-4 pb-20 pt-24 md:px-8 md:pb-28 md:pt-32">
        <div className="flex items-end justify-between">
          <h1 className="font-heading text-4xl font-bold uppercase tracking-tight md:text-7xl">
            Lookbook
          </h1>
          <span className="hidden text-[10px] font-medium uppercase tracking-[0.3em] text-muted-foreground sm:block">
            Coleção 2026
          </span>
        </div>
      </section>

      {/* spreads — imagem domina, legenda sussurra (Zara) */}
      <div className="flex flex-col gap-24 md:gap-40">
        {looks.map((look, i) => (
          <article key={look.index}>
            <div className="relative aspect-[4/5] w-full md:aspect-[16/9]">
              <Image
                src={look.image}
                alt={`VESTRA ROOM — ${look.title}`}
                fill
                sizes="100vw"
                className="object-cover"
              />
            </div>
            <div
              className={`mx-auto mt-5 flex max-w-7xl items-baseline justify-between px-4 md:px-8 ${
                i % 2 === 1 ? "flex-row-reverse text-right" : ""
              }`}
            >
              <p className="font-heading text-lg font-semibold uppercase tracking-[0.15em]">
                {look.index} — {look.title}
              </p>
              <p className="text-[10px] uppercase tracking-[0.25em] text-muted-foreground">
                {look.caption}
              </p>
            </div>
          </article>
        ))}
      </div>

      {/* fechamento minimalista */}
      <section className="mx-auto flex max-w-7xl flex-col items-start gap-6 px-4 py-28 md:px-8 md:py-40">
        <h2 className="font-heading max-w-2xl text-3xl font-bold uppercase tracking-tight md:text-5xl">
          Encontre a sua peça
        </h2>
        <Link
          href="/catalogo"
          className="group inline-flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.2em]"
        >
          Explorar coleção
          <span className="inline-block h-px w-10 bg-foreground transition-all duration-300 group-hover:w-16" />
        </Link>
      </section>
    </>
  );
}
