"use client";

import React from "react";
import { Viewer3D } from "@/components/viewer-3d/viewer";
import { ProductPlaceholder } from "@/components/product/product-placeholder";
import { useProductColor } from "@/components/product/product-color";
import { colorToHex } from "@/lib/color-names";

class ViewerErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return <ProductPlaceholder label="Pré-visualização 3D indisponível" />;
    }
    return this.props.children;
  }
}

export function ProductViewer({
  modelUrl,
  interactive,
  autoRotate,
  controls,
  mannequin,
}: {
  modelUrl?: string;
  interactive?: boolean;
  autoRotate?: boolean;
  controls?: boolean;
  mannequin?: boolean;
}) {
  // Na página do produto, a peça aparece na cor escolhida na compra.
  const [selectedColor] = useProductColor();
  return (
    <ViewerErrorBoundary>
      <Viewer3D
        modelUrl={modelUrl}
        interactive={interactive}
        autoRotate={autoRotate}
        controls={controls}
        mannequin={mannequin}
        color={selectedColor ? colorToHex(selectedColor) : undefined}
      />
    </ViewerErrorBoundary>
  );
}
