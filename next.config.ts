import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Standalone solo para Docker/self-host (lo exige el Dockerfile).
  // En Vercel se usa su output nativo: standalone ahí rompe el trace
  // `.next/next-server.js.nft.json` y tumba el build. Vercel pone VERCEL=1.
  ...(process.env.VERCEL ? {} : { output: "standalone" }),
};

export default nextConfig;
