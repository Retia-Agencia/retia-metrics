import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fecha as formatoFecha, monto as formatoMonto } from "@/lib/format";
import type { HistorialDePersona } from "@/lib/queries/personas";

/**
 * Historial de una persona (ticket 006, ADR 0013, 0015, 0021).
 *
 * Es de SOLO LECTURA: editar o borrar registros pasados esta fuera del alcance del
 * ticket, asi que no hay componente cliente ni server action. No consulta ni
 * calcula nada; recibe el historial ya armado por `historialDePersona`.
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
          {/* "Sin responsable" es un estado valido (ADR 0021), asi que se dice en
              vez de dejar el renglon vacio. */}
          <Dato etiqueta="Responsable" valor={persona.responsableCloserId ?? "Sin responsable"} />
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Llamadas</h2>
        {llamadas.length === 0 ? (
          <p className="text-sm text-muted-foreground">Todavía no tiene llamadas registradas.</p>
        ) : (
          <ul className="space-y-2">
            {llamadas.map((llamada) => (
              <li key={llamada.id} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">
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
            {ventas.map((venta) => (
              <li key={venta.saleId} className="rounded-md border p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{venta.productoNombre ?? "Sin producto"}</span>
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
                  {/* Sin precio del contrato (filas viejas de Sheets) no hay saldo
                      que calcular: se dice, no se inventa un numero. */}
                  <Dato
                    etiqueta="Saldo pendiente"
                    valor={
                      venta.saldo === null
                        ? "Sin precio de contrato registrado"
                        : formatoMonto(Number(venta.saldo), venta.moneda)
                    }
                  />
                </div>

                {venta.abonos.length > 0 ? (
                  <ul className="mt-2 space-y-1 border-t pt-2">
                    {venta.abonos.map((abono) => (
                      <li
                        key={abono.id}
                        className="flex flex-wrap items-center justify-between gap-2 text-sm"
                      >
                        <span className="tabular-nums">
                          {formatoMonto(Number(abono.monto), abono.moneda)}
                        </span>
                        <span className="text-muted-foreground">
                          {formatoFecha(abono.fecha)}
                          {abono.plataformaNombre ? ` · ${abono.plataformaNombre}` : ""}
                          {abono.closerId ? ` · ${abono.closerId}` : ""}
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
