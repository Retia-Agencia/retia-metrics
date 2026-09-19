import { paginaConRol } from "@/lib/auth/page-guards";
import { estadoDeFuentes, fuentesParaAdmin } from "@/lib/queries/fuentes";
import { PageShell } from "@/components/page-shell";
import { haceCuanto } from "@/lib/format";
import { BotonSincronizar } from "@/components/boton-sincronizar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";
import { FuentesAdmin, type ProgramaConFuentes } from "@/components/fuentes-admin";

export const dynamic = "force-dynamic";

type MapeoColumnas = Record<string, string | string[]>;

export default async function FuentesPage() {
  await paginaConRol("gerente");
  const { conteos, corridas, cambios } = await estadoDeFuentes();
  const { programas, fuentes } = await fuentesParaAdmin();

  // Se arma la vista por programa para la administracion: cada programa con sus
  // fuentes. El sheetId viaja completo (lo necesita el formulario de edicion) y se
  // trunca al PINTAR (S-13, `truncarId`), no aca.
  const programasConFuentes: ProgramaConFuentes[] = programas.map((p) => ({
    id: p.id,
    slug: p.slug,
    nombre: p.nombre,
    plantillaLead: (p.plantillaLead as MapeoColumnas | null) ?? null,
    fuentes: fuentes
      .filter((f) => f.programId === p.id)
      .map((f) => ({
        id: f.id,
        programId: f.programId,
        nombre: f.nombre,
        tipo: f.tipo,
        sheetId: f.sheetId,
        tab: f.tab,
        rango: f.rango,
        destino: f.destino,
        mapeoColumnas: (f.mapeoColumnas as MapeoColumnas) ?? {},
        activo: f.activo,
        ultimaSync: f.ultimaSync ? f.ultimaSync.toISOString() : null,
        orden: f.orden,
      })),
  }));

  return (
    <PageShell
      titulo="Fuentes de datos"
      descripcion="De dónde lee la app, cómo se mapean sus columnas y cuándo fue la última sincronización."
    >
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {conteos.map((c) => {
            const dup = c.aplicaciones ? 1 - c.personas / c.aplicaciones : 0;
            return (
              <Card key={c.slug}>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {c.nombre}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-2xl font-semibold tabular-nums">{num(c.personas)}</p>
                  <p className="text-xs text-muted-foreground">
                    personas · {num(c.aplicaciones)} aplicaciones · {pct(dup)} duplicados
                  </p>
                </CardContent>
              </Card>
            );
          })}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Cambios registrados
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-2xl font-semibold tabular-nums">{num(cambios)}</p>
              <p className="text-xs text-muted-foreground">en la bitácora</p>
            </CardContent>
          </Card>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-2">
          {programas.map((p) => (
            <BotonSincronizar key={p.id} programa={p.slug} />
          ))}
        </div>

        <FuentesAdmin programas={programasConFuentes} />

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas sincronizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            {corridas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no se ha corrido ninguna.</p>
            ) : (
              <div className="space-y-1 text-sm">
                {corridas.map((c) => (
                  <div key={c.id} className="flex flex-wrap items-center gap-2">
                    <Badge
                      variant={c.estado === "ok" ? "secondary" : c.estado === "error" ? "destructive" : "outline"}
                    >
                      {c.estado}
                    </Badge>
                    <span className="text-muted-foreground">{haceCuanto(c.iniciado)}</span>
                    <span className="tabular-nums">
                      {num(c.filasLeidas)} filas · {num(c.personasNuevas)} nuevas ·{" "}
                      {num(c.personasActualizadas)} actualizadas
                    </span>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
