import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";
import { COOKIE_PROGRAMA_PREFERIDO, slugParaRecordar } from "@/lib/programa-preferido";

/**
 * Next 16 renombro `middleware.ts` a `proxy.ts`.
 * Usa la config edge-safe (sin base de datos): solo lee y valida el JWT.
 *
 * Esto es la primera barrera, no la unica. Cada ruta vuelve a validar el rol en el
 * servidor con requireRole() — el proxy no sabe de roles, solo de "hay sesion o no".
 */
const { auth } = NextAuth(authConfig);

export default auth((req) => {
  const { pathname, search } = req.nextUrl;

  const esRutaPublica =
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname === "/api/health" ||
    // El webhook de formularios (ADR 0055): no tiene sesion, se autentica con la firma
    // HMAC en el propio handler. Nunca redirige a /login, o cada envio se perderia.
    pathname.startsWith("/api/webhooks/formularios/") ||
    // El webhook de Calendly (ticket 096): mismo caso, firma con la clave del programa.
    pathname.startsWith("/api/webhooks/calendly/");

  if (esRutaPublica) return NextResponse.next();

  if (req.auth?.user?.id) {
    // Una precarga de Next no es una visita: si contara, un link precargado a otro
    // programa cambiaria el recordado sin que nadie hiciera clic.
    const esPrecarga = req.headers.has("next-router-prefetch") || req.headers.get("purpose") === "prefetch";
    const slug = esPrecarga ? null : slugParaRecordar(pathname, req.nextUrl.searchParams);
    const actual = req.cookies.get(COOKIE_PROGRAMA_PREFERIDO)?.value;
    const response = NextResponse.next();
    if (slug && slug !== actual) {
      response.cookies.set(COOKIE_PROGRAMA_PREFERIDO, slug, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        secure: process.env.NODE_ENV === "production",
      });
    }
    return response;
  }

  // Las APIs responden 401 en JSON; las paginas redirigen al login.
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Necesitas iniciar sesion." }, { status: 401 });
  }

  const url = new URL("/login", req.nextUrl.origin);
  if (pathname !== "/") url.searchParams.set("desde", `${pathname}${search}`);
  return NextResponse.redirect(url);
});

export const config = {
  matcher: [
    // Todo, salvo assets estaticos y archivos con extension.
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
