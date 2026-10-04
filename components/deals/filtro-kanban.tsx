"use client";

import { BarraDeFiltros } from "@/components/filtros/barra-de-filtros";
import { useFiltrosUrl } from "@/components/filtros/use-filtros-url";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OpcionCanal, OpcionCatalogo, OrdenKanban } from "@/lib/queries/kanban";

/**
 * Filtros del Kanban: dueno, cohorte, canal y antiguedad en la etapa (ticket 069).
 *
 * Viven en la URL, no en estado del componente (ADR 0023): un tablero filtrado se
 * comparte y se recarga, y el servidor arma el tablero sin un ida y vuelta. Un closer
 * sin filtros ve el programa completo, igual que un gerente (ADR 0048). Los ids que van
 * a la URL son opacos (owner, cohorte) o texto de canal; ningun dato personal.
 */

const TODOS = "todos";
const TODAS_LAS_COHORTES = "todas";

const ANTIGUEDADES = [
  { valor: "3", etiqueta: "3+ días" },
  { valor: "7", etiqueta: "7+ días" },
  { valor: "14", etiqueta: "14+ días" },
  { valor: "30", etiqueta: "30+ días" },
];

export interface FiltroKanbanProps {
  mostrarDueno: boolean;
  ownerUserId: string | null;
  cohorteId: string | null;
  canal: string | null;
  antiguedadMinima: number | null;
  owners: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  canales: OpcionCanal[];
  leadQuality: string | null;
  leadValue: string | null;
  leadQualities: string[];
  leadValues: string[];
  orden: OrdenKanban;
}

export function FiltroKanban({
  mostrarDueno,
  ownerUserId,
  cohorteId,
  canal,
  antiguedadMinima,
  owners,
  cohortes,
  canales,
  leadQuality,
  leadValue,
  leadQualities,
  leadValues,
  orden,
}: FiltroKanbanProps) {
  const { poner } = useFiltrosUrl();

  return (
    <BarraDeFiltros nombres={["owner", "leadQuality", "leadValue", "cohorte", "canal", "antiguedad", "fecha", "periodo", "a_desde", "a_hasta", "rango", "desde", "hasta", "orden", "sentido"]}>
      {mostrarDueno ? <Select
        value={ownerUserId ?? TODOS}
        items={[{ value: TODOS, label: "Todos los dueños" }, ...owners.map((o) => ({ value: o.id, label: o.nombre }))]}
        onValueChange={(v: string | null) => poner({ owner: !v || v === TODOS ? null : v })}
      >
        <SelectTrigger className="w-44" aria-label="Dueño">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los dueños</SelectItem>
          {owners.map((o) => (
            <SelectItem key={o.id} value={o.id}>
              {o.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select> : null}
      <Select value={leadQuality ?? TODOS} items={[{ value: TODOS, label: "Todas las calidades" }, ...leadQualities.map((v) => ({ value: v, label: v }))]} onValueChange={(v: string | null) => poner({ leadQuality: !v || v === TODOS ? null : v })}>
        <SelectTrigger className="w-44" aria-label="Calidad del lead"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={TODOS}>Todas las calidades</SelectItem>{leadQualities.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
      </Select>
      <Select value={leadValue ?? TODOS} items={[{ value: TODOS, label: "Todos los valores" }, ...leadValues.map((v) => ({ value: v, label: v }))]} onValueChange={(v: string | null) => poner({ leadValue: !v || v === TODOS ? null : v })}>
        <SelectTrigger className="w-40" aria-label="Valor del lead"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value={TODOS}>Todos los valores</SelectItem>{leadValues.map((v) => <SelectItem key={v} value={v}>{v}</SelectItem>)}</SelectContent>
      </Select>

      <Select
        value={cohorteId ?? TODAS_LAS_COHORTES}
        items={[{ value: TODAS_LAS_COHORTES, label: "Todas las cohortes" }, ...cohortes.map((c) => ({ value: c.id, label: c.nombre }))]}
        onValueChange={(v: string | null) => poner({ cohorte: !v ? TODAS_LAS_COHORTES : v })}
      >
        <SelectTrigger className="w-40" aria-label="Cohorte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODAS_LAS_COHORTES}>Todas las cohortes</SelectItem>
          {cohortes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={`${orden.campo}:${orden.sentido}`}
        items={[
          { value: "actividad:desc", label: "Actividad: más reciente" },
          { value: "actividad:asc", label: "Actividad: más antigua" },
          { value: "creado:desc", label: "Creación: más reciente" },
          { value: "creado:asc", label: "Creación: más antigua" },
        ]}
        onValueChange={(valor: string | null) => {
          const [campo, sentido] = valor?.split(":") ?? [];
          if ((campo === "actividad" || campo === "creado") && (sentido === "desc" || sentido === "asc")) {
            poner({ orden: campo, sentido });
          }
        }}
      >
        <SelectTrigger className="w-56" aria-label="Orden">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="actividad:desc">Actividad: más reciente</SelectItem>
          <SelectItem value="actividad:asc">Actividad: más antigua</SelectItem>
          <SelectItem value="creado:desc">Creación: más reciente</SelectItem>
          <SelectItem value="creado:asc">Creación: más antigua</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={canal ?? TODOS}
        items={[{ value: TODOS, label: "Todos los canales" }, ...canales.map((c) => ({ value: c.clave, label: `${c.utmSource} / ${c.utmMedium}` }))]}
        onValueChange={(v: string | null) => poner({ canal: !v || v === TODOS ? null : v })}
      >
        <SelectTrigger className="w-48" aria-label="Canal">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los canales</SelectItem>
          {canales.map((c) => (
            <SelectItem key={c.clave} value={c.clave}>
              {c.utmSource} / {c.utmMedium}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={antiguedadMinima != null ? String(antiguedadMinima) : TODOS}
        items={[{ value: TODOS, label: "Cualquier antigüedad" }, ...ANTIGUEDADES.map((a) => ({ value: a.valor, label: a.etiqueta }))]}
        onValueChange={(v: string | null) => poner({ antiguedad: !v || v === TODOS ? null : v })}
      >
        <SelectTrigger className="w-52" aria-label="Antigüedad en la etapa">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Cualquier antigüedad</SelectItem>
          {ANTIGUEDADES.map((a) => (
            <SelectItem key={a.valor} value={a.valor}>
              {a.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

    </BarraDeFiltros>
  );
}
