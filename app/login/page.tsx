import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { destinoInicial } from "@/lib/auth/page-guards";
import { loginLocalHabilitado, LOGIN_LOCAL_ID } from "@/lib/auth/login-local";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Marca } from "@/components/marca";

const MENSAJES_ERROR: Record<string, string> = {
  AccessDenied:
    "Tu correo no está autorizado. El acceso lo habilita la gerencia comercial uno por uno — no hay registro abierto.",
  Configuration:
    "La autenticación no está configurada correctamente. Avisa a la gerencia comercial.",
  Verification: "El enlace expiró. Intenta entrar de nuevo.",
};

/**
 * Los usuarios activos que ofrece el formulario local (solo dev). Import dinamico del
 * driver, igual que `lib/auth/revalidacion.ts`: mantiene la base fuera del bundle que no
 * la necesita. Nunca corre en produccion (el formulario no se pinta).
 */
async function usuariosParaLoginLocal(): Promise<{ email: string; nombre: string | null; rol: string }[]> {
  const { db } = await import("@/lib/db");
  const { users } = await import("@/lib/db/schema");
  const { eq, asc } = await import("drizzle-orm");
  return db
    .select({ email: users.email, nombre: users.nombre, rol: users.rol })
    .from(users)
    .where(eq(users.activo, true))
    .orderBy(asc(users.email));
}

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

export default async function LoginPage({ searchParams }: { searchParams: Busqueda }) {
  const session = await auth();
  if (session?.user?.id) redirect(await destinoInicial(session.user.rol));

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const desdeCrudo = typeof params.desde === "string" ? params.desde : undefined;
  // Solo rutas internas. Hoy el callback `redirect` por defecto de Auth.js ya
  // descarta otro origen, pero esa proteccion es invisible: desaparece el dia que
  // alguien defina un callback `redirect` propio para manejar el callbackUrl, sin
  // tocar esta linea. Ojo con "//evil.com": empezar por "/" no alcanza, porque el
  // navegador lo resuelve como dominio externo.
  const desde =
    desdeCrudo?.startsWith("/") && !desdeCrudo.startsWith("//") ? desdeCrudo : undefined;

  // El login local (ticket 069) solo existe en `npm run dev:local`: flag + base local.
  // En produccion `loginLocalHabilitado()` es `false` y este bloque no se pinta.
  const conLoginLocal = loginLocalHabilitado();
  const usuariosLocales = conLoginLocal ? await usuariosParaLoginLocal() : [];

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <Marca />
      <Card className="w-full max-w-sm shadow-flotante">
        <CardHeader>
          <CardTitle className="text-base">Entra con tu cuenta del equipo</CardTitle>
          <CardDescription>
            Acceso restringido al equipo comercial de Retia.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error ? (
            <p
              role="alert"
              className="rounded-lg bg-tono-peligro-suave p-3 text-sm text-tono-peligro"
            >
              {MENSAJES_ERROR[error] ?? "No se pudo iniciar sesión. Intenta de nuevo."}
            </p>
          ) : null}

          <form
            action={async () => {
              "use server";
              await signIn("google", { redirectTo: desde ?? "/" });
            }}
          >
            <Button type="submit" size="lg" className="w-full">
              Entrar con Google
            </Button>
          </form>

          <p className="text-xs text-muted-foreground">
            Esta herramienta maneja datos personales de leads y cifras comerciales. No la
            compartas fuera del equipo.
          </p>

          {conLoginLocal ? (
            <form
              className="space-y-3 border-t border-border pt-4"
              action={async (formData) => {
                "use server";
                const correo = String(formData.get("email") ?? "").toLowerCase().trim();
                await signIn(LOGIN_LOCAL_ID, { email: correo, redirectTo: desde ?? "/" });
              }}
            >
              <label className="block text-xs font-medium text-muted-foreground" htmlFor="email-local">
                Entrar como (local)
              </label>
              <input
                id="email-local"
                name="email"
                type="email"
                required
                list={usuariosLocales.length > 0 ? "usuarios-locales" : undefined}
                defaultValue={usuariosLocales[0]?.email ?? ""}
                placeholder="dev@retia.local"
                className="h-9 w-full rounded-lg border border-border bg-card px-3 text-sm outline-none focus-visible:ring-2 focus-visible:ring-ring"
              />
              {usuariosLocales.length > 0 ? (
                <datalist id="usuarios-locales">
                  {usuariosLocales.map((u) => (
                    <option key={u.email} value={u.email}>
                      {u.nombre ? `${u.nombre} · ${u.rol}` : u.rol}
                    </option>
                  ))}
                </datalist>
              ) : null}
              <Button type="submit" variant="secondary" size="lg" className="w-full">
                Entrar como (local)
              </Button>
              <p className="text-xs text-muted-foreground">
                Solo desarrollo, contra la base local de Docker. No existe en producción.
              </p>
            </form>
          ) : null}
        </CardContent>
      </Card>
    </main>
  );
}
