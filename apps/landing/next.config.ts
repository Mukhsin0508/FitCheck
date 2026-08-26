import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pages stay static, but the try-on render proxy (app/api/tryon) needs a
  // server runtime — so no `output: "export"` anymore.
  // No image-optimizer server; media ships pre-sized.
  images: { unoptimized: true },
  // apps/landing lives in an npm workspace with hoisted node_modules; point
  // Turbopack at the monorepo root so `next` resolves during standalone builds.
  turbopack: {
    root: path.join(__dirname, "..", ".."),
  },
  // The embedded app is an SPA under public/app/. afterFiles = real files
  // (JS chunks, images) win; everything else falls back to the SPA shell.
  async rewrites() {
    return {
      afterFiles: [
        { source: "/app", destination: "/app/index.html" },
        { source: "/app/:path*", destination: "/app/index.html" },
      ],
    };
  },
};

export default nextConfig;
