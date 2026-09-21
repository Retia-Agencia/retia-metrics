import { paginaConRol } from "@/lib/auth/page-guards";
import { db } from "@/lib/db";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { haceCuanto, num } from "@/lib/format";
import { ultimasCorridasDeSync } from "@/lib/queries/fuentes";
import {
  conteosPorOrigen,
  conteosPorPrograma,
  ultimosCambiosDesdeLaApp,
  usuariosActivosPorRol,
} from "@/lib/queries/nerd-stats";

export const dynamic = "force-dynamic";

/**
 * `/nerd-stats` (ticket 025): la salud de la herramienta sin abrir la base.
 *
 * Es la UNICA ruta exclusiva del developer (ADR 0025). `paginaConRol("developer")`
 * la cierra a gerente y closer por igual, y deja pasar al developer por la misma
 * excepcion central de `puedeAcceder` que abre todas las demas.
 *
 * Todo se renderiza en el servidor: es solo lectura, no hay nada que el navegador
 * tenga que recalcular, asi que no hay componente cliente ni JS que enviar.
 *
 * Nada de lo que sale aca es un dato personal: son conteos y metadatos. Eso se
 * garantiza en las consultas (ver la nota de `lib/queries/nerd-stats.ts`), no
 * recordando no pintarlo.
 */
export default async function NerdStatsPage() {
  await paginaConRol("developer");

  const [corridas, programas, origenes, cambios, roles] = await Promise.all([
    ultimasCorridasDeSync(8, db),
    conteosPorPrograma(db),
    conteosPorOrigen(db),
    ultimosCambiosDesdeLaApp(15, db),
    usuariosActivosPorRol(db),
  ]);

  // Metadatos del despliegue. `CRON_SECRET` se reporta como si/no y NUNCA su valor:
  // saber que esta puesto es diagnostico, verlo seria una fuga.
  const commit = process.env.VERCEL_GIT_COMMIT_SHA ?? null;
  const entorno = process.env.VERCEL_ENV ?? "local";
  const cronConfigurado = Boolean(process.env.CRON_SECRET);

  return (
    <PageShell
      titulo="Nerd Stats"
      descripcion="Salud de la herramienta. Solo conteos y metadatos: ningún dato personal."
    >
      <div className="grid gap-4">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Despliegue</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Fila etiqueta="Entorno" valor={entorno} />
              <Fila etiqueta="Commit" valor={commit ? commit.slice(0, 7) : "sin desplegar"} />
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">CRON_SECRET</span>
                <Badge variant={cronConfigurado ? "secondary" : "outline"}>
                  {cronConfigurado ? "configurado" : "FALTA"}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuarios activos</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              {roles.length === 0 ? (
                <p className="text-muted-foreground">Nadie puede entrar.</p>
              ) : (
                roles.map((r) => <Fila key={r.rol} etiqueta={r.rol} valor={num(r.total)} />)
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Registros por origen</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p className="text-xs text-muted-foreground">
                Cuánto entra por la hoja y cuánto se registra en la app (ADR 0010).
              </p>
              <PorOrigen titulo="Llamadas" filas={origenes.llamadas} />
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Conteos por programa</CardTitle>
          </CardHeader>
          <CardContent>
            {programas.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay programas.</p>
            ) : (
              <Tabla
                encabezados={["Programa", "Leads", "Llamadas", "Deals", "Abonos"]}
                filas={programas.map((p) => ({
                  clave: p.slug,
                  celdas: [
                    <span key="n" className="flex items-center gap-2">
                      {p.nombre}
                      {p.activo ? null : <Badge variant="outline">inactivo</Badge>}
                    </span>,
                    num(p.personas),
                    num(p.llamadas),
                    num(p.deals),
                    num(p.abonos),
                  ],
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimas corridas de sync</CardTitle>
          </CardHeader>
          <CardContent>
            {corridas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Todavía no ha corrido ningún sync.</p>
            ) : (
              <Tabla
                encabezados={["Cuándo", "Programa", "Fuentes", "Estado", "Duración", "Filas", "Nuevas", "Actualizadas"]}
                filas={corridas.map((c) => ({
                  clave: c.id,
                  celdas: [
                    haceCuanto(c.iniciado),
                    c.programaNombre ?? "programa borrado",
                    // Las fuentes que leyo la corrida, formateadas aca (el formato es
                    // del que presenta). `null` = corrida anterior a la migracion, sin
                    // el dato: se muestra "—", no un nombre inventado (F-07).
                    c.fuentesLeidas === null
                      ? "—"
                      : c.fuentesLeidas.map((f) => `${f.nombre} (${num(f.filas)})`).join(" + "),
                    <Badge key="e" variant={c.estado === "error" ? "outline" : "secondary"}>
                      {c.estado}
                    </Badge>,
                    c.duracionSegundos === null ? "en curso" : `${num(c.duracionSegundos)} s`,
                    num(c.filasLeidas),
                    num(c.personasNuevas),
                    num(c.personasActualizadas),
                  ],
                }))}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Últimos cambios desde la app</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="mb-3 text-xs text-muted-foreground">
              Qué tabla y qué campo se tocaron, quién y cuándo. Los valores no se muestran a
              propósito: la bitácora guarda datos de leads y esta pantalla no los expone.
            </p>
            {cambios.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nadie ha cambiado nada desde la app todavía.
              </p>
            ) : (
              <Tabla
                encabezados={["Cuándo", "Tabla", "Campo", "Quién"]}
                filas={cambios.map((c) => ({
                  clave: c.id,
                  celdas: [
                    haceCuanto(c.detectadoEn),
                    <code key="t" className="text-xs">
                      {c.tabla}
                    </code>,
                    <code key="c" className="text-xs">
                      {c.campo}
                    </code>,
                    c.quien ?? "sin usuario",
                  ],
                }))}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{etiqueta}</span>
      <span className="font-medium tabular-nums">{valor}</span>
    </div>
  );
}

function PorOrigen({
  titulo,
  filas,
}: {
  titulo: string;
  filas: readonly { origen: string; total: number }[];
}) {
  if (filas.length === 0) {
    return <Fila etiqueta={titulo} valor="0" />;
  }
  return (
    <div>
      <div className="text-muted-foreground">{titulo}</div>
      {filas.map((f) => (
        <Fila key={f.origen} etiqueta={`· ${f.origen}`} valor={num(f.total)} />
      ))}
    </div>
  );
}

function Tabla({
  encabezados,
  filas,
}: {
  encabezados: readonly string[];
  filas: readonly { clave: string; celdas: React.ReactNode[] }[];
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-xs text-muted-foreground">
            {encabezados.map((h) => (
              <th key={h} className="py-2 pr-4 font-normal">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.clave} className="border-b last:border-0">
              {f.celdas.map((c, i) => (
                <td key={i} className="py-2 pr-4 tabular-nums">
                  {c}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
