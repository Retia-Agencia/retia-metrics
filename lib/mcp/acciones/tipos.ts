import type { z } from "zod";
import type { Db } from "@/lib/db/tipos";
import type { ActorDeMovimiento } from "@/lib/deals/mover-deal";
import type { EventoDeshacible } from "@/lib/deshacer/deshacer";
import type { ContextoMcp } from "@/lib/mcp/herramientas/tipos";

export interface ObjetivoAccionMcp {
  id: string;
  [clave: string]: unknown;
}

export interface RevisionAccionMcp {
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  sePuedeAplicar: boolean;
  razon: string | null;
  detalle?: Record<string, unknown>;
  efectoExterno?: boolean;
  aviso?: string;
}

/** Dónde vive el objetivo de una acción que no es un deal (un SKU, un programa): lo que preparar_accion necesita para ubicarlo. */
export interface UbicacionDeObjetivoMcp {
  programId: string;
  nombre: string | null;
  antes: Record<string, unknown> | null;
}

export interface AplicacionAccionMcp {
  diferido?: (db: Db) => Promise<{ pendiente: boolean }>;
}

export interface AccionMcp<E extends z.ZodObject = z.ZodObject> {
  clave: string;
  titulo: string;
  cuandoUsarla: string;
  argumentos: E;
  ejemplo: z.input<E>;
  puede(contexto: ContextoMcp): boolean;
  /** Sin esto el objetivo es un deal. Con esto, preparar_accion lo ubica aquí y rechaza si es de otro programa. */
  ubicar?(db: Db, objetivo: ObjetivoAccionMcp): Promise<UbicacionDeObjetivoMcp | null>;
  /** Razón cuando el objetivo no existe o es de otro programa; por defecto habla de un deal. */
  objetivoAusente?: string;
  objetivos(argumentos: z.output<E>): ObjetivoAccionMcp[];
  revisar(db: Db, actor: ActorDeMovimiento, objetivo: ObjetivoAccionMcp): Promise<RevisionAccionMcp>;
  huella(db: Db, objetivo: ObjetivoAccionMcp, opciones?: { bloquear?: true }): Promise<string | null>;
  aplicar(db: Db, actor: ActorDeMovimiento, objetivo: ObjetivoAccionMcp, opciones: { origen: "mcp" }): Promise<unknown>;
  eventoDeshacer?(nuevos: EventoDeshacible[], objetivo: ObjetivoAccionMcp): EventoDeshacible | undefined;
  seDeshace: boolean;
  efectoExterno: boolean;
}
