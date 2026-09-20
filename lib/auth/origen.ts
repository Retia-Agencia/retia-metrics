import { ErrorDeApp } from "@/lib/errors";

/**
 * Chequeo de origen (S-12). Es la defensa contra CSRF de los route handlers que
 * mutan.
 *
 * Por que hace falta en UNA sola ruta y no en todas: las mutaciones de esta app
 * son Server Actions, y Next ya compara `Origin` contra el host por su cuenta en
 * cada una. El unico handler que muta y no pasa por ahi es
 * `POST /api/sync/[programa]`. Todo lo demas bajo `app/api/` es GET o lo maneja
 * Auth.js. Por eso esto es un chequeo de diez lineas y no la migracion de las
 * mutaciones a Server Actions que proponia el handoff: esa migracion ya paso.
 *
 * Por que se compara contra `X-Forwarded-Host` primero: detras de Vercel el `Host`
 * que ve la funcion no siempre es el dominio que escribio el navegador, y comparar
 * contra el equivocado rechaza peticiones legitimas.
 *
 * Por que se deja pasar la peticion SIN `Origin`: la amenaza es un formulario de
 * otro sitio enviado por el navegador de alguien con sesion abierta, y en ese caso
 * el navegador SIEMPRE manda `Origin`. Una peticion sin la cabecera no viene de un
 * navegador, asi que no arrastra la cookie de nadie: es el mismo criterio que usa
 * Next. Lo que la protege es `requireRole`, que sigue corriendo igual.
 */
export function exigirMismoOrigen(req: Request): void {
  const origin = req.headers.get("origin");
  if (!origin) return;

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (!host) throw new ErrorDeApp("No se pudo verificar el origen de la peticion.", 403);

  let origenHost: string;
  try {
    origenHost = new URL(origin).host;
  } catch {
    throw new ErrorDeApp("Origen invalido.", 403);
  }

  if (origenHost !== host) {
    throw new ErrorDeApp("Origen no permitido.", 403);
  }
}
