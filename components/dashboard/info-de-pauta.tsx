import type { SeccionDeInfo } from "@/components/hub/info-de-pagina";
import { Frase } from "@/components/hub/piezas-de-info";

/** Explicación única de Hub › Pauta (412), en el orden de la pantalla. */
export function seccionesDeInfoDePauta(): SeccionDeInfo[] {
  return [
    {
      id: "pauta",
      titulo: "Qué hay aquí",
      contenido: <>
        <Frase>De dónde vienen los registros: cada canal se abre en sus UTM, con la regla que lo clasificó.</Frase>
        <Frase>Qué rindió la plata: inversión, agendas, ventas, facturación y ROAS por campaña, anuncio o canal.</Frase>
        <Frase>Cómo va la cohorte: lo que llevamos contra la meta y contra lo esperado a la fecha.</Frase>
      </>,
    },
    {
      id: "equivalencias",
      titulo: "Equivalencias con el Excel de Paid Media",
      contenido: <Frase>% presentación a zoom = % de show; % cierre zoom a cliente = Cierre de ventas; % cierre agenda a cliente = Agenda → venta.</Frase>,
    },
  ];
}
