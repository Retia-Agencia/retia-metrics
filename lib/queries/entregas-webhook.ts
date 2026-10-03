import { and, desc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { entregasWebhook, leads, sobresCrudos, sources } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Las entregas del webhook (ticket 110): cada vez que la ruta responde, se guarda la
 * hora, la fuente, el codigo HTTP, el motivo y —si hubo— el lead y el sobre crudo. Es
 * lo que antes solo vivia en los logs de Vercel, que nadie del negocio ve.
 *
 * Aqui viven: (1) el REGISTRO de una entrega, envuelto para que NUNCA tumbe la ingesta
 * (mismo principio que la caja negra, ADR 0058); (2) la PURGA barata de los rechazos
 * vencidos; (3) las LECTURAS por programa y las huerfanas.
 */

/** El enum `motivo_entrega` de la base, para tipar sin repetir literales sueltos. */
export type MotivoEntrega =
  | "procesado"
  | "sin_correo"
  | "contenido_invalido"
  | "fallo_ingesta"
  | "fuente_no_encontrada"
  | "sin_secreto"
  | "firma_ausente"
  | "firma_invalida";

/** Los 200 con firma buena tienen sobre crudo y pueden reprocesarse si fallaron. */
const MOTIVOS_CON_SOBRE: MotivoEntrega[] = ["procesado", "sin_correo", "contenido_invalido", "fallo_ingesta"];
/** Un rechazo (404, 401) se guarda SIN cuerpo: un cuerpo sin firma valida es de cualquiera. */
export const MOTIVOS_DE_RECHAZO: MotivoEntrega[] = [
  "fuente_no_encontrada",
  "sin_secreto",
  "firma_ausente",
  "firma_invalida",
];

/** Cuanto se guarda un rechazo antes de purgarlo (decision de Mani, 28-sep). */
const DIAS_RETENCION_RECHAZOS = 90;
const DIA_MS = 86_400_000;

export interface EntradaEntrega {
  programId: string | null;
  sourceId: string | null;
  sobreId: string | null;
  leadId: string | null;
  codigoHttp: 200 | 401 | 404;
  motivo: MotivoEntrega;
}

/**
 * Registra UNA entrega. Nunca lanza: si el insert falla se loguea y se sigue, igual
 * que `registrarSobre` en la ruta. Registrar la entrega no puede cambiar la respuesta
 * al proveedor ni tumbar la ingesta del lead (ADR 0058).
 *
 * Al registrar un RECHAZO nuevo se purgan de una vez los rechazos vencidos (barato, en
 * la propia ruta, sin cron): un 401 o un 404 nuevo es la ocasion natural, y asi la
 * tabla no crece sin techo. La purga tambien va en su propio try: si falla, la entrega
 * ya quedo escrita.
 */
export async function registrarEntrega(
  db: Db,
  entrada: EntradaEntrega,
  ahora: Date = new Date(),
): Promise<void> {
  try {
    await db.insert(entregasWebhook).values({
      programId: entrada.programId,
      sourceId: entrada.sourceId,
      sobreId: entrada.sobreId,
      leadId: entrada.leadId,
      codigoHttp: entrada.codigoHttp,
      motivo: entrada.motivo,
    });
  } catch (e) {
    console.error("[webhook] no se pudo registrar la entrega", e);
    return;
  }

  if (MOTIVOS_DE_RECHAZO.includes(entrada.motivo)) {
    try {
      await purgarRechazosVencidos(db, ahora);
    } catch (e) {
      console.error("[webhook] no se pudo purgar rechazos vencidos", e);
    }
  }
}

/**
 * Borra las entregas RECHAZADAS de mas de 90 dias. Solo los rechazos: las aceptadas
 * quedan con su sobre crudo (ADR 0058) y son el historial que la pantalla muestra.
 * Devuelve cuantas borro (util para el test).
 */
export async function purgarRechazosVencidos(db: Db, ahora: Date = new Date()): Promise<number> {
  const corte = new Date(ahora.getTime() - DIAS_RETENCION_RECHAZOS * DIA_MS);
  const borradas = await db
    .delete(entregasWebhook)
    .where(
      and(
        inArray(entregasWebhook.motivo, MOTIVOS_DE_RECHAZO),
        lt(entregasWebhook.recibidoEn, corte),
      ),
    )
    .returning();
  return borradas.length;
}

/** Una entrega como la pinta la pantalla. El texto legible del motivo lo decide la UI. */
export interface EntregaListada {
  id: string;
  recibidoEn: Date;
  codigoHttp: number;
  motivo: MotivoEntrega;
  fuenteNombre: string | null;
  leadId: string | null;
  leadNombre: string | null;
  sobreId: string | null;
  /** El error del sobre, si lo hay: por que fallo el procesamiento con firma buena. */
  errorSobre: string | null;
  /** Si esta entrega se puede reprocesar (tiene sobre, y el sobre esta con error). */
  reprocesable: boolean;
}

/** Cuantas entregas trae la pantalla, la mas reciente arriba. Un tope sano a esta escala. */
/** Cuantas entregas trae cada pagina, la mas reciente arriba. Se cargan mas bajo demanda. */
export const ENTREGAS_POR_PAGINA = 25;

/**
 * El cursor de paginacion keyset: la fecha e id de la ULTIMA entrega mostrada. La
 * siguiente pagina pide lo que esta estrictamente despues en el orden `(recibidoEn
 * desc, id desc)`, nunca con `OFFSET` —que recorre y descarta todo lo anterior cada vez
 * y crece sin techo—. El id desempata dos entregas con la MISMA fecha, asi que no hay
 * solapes ni huecos aunque varias caigan en el mismo instante.
 */
export interface CursorEntregas {
  recibidoEn: Date;
  id: string;
}

/** Una pagina de entregas: las filas y, si hay mas, el cursor para pedir la siguiente. */
export interface PaginaEntregas {
  entregas: EntregaListada[];
  /** El cursor opaco (base64url) de la siguiente pagina, o `null` si esta es la ultima. */
  cursor: string | null;
}

/**
 * El cursor viaja por la red como una cadena opaca (base64url de `ISO|id`): la pantalla
 * no arma consultas con el, solo lo devuelve tal cual. Se valida en el borde con zod
 * (`descifrarCursor`): un cursor manipulado o de otra forma se ignora y se vuelve a la
 * primera pagina, nunca revienta.
 */
const esquemaCursor = z
  .string()
  .max(200)
  .transform((valor, ctx) => {
    let texto: string;
    try {
      texto = Buffer.from(valor, "base64url").toString("utf8");
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cursor inválido." });
      return z.NEVER;
    }
    const corte = texto.indexOf("|");
    if (corte <= 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cursor inválido." });
      return z.NEVER;
    }
    const iso = texto.slice(0, corte);
    const id = texto.slice(corte + 1);
    const fecha = new Date(iso);
    if (Number.isNaN(fecha.getTime()) || id.length === 0) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Cursor inválido." });
      return z.NEVER;
    }
    return { recibidoEn: fecha, id } satisfies CursorEntregas;
  });

