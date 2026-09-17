import Link from "next/link";
import { Database, ListChecks } from "lucide-react";
import { paginaConRol } from "@/lib/auth/page-guards";
import { PageShell } from "@/components/page-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AjustesPage() {
  await paginaConRol("gerente");
  return (
    <PageShell titulo="Ajustes" descripcion="Fuentes de datos, usuarios y parámetros de cohorte.">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
      </div>
    </PageShell>
  );
}
