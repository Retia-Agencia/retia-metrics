import Link from "next/link";
import { Boxes, Database, ListChecks, Users } from "lucide-react";
import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Indice de ajustes (enmienda del ticket 013, Mani 20-sep).
 *
 * Deja de ser exclusivo de gerente y la guarda baja a cada subpagina: hoy un closer
 * administra las plataformas de pago, asi que necesita una puerta. Lo que entra aca
 * es PROYECCION, no permiso — un enlace que no ve igual lo rebotaria su propia
 * guarda—: sin proyectar, el closer veria tres tarjetas que lo devuelven a `/mi-dia`,
 * que es peor que no verlas.
 *
 * La pregunta es `esAdministrador` sobre el ROL DE VISTA, no `rol === "gerente"`
 * (ADR 0025 punto 5, ADR 0028): el developer administra y no puede quedarse afuera
 * de su propia app.
 */
const ENLACES = [
  {
    href: "/ajustes/programas",
    icono: Boxes,
    titulo: "Programas y cohortes",
    descripcion:
      "Los programas con su slug, web y Calendly, y las cohortes de cada uno: se crean y desactivan sin tocar código.",
    soloAdministradores: true,
  },
  {
    href: "/ajustes/fuentes",
    icono: Database,
    titulo: "Fuentes de datos",
    descripcion:
      "Qué hojas lee la app, cuándo fue la última sincronización y cuántas personas hay en la base.",
    soloAdministradores: true,
  },
  {
    href: "/ajustes/catalogos",
    icono: ListChecks,
    titulo: "Catálogos",
    descripcion:
      "Plataformas de pago, motivos de pérdida y orígenes del lead: se agregan, renombran y desactivan sin tocar código.",
    soloAdministradores: false,
  },
  {
    href: "/ajustes/usuarios",
    icono: Users,
    titulo: "Usuarios",
    descripcion:
      "Quién puede entrar, con qué rol y en qué programas vende cada closer: se agregan, editan y desactivan sin CLI.",
    soloAdministradores: true,
  },
] as const;

export default async function AjustesPage() {
  const session = await paginaConRol("gerente", "closer");
  const esAdmin = esAdministrador(await rolDeVista(session));
  const visibles = ENLACES.filter((e) => esAdmin || !e.soloAdministradores);

  return (
    <PageShell titulo="Ajustes" descripcion="Fuentes de datos, usuarios y parámetros de cohorte.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {visibles.map(({ href, icono: Icono, titulo, descripcion }) => (
          <Link key={href} href={href} className="block">
            <Card className="h-full transition-colors hover:bg-accent/40">
              <CardHeader className="flex-row items-center gap-2 space-y-0">
                <Icono className="size-4 text-muted-foreground" />
                <CardTitle className="text-base">{titulo}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">{descripcion}</CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </PageShell>
  );
}
