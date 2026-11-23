import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "**",
      },
    ],
  },
  // Item 21: as fotos da troca (até 3) vão na server action. O navegador já
  // reduz cada uma para ~1600 px antes de enviar; o padrão do Next é 1 MB.
  experimental: {
    serverActions: { bodySizeLimit: "8mb" },
  },
  // sharp e o pipeline glTF (gltf-transform) rodam só em server actions / route
  // handlers Node. Mantê-los externos evita o bundler tentar resolver os
  // binários nativos no build.
  serverExternalPackages: [
    "sharp",
    "@gltf-transform/core",
    "@gltf-transform/functions",
    "@gltf-transform/extensions",
    "ndarray-pixels",
  ],
};

export default nextConfig;
