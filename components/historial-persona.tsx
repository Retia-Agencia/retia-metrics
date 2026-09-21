import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fecha as formatoFecha, monto as formatoMonto, saldoLegible } from "@/lib/format";
import type { Anulacion, HistorialDePersona } from "@/lib/queries/personas";
import { AnularRegistro } from "@/components/anular-registro";

/**
 * Historial de una persona (ticket 006, ADR 0013, 0015, 0021, 0026).
 *
 * Dejo de ser de solo lectura en el ticket 029: cada registro vigente trae su boton
 * de anular (`AnularRegistro`, que si es cliente). Sigue sin consultar ni calcular
 * nada; recibe el historial ya armado por `historialDePersona`.
 *
 * **Lo anulado se ve, tachado, con quien lo anulo, cuando y por que** (ADR 0026
 * punto 4). Esconderlo aqui convertiria la anulacion en un borrado con otro nombre, y
 * "esta venta se anulo el 19 de septiembre porque el pago se cayo" es justo lo que
 * alguien necesita saber cuando la caja de ese dia no cuadra. La regla es: fuera de
 * las metricas, dentro del historial.
 *
 * Los montos salen con su moneda al lado (`monto`) y las fechas por `fecha`. Un
 * timestamp se pasa antes por `diaDeCalendario`, la unica definicion de "que dia
 * es" del proyecto: Vercel corre en UTC y el equipo esta en Bogota, asi que
 * formatear el instante crudo correria el dia.
 */

/** Los 8 resultados del enum con su etiqueta legible (tabla del ADR 0015). */
const ETIQUETA_RESULTADO: Record<string, string> = {
  agendada: "Agendada",
  show: "Show",
  no_show: "No show",
  cancelada: "Cancelada",
  reagendada: "Reagendada",
  compromiso_pago: "Compromiso de pago",
  cerrada: "Cerrada (venta)",
  perdida: "Perdida",
};

/** Un dia de calendario en Bogota, escrito para leer. `null` si no hay fecha. */
function diaLegible(valor: Date | string | null): string | null {
  if (!valor) return null;
  return formatoFecha(diaDeCalendario(valor));
}

/**
 * El sello de una anulacion. Los tres datos van juntos porque juntos se guardaron
 * (el CHECK `*_anulacion_completa` de la base): "anulada" sin quien ni por que es el
 * estado que el ADR 0026 descarta.
 */
function SelloAnulacion({ anulacion, etiqueta }: { anulacion: Anulacion; etiqueta: string }) {
  return (
    <p className="mt-2 border-t pt-2 text-sm text-muted-foreground">
      <span className="font-medium text-destructive">{etiqueta}</span> el{" "}
      {diaLegible(anulacion.fecha)} por {anulacion.porNombre} · {anulacion.motivo}
    </p>
  );
}

/** Tachado y apagado para lo que ya no cuenta. */
function claseAnulada(anulada: boolean): string {
  return anulada ? " opacity-60" : "";
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string | null }) {
  if (!valor) return null;
  return (
    <p className="text-sm">
      <span className="text-muted-foreground">{etiqueta}: </span>
      {valor}
    </p>
  );
}

