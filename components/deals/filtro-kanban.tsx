"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { OpcionCanal, OpcionCatalogo } from "@/lib/queries/kanban";

/**
 * Filtros del Kanban: dueno, cohorte, canal y antiguedad en la etapa (ticket 069).
 *
 * Viven en la URL, no en estado del componente (ADR 0023): un tablero filtrado se
 * comparte y se recarga, y el servidor arma el tablero sin un ida y vuelta. Un closer
 * sin filtros ve el programa completo, igual que un gerente (ADR 0048). Los ids que van
 * a la URL son opacos (owner, cohorte) o texto de canal; ningun dato personal.
 */

const TODOS = "todos";

const claseInput =
  "h-8 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

const ANTIGUEDADES = [
  { valor: "3", etiqueta: "3+ días" },
  { valor: "7", etiqueta: "7+ días" },
  { valor: "14", etiqueta: "14+ días" },
  { valor: "30", etiqueta: "30+ días" },
];

export interface FiltroKanbanProps {
  ownerUserId: string | null;
  cohorteId: string | null;
  canal: string | null;
  antiguedadMinima: number | null;
  owners: OpcionCatalogo[];
  cohortes: OpcionCatalogo[];
  canales: OpcionCanal[];
}

export function FiltroKanban({
  ownerUserId,
  cohorteId,
  canal,
  antiguedadMinima,
  owners,
  cohortes,
  canales,
}: FiltroKanbanProps) {
  const router = useRouter();
  const pathname = usePathname();
  const busqueda = useSearchParams();

  function navegar(cambios: Record<string, string | null>) {
    const params = new URLSearchParams(busqueda.toString());
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor === null) params.delete(clave);
      else params.set(clave, valor);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  }

  const hayFiltro = ownerUserId || cohorteId || canal || antiguedadMinima != null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={ownerUserId ?? TODOS}
        items={[{ value: TODOS, label: "Todos los dueños" }, ...owners.map((o) => ({ value: o.id, label: o.nombre }))]}
        onValueChange={(v: string | null) => navegar({ owner: !v || v === TODOS ? null : v })}
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
      </Select>

      <Select
        value={cohorteId ?? TODOS}
        items={[{ value: TODOS, label: "Todas las cohortes" }, ...cohortes.map((c) => ({ value: c.id, label: c.nombre }))]}
        onValueChange={(v: string | null) => navegar({ cohorte: !v || v === TODOS ? null : v })}
      >
        <SelectTrigger className="w-40" aria-label="Cohorte">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todas las cohortes</SelectItem>
          {cohortes.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.nombre}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={canal ?? TODOS}
        items={[{ value: TODOS, label: "Todos los canales" }, ...canales.map((c) => ({ value: c.clave, label: `${c.utmSource} / ${c.utmMedium}` }))]}
        onValueChange={(v: string | null) => navegar({ canal: !v || v === TODOS ? null : v })}
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
        onValueChange={(v: string | null) => navegar({ antiguedad: !v || v === TODOS ? null : v })}
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

      {hayFiltro ? (
        <button
          type="button"
          onClick={() => router.push(pathname)}
          className={claseInput + " text-muted-foreground transition-colors duration-150 hover:text-foreground"}
        >
          Limpiar
        </button>
      ) : null}
    </div>
  );
}
