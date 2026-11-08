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
          { palabra: "Asistencia", significa: "Citas realizadas entre citas ya marcadas." },
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
        <Frase>Los deals creados en el periodo. Cada porcentaje divide una barra por la anterior.</Frase>
        <Frase>Compraron solo cuenta ventas con show antes del pago; las demás van en su línea aparte.</Frase>
        <Frase>Si el periodo terminó hace poco (los días de madurez del programa), aún pueden llegar ventas.</Frase>
        <Frase>Completo significa que la persona terminó el formulario, aunque haya empezado con un parcial.</Frase>
      </>,
    },
    {
      id: "escalera",
      titulo: "Cómo cierra cada llamada",
      contenido: <>
        <Palabras items={[
          { palabra: "Cerró en la llamada", significa: "El primer pago cae el mismo día (Bogotá) que la llamada con show." },
          { palabra: "Cerró con seguimiento", significa: "El primer pago llega días hábiles después de esa llamada." },
          { palabra: "No cerró", significa: "Tuvo show y no hay venta." },
        ]} />
        <Frase>Nadie lo etiqueta: se calcula con la llamada marcada y el primer abono. Una cita sin marcar no entra.</Frase>
        <Frase>Las ventas sin llamada registrada van aparte. Cada deal lo dice en su ficha.</Frase>
      </>,
    },
    {
      id: "deals-agendas",
      titulo: "Deals y agendas",
      contenido: <Frase>Compara cuándo nacen los deals y cuándo se crean sus agendas. Los controles cambian el paso y la forma de la misma serie.</Frase>,
    },
    {
      id: "etapas",
      titulo: "Etapas y tiempo",
      contenido: <>
        <Palabras items={[
          { palabra: "Camino del setter", significa: "Deals que pasaron por En gestión, Contactado o Calificado." },
          { palabra: "Camino de la llamada", significa: "Deals que llegaron a Agendado." },
          { palabra: "Siguen aquí", significa: "Abiertos, aunque hayan vuelto a una etapa anterior." },
          { palabra: "Se perdieron aquí", significa: "Hoy en Cierre Perdido." },
        ]} />
        <Frase>El tiempo es la mediana de días hábiles en la etapa. Con menos de cinco deals sale “—”.</Frase>
      </>,
    },
    {
      id: "agendas-semana",
      titulo: "Citas por semana",
      contenido: <Frase>Las citas se agrupan por su semana y resultado: show, no-show, sin marcar o futura.</Frase>,
    },
    {
      id: "closers",
      titulo: "Closers",
      contenido: <Frase>Las mismas cifras de arriba, por closer, en el periodo elegido. Sin casos sale “—”.</Frase>,
    },
  ];
}
