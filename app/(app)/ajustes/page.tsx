import Link from "next/link";
import { Boxes, Database, ListChecks, Users } from "lucide-react";
import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AjustesPage() {
  await paginaConRol("gerente");
  return (
    <PageShell titulo="Ajustes" descripcion="Fuentes de datos, usuarios y parámetros de cohorte.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Link href="/ajustes/programas" className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Boxes className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Programas y cohortes</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Los programas con su slug, web y Calendly, y las cohortes de cada uno: se crean
              y desactivan sin tocar código.
            </CardContent>
          </Card>
        </Link>
        <Link href="/ajustes/fuentes" className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Database className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Fuentes de datos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Qué hojas lee la app, cuándo fue la última sincronización y cuántas personas
              hay en la base.
            </CardContent>
          </Card>
        </Link>
        <Link href="/ajustes/catalogos" className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <ListChecks className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Catálogos</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Plataformas de pago, motivos de pérdida y orígenes del lead: se agregan,
              renombran y desactivan sin tocar código.
            </CardContent>
          </Card>
        </Link>
        <Link href="/ajustes/usuarios" className="block">
          <Card className="h-full transition-colors hover:bg-accent/40">
            <CardHeader className="flex-row items-center gap-2 space-y-0">
              <Users className="size-4 text-muted-foreground" />
              <CardTitle className="text-base">Usuarios</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Quién puede entrar, con qué rol y en qué programas vende cada closer: se
              agregan, editan y desactivan sin CLI.
            </CardContent>
          </Card>
        </Link>
      </div>
    </PageShell>
  );
}
