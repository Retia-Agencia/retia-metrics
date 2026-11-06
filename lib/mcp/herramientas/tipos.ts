import type { Session } from "next-auth";
import type { z } from "zod";
import type { Rol } from "@/lib/auth/roles";
import type { Db } from "@/lib/db/tipos";

export interface ContextoMcp {
  db: Db;
  session: Session;
  rol: Rol | null;
  tokenId: string;
  escritura: boolean;
}

export interface ResultadoDeHerramienta {
  texto: string;
  estructurado: Record<string, unknown>;
}

export interface Herramienta<E extends z.ZodObject = z.ZodObject> {
  nombre: string;
  descripcion: string;
  entrada: E;
  puede(contexto: ContextoMcp): boolean;
  soloLectura: true;
  ejecutar(contexto: ContextoMcp, entrada: z.output<E>): Promise<ResultadoDeHerramienta>;
}
