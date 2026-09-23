import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, monto, num, pct } from "@/lib/format";
import type { CajaPorMoneda } from "@/lib/queries/dashboard";
import type { VistaDelDashboard } from "@/lib/queries/vista-dashboard";

/**
 * El dashboard comercial de un programa (ticket 005): pinta lo que ya calcularon las
 * consultas del 004. No calcula nada, no consulta nada y no sabe que rol esta
 * mirando, porque todos ven lo mismo (ADR 0009).
 *
 * Dos reglas de dominio se ven en cada numero:
 *  - **La moneda va al lado del monto y nunca se convierte.** La caja llega como una
 *    fila por moneda; se pintan todas, una debajo de otra, jamas sumadas.
 *  - **Lo que no se sabe se dice.** Una tasa sin denominador y una cohorte sin
 *    ventana de venta salen como "—" con su explicacion, nunca como 0.
 */

/** Una tasa que puede no existir: sin denominador no hay porcentaje, hay "—". */
function tasa(valor: number | null): string {
  return valor === null ? "—" : pct(valor);
}

function Tarjeta({
  titulo,
  valor,
  nota,
}: {
  titulo: string;
  valor: ReactNode;
  nota?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-xs font-medium tracking-normal text-muted-foreground">{titulo}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="cifra text-2xl font-semibold">{valor}</div>
        {nota ? <p className="mt-1 text-xs text-muted-foreground">{nota}</p> : null}
      </CardContent>
    </Card>
  );
}

/** La caja siempre con su moneda al lado, una linea por moneda. Nunca se suman. */
function Caja({ caja }: { caja: CajaPorMoneda[] }) {
  if (caja.length === 0) return <>—</>;
  return (
    <>
      {caja.map((c) => (
        <div key={c.moneda}>{monto(c.total, c.moneda)}</div>
      ))}
    </>
  );
}

