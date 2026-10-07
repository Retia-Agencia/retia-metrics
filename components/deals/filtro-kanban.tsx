"use client";

import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import { FiltroFechaLista, CLAVES_DE_FECHA_LISTA } from "@/components/filtro-fecha-lista";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionCanal, OpcionCatalogo, OrdenKanban } from "@/lib/queries/kanban";

/**
 * Filtros del Kanban sobre la barra de lista (ticket 069, migrado por el ticket 202):
 * dueño y fecha a la vista; calidad, valor, cohorte, canal y antigüedad en el popover;
 * el orden aparte. Todo vive en la URL, no en estado del componente (ADR 0023): un
 * tablero filtrado se comparte y se recarga. Un closer sin filtros ve el programa
 * completo, igual que un gerente (ADR 0048). Los ids que van a la URL son opacos (owner,
 * cohorte) o texto de canal; ningún dato personal.
 *
 * La cohorte tiene un centinela propio ("todas") distinto de la ausencia: sin `cohorte`
 * en la URL se ve la cohorte ACTIVA (el valor "todos" del chip), no "todas". Por eso su
 * declaración incluye la opción "todas" como un valor real.
 */

const ANTIGUEDADES = [
  { value: "3", label: "3+ días" },
  { value: "7", label: "7+ días" },
  { value: "14", label: "14+ días" },
  { value: "30", label: "30+ días" },
];

const ORDENES = [
  { value: "actividad:desc", label: "Actividad: más reciente" },
  { value: "actividad:asc", label: "Actividad: más antigua" },
  { value: "creado:desc", label: "Creación: más reciente" },
  { value: "creado:asc", label: "Creación: más antigua" },
];

export interface FiltroKanbanProps {
  total: number;
  mostrarDueno: boolean;
  cohorteId: string | null;
  antiguedadMinima: number | null;
  owners: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  canales: OpcionCanal[];
  leadQualities: string[];
  leadValues: string[];
  orden: OrdenKanban;
  /** El filtro de fecha vigente (campo + periodo), resuelto en el servidor; `null` si no hay. */
  fecha: { campo: string; periodo: PeriodoResuelto } | null;
  /** Los campos de fecha que la lista sabe filtrar, con su etiqueta. */
  camposDeFecha: readonly { valor: string; etiqueta: string }[];
}

export function FiltroKanban({
  total,
  mostrarDueno,
  cohorteId,
  antiguedadMinima,
  owners,
  cohortes,
  canales,
  leadQualities,
  leadValues,
  orden,
  fecha,
  camposDeFecha,
}: FiltroKanbanProps) {
  const filtros: FiltroDeclarado[] = [
    ...(mostrarDueno
      ? [
          {
            tipo: "select" as const,
            nombre: "owner",
            etiqueta: "Dueño",
            todos: "Todos los dueños",
            aVista: true,
            opciones: owners.map((o) => ({ value: o.id, label: o.nombre })),
          },
        ]
      : []),
    {
      tipo: "select",
      nombre: "leadQuality",
      etiqueta: "Calidad",
      todos: "Todas las calidades",
      aVista: false,
      opciones: leadQualities.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "leadValue",
      etiqueta: "Valor",
      todos: "Todos los valores",
      aVista: false,
      opciones: leadValues.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Cohorte",
      // Sin `cohorte` en la URL se ve la cohorte activa; "todas" es un valor real.
      todos: "Cohorte activa",
      aVista: false,
      opciones: [
        { value: "todas", label: "Todas las cohortes" },
        ...cohortes.map((c) => ({ value: c.id, label: c.nombre })),
      ],
    },
    {
      tipo: "select",
      nombre: "canal",
      etiqueta: "Canal",
      todos: "Todos los canales",
      aVista: false,
      opciones: canales.map((c) => ({ value: c.clave, label: `${c.utmSource} / ${c.utmMedium}` })),
    },
    {
      tipo: "select",
      nombre: "antiguedad",
      etiqueta: "Antigüedad en la etapa",
      todos: "Cualquier antigüedad",
      aVista: false,
      opciones: ANTIGUEDADES,
    },
  ];

  // El chip de cohorte muestra "todos" (= activa) cuando no hay `cohorte` en la URL; si
  // el servidor resolvió un id, se refleja. `cohorteId` null + sin "todas" = activa.
  void cohorteId;
  void antiguedadMinima;

  return (
    <BarraDeLista
      total={total}
      sustantivo={{ singular: "deal", plural: "deals" }}
      filtros={filtros}
      compuestosAVista={<FiltroFechaLista campos={camposDeFecha} filtro={fecha} />}
      clavesCompuestas={CLAVES_DE_FECHA_LISTA}
      compuestoActivo={fecha != null}
      orden={
        <ControlDeOrden
          nombre="orden"
          sentido="sentido"
          valor={`${orden.campo}:${orden.sentido}`}
          opciones={ORDENES}
        />
      }
    />
  );
}
