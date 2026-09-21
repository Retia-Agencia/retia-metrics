import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { changeLog, miembrosPrograma, leads, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { esViolacionUnica } from "@/lib/db/errores";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import type { Rol } from "@/lib/auth/roles";
import { trabajaLeads } from "@/lib/auth/roles";
import { igualCloser } from "@/lib/closers/identidad";
import type { Lead } from "@/lib/db/schema";

/**
 * Responsable de una persona y alta manual (ticket 026, ADR 0021, 0011, 0005, 0003).
 *
 * A diferencia de `lib/catalogo/*`, `leads` NO tiene columna `activo`, asi que esto
 * no usa `moldeDeCatalogo`: escribe directo, pero con el mismo estilo — la base entra
 * por inyeccion (para testear con PGlite), sin `"use server"`, errores via
 * `ErrorDeApp`, y toda escritura atomica con `ejecutarJuntas` dejando rastro en
 * `change_log` con `origen = "app"` y el `userId` del actor.
 *
 * El `closerId` que se guarda como responsable se copia SIEMPRE de la cuenta
 * logueada; el closer nunca lo elige (ADR 0011). El sync nunca lee ni pisa este
 * campo (ADR 0021): eso vive en `lib/sheets/plan-sync.ts`.
 */

/** Quien realiza la operacion: su id (para `change_log`), su rol y su closerId (ADR 0011). */
export interface Actor {
  id: string;
  rol: Rol;
  closerId: string | null;
}

/**
 * Lo que devuelve un alta manual: la persona, y si ESTA llamada fue la que la creo.
 * `creada: false` significa que el correo ya existia en ese programa y se devolvio la
 * fila de siempre, sin tocar nada (dedup del ADR 0005).
 */
export interface ResultadoAltaManual {
  persona: Lead;
  creada: boolean;
}

/** Entrada de `crearPersonaManual`. El correo es obligatorio y se normaliza. */
export const esquemaPersonaManual = z.object({
  programId: z.string().uuid("Programa inválido."),
  correo: z.string().trim().toLowerCase().email("Correo inválido."),
  nombre: z.string().trim().max(120, "Máximo 120 caracteres.").optional(),
  telefono: z.string().trim().max(40, "Máximo 40 caracteres.").optional(),
});

export type EntradaPersonaManual = z.input<typeof esquemaPersonaManual>;

/** Lee una persona por id. */
async function leerPersona(db: Db, id: string): Promise<Lead | undefined> {
  const [fila] = await db.select().from(leads).where(eq(leads.id, id)).limit(1);
  return fila as Lead | undefined;
}

/** Lee una persona por (programa, correo normalizado): la llave del dedup (ADR 0005). */
async function leerPorCorreo(
  db: Db,
  programId: string,
  emailNormalizado: string,
): Promise<Lead | undefined> {
  const [fila] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.programId, programId), eq(leads.emailNormalizado, emailNormalizado)))
    .limit(1);
  return fila as Lead | undefined;
}

/**
 * Es destino valido de un lead en un programa quien TRABAJA LEADS (closer o
 * developer, `trabajaLeads` en `lib/auth/roles.ts`), esta activo, tiene ese `closerId`
 * Y una membresia ACTIVA en el programa. Una sola regla que impide que un closer de
 * otro programa se robe personas ajenas y que un gerente asigne a alguien que no
 * vende ahi.
 *
 * Antes filtraba `eq(users.rol, "closer")` contra la base, asi que un developer no
 * pasaba ni con la vista `closer` puesta (ticket 028). El filtro por rol se relaja
 * usando `trabajaLeads`, NO escribiendo `"developer"` en la consulta: la excepcion del
 * developer vive en un solo lugar (ADR 0025). Se lee la columna `rol` y se decide en
 * memoria; a esta escala (una fila por closerId) es gratis.
 */
async function esCloserValidoEnPrograma(
  db: Db,
  closerId: string,
  programId: string,
): Promise<boolean> {
  const [fila] = await db
    .select({ rol: users.rol })
    .from(users)
    .innerJoin(miembrosPrograma, eq(miembrosPrograma.userId, users.id))
    .where(
      and(
        // Sin distinguir mayusculas (ADR 0030).
        igualCloser(users.closerId, closerId),
        eq(users.activo, true),
        eq(miembrosPrograma.programId, programId),
        eq(miembrosPrograma.activo, true),
      ),
    )
    .limit(1);
  return Boolean(fila) && trabajaLeads(fila.rol as Rol);
}

