import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { Marca } from "@/components/marca";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSesionReal } from "@/lib/auth/guards";
import { etiquetaDeRol } from "@/lib/auth/roles";
import { rolRealDeSesion, sesionEfectiva } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { ErrorDeAutorizar, validarPeticionDeAutorizar } from "@/lib/oauth/autorizar";
import { issuer } from "@/lib/oauth/origen";
import { scopeConcedido } from "@/lib/oauth/scope";
import { cancelarConexion, permitirConexion } from "./acciones";

export const dynamic = "force-dynamic";

type Busqueda = Promise<Record<string, string | string[] | undefined>>;

function simples(crudos: Record<string, string | string[] | undefined>): Record<string, string | undefined> {
  return Object.fromEntries(Object.entries(crudos).map(([clave, valor]) => [clave, Array.isArray(valor) ? valor[0] : valor]));
}

function redireccionDeError(error: ErrorDeAutorizar): string {
  const url = new URL(error.redirectUri!);
  url.searchParams.set("error", error.codigo);
  url.searchParams.set("error_description", error.message);
  if (error.state !== undefined) url.searchParams.set("state", error.state);
  url.searchParams.set("iss", issuer());
  return url.toString();
}

function TarjetaDeError({ suplantando = false }: { suplantando?: boolean }) {
  return (
    <Card className="w-full max-w-sm shadow-flotante">
      <CardHeader>
        <CardTitle className="text-base">No se puede completar la conexión</CardTitle>
        <CardDescription role="alert">
          {suplantando
            ? "Termina de ver como otra persona para conectar una IA."
            : "Esta conexión no es válida. Vuelve a Claude e inténtalo de nuevo."}
        </CardDescription>
      </CardHeader>
    </Card>
  );
}

export default async function AutorizarPage({ searchParams }: { searchParams: Busqueda }) {
  const real = await requireSesionReal();
  const efectiva = await sesionEfectiva(real);
  const params = simples(await searchParams);
  let peticion: Awaited<ReturnType<typeof validarPeticionDeAutorizar>>;
  try {
    peticion = await validarPeticionDeAutorizar(db, params);
  } catch (error) {
    if (error instanceof ErrorDeAutorizar && error.redirigir) redirect(redireccionDeError(error));
    return <Marco><TarjetaDeError /></Marco>;
  }
  if (efectiva.user.suplantadoPor) return <Marco><TarjetaDeError suplantando /></Marco>;
  const rolReal = rolRealDeSesion(real);
  if (!rolReal) return <Marco><TarjetaDeError /></Marco>;

  const scope = scopeConcedido(rolReal, peticion.scopePedido);
  const nombre = real.user.name ?? real.user.email ?? "Usuario";
  return (
    <Marco>
      <Card className="w-full max-w-lg shadow-flotante">
        <CardHeader>
          <CardTitle className="text-base">
            {peticion.cliente.nombre} quiere usar el CRM como {nombre} ({etiquetaDeRol(rolReal)})
          </CardTitle>
          <CardDescription>
            {scope === "lectura"
              ? "Solo podrá consultar lo que tú ya ves en el CRM."
              : "Podrá consultar y proponer cambios que tú confirmas."}
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Formulario params={params} action={cancelarConexion}>
            <Button type="submit" variant="outline" className="w-full sm:w-auto">Cancelar</Button>
          </Formulario>
          <Formulario params={params} action={permitirConexion}>
            <Button type="submit" className="w-full sm:w-auto">Permitir</Button>
          </Formulario>
        </CardContent>
      </Card>
    </Marco>
  );
}

function Marco({ children }: { children: ReactNode }) {
  return <main className="flex min-h-screen flex-col items-center justify-center gap-6 p-4"><Marca />{children}</main>;
}

function Formulario({ params, action, children }: {
  params: Record<string, string | undefined>;
  action: (formData: FormData) => Promise<never>;
  children: ReactNode;
}) {
  return (
    <form action={action} className="w-full sm:w-auto">
      {Object.entries(params).map(([clave, valor]) => valor === undefined ? null : (
        <input key={clave} type="hidden" name={clave} value={valor} />
      ))}
      {children}
    </form>
  );
}
