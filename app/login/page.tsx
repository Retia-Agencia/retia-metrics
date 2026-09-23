import { redirect } from "next/navigation";
import { auth, signIn } from "@/lib/auth";
import { destinoInicial } from "@/lib/auth/page-guards";
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
        </CardContent>
      </Card>
    </main>
  );
}
