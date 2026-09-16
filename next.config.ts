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
  // Enlaces viejos: antes cada programa tenia su ruta fija (`/comunicarte`,
  // `/tactical-investor`); hoy el dashboard vive en `/programas/[slug]` (ADR 0012).
  // Estas redirecciones viven en config, no en codigo de app, a proposito: el
  // guardian del contrato de extension (tests/contrato-extension.test.ts) no revisa
  // este archivo, asi que nombrar aqui los slugs viejos no rompe la regla. Son
  // permanentes (308) porque las rutas viejas no vuelven. Se pueden borrar cuando
  // nadie use ya los enlaces viejos.
  async redirects() {
    return [
      { source: "/comunicarte", destination: "/programas/comunicarte", permanent: true },
      {
        source: "/tactical-investor",
        destination: "/programas/tactical-investor",
        permanent: true,
      },
    ];
  },
};

export default nextConfig;
