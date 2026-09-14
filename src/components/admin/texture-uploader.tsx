"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export function TextureUploader({ productId }: { productId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function upload(file: File) {
    setError(null);
    setPending(true);

    const form = new FormData();
    form.append("file", file);
    form.append("productId", productId);

    try {
      const res = await fetch("/api/models-3d/upload-texture", {
        method: "POST",
        body: form,
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Erro no upload da textura.");
        return;
      }
      router.refresh();
    } catch {
      setError("Falha de rede.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <input
        ref={inputRef}
        type="file"
        accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) upload(file);
        }}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={pending}
        className="w-fit rounded-sm border border-foreground/15 px-3 py-1.5 text-[11px] font-medium uppercase tracking-wide text-foreground/70 transition-colors hover:border-foreground hover:text-foreground disabled:opacity-50"
      >
        {pending ? "Enviando..." : "Enviar textura (.png/.jpg/.webp)"}
      </button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
