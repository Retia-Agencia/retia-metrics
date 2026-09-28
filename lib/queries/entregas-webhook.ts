import { and, desc, eq, inArray, isNull, lt, sql } from "drizzle-orm";
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
const LIMITE_ENTREGAS = 200;

/**
 * Las entregas de UN programa, la mas reciente arriba (el programa es frontera: nunca
 * se cruzan dos programas, ADR 0043). El error del sobre y si se puede reprocesar salen
 * de `sobres_crudos`. El nombre del lead sale de `leads` (para el enlace a su ficha; el
 * id que va a la URL es opaco, nunca el correo).
 */
export async function entregasDePrograma(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<EntregaListada[]> {
  const filas = await db
    .select({
      id: entregasWebhook.id,
      recibidoEn: entregasWebhook.recibidoEn,
      codigoHttp: entregasWebhook.codigoHttp,
      motivo: entregasWebhook.motivo,
      fuenteNombre: sources.nombre,
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
    .where(eq(entregasWebhook.programId, programId))
    .orderBy(desc(entregasWebhook.recibidoEn))
    .limit(LIMITE_ENTREGAS);

  return filas.map((f) => aEntregaListada(f));
}

/**
 * Las entregas HUERFANAS: las que no resolvieron una fuente (`source_id` nulo), asi
 * que no son de ningun programa. Son los 404 por id inexistente o mal formado. Se
 * muestran aparte porque no caben en la vista por programa.
 */
export async function entregasHuerfanas(db: Db = dbDeLaApp): Promise<EntregaListada[]> {
  const filas = await db
    .select({
      id: entregasWebhook.id,
      recibidoEn: entregasWebhook.recibidoEn,
      codigoHttp: entregasWebhook.codigoHttp,
      motivo: entregasWebhook.motivo,
      fuenteNombre: sql<string | null>`null`,
      leadId: entregasWebhook.leadId,
      leadNombre: sql<string | null>`null`,
      leadEmail: sql<string | null>`null`,
      sobreId: entregasWebhook.sobreId,
      errorSobre: sql<string | null>`null`,
      reprocesadoEn: sql<Date | null>`null`,
    })
    .from(entregasWebhook)
    .where(isNull(entregasWebhook.sourceId))
    .orderBy(desc(entregasWebhook.recibidoEn))
    .limit(LIMITE_ENTREGAS);

  return filas.map((f) => aEntregaListada(f));
}

function aEntregaListada(f: {
  id: string;
  recibidoEn: Date;
  codigoHttp: number;
  motivo: MotivoEntrega;
  fuenteNombre: string | null;
  leadId: string | null;
  leadNombre: string | null;
  leadEmail: string | null;
  sobreId: string | null;
  errorSobre: string | null;
  reprocesadoEn: Date | null;
}): EntregaListada {
  return {
    id: f.id,
    recibidoEn: new Date(f.recibidoEn),
    codigoHttp: f.codigoHttp,
    motivo: f.motivo,
    fuenteNombre: f.fuenteNombre,
    leadId: f.leadId,
    // El nombre del lead, y si no tiene, el correo: la pantalla necesita una etiqueta
    // para el enlace. El id de la URL sigue siendo opaco (regla dura).
    leadNombre: f.leadNombre ?? f.leadEmail,
    sobreId: f.sobreId,
    errorSobre: f.errorSobre,
    // Reprocesable = tiene sobre, el sobre sigue con error y aun nadie lo reproceso.
    reprocesable:
      MOTIVOS_CON_SOBRE.includes(f.motivo) && f.errorSobre !== null && f.reprocesadoEn === null,
  };
}
