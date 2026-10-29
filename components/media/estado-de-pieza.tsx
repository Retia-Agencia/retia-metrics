import { Badge } from "@/components/ui/badge";
import type { EstadoDePieza } from "./tipos";

export const ESTADOS: Record<EstadoDePieza, { texto: string; variante: "info" | "alerta" | "exito" | "neutro" }> = {
  programada: { texto: "Programada", variante: "info" },
  atrasada: { texto: "Atrasada", variante: "alerta" },
  publicada: { texto: "Publicada", variante: "exito" },
  fija: { texto: "Siempre visible", variante: "neutro" },
};

export function BadgeDeEstado({ estado }: { estado: EstadoDePieza }) {
  const e = ESTADOS[estado];
  return <Badge variant={e.variante}>{e.texto}</Badge>;
}

/** `2026-10-29` → `29/10/2026`, sin pasar por `Date` (una fecha de negocio no tiene zona, AGENTS.md). */
export function fechaLegible(fecha: string | null): string {
  if (!fecha) return "—";
  const [a, m, d] = fecha.split("-");
  return `${d}/${m}/${a}`;
}