function Tabla({ cabeceras, children }: { cabeceras: string[]; children: ReactNode }) {
  return (
    <table className="w-full text-sm [&_td:not(:first-child)]:cifra">
      <thead>
        <tr className="border-b text-left text-xs text-muted-foreground">
          {cabeceras.map((c, i) => (
            <th key={c} className={i === 0 ? "py-2 font-medium" : "py-2 text-right font-medium"}>
              {c}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="divide-y [&_tr]:transition-colors [&_tr:hover]:bg-muted/40">{children}</tbody>
    </table>
  );
}

export function DashboardPrograma({ vista }: { vista: VistaDelDashboard }) {
  const { embudo, caja, leads, cohorte, comparativo, motivos, origenes, closerId } = vista;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Caja recaudada"
          valor={<Caja caja={caja} />}
          nota="suma de abonos por su fecha, por moneda"
        />
        <Tarjeta
          titulo="Llamadas"
          valor={`${num(embudo.llamadasConShow)} de ${num(embudo.agendas)}`}
          nota={`${tasa(embudo.pctShow)} de show`}
        />
        <Tarjeta
          titulo="% de cierre"
          valor={tasa(embudo.pctCierre)}
          nota={`${num(embudo.cierres)} cierres sobre llamadas con show`}
        />
        <Tarjeta
          titulo="Leads"
          valor={leads.leads === null ? "—" : num(leads.leads)}
          nota={
            leads.metaDelRango === null
              ? `${num(leads.diasHabiles)} días hábiles · sin meta de leads en la cohorte`
              : `meta ${num(leads.metaDelRango)} (${num(leads.metaLeadsDia ?? 0)}/día hábil) · ${tasa(leads.cumplimiento)}`
          }
        />
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
          <CardTitle className="text-base">
            {cohorte ? `Cohorte ${cohorte.codigo}` : "Cohorte"}
          </CardTitle>
          {cohorte?.ventana ? (
            <Badge variant="secondary">
              día {num(cohorte.ventana.dia)} de {num(cohorte.ventana.total)} hábiles
            </Badge>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          {!cohorte ? (
            <p className="text-muted-foreground">
              Este programa no tiene ninguna cohorte activa. Se activa desde Ajustes.
            </p>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-5">
                <div>
                  <p className="text-xs text-muted-foreground">Vendidos / meta</p>
                  <p className="text-lg cifra font-semibold">
                    {num(cohorte.vendidos)} / {num(cohorte.meta)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Faltan</p>
                  <p className="text-lg cifra font-semibold">{num(cohorte.faltan)}</p>
                </div>
                {cohorte.ventana ? (
                  <>
                    <div>
                      <p className="text-xs text-muted-foreground">Meta dinámica</p>
                      <p className="text-lg cifra font-semibold">
                        {num(cohorte.ventana.metaDinamica, 1)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        por día hábil, quedan {num(cohorte.ventana.habilesRestantes)}
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Esperado a hoy</p>
                      <p className="text-lg cifra font-semibold">
                        {num(cohorte.ventana.esperado, 1)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        ritmo lineal {num(cohorte.ventana.metaLineal, 1)}/día
                      </p>
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Cumplimiento</p>
                      <p className="text-lg cifra font-semibold">
                        {tasa(cohorte.ventana.cumplimiento)}
                      </p>
                    </div>
                  </>
                ) : null}
              </div>

              {cohorte.ventana ? (
                <p className="text-xs text-muted-foreground">
                  Vende del {fecha(cohorte.ventana.inicio)} al {fecha(cohorte.ventana.cierre)},
                  inclusive.
                </p>
              ) : (
                <p className="text-xs text-muted-foreground">
                  Esta cohorte no tiene declarado su inicio de ventas, así que no se pueden
                  contar sus días hábiles ni su meta dinámica. Se declara en Ajustes.
                </p>
              )}

              {closerId !== null ? (
                <p className="text-sm">
                  Contribución de <span className="font-medium">{closerId}</span>:{" "}
                  <span className="tabular-nums">{num(cohorte.vendidosDelCloser ?? 0)}</span> de
                  los {num(cohorte.vendidos)} cupos vendidos. La meta es de la cohorte, no
                  individual.
                </p>
              ) : null}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Closers</CardTitle>
        </CardHeader>
        <CardContent>
          {comparativo.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nadie registró actividad en este rango.
            </p>
          ) : (
            <Tabla cabeceras={["Closer", "Agendas", "Show", "% show", "Cierres", "% cierre", "Caja"]}>
              {comparativo.map((c) => (
                <tr key={c.closerId ?? "sin-closer"} className="tabular-nums">
                  <td className="py-2">
                    {c.closerId ?? <span className="text-muted-foreground">sin closer</span>}
                  </td>
                  <td className="py-2 text-right">{num(c.agendas)}</td>
                  <td className="py-2 text-right">{num(c.llamadasConShow)}</td>
                  <td className="py-2 text-right">{tasa(c.pctShow)}</td>
                  <td className="py-2 text-right">{num(c.cierres)}</td>
                  <td className="py-2 text-right">{tasa(c.pctCierre)}</td>
                  <td className="py-2 text-right">
                    <Caja caja={c.caja} />
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
          <p className="pt-3 text-xs text-muted-foreground">
            El comparativo nunca se filtra por closer: todos ven todo (ADR 0009).
          </p>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Motivos de pérdida</CardTitle>
          </CardHeader>
          <CardContent>
            {motivos.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ninguna llamada perdida con motivo del catálogo en este rango.
              </p>
            ) : (
              <Tabla cabeceras={["Motivo", "Llamadas"]}>
                {motivos.map((m) => (
                  <tr key={m.motivo} className="tabular-nums">
                    <td className="py-2">{m.motivo}</td>
                    <td className="py-2 text-right">{num(m.llamadas)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Origen del lead</CardTitle>
          </CardHeader>
          <CardContent>
            {origenes.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin llamadas en este rango.</p>
            ) : (
              <Tabla cabeceras={["Origen", "Agendas", "Show", "% show", "Cierres"]}>
                {origenes.map((o) => (
                  <tr key={o.origen ?? "sin-origen"} className="tabular-nums">
                    <td className="py-2">
                      {o.origen ?? <span className="text-muted-foreground">sin origen</span>}
                    </td>
                    <td className="py-2 text-right">{num(o.agendas)}</td>
                    <td className="py-2 text-right">{num(o.llamadasConShow)}</td>
                    <td className="py-2 text-right">{tasa(o.pctShow)}</td>
                    <td className="py-2 text-right">{num(o.cierres)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>
      </div>

      {closerId !== null ? (
        <p className="text-xs text-muted-foreground">
          Filtrado por <span className="font-medium">{closerId}</span>. Los leads no se
          muestran por closer: la atribución pasa a ser el dueño del deal y todavía no hay
          deals, así que un número aquí sería el del programa entero con el nombre de una
          persona encima.
        </p>
      ) : null}
    </div>
  );
}
