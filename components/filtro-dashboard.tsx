"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

/**
 * Filtro del dashboard: rango de fechas y closer (ticket 005).
 *
 * Vive en la URL, no en estado del componente: asi un dashboard filtrado se puede
 * compartir o recargar, y el servidor arma la vista sin un ida y vuelta de cliente.
 * Los identificadores que van a la URL son el preset, las dos fechas y el closerId
 * (texto del closer, ADR 0011): ningun dato personal de un lead (correo, telefono)
 * pasa por aca.
 */

const TODOS = "todos";

const claseInput =
  "h-8 rounded-lg border border-border bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

export interface FiltroProps {
  preset: string;
  desde: string;
  hasta: string;
  closerId: string | null;
  closers: readonly string[];
  /** Solo se ofrece el rango de la cohorte si hay una vendiendo con ventana (ADR 0022). */
  cohorteDisponible: boolean;
}

export function FiltroDashboard({
  preset,
  desde,
  hasta,
  closerId,
  closers,
  cohorteDisponible,
}: FiltroProps) {
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

  const rangos: { valor: string; etiqueta: string }[] = [
    { valor: "hoy", etiqueta: "Hoy" },
    { valor: "semana", etiqueta: "Esta semana" },
    { valor: "mes", etiqueta: "Este mes" },
    ...(cohorteDisponible ? [{ valor: "cohorte", etiqueta: "Cohorte" }] : []),
    { valor: "custom", etiqueta: "Personalizado" },
  ];

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        value={preset}
        onValueChange={(valor: string | null) =>
          // Al salir de "personalizado" las fechas sueltas se van con el preset:
          // dejarlas en la URL haria que volver a "personalizado" muestre un rango
          // viejo que nadie pidio.
          navegar(
            valor === null
              ? { rango: "hoy", desde: null, hasta: null }
              : valor === "custom"
              ? { rango: valor, desde, hasta }
              : { rango: valor, desde: null, hasta: null },
          )
        }
      >
        <SelectTrigger className="w-44" aria-label="Rango de fechas">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {rangos.map((r) => (
            <SelectItem key={r.valor} value={r.valor}>
              {r.etiqueta}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {preset === "custom" ? (
        <>
          <input
            type="date"
            value={desde}
            max={hasta}
            onChange={(e) => navegar({ rango: "custom", desde: e.target.value, hasta })}
            className={claseInput}
            aria-label="Desde"
          />
          <input
            type="date"
            value={hasta}
            min={desde}
            onChange={(e) => navegar({ rango: "custom", desde, hasta: e.target.value })}
            className={claseInput}
            aria-label="Hasta"
          />
        </>
      ) : null}

      <Select
        value={closerId ?? TODOS}
        onValueChange={(valor: string | null) =>
          navegar({ closer: valor === null || valor === TODOS ? null : valor })
        }
      >
        <SelectTrigger className="w-44" aria-label="Closer">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={TODOS}>Todos los closers</SelectItem>
          {closers.map((c) => (
            <SelectItem key={c} value={c}>
              {c}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