/** Cifra un cursor a su cadena opaca. */
export function cifrarCursor(cursor: CursorEntregas): string {
  return Buffer.from(`${cursor.recibidoEn.toISOString()}|${cursor.id}`, "utf8").toString("base64url");
}

/**
 * Descifra el cursor que llega por la red. Un valor ausente, vacio o malformado NO es
 * un error del usuario: devuelve `null` y la lectura arranca desde la primera pagina.
 */
export function descifrarCursor(valor: string | null | undefined): CursorEntregas | null {
  if (!valor) return null;
  const r = esquemaCursor.safeParse(valor);
  return r.success ? r.data : null;
}

/** El predicado keyset: lo estrictamente despues del cursor en `(recibidoEn, id)` desc. */
function despuesDelCursor(cursor: CursorEntregas) {
  return or(
    lt(entregasWebhook.recibidoEn, cursor.recibidoEn),
    and(eq(entregasWebhook.recibidoEn, cursor.recibidoEn), lt(entregasWebhook.id, cursor.id)),
  );
}

/** Arma la pagina: pide una fila de mas para saber si hay siguiente, sin un `count`. */
function aPaginaEntregas(filas: EntregaListada[]): PaginaEntregas {
  const hayMas = filas.length > ENTREGAS_POR_PAGINA;
  const pagina = hayMas ? filas.slice(0, ENTREGAS_POR_PAGINA) : filas;
  const ultima = pagina[pagina.length - 1];
  return {
    entregas: pagina,
    cursor: hayMas && ultima ? cifrarCursor({ recibidoEn: ultima.recibidoEn, id: ultima.id }) : null,
  };
}

/**
 * Las entregas de UN programa, la mas reciente arriba (el programa es frontera: nunca
 * se cruzan dos programas, ADR 0043), paginadas de a `ENTREGAS_POR_PAGINA`. El error del
 * sobre y si se puede reprocesar salen de `sobres_crudos`. El nombre del lead sale de
 * `leads` (para el enlace a su ficha; el id que va a la URL es opaco, nunca el correo).
 * Sin `cursor` trae la primera pagina; con el, la siguiente, por keyset y nunca `OFFSET`.
 */
