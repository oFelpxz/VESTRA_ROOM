import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import {
  validateModel3DAction,
  rejectModel3DAction,
  markOptimizedAction,
  deleteModel3DAction,
} from "@/lib/model-3d-actions";
import { Model3DUploader } from "@/components/admin/model-3d-uploader";
import { Model3DValidator } from "@/components/admin/model-3d-validator";
import { isCloudObject, resolveModelUrl } from "@/lib/storage";

const STATUS_BADGE: Record<string, string> = {
  PENDING: "bg-muted text-muted-foreground",
  VALIDATED: "bg-acid/30 text-foreground",
  REJECTED: "bg-destructive/10 text-destructive",
  OPTIMIZED: "bg-foreground text-background",
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Pendente",
  VALIDATED: "Validado",
  REJECTED: "Rejeitado",
  OPTIMIZED: "Otimizado",
};

export default async function Modelo3DRevisaoPage({
  params,
}: {
  params: Promise<{ productId: string }>;
}) {
  const { productId } = await params;

  const product = await prisma.product.findUnique({
    where: { id: productId },
    include: { model3D: true },
  });
  if (!product) notFound();

  const model = product.model3D;
  const previewUrl = model ? await resolveModelUrl(model.fileUrl) : null;

  return (
    <div className="flex flex-col gap-10">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">
          <Link
            href="/admin/modelos-3d"
            className="underline-offset-4 hover:underline"
          >
            Modelos 3D
          </Link>{" "}
          / {product.name}
        </p>

        <div className="mt-2 flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="font-heading text-3xl font-bold uppercase tracking-tight md:text-5xl">
                {product.name}
              </h1>
              {model && (
                <>
                  <span
                    className={`rounded-sm px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] ${STATUS_BADGE[model.status]}`}
                  >
                    {STATUS_LABEL[model.status]}
                  </span>
                  <span className="rounded-sm border border-foreground/15 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.15em] text-foreground/70">
                    v{model.version}
                  </span>
                </>
              )}
            </div>
            <p className="mt-2 text-sm text-muted-foreground">
              /{product.slug}
            </p>
          </div>

          <Link
            href={`/admin/produtos/${product.id}`}
            className="rounded-sm border border-foreground/15 px-4 py-2 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
          >
            Editar produto
          </Link>
        </div>
      </div>

      {/* Grade principal: preview + ações */}
      <div className="grid gap-10 lg:grid-cols-[1fr_320px]">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {model ? "Pré-visualização" : "Nenhum modelo associado"}
          </p>
          <div className="mt-4">
            {model && previewUrl ? (
              <Model3DValidator
                url={previewUrl}
                fileSizeMb={model.fileSizeMb}
              />
            ) : model ? (
              <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-dashed border-border bg-muted text-sm text-muted-foreground">
                Não foi possível gerar a pré-visualização do modelo.
              </div>
            ) : (
              <div className="flex aspect-[4/3] items-center justify-center rounded-sm border border-dashed border-border bg-muted text-sm text-muted-foreground">
                Envie um arquivo .glb para pré-visualizar.
              </div>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-8">
          {/* Ações de validação */}
          {model && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Validação
              </p>
              <div className="mt-4 flex flex-col gap-2">
                {model.status !== "VALIDATED" && (
                  <form action={validateModel3DAction}>
                    <input type="hidden" name="id" value={model.id} />
                    <button
                      type="submit"
                      className="inline-flex w-full items-center justify-center gap-2 rounded-sm bg-foreground px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-colors hover:bg-foreground/85"
                    >
                      <span className="text-acid">●</span> Aprovar modelo
                    </button>
                  </form>
                )}

                {model.status !== "REJECTED" && (
                  <form action={rejectModel3DAction}>
                    <input type="hidden" name="id" value={model.id} />
                    <button
                      type="submit"
                      className="w-full rounded-sm border border-foreground/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-destructive hover:text-destructive"
                    >
                      Rejeitar
                    </button>
                  </form>
                )}

                {model.status === "VALIDATED" && (
                  <form action={markOptimizedAction}>
                    <input type="hidden" name="id" value={model.id} />
                    <button
                      type="submit"
                      className="w-full rounded-sm border border-foreground/15 px-4 py-2.5 text-xs font-semibold uppercase tracking-[0.15em] text-foreground/70 transition-colors hover:border-foreground hover:text-foreground"
                    >
                      Marcar como otimizado
                    </button>
                  </form>
                )}

                <form action={deleteModel3DAction}>
                  <input type="hidden" name="id" value={model.id} />
                  <button
                    type="submit"
                    className="mt-2 w-full rounded-sm border border-foreground/15 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.15em] text-foreground/60 transition-colors hover:border-destructive hover:text-destructive"
                  >
                    Excluir modelo
                  </button>
                </form>
              </div>
            </div>
          )}

          {/* Upload (nova versão ou primeiro) */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
              {model ? "Substituir (nova versão)" : "Upload"}
            </p>
            <div className="mt-4">
              <Model3DUploader
                productId={product.id}
                hasExisting={Boolean(model)}
              />
            </div>
          </div>

          {/* Metadados */}
          {model && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
                Arquivo
              </p>
              <ul className="mt-4 divide-y divide-border border-y border-border text-sm">
                <Meta label="Formato" value={model.format} />
                <Meta
                  label="Tamanho"
                  value={
                    model.fileSizeMb ? `${model.fileSizeMb} MB` : "—"
                  }
                />
                <Meta
                  label="Armazenamento"
                  value={
                    isCloudObject(model.fileUrl)
                      ? "Supabase Storage (privado)"
                      : "Local (public/models)"
                  }
                />
                <Meta
                  label="Caminho"
                  value={
                    <code className="font-mono text-[11px] break-all">
                      {model.fileUrl}
                    </code>
                  }
                />
                <Meta
                  label="Atualizado"
                  value={model.updatedAt.toLocaleString("pt-BR")}
                />
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Meta({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <li className="flex items-start justify-between gap-4 py-2.5">
      <span className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
        {label}
      </span>
      <span className="text-right">{value}</span>
    </li>
  );
}
