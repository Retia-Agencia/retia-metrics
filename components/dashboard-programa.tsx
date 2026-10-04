import { CifraConLista } from "@/components/cifra-con-lista";
import type { DetallesDelDashboard } from "@/lib/queries/vista-metrica";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { fecha, monto, num, pct, usd } from "@/lib/format";
import type { CajaPorMoneda, FilaEmbudoPorCanal } from "@/lib/queries/dashboard";
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
        <span className="block" key={c.moneda}>{monto(c.total, c.moneda)}</span>
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

export function DashboardPrograma({
  vista,
  detalles,
  origenPorCanal,
}: {
  vista: VistaDelDashboard;
  detalles?: DetallesDelDashboard;
  origenPorCanal: FilaEmbudoPorCanal[] | null;
}) {
  const { embudo, sinGrain, caja, cortesias, leads, cohorte, comparativo, comisionPorcentaje, motivos, claveCloser, closers } = vista;
  // La etiqueta visible del closer filtrado (nunca su `users.id`): sale del selector.
  const etiquetaCloser = claveCloser === null ? null : (closers.find((c) => c.id === claveCloser)?.label ?? "este closer");

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tarjeta
          titulo="Caja recaudada"
          valor={<CifraConLista titulo="Caja recaudada" detalle={detalles?.caja}><Caja caja={caja} /></CifraConLista>}
          nota="suma de abonos por su fecha, por moneda"
        />
        <Tarjeta
          titulo="Llamadas"
          valor={<><CifraConLista titulo="Shows" detalle={detalles?.shows}>{num(embudo.llamadasConShow)}</CifraConLista>{" de "}<CifraConLista titulo="Agendas" detalle={detalles?.agendas}>{num(embudo.agendas)}</CifraConLista></>}
          nota={`${tasa(embudo.pctShow)} de show`}
        />
        <Tarjeta
          titulo="Shows sin Grain"
          valor={
            <>
              <span className={sinGrain.sinGrain > 0 ? "text-tono-peligro" : undefined}>
                <CifraConLista titulo="Shows sin Grain" detalle={detalles?.shows_sin_grain}>{num(sinGrain.sinGrain)}</CifraConLista>
              </span>
              {` de ${num(sinGrain.shows)}`}
            </>
          }
          nota={`${tasa(sinGrain.pct)} de los shows no tiene grabación`}
        />
        <Tarjeta
          titulo="% de cierre"
          valor={tasa(embudo.pctCierre)}
          nota={<><CifraConLista titulo="Cierres" detalle={detalles?.cierres}>{num(embudo.cierres)} cierres</CifraConLista>{" sobre llamadas con show · "}<CifraConLista titulo="Cortesías" detalle={detalles?.cortesias}>{num(cortesias)} {cortesias === 1 ? "cortesía" : "cortesías"}</CifraConLista>{" aparte"}</>}
        />
        <Tarjeta
          titulo="Leads"
          valor={
            leads.leads === null ? (
              "—"
            ) : (
              <CifraConLista titulo="Leads" detalle={detalles?.leads}>
                {num(leads.leads)}
              </CifraConLista>
            )
          }
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

              {claveCloser !== null ? (
                <p className="text-sm">
                  Contribución de <span className="font-medium">{etiquetaCloser}</span>:{" "}
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
            <Tabla cabeceras={["Closer", "Agendas", "Show", "% show", "Cierres", "% cierre", "Caja", "Comisión"]}>
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
                  <td className="py-2 text-right">
                    {/* Si NINGUNA venta tiene % y valor, no hay comision que mostrar: un cero mentiria. */}
                    {c.comisionUsd === 0 && c.ventasSinComision > 0 ? (
                      <span className="block text-muted-foreground">—</span>
                    ) : (
                      <span className="block">{usd(c.comisionUsd)}</span>
                    )}
                    {c.ventasSinComision > 0 ? (
                      <span className="block text-xs text-muted-foreground">
                        {num(c.ventasSinComision)} sin % o sin valor
                      </span>
                    ) : null}
                  </td>
                </tr>
              ))}
            </Tabla>
          )}
          <p className="pt-3 text-xs text-muted-foreground">
            El comparativo nunca se filtra por closer: todos ven todo (ADR 0009).
          </p>
          <p className="pt-1 text-xs text-muted-foreground">
            {textoComisionPrograma(comisionPorcentaje)}
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
                Ningún deal perdido con motivo en este rango.
              </p>
            ) : (
              <Tabla cabeceras={["Motivo", "Deals"]}>
                {motivos.map((m) => (
                  <tr key={m.motivo} className="tabular-nums">
                    <td className="py-2">{m.motivo}</td>
                    <td className="py-2 text-right">{num(m.deals)}</td>
                  </tr>
                ))}
              </Tabla>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">Origen del lead</CardTitle>
          </CardHeader>
          <CardContent>
            {origenPorCanal === null ? (
              <p className="text-sm text-muted-foreground">
                El origen por canal es del programa entero: quita el filtro de closer para verlo.
              </p>
            ) : origenPorCanal.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin envíos ni llamadas en este rango.</p>
            ) : (
              <Tabla cabeceras={["Canal", "Área", "Envíos", "Agendas", "Show", "% show", "Ventas"]}>
                {origenPorCanal.map((o) => {
                  const etiquetas = {
                    sin_clasificar: "Sin clasificar",
                    sin_utm: "Sin UTM",
                    sin_envio_origen: "Sin envío de origen",
                  } as const;
                  return (
                  <tr key={`${o.origen}:${o.canalId ?? "sin-canal"}`} className="tabular-nums">
                    <td className="py-2">
                      {o.origen === "canal" ? o.canal : (
                        <span className="text-muted-foreground">{etiquetas[o.origen]}</span>
                      )}
                    </td>
                    <td className="py-2">{o.area ?? "—"}</td>
                    <td className="py-2 text-right">{num(o.envios)}</td>
                    <td className="py-2 text-right">{num(o.agendas)}</td>
                    <td className="py-2 text-right">{num(o.shows)}</td>
                    <td className="py-2 text-right">{tasa(o.pctShow)}</td>
                    <td className="py-2 text-right">{num(o.ventas)}</td>
                  </tr>
                  );
                })}
              </Tabla>
            )}
          </CardContent>
        </Card>
      </div>

      {claveCloser !== null ? (
        <p className="text-xs text-muted-foreground">
          Filtrado por <span className="font-medium">{etiquetaCloser}</span>. Los leads no se
          muestran por closer: la atribución pasa a ser el dueño del deal y todavía no hay
          deals, así que un número aquí sería el del programa entero con el nombre de una
          persona encima.
        </p>
      ) : null}
    </div>
  );
}

export function textoComisionPrograma(comisionPorcentaje: string | null): string {
  return comisionPorcentaje != null
    ? `Comisión: ${num(Number(comisionPorcentaje), 2)} % del valor vendido de cada venta, congelado al vender.`
    : "Comisión: sin porcentaje cargado.";
}
