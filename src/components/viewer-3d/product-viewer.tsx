"use client";

import React from "react";
import { Viewer3D } from "@/components/viewer-3d/viewer";
import { ProductPlaceholder } from "@/components/product/product-placeholder";

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
}: {
  modelUrl?: string;
  interactive?: boolean;
  autoRotate?: boolean;
}) {
  return (
    <ViewerErrorBoundary>
      <Viewer3D
        modelUrl={modelUrl}
        interactive={interactive}
        autoRotate={autoRotate}
      />
    </ViewerErrorBoundary>
  );
}
