"use client";

import { useActionState, useState } from "react";
import { createReviewAction, type ReviewFormState } from "@/lib/review-actions";

const initialState: ReviewFormState = {};

export function ReviewForm({
  productId,
  productSlug,
}: {
  productId: string;
  productSlug: string;
}) {
  const [rating, setRating] = useState(0);
  const [hovered, setHovered] = useState(0);
  const [state, formAction, pending] = useActionState(
    createReviewAction,
    initialState,
  );

  if (state.success) {
    return (
      <p className="rounded-sm border border-acid/40 bg-acid/10 px-4 py-3 text-sm">
        Obrigado! Sua avaliação foi enviada e vai aparecer aqui assim que for
        moderada.
      </p>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-3">
      <input type="hidden" name="productId" value={productId} />
      <input type="hidden" name="productSlug" value={productSlug} />
      <input type="hidden" name="rating" value={rating} />

      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-muted-foreground">
          Sua nota
        </p>
        <div
          className="mt-2 flex gap-1"
          onMouseLeave={() => setHovered(0)}
        >
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onMouseEnter={() => setHovered(n)}
              onClick={() => setRating(n)}
              aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
              className={`text-2xl leading-none transition-colors ${
                n <= (hovered || rating)
                  ? "text-acid"
                  : "text-muted-foreground/30"
              }`}
            >
              ★
            </button>
          ))}
        </div>
      </div>

      <textarea
        name="comment"
        rows={3}
        placeholder="Conte como foi a experiência com a peça (opcional)"
        className="w-full rounded-sm border border-border bg-transparent px-3 py-2 text-sm outline-none focus:border-foreground/40"
      />

      {state.error && (
        <p className="text-sm text-destructive">{state.error}</p>
      )}

      <button
        type="submit"
        disabled={pending || rating === 0}
        className="inline-flex h-10 w-fit items-center justify-center rounded-sm bg-foreground px-6 text-xs font-semibold uppercase tracking-[0.15em] text-background transition-opacity hover:opacity-90 disabled:opacity-40"
      >
        {pending ? "Enviando..." : "Enviar avaliação"}
      </button>
    </form>
  );
}
