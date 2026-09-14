"use client";

import {
  fitLabelColor,
  fitLabelText,
  type FitResult,
} from "@/lib/fit-calculator";

export function FitIndicator({ result }: { result: FitResult }) {
  const colors = fitLabelColor(result.label);

  return (
    <div className={`rounded-sm border border-border p-4 ${colors.bg}`}>
      <div className="flex items-center gap-2">
        <span
          className={`inline-block size-2 rounded-full ${colors.dot}`}
        />
        <p
          className={`text-[11px] font-semibold uppercase tracking-[0.15em] ${colors.text}`}
        >
          Caimento · {fitLabelText(result.label)}
        </p>
      </div>

      {result.details.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5 text-xs">
          {result.details.map((d) => (
            <li
              key={d.axis}
              className="flex items-center justify-between text-foreground/80"
            >
              <span>
                {d.axisLabel}{" "}
                <span className="text-muted-foreground">
                  {d.userValue.toFixed(0)} cm · ideal {d.rangeMin.toFixed(0)}-
                  {d.rangeMax.toFixed(0)}
                </span>
              </span>
              {d.status === "ok" ? (
                <span className="text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/60">
                  ok
                </span>
              ) : (
                <span
                  className={`text-[10px] font-semibold uppercase tracking-[0.15em] ${
                    d.status === "above" ? "text-foreground" : "text-muted-foreground"
                  }`}
                >
                  {d.status === "above" ? "+" : "−"}
                  {d.deltaCm.toFixed(1)} cm
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
