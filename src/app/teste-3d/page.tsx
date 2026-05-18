import { Viewer3D } from "@/components/viewer-3d/viewer";

export default function Teste3DPage() {
  return (
    <section className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="inline-flex items-center gap-2 text-xs font-medium uppercase tracking-[0.25em] text-muted-foreground">
        <span className="inline-block size-1.5 rounded-full bg-acid" />
        VESTRA FIT
      </p>
      <h1 className="font-heading mt-3 text-4xl font-bold uppercase tracking-tight md:text-6xl">
        Provador virtual 3D
      </h1>
      <p className="mt-4 max-w-xl text-muted-foreground">
        Arraste para girar. Use o scroll para aproximar. Veja a peça em todos os
        ângulos.
      </p>

      <div className="relative mt-10 h-[600px] w-full overflow-hidden rounded-sm border border-border bg-foreground">
        <span className="absolute left-4 top-4 z-10 text-[10px] font-medium uppercase tracking-[0.2em] text-background/50">
          VESTRA ROOM · 3D
        </span>
        <Viewer3D />
      </div>
    </section>
  );
}
