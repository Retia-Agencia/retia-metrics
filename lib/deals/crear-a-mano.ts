import { and, eq, notInArray } from "drizzle-orm";
import { z } from "zod";
import { deals, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { puedeAcceder, type Rol } from "@/lib/auth/roles";
import { crearPersonaManual } from "@/lib/mutations/personas";
import { vigente } from "@/lib/queries/vigente";
import { abrirDeal } from "./mover-etapa";
import type { EtapaDeal } from "./etapas";

/**
 * Crear un deal a mano desde la app (ticket 140, comercial.md §9.1; el "Add deals" de
 * HubSpot).
 *
 * No es un escritor nuevo: el deal lo abre `abrirDeal()` del motor, el MISMO que usa la
 * ingesta, asi que nace con su fila de `deal_etapa_historial`, su rastro en `change_log`
 * y la reja de un deal abierto por lead y programa (ADR 0037). Este modulo solo decide
 * lo que el motor no sabe:
 *
 *  - **El programa es frontera (ADR 0048).** Un programa fuera del alcance de la sesion
 *    responde 404, igual que uno inexistente: un closer que forja la accion con el id del
 *    otro programa no se entera de que existe, y la base no se mueve.
 *  - **Nunca un deal sin lead.** O se elige un lead del programa, o se crea primero con el
 *    alta manual de siempre (`crearPersonaManual`, ticket 026), con su dedup y su reja de
 *    quien puede crear personas.
 *  - **Nace en la etapa de entrada** (`ETAPA_DE_ENTRADA`): elegir una etapa avanzada al
 *    crear esta fuera del alcance; lo demas lo mueve el motor.
 *  - **Si el lead ya tiene un deal abierto**, se rechaza con el id de ese deal para que la
 *    pantalla lo enlace (`DealYaAbierto`). La reja es el indice
 *    `deals_uno_abierto_por_lead_y_programa_idx`; la lectura previa solo arma el mensaje,
 *    y si dos personas chocan, el indice gana y se relee.
 *
 * El actor sale SIEMPRE de la sesion (quien llama lo arma), nunca del input.
 */

/** Donde nace un deal creado a mano: la primera etapa del tablero (structure.md §2.1). */
export const ETAPA_DE_ENTRADA: EtapaDeal = "pendiente_setteo";

/** Quien crea. `closerId` lo exige el alta manual del lead (ADR 0011). */
export interface ActorDeAlta {
  userId: string;
  rol: Rol;
  closerId: string | null;
}

export const esquemaDealAMano = z.object({
  programId: z.string().uuid("Programa inválido."),
  lead: z.discriminatedUnion("tipo", [
    z.object({ tipo: z.literal("existente"), leadId: z.string().uuid("Lead inválido.") }),
    z.object({
      tipo: z.literal("nuevo"),
      correo: z.string(),
      nombre: z.string().optional(),
      telefono: z.string().optional(),
    }),
  ]),
});

export type EntradaDealAMano = z.input<typeof esquemaDealAMano>;

export interface DealCreado {
  dealId: string;
  leadId: string;
  /** `true` si ESTA alta creo el lead; `false` si ya existia (elegido o por dedup del correo). */
  leadCreado: boolean;
}

/** El lead ya tiene un deal abierto en el programa: se trabaja ese, y este error dice cual. */
export class DealYaAbierto extends ErrorDeApp {
  constructor(readonly dealId: string) {
    super("Este lead ya tiene un deal abierto en el programa: trabaja ese.", 409);
  }
}

const CERRADAS: EtapaDeal[] = ["completo", "cierre_perdido"];

/** El deal abierto (no cerrado, no anulado) del lead en el programa, si lo hay. */
async function dealAbiertoDe(db: Db, leadId: string, programId: string): Promise<string | null> {
  const [fila] = await db
    .select({ id: deals.id })
    .from(deals)
    .where(
      and(
        eq(deals.leadId, leadId),
        eq(deals.programId, programId),
        notInArray(deals.etapa, CERRADAS),
        vigente(deals),
      ),
    )
    .limit(1);
  return fila?.id ?? null;
}

export async function crearDealAMano(
  db: Db,
  actor: ActorDeAlta,
  entrada: EntradaDealAMano,
): Promise<DealCreado> {
  return normalizando(async () => {
    // Quien puede: gerente, closer y (por `esAccesoTotal`) el developer. La ruta ya lo
    // exige; se repite aqui porque esta funcion es la reja, no la pantalla.
    if (!puedeAcceder(actor.rol, ["gerente", "closer"])) {
      throw new ErrorDeApp("No tienes permiso para crear deals.", 403);
    }
    const datos = esquemaDealAMano.parse(entrada);

    if (!(await programaEnAlcance(actor.userId, actor.rol, datos.programId, db))) {
      throw new ErrorDeApp("No existe el programa.", 404);
    }

    let leadId: string;
    let leadCreado = false;
    if (datos.lead.tipo === "existente") {
      const [lead] = await db
        .select({ id: leads.id })
        .from(leads)
        .where(and(eq(leads.id, datos.lead.leadId), eq(leads.programId, datos.programId)));
      // Un lead de otro programa responde igual que uno inexistente: el programa es frontera.
      if (!lead) throw new ErrorDeApp("No existe el lead en este programa.", 404);
      leadId = lead.id;
    } else {
      const { persona, creada } = await crearPersonaManual(
        db,
        { id: actor.userId, rol: actor.rol, closerId: actor.closerId },
        {
          programId: datos.programId,
          correo: datos.lead.correo,
          nombre: datos.lead.nombre || undefined,
          telefono: datos.lead.telefono || undefined,
        },
      );
      leadId = persona.id;
      leadCreado = creada;
    }

    const abierto = await dealAbiertoDe(db, leadId, datos.programId);
    if (abierto) throw new DealYaAbierto(abierto);

    try {
      const dealId = await abrirDeal(db, {
        leadId,
        programId: datos.programId,
        etapa: ETAPA_DE_ENTRADA,
        actor: { tipo: "usuario", userId: actor.userId, rol: actor.rol },
      });
      return { dealId, leadId, leadCreado };
    } catch (e) {
      // Carrera: otro abrio un deal entre la lectura y la escritura. El indice gano;
      // se relee para enlazar el que quedo.
      if (e instanceof ErrorDeApp && e.status === 409) {
        const ganador = await dealAbiertoDe(db, leadId, datos.programId);
        if (ganador) throw new DealYaAbierto(ganador);
      }
      throw e;
    }
  });
}
