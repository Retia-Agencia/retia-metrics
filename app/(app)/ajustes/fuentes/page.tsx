import { paginaConRol } from "@/lib/auth/page-guards";
import { estadoDeFuentes } from "@/lib/queries/fuentes";
import { PageShell } from "@/components/page-shell";
import { BotonSincronizar } from "@/components/boton-sincronizar";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { num, pct } from "@/lib/format";

export const dynamic = "force-dynamic";

const DESTINOS: Record<string, string> = {
  people: "Personas",
  calls: "Llamadas",
  sales: "Ventas",
  ad_spend: "Pauta",
};

function haceCuanto(d: Date | null) {
  if (!d) return "nunca";
  const min = Math.round((Date.now() - new Date(d).getTime()) / 60000);
  if (min < 1) return "hace segundos";
  if (min < 60) return `hace ${min} min`;
  const h = Math.round(min / 60);
  if (h < 24) return `hace ${h} h`;
  return `hace ${Math.round(h / 24)} d`;
}

export default async function FuentesPage() {
  await paginaConRol("gerente");
  const { fuentes, conteos, corridas, cambios } = await estadoDeFuentes();

  const porPrograma = new Map<string, typeof fuentes>();
  for (const f of fuentes) {
    const lista = porPrograma.get(f.programaSlug) ?? [];
    lista.push(f);
    porPrograma.set(f.programaSlug, lista);
  }

  return (
    <PageShell
      titulo="Fuentes de datos"
      descripcion="De dónde lee la app y cuándo fue la última sincronización."
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

        {[...porPrograma.entries()].map(([slug, lista]) => (
          <Card key={slug}>
            <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
              <CardTitle className="text-base">{lista[0].programaNombre}</CardTitle>
              <BotonSincronizar programa={slug} />
            </CardHeader>
            <CardContent className="space-y-2">
              {lista.map((f) => (
                <div
                  key={f.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <span className="font-medium">{f.nombre}</span>
                    <span className="ml-2 text-muted-foreground">· {f.tab}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">{DESTINOS[f.destino] ?? f.destino}</Badge>
                    {f.activo ? (
                      <Badge variant="secondary">{haceCuanto(f.ultimaSync)}</Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground">
                        sin mapeo
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
              <p className="pt-1 text-xs text-muted-foreground">
                Las fuentes marcadas <span className="font-medium">sin mapeo</span> están
                inactivas: sus columnas todavía no se han verificado contra la hoja real.
              </p>
            </CardContent>
          </Card>
        ))}

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
