export function Marquee({
  items,
  tone = "dark",
}: {
  items: string[];
  tone?: "dark" | "light";
}) {
  const wrap =
    tone === "light"
      ? "border-y border-background/15 bg-foreground text-background"
      : "border-y border-border bg-background text-foreground";

  const Group = () => (
    <div className="flex shrink-0 items-center">
      {items.map((t, i) => (
        <span
          key={i}
          className="flex items-center gap-10 whitespace-nowrap px-5 font-heading text-sm font-semibold uppercase tracking-[0.25em]"
        >
          {t}
          <span className="size-1 rounded-full bg-acid" />
        </span>
      ))}
    </div>
  );

  return (
    <div className={`overflow-hidden py-4 ${wrap}`}>
      <div className="animate-marquee flex w-max">
        <Group />
        <Group />
      </div>
    </div>
  );
}
