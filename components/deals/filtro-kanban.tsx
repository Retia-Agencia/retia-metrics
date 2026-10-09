"use client";

import type { ReactNode } from "react";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { OPCIONES_DE_ORDEN, type FiltroDeclarado } from "@/components/filtros/declaracion";
import { FiltroFechaLista, CLAVES_DE_FECHA_LISTA } from "@/components/filtro-fecha-lista";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionCanal, OpcionCatalogo, OrdenKanban } from "@/lib/queries/kanban";

/**
 * Filtros del Kanban sobre la barra de lista (ticket 069, migrado por el ticket 202):
 * todos los filtros viven en el popover y el orden queda aparte. Todo vive en la URL,
 * no en estado del componente (ADR 0023): un
 * tablero filtrado se comparte y se recarga. Un closer sin filtros ve el programa
 * completo, igual que un gerente (ADR 0048). Los ids que van a la URL son opacos (owner,
 * cohorte) o texto de canal; ningún dato personal.
 *
 * La cohorte tiene un centinela propio ("todas") distinto de la ausencia: sin `cohorte`
 * en la URL se ve la cohorte ACTIVA, no "todas". La declaración modela ambos valores
 * para contar el default y escribir el centinela al quitarlo.
 */

const ANTIGUEDADES = [
  { value: "3", label: "3+ días" },
  { value: "7", label: "7+ días" },
  { value: "14", label: "14+ días" },
  { value: "30", label: "30+ días" },
];

export interface FiltroKanbanProps {
  total: number;
  buscador?: ReactNode;
  mostrarDueno: boolean;
  cohorteActivaId: string | null;
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
  buscador,
  mostrarDueno,
  cohorteActivaId,
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
            opciones: owners.map((o) => ({ value: o.id, label: o.nombre })),
          },
        ]
      : []),
    {
      tipo: "select",
      nombre: "leadQuality",
      etiqueta: "Calidad",
      todos: "Todas las calidades",
      opciones: leadQualities.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "leadValue",
      etiqueta: "Valor",
      todos: "Todos los valores",
      opciones: leadValues.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Cohorte",
      todos: "Todas las cohortes",
      valorTodos: "todas",
      porDefecto: cohorteActivaId
        ? { valor: cohorteActivaId, etiqueta: "Cohorte activa", valorTodos: "todas" }
        : undefined,
      opciones: cohortes.map((c) => ({ value: c.id, label: c.nombre })),
    },
    {
      tipo: "select",
      nombre: "canal",
      etiqueta: "Canal",
      todos: "Todos los canales",
      opciones: canales.map((c) => ({ value: c.clave, label: `${c.utmSource} / ${c.utmMedium}` })),
    },
    {
      tipo: "select",
      nombre: "antiguedad",
      etiqueta: "Antigüedad en la etapa",
      todos: "Cualquier antigüedad",
      opciones: ANTIGUEDADES,
    },
  ];

  void antiguedadMinima;

  return (
    <BarraDeLista
      total={total}
      sustantivo={{ singular: "deal", plural: "deals" }}
      buscador={buscador}
      filtros={filtros}
      compuestosPopover={<FiltroFechaLista campos={camposDeFecha} filtro={fecha} />}
      clavesCompuestas={CLAVES_DE_FECHA_LISTA}
      compuestoActivo={fecha != null}
      orden={
        <ControlDeOrden
          nombre="orden"
          sentido="sentido"
          valor={`${orden.campo}:${orden.sentido}`}
          opciones={OPCIONES_DE_ORDEN}
        />
      }
    />
  );
}
