"use client";

import { createContext, useContext } from "react";

/** Modo leve do provador (ver `src/lib/render-quality.ts`). */
export const LiteContext = createContext(false);

export const useLite = () => useContext(LiteContext);
