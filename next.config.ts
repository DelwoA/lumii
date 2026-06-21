import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Repo root holds planning docs + pnpm-workspace.yaml; pin Turbopack root to
  // this app dir to silence the inferred-workspace-root warning.
  turbopack: {
    root: __dirname,
  },
  experimental: {
    // Quiz PDF generation + AI uploads can produce larger server-action payloads.
    serverActions: {
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
