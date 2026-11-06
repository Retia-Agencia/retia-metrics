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
  // Caché de cliente para páginas dinámicas (todas lo son): sin esto, volver a una pestaña ya vista
  // la pide entera al servidor (0 s desde Next 15). Con 15 s, A→B→A dentro de esa ventana es instantáneo.
  // RIESGO de frescura: solo para cambios EXTERNOS a la sesión (otro closer, webhook, Calendly, cron),
  // que se ven hasta 15 s tarde al volver a una pestaña cacheada. Las escrituras propias NO quedan
  // viejas: toda server action con revalidatePath y todo router.refresh() purgan el caché de cliente
  // entero (probado en dev:local el 6-nov). Atrás/adelante del navegador ya reutilizaba caché sin esto.
  // No subir de 30 s ni tocar `static` sin repetir esa prueba. Doc: next/docs staleTimes.md (experimental).
  experimental: { staleTimes: { dynamic: 15 } },
  // Incluye el manual HTML en el despliegue de la ruta autenticada.
  outputFileTracingIncludes: { "/manual": ["./docs/manuales/operacion-comercial.html"] },
  async headers() {
    return [{ source: "/:path*", headers: cabecerasDeSeguridad }];
  },
};

export default nextConfig;
