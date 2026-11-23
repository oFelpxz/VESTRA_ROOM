"use client";

import { createContext, useContext, useState, type ReactNode } from "react";

/**
 * Cor escolhida na página do produto, dividida entre a compra (botões de
 * cor) e o 3D (a peça aparece na cor escolhida).
 */
type ProductColor = [string | null, (color: string | null) => void];

const ProductColorContext = createContext<ProductColor | null>(null);

export function ProductColorProvider({ children }: { children: ReactNode }) {
  const state = useState<string | null>(null);
  return <ProductColorContext.Provider value={state}>{children}</ProductColorContext.Provider>;
}

/** Cor escolhida; fora do provider, cada componente guarda a sua. */
export function useProductColor(): ProductColor {
  const shared = useContext(ProductColorContext);
  const local = useState<string | null>(null);
  return shared ?? local;
}
