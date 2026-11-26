"use client";

import type { ReactNode } from "react";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { OPCIONES_DE_ORDEN_DEALS, type FiltroDeclarado } from "@/components/filtros/declaracion";
import { FiltroFechaLista } from "@/components/filtro-fecha-lista";
import { CLAVES_DE_FECHA_LISTA } from "@/lib/claves-de-fecha-lista";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import { Button } from "@/components/ui/button";
import type { PeriodoResuelto } from "@/lib/periodo";
import type { OpcionCanal, OpcionCatalogo, OrdenKanban } from "@/lib/queries/kanban";

/**
 * Filtros del Kanban sobre la barra de lista (ticket 069, migrado por el ticket 202):
 * todos los filtros viven en el popover y el orden queda aparte. Todo vive en la URL,
 * no en estado del componente (ADR 0023): un
 * tablero filtrado se comparte y se recarga. Un closer sin filtros ve el programa
 * completo, igual que un gerente (ADR 0048). Los ids que van a la URL son opacos (closer,
 * cohorte) o texto de canal; ningún dato personal.
 *
 * El tablero abre con todos los ciclos (ADR 0140). El filtro Ciclo conserva el
 * parámetro `cohorte` y reconoce "todas" en los enlaces existentes.
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
  antiguedadMinima: number | null;
  owners: OpcionCatalogo[];
  ciclos: OpcionCatalogo[];
  skus: OpcionCatalogo[];
  nombresDeSku: { slug: string; nombre: string }[];
  canales: OpcionCanal[];
  leadQualities: string[];
  leadValues: string[];
  orden: OrdenKanban;
  /** El filtro de fecha vigente (campo + periodo), resuelto en el servidor; `null` si no hay. */
  fecha: { campo: string; periodo: PeriodoResuelto } | null;
  /** Los campos de fecha que la lista sabe filtrar, con su etiqueta. */
  camposDeFecha: readonly { valor: string; etiqueta: string }[];
  /** La vista vigente y las que hay (ADR 0103), del servidor: deciden columnas, no cifras. */
  vista: string;
  vistas: readonly { valor: string; etiqueta: string }[];
}

/** Las vistas del tablero como botones: la elegida va a la URL y el proxy la recuerda. */
function SelectorDeVista({ vista, vistas }: { vista: string; vistas: FiltroKanbanProps["vistas"] }) {
  const { poner } = useFiltrosUrl();
  return (
    <div className="flex gap-1" role="group" aria-label="Vista del tablero">
      {vistas.map((v) => (
        <Button
          key={v.valor}
          type="button"
          size="sm"
          variant={v.valor === vista ? "secondary" : "ghost"}
          aria-pressed={v.valor === vista}
          onClick={() => poner({ vista: v.valor })}
        >
          {v.etiqueta}
        </Button>
      ))}
    </div>
  );
}

export function FiltroKanban({
  total,
  buscador,
  mostrarDueno,
  antiguedadMinima,
  owners,
  ciclos,
  skus,
  nombresDeSku,
  canales,
  leadQualities,
  leadValues,
  orden,
  fecha,
  camposDeFecha,
  vista,
  vistas,
}: FiltroKanbanProps) {
  const filtros: FiltroDeclarado[] = [
    ...(mostrarDueno
      ? [
          {
            tipo: "select" as const,
            nombre: "closer",
            etiqueta: "Closer",
            todos: "Todos los closers",
            opciones: owners.map((o) => ({ value: o.id, label: o.nombre })),
          },
        ]
      : []),
    {
      tipo: "select",
      nombre: "calidad",
      etiqueta: "Calidad",
      todos: "Todas las calidades",
      opciones: leadQualities.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "valor",
      etiqueta: "Valor",
      todos: "Todos los valores",
      opciones: leadValues.map((v) => ({ value: v, label: v })),
    },
    {
      tipo: "select",
      nombre: "cohorte",
      etiqueta: "Ciclo",
      todos: "Todos los ciclos",
      valorTodos: "todas",
      opciones: ciclos.map((c) => ({ value: c.id, label: c.nombre })),
    },
    {
      tipo: "select",
      nombre: "nombre_sku",
      etiqueta: "Nombre del SKU",
      todos: "Todos los nombres",
      opciones: nombresDeSku.map((sku) => ({ value: sku.slug, label: sku.nombre })),
    },
    {
      tipo: "select",
      nombre: "sku",
      etiqueta: "SKU",
      todos: "Todos los SKUs",
      opciones: [{ value: "sin", label: "Sin SKU" }, ...skus.map((sku) => ({ value: sku.id, label: sku.nombre }))],
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
    {
      tipo: "select",
      nombre: "tag",
      etiqueta: "Tag",
      todos: "Todos los tags",
      opciones: [
        { value: "por_reagendar", label: "Por reagendar" },
        { value: "seguimiento", label: "Seguimiento" },
        { value: "sin", label: "Sin tag" },
      ],
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
      acciones={<SelectorDeVista vista={vista} vistas={vistas} />}
      orden={
        <ControlDeOrden
          nombre="orden"
          sentido="sentido"
          valor={`${orden.campo}:${orden.sentido}`}
          opciones={OPCIONES_DE_ORDEN_DEALS}
        />
      }
    />
  );
}
