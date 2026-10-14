import { paginaConRol } from "@/lib/auth/page-guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  cuentasVinculadas,
  estadoConexionMeta,
  type CuentaVinculada,
} from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { fechaHoraEnBogota, haceCuanto } from "@/lib/format";
import { ultimaSincronizacionPauta } from "@/lib/pauta/sincronizar";
import { PageShell } from "@/components/page-shell";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConexionMeta } from "./conexion-meta";
import { SincronizacionMeta } from "./sincronizacion-meta";

export const dynamic = "force-dynamic";

function agruparPorPrograma(cuentas: CuentaVinculada[]) {
  const grupos = new Map<string, { nombre: string; cuentas: CuentaVinculada[] }>();
  for (const cuenta of cuentas) {
    const grupo = grupos.get(cuenta.programId);
    if (grupo) grupo.cuentas.push(cuenta);
    else grupos.set(cuenta.programId, { nombre: cuenta.programa, cuentas: [cuenta] });
  }
  return [...grupos.entries()].map(([id, grupo]) => ({ id, ...grupo }));
}

export default async function MetaPage() {
  const session = await paginaConRol("gerente", "paid_trafficker");
  if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
  const [estado, cuentas, ultima] = await Promise.all([
    estadoConexionMeta(db),
    cuentasVinculadas(db),
    ultimaSincronizacionPauta(db),
  ]);
  const cuentasPorPrograma = agruparPorPrograma(cuentas);

  return (
    <PageShell
      titulo="Meta"
      descripcion="Conexión de solo lectura con las cuentas publicitarias."
      volver={{ porDefecto: { href: "/ajustes", etiqueta: "Ajustes" } }}
    >
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex flex-wrap items-center gap-2 text-base">
              Conexión
              <Badge variant={estado.conectada ? "exito" : "neutro"}>
                {estado.conectada ? "Conectada" : "Sin conectar"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {estado.conectada
                ? `Conectada como ${estado.nombre} desde ${fechaHoraEnBogota(estado.desde)}.`
                : "Meta todavía no está conectada."}
            </p>
            <ConexionMeta />
            <div className="flex flex-wrap items-center gap-3">
              <SincronizacionMeta deshabilitada={!estado.conectada} />
              <p className="text-sm text-muted-foreground">
                Última sincronización {haceCuanto(ultima?.fin ?? ultima?.inicio)}.
              </p>
              {ultima ? (
                <Badge variant={ultima.estado === "ok" ? "exito" : ultima.estado === "error" ? "peligro" : "info"}>
                  {ultima.estado === "ok" ? "Completa" : ultima.estado === "error" ? "Falló" : "En curso"}
                </Badge>
              ) : null}
            </div>
            {ultima?.estado === "error" && ultima.error ? (
              <p className="text-sm text-tono-peligro">{ultima.error}</p>
            ) : null}
            <p className="text-xs text-muted-foreground">
              El token nunca vuelve a mostrarse. Pegar uno nuevo reemplaza la conexión actual.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Cuentas por programa</CardTitle>
          </CardHeader>
          <CardContent>
            {cuentasPorPrograma.length === 0 ? (
              <p className="text-sm text-muted-foreground">No hay cuentas vinculadas.</p>
            ) : (
              <div className="space-y-6">
                {cuentasPorPrograma.map((grupo) => (
                  <section key={grupo.id} className="space-y-2">
                    <h3 className="font-medium">{grupo.nombre}</h3>
                    <div className="overflow-x-auto">
                      <table className="w-full text-left text-sm">
                        <thead className="border-b text-xs text-muted-foreground">
                          <tr>
                            <th className="px-2 py-2 font-medium">Cuenta</th>
                            <th className="px-2 py-2 font-medium">ID</th>
                            <th className="px-2 py-2 font-medium">Moneda</th>
                            <th className="px-2 py-2 font-medium">Zona</th>
                            <th className="px-2 py-2 font-medium">Estado</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {grupo.cuentas.map((cuenta) => (
                            <tr key={cuenta.id}>
                              <td className="px-2 py-3 font-medium">{cuenta.nombre}</td>
                              <td className="cifra px-2 py-3">{cuenta.idMeta}</td>
                              <td className="cifra px-2 py-3">{cuenta.moneda}</td>
                              <td className="px-2 py-3">
                                <div className="space-y-1">
                                  <span>{cuenta.zonaHoraria}</span>
                                  {cuenta.zonaDistintaDeBogota ? (
                                    <Badge variant="alerta">
                                      Zona distinta de Bogotá: el gasto por día quedaría corrido
                                    </Badge>
                                  ) : null}
                                </div>
                              </td>
                              <td className="px-2 py-3">
                                <Badge variant={cuenta.activo ? "exito" : "neutro"}>
                                  {cuenta.activo ? "Activa" : "Inactiva"}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </section>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </PageShell>
  );
}
