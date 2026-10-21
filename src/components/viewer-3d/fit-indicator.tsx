"use client";

import {
  FIT_CLASSES,
  FIT_CLASS_LABEL,
  type FitClass,
  type GarmentKind,
  type RegionFit,
  type SizeRecommendation,
} from "@/lib/fit-regions";

/** Cor de cada classe: regular em destaque, os extremos em alerta. */
export const FIT_CLASS_COLOR: Record<FitClass, { pill: string; dot: string }> = {
  MUITO_JUSTO: { pill: "bg-destructive/10 text-destructive", dot: "bg-destructive" },
  JUSTO: { pill: "bg-secondary text-foreground", dot: "bg-foreground" },
  REGULAR: { pill: "bg-acid/30 text-foreground", dot: "bg-acid" },
  SOLTO: { pill: "bg-muted text-muted-foreground", dot: "bg-muted-foreground" },
  OVERSIZED: { pill: "bg-muted text-foreground", dot: "bg-foreground/60" },
};

export function FitPill({ fit }: { fit: FitClass }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-sm px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] ${FIT_CLASS_COLOR[fit].pill}`}
    >
      {FIT_CLASS_LABEL[fit]}
    </span>
  );
}

/** Escala de cinco passos, do muito justo ao oversized, com a classe marcada. */
function Scale({ fit }: { fit: FitClass }) {
  return (
    <span className="flex gap-0.5" aria-hidden>
      {FIT_CLASSES.map((c) => (
        <span
          key={c}
          className={`h-1.5 w-4 rounded-full ${c === fit ? FIT_CLASS_COLOR[c].dot : "bg-border"}`}
        />
      ))}
    </span>
  );
}

const cm = (n: number) => n.toFixed(0);

/** 3D-06: caimento de cada região do tamanho escolhido. */
export function FitIndicator({
  size,
  overall,
  regions,
  kind,
}: {
  size: string | null;
  overall: FitClass | null;
  regions: RegionFit[];
  kind: GarmentKind;
}) {
  return (
    <div className="rounded-sm border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Caimento{size ? ` · Tam ${size}` : ""}
        </p>
        {overall && <FitPill fit={overall} />}
      </div>

      {regions.length === 0 ? (
        <p className="mt-3 text-xs text-muted-foreground">
          {size
            ? "A tabela de medidas deste tamanho não cobre as suas medidas."
            : "Escolha um tamanho para ver o caimento."}
        </p>
      ) : (
        <ul className="mt-3 flex flex-col gap-2 text-xs">
          {regions.map((r) => (
            <li key={r.region} className="flex items-center justify-between gap-3">
              <span className="min-w-0">
                <span className="font-medium">{r.label}</span>{" "}
                <span className="text-muted-foreground">
                  {cm(r.userCm)} cm · peça {cm(r.idealMinCm)}–{cm(r.idealMaxCm)}
                </span>
                {r.note && <span className="block text-muted-foreground">Fica {r.note}</span>}
              </span>
              <span className="flex shrink-0 flex-col items-end gap-1">
                <FitPill fit={r.fit} />
                <Scale fit={r.fit} />
              </span>
            </li>
          ))}
        </ul>
      )}
      {kind !== "bottom" && regions.length > 0 && (
        <p className="mt-3 text-[10px] text-muted-foreground">
          {kind === "dress"
            ? "Ombros são estimados pelo peito: a tabela não traz essa medida."
            : "Ombros e barra são estimados pelo peito e pela altura: a tabela não traz essas medidas."}
        </p>
      )}
    </div>
  );
}

/** 3D-08: tamanho sugerido, sempre como estimativa. */
export function SizeSuggestion({
  recommendation,
  selectedSize,
  onUse,
}: {
  recommendation: SizeRecommendation | null;
  selectedSize: string | null;
  onUse: (size: string) => void;
}) {
  if (!recommendation) return null;
  const { size, tooTight } = recommendation;
  return (
    <div className="rounded-sm border border-border p-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Tamanho sugerido · estimativa
        </p>
        <span className="font-heading text-xl font-bold">{size}</span>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">
        {tooTight
          ? `Nenhum tamanho desta peça fica confortável em todas as regiões; o ${size} é o que menos aperta.`
          : "Calculado com as suas medidas, a sua preferência de caimento e a tabela da peça."}{" "}
        É uma estimativa: tecido e modelagem mudam o caimento. Na dúvida, confira a tabela de
        medidas.
      </p>
      {selectedSize !== size && (
        <button
          type="button"
          onClick={() => onUse(size)}
          className="mt-3 text-[11px] font-semibold uppercase tracking-[0.15em] underline underline-offset-4"
        >
          Provar o {size}
        </button>
      )}
    </div>
  );
}

/** 3D-07: dois tamanhos, região por região. */
export function FitCompare({
  a,
  b,
}: {
  a: { size: string; regions: RegionFit[] };
  b: { size: string; regions: RegionFit[] };
}) {
  const regions = [...new Set([...a.regions, ...b.regions].map((r) => r.region))];
  const find = (list: RegionFit[], region: string) => list.find((r) => r.region === region);
  return (
    <div className="rounded-sm border border-border p-4">
      <p className="text-[11px] font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        Comparando
      </p>
      <table className="mt-3 w-full text-xs">
        <thead>
          <tr className="text-left text-muted-foreground">
            <th className="pb-2 font-medium">Região</th>
            <th className="pb-2 font-medium">Tam {a.size}</th>
            <th className="pb-2 font-medium">Tam {b.size}</th>
          </tr>
        </thead>
        <tbody>
          {regions.map((region) => {
            const ra = find(a.regions, region);
            const rb = find(b.regions, region);
            return (
              <tr key={region} className="border-t border-border">
                <td className="py-1.5 font-medium">{(ra ?? rb)!.label}</td>
                <td className="py-1.5">{ra ? <FitPill fit={ra.fit} /> : "—"}</td>
                <td className="py-1.5">{rb ? <FitPill fit={rb.fit} /> : "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
