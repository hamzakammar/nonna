import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Price Watch reads its mock competitor websites from disk at runtime; ship them with every function.
  outputFileTracingIncludes: {
    "/**": ["./src/lib/pricewatch/fixtures/**/*"],
  },
};

export default nextConfig;
