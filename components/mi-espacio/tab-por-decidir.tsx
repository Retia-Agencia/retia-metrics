import { db } from "@/lib/db";
import { duenosPosibles } from "@/lib/deals/duenos";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { llamadasSinCloserDelPrograma, llamadasSueltasDelPrograma } from "@/lib/queries/inbox";
import { HORAS_SIN_CALIDAD, saludDeFuentes, type EstadoDeFuente } from "@/lib/queries/salud-fuentes";
import { origenDeLaPagina } from "@/lib/navegacion/volver";
import { haceCuanto, num } from "@/lib/format";
import { InboxSinDueno } from "@/components/deals/inbox-sin-dueno";
import { InboxLlamadasSueltas } from "@/components/deals/inbox-llamadas-sueltas";
import { HostsSinCuenta } from "@/components/mi-espacio/hosts-sin-cuenta";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

/**
 * Sección "Por decidir" de Mi espacio del gerente (ticket 179): la operación del CRM que
 * le toca decidir a quien administra sin trabajar leads, acotada al programa del selector.
 *
 * Es VISIBILIDAD de la operación, NO métricas (eso vive en el Dashboard del programa). Y
 * **NUNCA los deals de los closers**: solo lo que no tiene dueño o nadie está mirando.
 * Cuatro bloques:
 *  1. **Deals sin dueño y Por settear** (`InboxSinDueno`): el gerente REASIGNA
 *     (`administra`), no reclama (`puedeReclamar=false`): no trabaja leads (ADR 0003).
 *  2. **Llamadas sueltas** del programa (`InboxLlamadasSueltas`): citas de Calendly sin deal.
 *  3. **Hosts sin cuenta** (`HostsSinCuenta`): citas cuya host no tiene cuenta en el CRM.
 *  4. **Webhook Health** con alarma: fuentes `marcada` del programa (ticket 107). Si no hay
 *     ninguna, una línea "Sin alarmas".
 *
 * El programa es FRONTERA (ADR 0043): todo entra por `programId`/`slug` y jamás cruza. Es
 * un componente de servidor y reusa los módulos del Inbox del programa (una respuesta por
 * pregunta), sin copiar SQL.
 */

const TONO_ESTADO: Record<EstadoDeFuente, "exito" | "info" | "alerta" | "peligro" | "neutro"> = {
  al_dia: "exito",
  volvio: "info",
  sin_respuestas: "alerta",
  muerta: "peligro",
  sin_envios: "neutro",
};

const TEXTO_ESTADO: Record<EstadoDeFuente, string> = {
  al_dia: "Al día",
  volvio: "Volvió",
  sin_respuestas: "Sin respuestas",
  muerta: "Muerta",
  sin_envios: "Sin envíos",
};

export async function TabPorDecidir({
  programId,
  slug,
}: {
  programId: string;
  slug: string;
}) {
  const [secciones, duenos, llamadasSueltas, llamadasSinCloser, salud] = await Promise.all([
    seccionesSinDueno(db, programId),
    duenosPosibles(db, programId),
    // El gerente no cuelga sueltas (no trabaja leads): sin `actor`, `puedeColgar` queda en
    // false. La reja de verdad vive en la server action igual.
    llamadasSueltasDelPrograma(db, programId),
    llamadasSinCloserDelPrograma(db, programId),
    saludDeFuentes(),
  ]);

  // Solo las fuentes del programa elegido y SOLO las marcadas (con alarma): el programa es
  // frontera y aquí lo que importa es lo que requiere atención.
  const alarmas = salud.filter((s) => s.programId === programId && s.marcada);
  // Mi espacio → Por decidir: la ficha vuelve a esta tab (ticket 174).
  const origen = origenDeLaPagina("/mi-espacio", { programa: slug, tab: "por-decidir" });

  return (
    <div className="space-y-4">
      {/* 1 · Deals sin dueño: Agendados sin dueño y Por settear. El gerente reasigna. */}
      <InboxSinDueno
        pendienteSetteo={secciones.pendienteSetteo}
        unclaimed={secciones.unclaimed}
        puedeReclamar={false}
        administra={true}
        duenos={duenos}
      />

      {/* 2 · Llamadas sueltas del programa. */}
      <InboxLlamadasSueltas llamadas={llamadasSueltas} programId={programId} origen={origen} />

      {/* 3 · Hosts sin cuenta (no se muestra si no hay). */}
      <HostsSinCuenta filas={llamadasSinCloser} />

      {/* 4 · Webhook Health con alarma. */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            Webhook Health
            {alarmas.length > 0 ? <Badge variant="alerta">{alarmas.length}</Badge> : null}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alarmas.length === 0 ? (
            <p className="text-sm text-muted-foreground">Sin alarmas.</p>
          ) : (
            <div className="space-y-1 text-sm">
              {alarmas.map((s) => (
                <div key={s.sourceId} className="flex flex-wrap items-center gap-2">
                  <Badge variant={TONO_ESTADO[s.estado]}>{TEXTO_ESTADO[s.estado]}</Badge>
                  <span className="font-medium">{s.nombre}</span>
                  <span className="text-muted-foreground">último envío {haceCuanto(s.ultimo)}</span>
                  {s.sobresPendientes > 0 ? (
                    <span className="text-tono-alerta">· {num(s.sobresPendientes)} sobres sin procesar</span>
                  ) : null}
                  {s.sinCalidad > 0 ? (
                    <span className="text-tono-alerta">
                      · {num(s.sinCalidad)} {s.sinCalidad === 1 ? "envío" : "envíos"} completos sin calidad en {HORAS_SIN_CALIDAD} h
                    </span>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
