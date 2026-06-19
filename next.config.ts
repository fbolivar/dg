import type { NextConfig } from 'next'

// Content-Security-Policy: bloquea la carga de scripts/recursos de orígenes no
// autorizados (principal mitigación de XSS e inyección). Se permite 'unsafe-inline'
// y 'unsafe-eval' porque Next.js/React inyectan estilos y scripts inline; en
// producción endurecida se reemplaza por nonces. connect-src habilita Supabase.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
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
