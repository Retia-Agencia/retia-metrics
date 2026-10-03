import Link from "next/link";
import { Activity, FileWarning, ListChecks, Radio, Shapes, Users } from "lucide-react";
import { paginaConRol } from "@/lib/auth/page-guards";
import { esAdministrador, manejaPauta, type Rol } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Índice de Ajustes (ticket 173, ADR 0077 punto 1): queda SOLO lo que no es de ningún
 * objeto —usuarios y roles, canales, webhook, motivos y áreas— más las rarezas de la
 * migración mientras el 078 no cierre. Lo que vive en un Programa o en Mi espacio
 * (programas y cohortes, fuentes, dónde vende cada closer) se fue de aquí (A-81).
 *
 * Lo que entra es PROYECCIÓN, no permiso: cada subpágina conserva su guarda de servidor
 * (esconder un enlace no es seguridad). La pregunta se hace por capacidad sobre el ROL
 * DE VISTA (ADR 0025 punto 5, ADR 0028), nunca `rol === "..."`: `esAdministrador` para
 * casi todo, `manejaPauta` para Canales (ADR 0052). Un rol que no ve ninguna tarjeta
 * (hoy el paid trafficker sin acceso a nada más que Canales) recibe un estado vacío.
 */
const ENLACES = [
  {
    href: "/ajustes/usuarios",
    icono: Users,
    titulo: "Usuarios",
    descripcion: "Quién puede entrar y con qué rol: se agregan, editan y desactivan sin CLI.",
    requisito: "administra",
  },
  {
    href: "/ajustes/canales",
    icono: Radio,
    titulo: "Canales",
    descripcion: "De qué canal y área viene cada envío.",
    requisito: "pauta",
  },
  {
    href: "/ajustes/salud",
    icono: Activity,
    titulo: "Webhook Health",
    descripcion: "Cada entrega del webhook por programa, la conciliación y el aviso de fuentes en silencio.",
    requisito: "administra",
  },
  {
    href: "/ajustes/catalogos",
    icono: ListChecks,
    titulo: "Motivos",
    descripcion: "Los motivos que se usan al perder, retroceder o recuperar un deal.",
    requisito: "administra",
  },
  {
    href: "/ajustes/areas",
    icono: Shapes,
    titulo: "Áreas",
    descripcion: "Agrupan los canales por área de origen, para el rendimiento por área.",
    requisito: "administra",
  },
  {
    href: "/ajustes/migracion",
    icono: FileWarning,
    titulo: "Rarezas de la migración",
    descripcion: "Lo que la migración no pudo clasificar, por programa y por tipo, con el deal o lead que apunta.",
    requisito: "administra",
  },
] as const;

/** ¿Este actor ve esta tarjeta? Por capacidad, nunca por el literal del rol (ADR 0025). */
function puedeVer(requisito: (typeof ENLACES)[number]["requisito"], rol: Rol | null): boolean {
  return requisito === "pauta" ? manejaPauta(rol) : esAdministrador(rol);
}

export default async function AjustesPage() {
  // Los tres roles base entran al índice (paid_trafficker incluido): la proyección y
  // la guarda de cada subpágina deciden qué puede tocar cada uno.
  const session = await paginaConRol("gerente", "closer", "paid_trafficker");
  const rol = await rolDeVista(session);
  const visibles = ENLACES.filter((e) => puedeVer(e.requisito, rol));

  return (
    <PageShell titulo="Ajustes" descripcion="Usuarios y roles, canales, webhook, motivos y áreas.">
      {visibles.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">
            No hay ajustes disponibles para tu rol.
          </CardContent>
        </Card>
      ) : (
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
      )}
    </PageShell>
  );
}
