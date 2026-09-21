import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { diaDeCalendario } from "@/lib/dias-habiles";
import { fecha as formatoFecha } from "@/lib/format";
import type { Anulacion, HistorialDePersona } from "@/lib/queries/personas";

/**
 * Historial de una persona (ticket 006, ADR 0013, 0015, 0021, 0026).
 *
 * ⚠️ El ticket 038 le quito las ventas, los abonos y el boton de anular: `sales`
 * se disolvio en el Deal y la mutacion de anulacion renace en la etapa 4 sobre el
 * objeto nuevo. Vuelve a ser de solo lectura, con las llamadas. La ficha completa
 * del Lead (envios con diff, contactos, deals abiertos y cerrados) es de la
 * etapa 6.
 *
 * Sigue sin consultar ni calcular nada; recibe el historial ya armado por
 * `historialDePersona`.
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
  const { persona, llamadas } = historial;

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
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </section>

    </div>
  );
}
