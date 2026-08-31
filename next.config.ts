import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