export async function entregasDePrograma(
  programId: string,
  cursor: CursorEntregas | null = null,
  db: Db = dbDeLaApp,
): Promise<PaginaEntregas> {
  const filtro = cursor
    ? and(eq(entregasWebhook.programId, programId), despuesDelCursor(cursor))
    : eq(entregasWebhook.programId, programId);
  const filas = await db
    .select({
      id: entregasWebhook.id,
      recibidoEn: entregasWebhook.recibidoEn,
      codigoHttp: entregasWebhook.codigoHttp,
      motivo: entregasWebhook.motivo,
      fuenteNombre: sources.nombre,
      sourceId: entregasWebhook.sourceId,
      leadId: entregasWebhook.leadId,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      sobreId: entregasWebhook.sobreId,
      errorSobre: sobresCrudos.error,
      reprocesadoEn: sobresCrudos.reprocesadoEn,
    })
    .from(entregasWebhook)
    .leftJoin(sources, eq(sources.id, entregasWebhook.sourceId))
    .leftJoin(leads, eq(leads.id, entregasWebhook.leadId))
    .leftJoin(sobresCrudos, eq(sobresCrudos.id, entregasWebhook.sobreId))
    .where(filtro)
    // Un segundo criterio por id desempata las entregas de la misma fecha: el keyset
    // necesita un orden total o dos filas con el mismo instante se saltarian o repetirian.
    .orderBy(desc(entregasWebhook.recibidoEn), desc(entregasWebhook.id))
    .limit(ENTREGAS_POR_PAGINA + 1);

  return aPaginaEntregas(filas.map((f) => aEntregaListada(f, false)));
}

/**
 * Las entregas HUERFANAS: las que no resolvieron ni una fuente ni un programa
 * (`program_id` nulo). Son los 404 por id inexistente o mal formado. Se muestran aparte
 * porque no caben en la vista por programa. No se filtra por `source_id` nulo: una
 * entrega de Calendly (0039) tampoco tiene fuente y SI es de un programa. Pagina igual
 * que la vista por programa (keyset, nunca `OFFSET`).
 */
export async function entregasHuerfanas(
  cursor: CursorEntregas | null = null,
  db: Db = dbDeLaApp,
): Promise<PaginaEntregas> {
  const filtro = cursor
    ? and(isNull(entregasWebhook.programId), despuesDelCursor(cursor))
    : isNull(entregasWebhook.programId);
  const filas = await db
    .select({
      id: entregasWebhook.id,
      recibidoEn: entregasWebhook.recibidoEn,
      codigoHttp: entregasWebhook.codigoHttp,
      motivo: entregasWebhook.motivo,
      fuenteNombre: sql<string | null>`null`,
      sourceId: entregasWebhook.sourceId,
      leadId: entregasWebhook.leadId,
      leadNombre: sql<string | null>`null`,
      leadEmail: sql<string | null>`null`,
      sobreId: entregasWebhook.sobreId,
      errorSobre: sql<string | null>`null`,
      reprocesadoEn: sql<Date | null>`null`,
    })
    .from(entregasWebhook)
    .where(filtro)
    .orderBy(desc(entregasWebhook.recibidoEn), desc(entregasWebhook.id))
    .limit(ENTREGAS_POR_PAGINA + 1);

  return aPaginaEntregas(filas.map((f) => aEntregaListada(f, true)));
}

function aEntregaListada(f: {
  id: string;
  recibidoEn: Date;
  codigoHttp: number;
  motivo: MotivoEntrega;
  fuenteNombre: string | null;
  sourceId: string | null;
  leadId: string | null;
  leadNombre: string | null;
  leadEmail: string | null;
  sobreId: string | null;
  errorSobre: string | null;
  reprocesadoEn: Date | null;
}, huerfana: boolean): EntregaListada {
  return {
    id: f.id,
    recibidoEn: new Date(f.recibidoEn),
    codigoHttp: f.codigoHttp,
    motivo: f.motivo,
    // Una entrega de un programa sin fuente es del webhook de Calendly (0039).
    fuenteNombre: f.fuenteNombre ?? (f.sourceId === null && !huerfana ? "Calendly" : null),
    leadId: f.leadId,
    // El nombre del lead, y si no tiene, el correo: la pantalla necesita una etiqueta
    // para el enlace. El id de la URL sigue siendo opaco (regla dura).
    leadNombre: f.leadNombre ?? f.leadEmail,
    sobreId: f.sobreId,
    errorSobre: f.errorSobre,
    // Reprocesable = tiene sobre, el sobre sigue con error y aun nadie lo reproceso.
    // Un sobre de Calendly (sin fuente) todavia no se reprocesa desde la pantalla.
    reprocesable:
      f.sourceId !== null &&
      MOTIVOS_CON_SOBRE.includes(f.motivo) &&
      f.errorSobre !== null &&
      f.reprocesadoEn === null,
  };
}
