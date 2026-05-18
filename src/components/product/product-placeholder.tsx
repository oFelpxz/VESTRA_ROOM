export function ProductPlaceholder({
  label = "VESTRA ROOM",
}: {
  label?: string;
}) {
  return (
    <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-gradient-to-br from-secondary via-secondary to-muted">
      {/* faixas diagonais sutis */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(135deg, currentColor 0 1px, transparent 1px 22px)",
        }}
      />
      {/* monograma */}
      <span className="font-heading select-none text-7xl font-bold leading-none tracking-tighter text-foreground/[0.07] sm:text-8xl md:text-9xl">
        V
      </span>
      {/* assinatura */}
      <div className="absolute bottom-3 left-0 right-0 flex items-center justify-center gap-2">
        <span className="inline-block size-1 rounded-full bg-acid" />
        <span className="text-[10px] uppercase tracking-[0.35em] text-muted-foreground">
          {label}
        </span>
      </div>
    </div>
  );
}
