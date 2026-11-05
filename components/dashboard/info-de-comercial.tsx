import type { SeccionDeInfo } from "@/components/hub/info-de-pagina";
import { Frase, Palabras, Pasos } from "@/components/hub/piezas-de-info";

/** Explicación única de Hub › Comercial, en el orden de la pantalla. */
export function seccionesDeInfoDeComercial(): SeccionDeInfo[] {
  return [
    {
      id: "cifras",
      titulo: "Cifras clave",
      contenido: <>
        <Palabras items={[
          { palabra: "Agendadas", significa: "Citas creadas dentro del periodo." },
          { palabra: "% show", significa: "Citas con show entre citas ya marcadas." },
          { palabra: "% cierre", significa: "Ventas entre citas marcadas con show." },
          { palabra: "Agenda → venta", significa: "Ventas entre todas las citas marcadas." },
        ]} />
        <Frase>Más de 10 % sin marcar vuelve parcial la tasa. Esas citas nunca cuentan como no-show.</Frase>
      </>,
    },
    {
      id: "embudo",
      titulo: "Dónde se pierden",
      contenido: <>
        <Pasos pasos={[{ titulo: "Deals creados" }, { titulo: "Agendaron" }, { titulo: "Tuvieron show" }, { titulo: "Compraron" }]} />
        <Frase>Cada porcentaje divide una barra por la anterior. “Madurando” significa que aún pueden llegar ventas.</Frase>
        <Frase>Completo significa que la persona terminó el formulario, aunque haya empezado con un parcial.</Frase>
      </>,
    },
    {
      id: "escalera",
      titulo: "Cómo cierra cada llamada",
      contenido: <Frase>Reparte los casos en cierre inmediato, seguimiento y sin cierre. Las ventas sin llamada quedan fuera de esos tres grupos.</Frase>,
    },
    {
      id: "deals-agendas",
      titulo: "Deals y agendas",
      contenido: <Frase>Compara cuándo nacen los deals y cuándo se crean sus agendas. Los controles cambian el paso y la forma de la misma serie.</Frase>,
    },
    {
      id: "etapas",
      titulo: "Etapas y tiempo",
      contenido: <Frase>Cada camino separa quienes avanzaron, siguen allí o se perdieron. El tiempo es la mediana de días hábiles; exige cinco casos.</Frase>,
    },
    {
      id: "agendas-semana",
      titulo: "Agendas por semana",
      contenido: <Frase>Las citas se agrupan por su semana y resultado: show, no-show, sin marcar o futura.</Frase>,
    },
    {
      id: "closers",
      titulo: "Closers",
      contenido: <Frase>Cada deal pertenece a quien tomó su última cita. Vendido, recaudado y por cobrar usan las ventas de ese closer.</Frase>,
    },
  ];
}
