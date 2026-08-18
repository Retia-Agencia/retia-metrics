import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth/config";

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
    pathname === "/api/health";

  if (esRutaPublica) return NextResponse.next();

  if (req.auth?.user?.id) return NextResponse.next();

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
