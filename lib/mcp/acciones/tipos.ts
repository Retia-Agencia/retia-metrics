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
  objetivos(argumentos: z.output<E>): ObjetivoAccionMcp[];
  revisar(db: Db, actor: ActorDeMovimiento, objetivo: ObjetivoAccionMcp): Promise<RevisionAccionMcp>;
  huella(db: Db, objetivo: ObjetivoAccionMcp, opciones?: { bloquear?: true }): Promise<string | null>;
  aplicar(db: Db, actor: ActorDeMovimiento, objetivo: ObjetivoAccionMcp, opciones: { origen: "mcp" }): Promise<unknown>;
  eventoDeshacer?(nuevos: EventoDeshacible[], objetivo: ObjetivoAccionMcp): EventoDeshacible | undefined;
  seDeshace: boolean;
  efectoExterno: boolean;
}
