import type { NextConfig } from "next";

/**
 * Las cuatro que no rompen nada. La CSP completa va con nonce cuando entre
 * Recharts en la Fase 2: ponerla ahora obligaria a aflojarla en dos semanas.
 */
const cabecerasDeSeguridad = [
  // Nadie puede meter la app en un iframe. Cierra el clickjacking sobre un gerente
  // con sesion abierta, que en la Fase 4 deja de ser teorico: ahi hay botones que
  // escriben de vuelta en Sheets.
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Content-Type-Options", value: "nosniff" },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
