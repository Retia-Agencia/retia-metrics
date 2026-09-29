import type { DealTemplate, Extraccion } from "./template";

/**
 * Los cruces ENTRE pestañas de un programa, antes de importar (ADR 0059). Puro.
 *
 * Cada extractor mira una sola pestaña; aqui se decide lo que solo se ve juntandolas:
 *
 * - **Un estudiante que tambien esta en el Setteo es UNA oportunidad, no dos.** Su fila de
 *   Setteo no crea deal (`sinDeal: es_estudiante`) y sus `Registro` pasan como notas al deal
 *   del estudiante: la historia del contacto no se pierde y la venta no se cuenta dos veces.
 * - **Un correo en dos pestañas de Estudiantes** (los "cohorte pasada" del 080) queda con sus
 *   dos deals y una rareza por cada uno: cual es la cohorte buena lo decide una persona, no
 *   este codigo. Como un Completo no ocupa el cupo, la base los deja entrar a los dos.
 *
 * Tambien arma el indice correo → deal que usa el importador para colgar cada llamada: una
 * llamada se cuelga del deal migrado de SU correo (ADR 0027: nada por cercania), y solo si
 * ese correo tiene UN deal; con dos, la llamada entra suelta y queda como rareza.
 */
export interface Consolidado extends Extraccion {
  /** correo → huella del deal del que cuelgan sus llamadas. */
  dealDeCorreo: Map<string, string>;
}

export function consolidar(e: Extraccion): Consolidado {
  const deEstudiantes = new Map<string, DealTemplate[]>();
  for (const d of e.deals) {
    if (d.cohorte == null) continue;
    deEstudiantes.set(d.correo, [...(deEstudiantes.get(d.correo) ?? []), d]);
  }

  const rarezas = [...e.rarezas];
  const sinDeal = [...e.sinDeal];
  const deals: DealTemplate[] = [];

  for (const [, varios] of deEstudiantes) {
    if (varios.length < 2) continue;
    for (const d of varios) {
      rarezas.push({
        huella: d.huella,
        tipo: "en_dos_cohortes",
        detalle: `El correo está en ${varios.length} pestañas de Estudiantes (${varios.map((v) => v.cohorte).join(", ")}): revisar cuál es su cohorte.`,
      });
    }
  }

  // La fila de Setteo del estudiante no crea deal: sus notas van al deal de la venta (el de
  // la ultima pestaña donde aparece). Se copia, no se muta la extraccion que entro.
  const notasHeredadas = new Map<string, DealTemplate["notas"]>();
  for (const d of e.deals) {
    const estudiante = deEstudiantes.get(d.correo);
    if (d.cohorte != null || !estudiante) continue;
    const destino = estudiante[estudiante.length - 1].huella;
    notasHeredadas.set(destino, [...(notasHeredadas.get(destino) ?? []), ...d.notas]);
    sinDeal.push({ huella: d.huella, razon: "es_estudiante" });
  }
  for (const d of e.deals) {
    if (d.cohorte == null && deEstudiantes.has(d.correo)) continue;
    const heredadas = notasHeredadas.get(d.huella);
    deals.push(heredadas ? { ...d, notas: [...heredadas, ...d.notas] } : d);
  }

  // Solo si el correo tiene UN deal migrado: con dos (dos cohortes) no hay evidencia de a cual
  // pertenece cada llamada, y entra suelta (ADR 0027).
  const porCorreo = new Map<string, string[]>();
  for (const d of deals) porCorreo.set(d.correo, [...(porCorreo.get(d.correo) ?? []), d.huella]);
  const dealDeCorreo = new Map<string, string>();
  for (const [correo, huellas] of porCorreo) if (huellas.length === 1) dealDeCorreo.set(correo, huellas[0]);

  return { ...e, deals, rarezas, sinDeal, dealDeCorreo };
}
