import Link from "next/link";

const STEPS = [
  { key: "address", label: "Endereço", index: "01" },
  { key: "review", label: "Revisão", index: "02" },
  { key: "payment", label: "Pagamento", index: "03" },
] as const;

export function CheckoutStepper({
  current,
  addressId,
}: {
  current: "address" | "review" | "payment";
  addressId?: string;
}) {
  const currentIdx = STEPS.findIndex((s) => s.key === current);

  return (
    <ol className="flex flex-wrap items-center gap-3">
      {STEPS.map((s, i) => {
        const done = i < currentIdx;
        const active = i === currentIdx;
        const reachable = done || active;

        const href =
          s.key === "address"
            ? "/checkout?step=address"
            : `/checkout?step=${s.key}${addressId ? `&addressId=${addressId}` : ""}`;

        const content = (
          <span
            className={`inline-flex items-center gap-2 rounded-sm px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.15em] ${
              active
                ? "bg-foreground text-background"
                : done
                  ? "border border-foreground/20 text-foreground/80"
                  : "border border-border text-muted-foreground"
            }`}
          >
            <span
              className={
                active
                  ? "text-acid"
                  : done
                    ? "text-foreground/40"
                    : "text-muted-foreground/60"
              }
            >
              |{s.index}|
            </span>
            {s.label}
          </span>
        );

        return (
          <li key={s.key} className="flex items-center gap-3">
            {reachable ? <Link href={href}>{content}</Link> : content}
            {i < STEPS.length - 1 && (
              <span className="h-px w-6 bg-border" aria-hidden />
            )}
          </li>
        );
      })}
    </ol>
  );
}
