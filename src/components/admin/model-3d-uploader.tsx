"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { registerModel3DAction } from "@/lib/model-3d-actions";
import { Button } from "@/components/ui/button";

type UploadInfo = {
  fileSizeMb: number;
  originalSizeMb: number;
  optimizedPct: number;
  wasOptimized: boolean;
  storage: "cloud" | "local";
};

export function Model3DUploader({
  productId,
  hasExisting,
}: {
  productId: string;
  hasExisting: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [progress, setProgress] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<UploadInfo | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    setInfo(null);
    setProgress(0);

    const ext = file.name.toLowerCase().slice(file.name.lastIndexOf("."));
    if (ext !== ".glb" && ext !== ".gltf") {
      setError("Apenas .glb ou .gltf são aceitos.");
      setProgress(null);
      return;
    }

    const sizeMb = file.size / (1024 * 1024);
    if (sizeMb > 25) {
      setError("Arquivo excede 25 MB.");
      setProgress(null);
      return;
    }

    // Upload via XHR para ter progresso
    const result = await new Promise<{
      ok: boolean;
      data?: {
        fileUrl: string;
        fileSizeMb: number;
        originalSizeMb: number;
        optimizedPct: number;
        wasOptimized: boolean;
        storage: "cloud" | "local";
        format: string;
      };
      error?: string;
    }>((resolve) => {
      const xhr = new XMLHttpRequest();
      const formData = new FormData();
      formData.append("file", file);
      formData.append("productId", productId);

      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) {
          setProgress(Math.round((e.loaded / e.total) * 100));
        }
      };
      xhr.onload = () => {
        try {
          const parsed = JSON.parse(xhr.responseText);
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve({ ok: true, data: parsed });
          } else {
            resolve({ ok: false, error: parsed.error ?? "Erro no upload." });
          }
        } catch {
          resolve({ ok: false, error: "Resposta inválida do servidor." });
        }
      };
      xhr.onerror = () => resolve({ ok: false, error: "Falha de rede." });
      xhr.open("POST", "/api/models-3d/upload");
      xhr.send(formData);
    });

    if (!result.ok || !result.data) {
      setError(result.error ?? "Erro desconhecido.");
      setProgress(null);
      return;
    }

    // Registra no banco via server action
    const fd = new FormData();
    fd.set("productId", productId);
    fd.set("fileUrl", result.data.fileUrl);
    fd.set("fileSizeMb", String(result.data.fileSizeMb));
    fd.set("format", result.data.format);

    startTransition(async () => {
      const state = await registerModel3DAction({}, fd);
      if (state.error) {
        setError(state.error);
        setProgress(null);
        return;
      }
      setProgress(100);
      setInfo({
        fileSizeMb: result.data!.fileSizeMb,
        originalSizeMb: result.data!.originalSizeMb,
        optimizedPct: result.data!.optimizedPct,
        wasOptimized: result.data!.wasOptimized,
        storage: result.data!.storage,
      });
      router.refresh();
    });
  }

  function onPick(files: FileList | null) {
    if (!files || files.length === 0) return;
    upload(files[0]);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          onPick(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-sm border-2 border-dashed p-10 text-center transition-colors ${
          dragging
            ? "border-acid bg-acid/10"
            : "border-border hover:border-foreground/40"
        }`}
      >
        <p className="font-heading text-lg font-bold uppercase tracking-tight">
          {hasExisting ? "Enviar nova versão" : "Enviar modelo 3D"}
        </p>
        <p className="max-w-md text-xs text-muted-foreground">
          Arraste o arquivo aqui ou clique para selecionar.
          <br />
          Formatos: .glb ou .gltf · até 25 MB
        </p>
        <input
          ref={inputRef}
          type="file"
          accept=".glb,.gltf,model/gltf-binary,model/gltf+json"
          className="hidden"
          onChange={(e) => onPick(e.target.files)}
        />
        <Button
          type="button"
          variant="outline"
          className="mt-2"
          onClick={(e) => {
            e.stopPropagation();
            inputRef.current?.click();
          }}
        >
          Selecionar arquivo
        </Button>
      </div>

      {progress !== null && (
        <div className="flex flex-col gap-1">
          <div className="h-1 w-full overflow-hidden rounded-sm bg-muted">
            <div
              className="h-full bg-acid transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-[11px] uppercase tracking-[0.15em] text-muted-foreground">
            {pending
              ? "Registrando..."
              : progress < 100
                ? `Enviando ${progress}%`
                : "Concluído"}
          </p>
        </div>
      )}

      {error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {error}
        </p>
      )}

      {info && (
        <div className="rounded-sm border border-border bg-muted/40 px-3 py-2.5 text-xs">
          <p className="font-semibold uppercase tracking-[0.15em] text-muted-foreground">
            {info.storage === "cloud"
              ? "Enviado ao Supabase Storage"
              : "Salvo localmente"}
          </p>
          <p className="mt-1.5 text-foreground/80">
            {info.wasOptimized ? (
              <>
                Otimizado automaticamente: {info.originalSizeMb} MB →{" "}
                <strong>{info.fileSizeMb} MB</strong>{" "}
                <span className="text-acid">(−{info.optimizedPct}%)</span>
              </>
            ) : (
              <>
                Sem ganho na otimização — mantido em{" "}
                <strong>{info.fileSizeMb} MB</strong>
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