/** El closer logueado debe tener su `closerId` cargado (precondicion del ADR 0011). */
function exigirCloserIdCargado(actor: Actor): string {
  const closerId = actor.closerId?.trim();
  if (!closerId) {
    throw new ErrorDeApp("Tu cuenta no tiene closerId cargado.", 400);
  }
  return closerId;
}

/**
 * Crea a mano una persona que no paso por el formulario (WhatsApp, masivos), solo un
 * closer. Entra por el CRM (`entrada = "crm"`); es la
 * entrada, no otro campo, lo que la separa en las metricas (ADR 0021).
 *
 * Dedup (ADR 0005): si ya existe una persona con ese `(programId, correo)` no crea ni
 * modifica nada, devuelve la existente. La misma garantia esta en el indice unico de
 * la base, asi que una carrera entre dos closers se resuelve releyendo tras el choque.
 *
 * **Devuelve tambien si la creo o si ya existia**, y no es un adorno: son dos cosas
 * distintas que el llamador tiene que poder distinguir. Hasta el 18-sep devolvia solo
 * la persona y `/mi-dia` confirmaba "Persona creada" en los dos casos, asi que un
 * closer que reescribia un nombre sobre un correo ya existente veia un toast verde y
 * se iba creyendo que lo habia guardado. El nombre se descartaba en silencio.
 */
export async function crearPersonaManual(
  db: Db,
  actor: Actor,
  input: EntradaPersonaManual,
): Promise<ResultadoAltaManual> {
  return normalizando(async () => {
    // Puede crear quien TRABAJA LEADS (closer o developer, `trabajaLeads`), NO el
    // gerente (ADR 0003). Antes era `actor.rol !== "closer"` a mano, y por eso un
    // developer en vista `todo` —la mas ancha— no podia crear pero en vista `closer`
    // si: la comparacion literal excluia al developer, que es justo el bug que el
    // ADR 0025 punto 5 prohibe. La excepcion del developer vive en `roles.ts`, no
    // aca (ticket 032).
    if (!trabajaLeads(actor.rol)) {
      throw new ErrorDeApp("Registrar trabajo de venta es del closer.", 403);
    }
    const closerId = exigirCloserIdCargado(actor);
    const datos = esquemaPersonaManual.parse(input);

    // El closer debe vender en el programa donde crea la persona.
    if (!(await esCloserValidoEnPrograma(db, closerId, datos.programId))) {
      throw new ErrorDeApp("No puedes crear personas en un programa donde no vendes.", 403);
    }

    // Dedup: si ya existe, se devuelve sin tocar nada ni escribir bitacora.
    const existente = await leerPorCorreo(db, datos.programId, datos.correo);
    if (existente) return { persona: existente, creada: false };

    // El id se genera en codigo para meter el alta y su change_log en el mismo lote.
    const id = crypto.randomUUID();
    const etiqueta = datos.nombre ?? datos.correo;
    // `numAplicaciones` va en 0 EXPLICITO: una persona creada a mano nunca aplico al
    // formulario, y dejarla en el default 1 afirmaria una aplicacion que no existio
    // (ADR 0005). `estado` si queda con el default de la base.
    const valores = {
      id,
      programId: datos.programId,
      emailNormalizado: datos.correo,
      nombre: datos.nombre ?? null,
      telefono: datos.telefono ?? null,
      entrada: "crm" as const,
      numAplicaciones: 0,
    };
    // Una fila de bitacora por campo escrito, como `molde.crear`. El `id` no es un
    // campo del alta (ya es `registroId`) y lo que llego vacio no se registra.
    const aBitacora = Object.entries(valores).filter(
      ([campo, valor]) => campo !== "id" && valor !== null,
    );

    try {
      await ejecutarJuntas(db, (tx) => [
        (tx as Db).insert(leads).values(valores),
        ...aBitacora.map(([campo, valor]) =>
          (tx as Db).insert(changeLog).values({
            tabla: "leads",
            registroId: id,
            etiqueta,
            campo,
            valorAnterior: null,
            valorNuevo: String(valor),
            origen: "app" as const,
            userId: actor.id,
          }),
        ),
      ]);
    } catch (error) {
      // Carrera con otro closer sobre el indice unico (programId, emailNormalizado):
      // se relee y se devuelve la existente en vez de propagar el error.
      if (esViolacionUnica(error)) {
        // La creo el OTRO closer, no esta llamada: `creada: false` es correcto y es
        // justo lo que hace que la pantalla no afirme un alta que no hizo.
        const yaCreada = await leerPorCorreo(db, datos.programId, datos.correo);
        if (yaCreada) return { persona: yaCreada, creada: false };
      }
      throw error;
    }

    return { persona: (await leerPersona(db, id))!, creada: true };
  });
}
