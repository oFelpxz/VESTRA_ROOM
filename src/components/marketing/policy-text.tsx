import { parsePolicy } from "@/lib/policies";

/** Mostra um texto de política (formato de `src/lib/policies.ts`). */
export function PolicyText({ text }: { text: string }) {
  return (
    <div className="space-y-4 text-muted-foreground md:text-lg">
      {parsePolicy(text).map((block, i) => {
        if (block.kind === "heading") {
          return (
            <h2
              key={i}
              className="font-heading pt-4 text-xl font-bold uppercase tracking-tight text-foreground md:text-2xl"
            >
              {block.text}
            </h2>
          );
        }
        if (block.kind === "list") {
          return (
            <ul key={i} className="list-disc space-y-1 pl-5">
              {block.items.map((item, j) => (
                <li key={j}>{item}</li>
              ))}
            </ul>
          );
        }
        return <p key={i}>{block.text}</p>;
      })}
    </div>
  );
}
