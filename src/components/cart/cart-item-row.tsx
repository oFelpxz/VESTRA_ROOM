"use client";

import {
  removeFromCartAction,
  updateCartItemQuantityForm,
} from "@/lib/cart-actions";

export function CartItemRow({
  cartItemId,
  quantity,
  maxStock,
}: {
  cartItemId: string;
  quantity: number;
  maxStock: number;
}) {
  const dec = Math.max(0, quantity - 1);
  const inc = Math.min(maxStock, quantity + 1);

  return (
    <div className="flex items-center gap-2">
      <form action={updateCartItemQuantityForm}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={dec} />
        <button
          type="submit"
          aria-label="Diminuir"
          className="flex h-8 w-8 items-center justify-center border border-foreground/20 text-sm transition-colors hover:border-foreground disabled:opacity-40"
          disabled={quantity <= 0}
        >
          −
        </button>
      </form>

      <span className="w-8 text-center text-sm font-medium">{quantity}</span>

      <form action={updateCartItemQuantityForm}>
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <input type="hidden" name="quantity" value={inc} />
        <button
          type="submit"
          aria-label="Aumentar"
          disabled={quantity >= maxStock}
          className="flex h-8 w-8 items-center justify-center border border-foreground/20 text-sm transition-colors hover:border-foreground disabled:cursor-not-allowed disabled:opacity-40"
        >
          +
        </button>
      </form>

      <form action={removeFromCartAction} className="ml-3">
        <input type="hidden" name="cartItemId" value={cartItemId} />
        <button
          type="submit"
          className="text-[10px] font-medium uppercase tracking-[0.15em] text-muted-foreground transition-colors hover:text-destructive"
        >
          Remover
        </button>
      </form>
    </div>
  );
}
