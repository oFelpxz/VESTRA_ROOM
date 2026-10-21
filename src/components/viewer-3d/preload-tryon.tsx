"use client";

import { useEffect } from "react";
import { useGLTF } from "@react-three/drei";
import { AVATAR_URL } from "./avatar-url";

/**
 * Baixa o corpo do provador enquanto o cliente olha a página do produto (a
 * peça já vem pelo 3D da página): ao abrir o provador, os dois estão em cache.
 */
export function PreloadTryOn() {
  useEffect(() => {
    const load = () => useGLTF.preload(AVATAR_URL);
    if ("requestIdleCallback" in window) {
      const id = requestIdleCallback(load, { timeout: 3000 });
      return () => cancelIdleCallback(id);
    }
    const id = setTimeout(load, 1500);
    return () => clearTimeout(id);
  }, []);
  return null;
}
