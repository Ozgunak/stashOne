import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const nextConfig: NextConfig = {
  turbopack: {
    root: dirname(fileURLToPath(import.meta.url)),
  },

  images: {
    // Allowlist of remote hosts the <Image> component can fetch from.
    // Without this, Next.js refuses to optimize external images
    // (security: prevents arbitrary-host SSRF via image loader).
    remotePatterns: [
      {
        protocol: "https",
        hostname: "assets.nhle.com",
        pathname: "/**",
      },
    ],

    // NHL team logos are SVG. Next.js disallows optimizing SVGs by
    // default because user-supplied SVG can contain XSS payloads.
    // Our SVGs come from a trusted CDN (assets.nhle.com), so we
    // enable it AND lock down with a strict CSP that blocks scripts
    // inside the SVG sandbox.
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },
};

export default nextConfig;
