import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { changeLog, miembrosPrograma, people, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import type { Rol } from "@/lib/auth/roles";
import { esAdministrador, trabajaLeads } from "@/lib/auth/roles";
import type { Persona } from "@/lib/db/schema";

/**
 * Responsable de una persona y alta manual (ticket 026, ADR 0021, 0011, 0005, 0003).
 *
 * A diferencia de `lib/catalogo/*`, `people` NO tiene columna `activo`, asi que esto
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

/** Entrada de `asignarResponsable`. El id de la persona y el closer destino en texto. */
export const esquemaAsignacion = z.object({
  personaId: z.string().uuid("El identificador no es válido."),
  closerId: z.string().trim().min(1, "Debes indicar un closer."),
});

/**
 * Lo que devuelve un alta manual: la persona, y si ESTA llamada fue la que la creo.
 * `creada: false` significa que el correo ya existia en ese programa y se devolvio la
 * fila de siempre, sin tocar nada (dedup del ADR 0005).
 */
export interface ResultadoAltaManual {
  persona: Persona;
  creada: boolean;
}

/** Entrada de `crearPersonaManual`. El correo es obligatorio y se normaliza. */
export const esquemaPersonaManual = z.object({
  programId: z.string().uuid("Programa inválido."),
  correo: z.string().trim().toLowerCase().email("Correo inválido."),
  nombre: z.string().trim().max(120, "Máximo 120 caracteres.").optional(),
  telefono: z.string().trim().max(40, "Máximo 40 caracteres.").optional(),
});

export type EntradaAsignacion = z.input<typeof esquemaAsignacion>;
export type EntradaPersonaManual = z.input<typeof esquemaPersonaManual>;

/** Traduce un `ZodError` a un `ErrorDeApp` 400 con el primer mensaje. */
async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (error) {
    if (error instanceof ErrorDeApp) throw error;
    if (error instanceof z.ZodError) {
      throw new ErrorDeApp(error.issues[0]?.message ?? "Petición inválida.", 400);
    }
    throw error;
  }
}

/**
 * Detecta la violacion de indice unico de Postgres (code `23505`), mirando tambien
 * la `cause` anidada como hace `esViolacionUnica` en `lib/catalogo/molde.ts`.
 */
function esViolacionUnica(error: unknown): boolean {
  let actual: unknown = error;
  for (let i = 0; i < 5 && actual != null; i++) {
    if (typeof actual === "object" && (actual as { code?: unknown }).code === "23505") {
      return true;
    }
    actual = (actual as { cause?: unknown }).cause;
  }
  return false;
}

/** Lee una persona por id. */
async function leerPersona(db: Db, id: string): Promise<Persona | undefined> {
  const [fila] = await db.select().from(people).where(eq(people.id, id)).limit(1);
  return fila as Persona | undefined;
}

/** Lee una persona por (programa, correo normalizado): la llave del dedup (ADR 0005). */
async function leerPorCorreo(
  db: Db,
  programId: string,
  emailNormalizado: string,
): Promise<Persona | undefined> {
  const [fila] = await db
    .select()
    .from(people)
    .where(and(eq(people.programId, programId), eq(people.emailNormalizado, emailNormalizado)))
    .limit(1);
  return fila as Persona | undefined;
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
        eq(users.closerId, closerId),
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
 * Asigna (o reasigna) el closer responsable de una persona.
 *
 * Un closer solo se asigna a si mismo una persona SIN responsable; un gerente asigna
 * o cambia a cualquiera. En ambos casos el closer destino tiene que vender en el
 * programa de la persona y estar activo. Cada cambio real va a `change_log`; si el
 * valor no cambia no se escribe nada (igual que `molde.editar`).
 */
export async function asignarResponsable(
  db: Db,
  actor: Actor,
  input: EntradaAsignacion,
): Promise<Persona> {
  return normalizando(async () => {
    const datos = esquemaAsignacion.parse(input);

    const persona = await leerPersona(db, datos.personaId);
    if (!persona) throw new ErrorDeApp("No existe una persona con ese id.", 404);

    // Quien NO administra (el closer, y el developer proyectado a vista `closer`)
    // solo se asigna a si mismo una persona SIN responsable. Quien administra
    // (gerente, o developer en vista `todo`/`gerente`) reasigna a cualquiera.
    //
    // Es un predicado POSITIVO, no un `actor.rol === "closer"` a mano (ticket 032):
    // el literal habria FUNCIONADO igual porque el rol ya viene proyectado por
    // `rolDeVista`, pero comparar contra un literal para APLICAR una restriccion
    // deja la pregunta escrita como un rol en vez de como una capacidad, que es la
    // forma que el ADR 0025 punto 5 senala como bug. `esAdministrador` da la
    // respuesta correcta en las cuatro combinaciones: developer en `todo` administra
    // (asigna libre, MAS que un closer, nunca menos), developer en vista `closer`
    // no (cae aca y se somete a las reglas del closer, que es lo que la vista pide).
    if (!esAdministrador(actor.rol)) {
      // Primero la precondicion del ADR 0011: una cuenta sin closerId no puede ser
      // responsable de nada. Va antes de la comparacion de abajo porque si no, un
      // closerId nulo saldria como "no es tuya" y el mensaje mandaria a la persona
      // equivocada a arreglar el problema.
      exigirCloserIdCargado(actor);
      if (datos.closerId !== actor.closerId) {
        throw new ErrorDeApp("Solo puedes asignarte personas a ti mismo.", 403);
      }
      if (persona.responsableCloserId) {
        throw new ErrorDeApp(
          "Esta persona ya tiene responsable; pídele a un gerente que la reasigne.",
          403,
        );
      }
    }

    // El closer destino tiene que vender en el programa de la persona y estar activo.
    if (!(await esCloserValidoEnPrograma(db, datos.closerId, persona.programId))) {
      throw new ErrorDeApp("Ese closer no vende en este programa o está inactivo.", 400);
    }

    // Sin cambio real: no se toca la fila ni se escribe change_log (como molde.editar).
    if (persona.responsableCloserId === datos.closerId) return persona;

    await ejecutarJuntas(db, (tx) => [
      (tx as Db)
        .update(people)
        .set({ responsableCloserId: datos.closerId, updatedAt: new Date() })
        .where(eq(people.id, persona.id)),
      (tx as Db).insert(changeLog).values({
        tabla: "people",
        registroId: persona.id,
        etiqueta: persona.nombre ?? persona.emailNormalizado,
        campo: "responsableCloserId",
        valorAnterior: persona.responsableCloserId,
        valorNuevo: datos.closerId,
        origen: "app" as const,
        userId: actor.id,
      }),
    ]);

    return (await leerPersona(db, persona.id))!;
  });
}

/**
 * Crea a mano una persona que no paso por el formulario (WhatsApp, masivos), solo un
 * closer, que queda como su responsable. Entra por el CRM (`entrada = "crm"`); es la
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

    // Dedup: si ya existe, se devuelve sin tocar el responsable ni escribir bitacora.
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
      responsableCloserId: closerId,
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
        (tx as Db).insert(people).values(valores),
        ...aBitacora.map(([campo, valor]) =>
          (tx as Db).insert(changeLog).values({
            tabla: "people",
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
