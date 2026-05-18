import Image from "next/image";
import Link from "next/link";

export function EditorialSection({
  image,
  alt,
  eyebrow,
  title,
  ctaLabel,
  href,
  align = "left",
}: {
  image: string;
  alt: string;
  eyebrow: string;
  title: string;
  ctaLabel: string;
  href: string;
  align?: "left" | "right";
}) {
  return (
    <section className="relative h-[82vh] min-h-[520px] w-full overflow-hidden">
      <Image
        src={image}
        alt={alt}
        fill
        sizes="100vw"
        className="object-cover"
      />
      <div className="absolute inset-0 bg-black/30" />

      <div
        className={`absolute inset-0 mx-auto flex max-w-7xl flex-col justify-center px-4 md:px-6 ${
          align === "right" ? "items-end text-right" : "items-start"
        }`}
      >
        <div className="max-w-xl">
          <p className="mb-4 text-xs font-medium uppercase tracking-[0.3em] text-white/80">
            {eyebrow}
          </p>
          <h2 className="font-heading text-4xl font-bold uppercase leading-[0.95] tracking-tight text-white md:text-6xl">
            {title}
          </h2>
          <Link
            href={href}
            className="mt-8 inline-flex h-12 items-center justify-center rounded-sm border border-white/40 px-8 text-xs font-semibold uppercase tracking-[0.15em] text-white transition-colors hover:bg-white hover:text-black"
          >
            {ctaLabel}
          </Link>
        </div>
      </div>
    </section>
  );
}
