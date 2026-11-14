import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";
import type { ClaveRegistrada } from "@/lib/metricas/registro";

/**
 * A qué concepto del registro (`lib/metricas/registro.ts`) apunta cada métrica que el reporte de WhatsApp enciende
 * (ticket 358, enmienda 13-nov, punto 4 de los pendientes del contrato). Exhaustivo en compilación: una métrica nueva
 * del semáforo obliga a decidir su concepto, y `tests/reporte-whatsapp-registro.test.ts` exige que esté registrado.
 * Hoy el semáforo enciende una sola métrica tipada; el resto de las cifras del mensaje (gasto, agendas del CRM y de
 * Meta) todavía no es una métrica con clave y es el siguiente paso del 358.
 */
export const CONCEPTO_DE_METRICA_DEL_REPORTE: Record<MetricaSemaforo["metrica"], ClaveRegistrada> = {
  costo_por_agenda: "costo_agenda_crm",
};