export function HistorialPersona({ historial }: { historial: HistorialDePersona }) {
  const { persona, llamadas, ventas } = historial;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex flex-wrap items-center gap-2">
            {persona.nombre ?? persona.emailNormalizado}
            {/* La entrada separa a quien llego por el formulario de un alta manual
                (ADR 0021): el CPL solo cuenta las del formulario. */}
            {persona.entrada === "crm" ? <Badge variant="outline">Alta manual</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Dato etiqueta="Correo" valor={persona.emailNormalizado} />
          <Dato etiqueta="Teléfono" valor={persona.telefono} />
          <Dato etiqueta="Programa" valor={persona.programaNombre} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Llamadas</h2>
        {llamadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene llamadas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {llamadas.map((llamada) => (
              <li
                key={llamada.id}
                className={`rounded-md border p-3${claseAnulada(llamada.anulacion !== null)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-medium${llamada.anulacion ? " line-through" : ""}`}>
                    {ETIQUETA_RESULTADO[llamada.resultado] ?? llamada.resultado}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {diaLegible(llamada.fechaLlamada) ?? "Sin fecha"}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  <Dato etiqueta="Closer" valor={llamada.closerId} />
                  <Dato etiqueta="Origen" valor={llamada.origenNombre} />
                  <Dato etiqueta="Motivo" valor={llamada.motivoNombre} />
                  <Dato etiqueta="Seguimiento" valor={diaLegible(llamada.fechaSeguimiento)} />
                  <Dato etiqueta="Nota" valor={llamada.notas} />
                </div>
                {llamada.anulacion ? (
                  <SelloAnulacion anulacion={llamada.anulacion} etiqueta="Anulada" />
                ) : (
                  <AnularRegistro tipo="llamada" id={llamada.id} queEs="esta llamada" />
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Ventas y abonos</h2>
        {ventas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene ventas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {ventas.map((venta) => {
              // La etiqueta y el valor salen JUNTOS: sin precio de contrato no se
              // inventa un numero, y un saldo negativo se anuncia como SOBREPAGO y no
              // como una deuda del cliente (ADR 0024).
              const saldo = saldoLegible(venta.saldo, venta.moneda);
              return (
              <li
                key={venta.saleId}
                className={`rounded-md border p-3${claseAnulada(venta.anulacion !== null)}`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className={`font-medium${venta.anulacion ? " line-through" : ""}`}>
                    {venta.productoNombre ?? "Sin producto"}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {venta.fecha ? formatoFecha(venta.fecha) : "Sin fecha"}
                  </span>
                </div>
                <div className="mt-1 space-y-1">
                  <Dato
                    etiqueta="Precio del contrato"
                    valor={
                      venta.precioAplicadoUsd
                        ? formatoMonto(Number(venta.precioAplicadoUsd), venta.moneda)
                        : null
                    }
                  />
                  <Dato
                    etiqueta="Abonado"
                    valor={formatoMonto(Number(venta.abonado), venta.moneda)}
                  />
                  {/* Una venta anulada NO muestra saldo. El precio y lo abonado son
                      hechos de lo que paso; el saldo es una AFIRMACION sobre lo que
                      alguien debe, y una venta anulada no reclama nada. Visto en el
                      navegador el 18-sep: una venta tachada decia "Saldo pendiente:
                      USD 797,00", que se lee como una deuda viva. Es el mismo error
                      que el "Saldo pendiente: USD -103" del recorrido anterior. */}
                  {venta.anulacion ? null : (
                    <Dato etiqueta={saldo.etiqueta} valor={saldo.valor} />
                  )}
                </div>

                {venta.abonos.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t pt-2">
                    {venta.abonos.map((abono) => (
                      <li key={abono.id} className={`text-sm${claseAnulada(abono.anulacion !== null)}`}>
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span
                            className={`tabular-nums${abono.anulacion ? " line-through" : ""}`}
                          >
                            {formatoMonto(Number(abono.monto), abono.moneda)}
                          </span>
                          <span className="text-muted-foreground">
                            {formatoFecha(abono.fecha)}
                            {abono.plataformaNombre ? ` · ${abono.plataformaNombre}` : ""}
                            {abono.closerId ? ` · ${abono.closerId}` : ""}
                          </span>
                        </div>
                        {abono.anulacion ? (
                          <SelloAnulacion anulacion={abono.anulacion} etiqueta="Anulado" />
                        ) : venta.anulacion ? null : (
                          // Un abono de una venta anulada no ofrece anular: la venta
                          // ya se llevo sus abonos por delante.
                          <AnularRegistro tipo="abono" id={abono.id} queEs="este abono" />
                        )}
                      </li>
                    ))}
                  </ul>
                ) : null}

                {venta.anulacion ? (
                  <SelloAnulacion anulacion={venta.anulacion} etiqueta="Anulada" />
                ) : (
                  <AnularRegistro
                    tipo="venta"
                    id={venta.saleId}
                    queEs="esta venta y sus abonos"
                    texto="Anular la venta"
                  />
                )}
              </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
