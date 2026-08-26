import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The page is fully static: export plain HTML so any static host serves it.
  output: "export",
  // No image-optimizer server in a static export; media ships pre-sized.
  images: { unoptimized: true },
  // apps/landing lives in an npm workspace with hoisted node_modules; point
  // Turbopack at the monorepo root so `next` resolves during standalone builds.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
};

export default nextConfig;
