import type { NextConfig } from "next";
import { config } from "dotenv";
import { resolve } from "path";

// Load root .env so REMOTE_API_URL is available to next.config.ts
config({ path: resolve(__dirname, "../../.env") });

const remoteApiUrl = process.env.REMOTE_API_URL || "http://localhost:8080";
const docsUrl = process.env.DOCS_URL || "http://localhost:4000";

// Allow both localhost and 127.0.0.1 in dev by default, then merge any
// additional hosts derived from CORS_ALLOWED_ORIGINS. ALLOWED_ORIGINS remains
// as a legacy alias so older local .env files do not silently break HMR.
const defaultAllowedDevOrigins = ["localhost", "127.0.0.1"];
const configuredOriginsEnv = process.env.CORS_ALLOWED_ORIGINS || process.env.ALLOWED_ORIGINS || "";
const configuredAllowedDevOrigins = configuredOriginsEnv
  ? configuredOriginsEnv.split(",")
      .map((origin) => {
        try {
          return new URL(origin.trim()).host;
        } catch {
          return origin.trim();
        }
      })
      .filter(Boolean)
  : [];
const allowedDevOrigins = Array.from(new Set([...defaultAllowedDevOrigins, ...configuredAllowedDevOrigins]));

const nextConfig: NextConfig = {
  ...(process.env.STANDALONE === "true" ? { output: "standalone" as const } : {}),
  // Pin tracing to the Mortis repo root so Windows lockfiles outside the repo
  // do not confuse Next.js when this workspace is launched from a nested app.
  outputFileTracingRoot: resolve(__dirname, "../.."),
  transpilePackages: ["@multica/core", "@multica/ui", "@multica/views"],
  ...(allowedDevOrigins.length > 0 ? { allowedDevOrigins } : {}),
  images: {
    formats: ["image/avif", "image/webp"],
    qualities: [75, 80, 85],
  },
  async rewrites() {
    return {
      // Run before file-system routes so /docs isn't shadowed by the
      // [workspaceSlug] dynamic segment.
      beforeFiles: [
        {
          source: "/docs",
          destination: `${docsUrl}/docs`,
        },
        {
          source: "/docs/:path*",
          destination: `${docsUrl}/docs/:path*`,
        },
      ],
      afterFiles: [
        {
          source: "/api/:path*",
          destination: `${remoteApiUrl}/api/:path*`,
        },
        {
          source: "/ws",
          destination: `${remoteApiUrl}/ws`,
        },
        {
          source: "/auth/:path*",
          destination: `${remoteApiUrl}/auth/:path*`,
        },
        {
          source: "/uploads/:path*",
          destination: `${remoteApiUrl}/uploads/:path*`,
        },
      ],
      fallback: [],
    };
  },
};

export default nextConfig;
