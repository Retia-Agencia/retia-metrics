import type { SeccionDeInfo } from "@/components/hub/info-de-pagina";
import { Frase } from "@/components/hub/piezas-de-info";
import { nombreCorto, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";

/** Explicación única de Hub › Pauta (412), en el orden de la pantalla. */
export function seccionesDeInfoDePauta(): SeccionDeInfo[] {
  return [
    {
      id: "pauta",
      titulo: "Qué hay aquí",
      contenido: <>
        <Frase>De dónde vienen los registros: cada canal se abre en sus UTM, con la regla que lo clasificó.</Frase>
        <Frase>Qué rindió la plata: {VOCABULARIO_PAUTA_SEMANAL.inversion.toLocaleLowerCase()}, {nombreCorto("agendadas").toLocaleLowerCase()}, {nombreCorto("ventas").toLocaleLowerCase()}, {nombreCorto("vendido").toLocaleLowerCase()} y {VOCABULARIO_PAUTA_SEMANAL.roas} por campaña, anuncio o canal.</Frase>
        <Frase>Cómo va la cohorte: lo que llevamos contra la meta y contra lo esperado a la fecha.</Frase>
      </>,
    },
    {
      id: "equivalencias",
      titulo: "Equivalencias con el Excel de Paid Media",
      contenido: <Frase>% de show / % presentación a zoom = {nombreCorto("asistencia")}; % cierre zoom a cliente = {nombreCorto("cierre_de_ventas")}; % cierre agenda a cliente = {nombreCorto("cita_a_venta")}.</Frase>,
    },
  ];
}
