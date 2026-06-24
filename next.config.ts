import type { NextConfig } from 'next'

// Content-Security-Policy. En producción se elimina 'unsafe-eval' (bloquea
// payloads basados en eval/Function). Se conserva 'unsafe-inline' en script-src
// porque Next.js 16 (Turbopack) emite scripts inline de hidratación y NO propaga
// el nonce a sus scripts (verificado), por lo que una CSP basada en nonce dejaría
// la app sin hidratar. 'unsafe-eval' solo se permite en desarrollo (Turbopack/HMR).
const IS_DEV = process.env.NODE_ENV !== 'production'
const scriptSrc = IS_DEV
  ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
  : "script-src 'self' 'unsafe-inline'"

const csp = [
  "default-src 'self'",
  scriptSrc,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ')

const securityHeaders = [
  { key: 'Content-Security-Policy', value: csp },
  { key: 'X-Frame-Options', value: 'DENY' },                                   // anti-clickjacking
  { key: 'X-Content-Type-Options', value: 'nosniff' },                         // anti MIME-sniffing
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },        // no fuga de URLs
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' }, // fuerza HTTPS
  { key: 'X-DNS-Prefetch-Control', value: 'off' },
  { key: 'X-Permitted-Cross-Domain-Policies', value: 'none' },
]

const nextConfig: NextConfig = {
  // Activa el MCP server en /_next/mcp (Next.js 16+)
  experimental: {
    mcpServer: true,
  },
  // No revelar el framework en la cabecera X-Powered-By
  poweredByHeader: false,
  async headers() {
    return [
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ]
  },
}

export default nextConfig
