"use client";

import { useActionState, useMemo, useState } from "react";
import {
  createReturnRequestAction,
  type ReturnFormState,
} from "@/lib/return-actions";
import {
  KIND_LABEL,
  MAX_PHOTOS,
  REASON_LABEL,
  REASON_TEXT_LIMIT,
  type ReturnKind,
  type ReturnReason,
} from "@/lib/returns";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

const initialState: ReturnFormState = {};

const selectClass =
  "h-9 rounded-sm border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring";

/**
 * Reduz a foto para no máximo 1600 px e regrava em JPEG. Fica leve para
 * enviar e perde os metadados (como a localização GPS do celular).
 */
async function shrinkPhoto(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", 0.85),
  );
  if (!blob) throw new Error("Não foi possível ler a foto.");
  return new File([blob], file.name.replace(/\.\w+$/, "") + ".jpg", { type: "image/jpeg" });
}

export function ReturnRequestForm({
  orderItemId,
  available,
  reasons,
  currentVariantId,
  variants,
}: {
  orderItemId: string;
  available: number;
  reasons: { reason: ReturnReason; kinds: ReturnKind[]; deadline: string }[];
  currentVariantId: string | null;
  variants: { id: string; color: string; size: string; stockQuantity: number }[];
}) {
  const [state, formAction, pending] = useActionState(createReturnRequestAction, initialState);
  const [reason, setReason] = useState<ReturnReason>(reasons[0].reason);
  const [kind, setKind] = useState<ReturnKind>("EXCHANGE");
  const [photos, setPhotos] = useState<File[]>([]);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const current = reasons.find((r) => r.reason === reason) ?? reasons[0];
  const effectiveKind = current.kinds.includes(kind) ? kind : current.kinds[0];
  const isDefect = reason === "DEFECT";

  // Troca: outra cor ou tamanho; no defeito pode ser a mesma peça.
  const options = useMemo(
    () => variants.filter((v) => isDefect || v.id !== currentVariantId),
    [variants, isDefect, currentVariantId],
  );

  async function onPickPhotos(list: FileList | null) {
    setPhotoError(null);
    if (!list) return;
    const picked = Array.from(list).slice(0, MAX_PHOTOS - photos.length);
    if (list.length > picked.length) setPhotoError(`No máximo ${MAX_PHOTOS} fotos.`);
    setPreparing(true);
    try {
      const shrunk = await Promise.all(picked.map(shrinkPhoto));
      setPhotos((p) => [...p, ...shrunk].slice(0, MAX_PHOTOS));
    } catch {
      setPhotoError("Não foi possível ler uma das fotos. Use JPG, PNG ou WEBP.");
    } finally {
      setPreparing(false);
    }
  }

  function submit(formData: FormData) {
    formData.delete("photos");
    for (const p of photos) formData.append("photos", p);
    formAction(formData);
  }

  return (
    <form action={submit} className="flex flex-col gap-5">
      <input type="hidden" name="orderItemId" value={orderItemId} />

      <div className="flex flex-col gap-2">
        <Label htmlFor="reason">Motivo</Label>
        <select
          id="reason"
          name="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value as ReturnReason)}
          className={selectClass}
        >
          {reasons.map((r) => (
            <option key={r.reason} value={r.reason}>
              {REASON_LABEL[r.reason]} (até {r.deadline})
            </option>
          ))}
        </select>
      </div>

      <div className="flex flex-col gap-2">
        <Label>O que você prefere</Label>
        <div className="flex flex-wrap gap-2">
          {(["EXCHANGE", "REFUND"] as const).map((k) => {
            const allowed = current.kinds.includes(k);
            return (
              <label
                key={k}
                className={`flex cursor-pointer items-center gap-2 rounded-sm border px-3 py-2 text-sm ${
                  effectiveKind === k ? "border-foreground" : "border-border"
                } ${allowed ? "" : "cursor-not-allowed opacity-40"}`}
              >
                <input
                  type="radio"
                  name="kind"
                  value={k}
                  checked={effectiveKind === k}
                  disabled={!allowed}
                  onChange={() => setKind(k)}
                  className="accent-foreground"
                />
                {KIND_LABEL[k]}
              </label>
            );
          })}
        </div>
        {!current.kinds.includes("REFUND") && (
          <p className="text-xs text-muted-foreground">
            Passado o prazo de arrependimento, por esse motivo só dá para trocar. Se a peça da
            troca tiver acabado, devolvemos o valor.
          </p>
        )}
      </div>

      {effectiveKind === "EXCHANGE" && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="exchangeVariantId">Trocar por</Label>
          <select id="exchangeVariantId" name="exchangeVariantId" required className={selectClass}>
            <option value="">Escolha a cor e o tamanho</option>
            {options.map((v) => (
              <option key={v.id} value={v.id}>
                {v.color} · Tam {v.size}
                {v.id === currentVariantId ? " (o mesmo, outra unidade)" : ""}
                {v.stockQuantity <= 0 ? " · sem estoque agora" : ""}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">
            Mesmo modelo, em outra cor ou tamanho. A peça é reservada quando a loja aprovar.
          </p>
        </div>
      )}

      {available > 1 && (
        <div className="flex flex-col gap-2">
          <Label htmlFor="quantity">Quantidade</Label>
          <select id="quantity" name="quantity" defaultValue="1" className={selectClass}>
            {Array.from({ length: available }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n}
              </option>
            ))}
          </select>
        </div>
      )}
      {available === 1 && <input type="hidden" name="quantity" value="1" />}

      <div className="flex flex-col gap-2">
        <Label htmlFor="reasonText">
          {isDefect ? "Descreva o defeito" : reason === "OTHER" ? "Conte o motivo" : "Comentário (opcional)"}
        </Label>
        <textarea
          id="reasonText"
          name="reasonText"
          rows={4}
          maxLength={REASON_TEXT_LIMIT}
          required={isDefect || reason === "OTHER"}
          className="rounded-sm border border-input bg-background px-3 py-2 text-sm outline-none focus-visible:border-ring"
        />
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="photos">
          Fotos {isDefect ? "(obrigatório, até 3)" : "(opcional, até 3)"}
        </Label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          disabled={photos.length >= MAX_PHOTOS || preparing}
          onChange={(e) => {
            void onPickPhotos(e.target.files);
            e.target.value = "";
          }}
          className="text-sm file:mr-3 file:rounded-sm file:border file:border-border file:bg-background file:px-3 file:py-1.5 file:text-xs file:uppercase"
        />
        {photos.length > 0 && (
          <ul className="flex flex-wrap gap-2">
            {photos.map((p, i) => (
              <li
                key={`${p.name}-${i}`}
                className="flex items-center gap-2 rounded-sm border border-border px-2 py-1 text-xs"
              >
                {p.name} · {Math.round(p.size / 1024)} KB
                <button
                  type="button"
                  onClick={() => setPhotos((list) => list.filter((_, j) => j !== i))}
                  className="text-muted-foreground hover:text-destructive"
                  aria-label={`Remover ${p.name}`}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        )}
        {preparing && <p className="text-xs text-muted-foreground">Preparando fotos...</p>}
        {photoError && <p className="text-xs text-destructive">{photoError}</p>}
      </div>

      <p className="text-xs text-muted-foreground">
        A peça deve voltar sem uso, sem lavagem e com a etiqueta (exceto defeito). O frete da volta
        é por conta da loja.
      </p>

      {state.error && (
        <p className="rounded-sm bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {state.error}
        </p>
      )}

      <Button type="submit" disabled={pending || preparing} className="w-fit">
        {pending ? "Enviando..." : "Enviar pedido"}
      </Button>
    </form>
  );
}
