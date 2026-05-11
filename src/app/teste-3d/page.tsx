import { Viewer3D } from "@/components/viewer-3d/viewer";

export default function Teste3DPage() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-12">
      <h1 className="text-3xl font-bold tracking-tight">Teste 3D</h1>
      <p className="mt-2 text-zinc-600 dark:text-zinc-400">
        Arraste para rotacionar. Use o scroll para zoom.
      </p>

      <div className="mt-8 h-[600px] w-full overflow-hidden rounded-lg border border-zinc-200 bg-zinc-100 dark:border-zinc-800 dark:bg-zinc-900">
        <Viewer3D />
      </div>
    </section>
  );
}
