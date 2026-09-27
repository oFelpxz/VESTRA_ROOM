export function CustomerStatusBadge({ blocked }: { blocked: boolean }) {
  return (
    <span
      className={`rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em] ${
        blocked ? "bg-destructive/10 text-destructive" : "bg-acid/30 text-foreground"
      }`}
    >
      {blocked ? "Bloqueado" : "Ativo"}
    </span>
  );
}
