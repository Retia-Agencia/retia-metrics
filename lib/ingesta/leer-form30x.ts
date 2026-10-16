import { and, eq, isNotNull, like } from "drizzle-orm";
import { sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerRespuestas } from "@/lib/form30x/api";
import { guardarSobre, marcarSobreConError, type DuenoDelSobre } from "./caja-negra";
import { procesarSobre, type FuenteParaProcesar } from "./procesar-sobre";

type PaginaForm30x = Awaited<ReturnType<typeof leerRespuestas>>;
type RespuestaForm30x = PaginaForm30x["data"][number];

export interface ResumenLecturaForm30x {
  fuentes: number;
  leidas: number;
  nuevas: number;
  saltadas: number;
  conError: number;
  fuentesConError: number;
}

/** Traduce la respuesta de la API al mismo cuerpo que entrega el webhook (ADR 0093). */
export function cuerpoDeWebhookDesdeRespuesta(respuesta: RespuestaForm30x, formId: string): string {
  return JSON.stringify({
    event: respuesta.completed ? "response.completed" : "response.partial",
    formId,
    formTitle: "",
    responseId: respuesta.id,
    submittedAt: respuesta.submittedAt,
    answers: respuesta.answers,
    hidden: respuesta.metadata.hidden ?? {},
    score: respuesta.metadata.score,
    tags: respuesta.metadata.tags ?? [],
    variables: respuesta.metadata.variables,
  });
}

function parcialTieneCorreo(respuesta: RespuestaForm30x): boolean {
  return respuesta.answers.some((answer) => {
    const type = answer.type;
    const value = answer.value;
    return type === "email" && typeof value === "string" && value.trim() !== "";
  });
}

async function yaExiste(db: Db, sourceId: string, respuesta: RespuestaForm30x): Promise<boolean> {
  const [fila] = await db
    .select({ id: submissions.id })
    .from(submissions)
    .where(
      and(
        eq(submissions.sourceId, sourceId),
        eq(submissions.token, respuesta.id),
        eq(submissions.esParcial, !respuesta.completed),
      ),
    )
    .limit(1);
  return fila !== undefined;
}

/**
 * Una respuesta que ya dejo un sobre de esta lectura y fallo (una entrega de prueba, un
 * mapeo roto) no se vuelve a escribir en cada corrida: su sobre con error ya esta a la vista
 * en Webhook Health y se reprocesa desde ahi. Sin esto, cada media hora sumaria un sobre
 * igual mientras la respuesta siga en la ventana. El cuerpo lo escribe
 * `cuerpoDeWebhookDesdeRespuesta` con `JSON.stringify`, asi que el texto es compacto.
 */
async function yaTieneSobre(db: Db, sourceId: string, respuesta: RespuestaForm30x): Promise<boolean> {
  const evento = respuesta.completed ? "response.completed" : "response.partial";
  const [fila] = await db
    .select({ id: sobresCrudos.id })
    .from(sobresCrudos)
    .where(
      and(
        eq(sobresCrudos.sourceId, sourceId),
        eq(sobresCrudos.origen, "form30x_api"),
        like(sobresCrudos.cuerpo, `%"event":"${evento}"%`),
        like(sobresCrudos.cuerpo, `%"responseId":${JSON.stringify(respuesta.id)}%`),
      ),
    )
    .limit(1);
  return fila !== undefined;
}

/** Lee las respuestas recientes de cada fuente Form30x activa (ADR 0093, ticket 272). */
export async function leerForm30x(
  db: Db,
  opciones: { leer?: typeof leerRespuestas; ahora?: Date } = {},
): Promise<ResumenLecturaForm30x> {
  const leer = opciones.leer ?? leerRespuestas;
  const limite = (opciones.ahora ?? new Date()).getTime() - 48 * 60 * 60 * 1000;
  const fuentes = await db
    .select({
      id: sources.id,
      programId: sources.programId,
      proveedor: sources.proveedor,
      tzFechas: sources.tzFechas,
      mapeoColumnas: sources.mapeoColumnas,
      formId: sources.form30xFormId,
    })
    .from(sources)
    .where(
      and(
        eq(sources.proveedor, "form30x"),
        eq(sources.activo, true),
        isNotNull(sources.form30xFormId),
      ),
    );
  const resumen: ResumenLecturaForm30x = {
    fuentes: fuentes.length,
    leidas: 0,
    nuevas: 0,
    saltadas: 0,
    conError: 0,
    fuentesConError: 0,
  };

  for (const fuente of fuentes) {
    const formId = fuente.formId;
    if (formId === null) continue;
    try {
      let cursor: string | undefined;
      let termino = false;
      do {
        const pagina = await leer(formId, cursor);
        for (const respuesta of pagina.data) {
          if (new Date(respuesta.submittedAt).getTime() < limite) {
            termino = true;
            break;
          }
          resumen.leidas += 1;
          if (
            (await yaExiste(db, fuente.id, respuesta)) ||
            (await yaTieneSobre(db, fuente.id, respuesta)) ||
            (!respuesta.completed && !parcialTieneCorreo(respuesta))
          ) {
            resumen.saltadas += 1;
            continue;
          }

          const cuerpo = cuerpoDeWebhookDesdeRespuesta(respuesta, formId);
          const dueno: DuenoDelSobre = {
            canal: "form30x_api",
            sourceId: fuente.id,
            programId: fuente.programId,
          };
          const sobreId = await guardarSobre(db, dueno, cuerpo);
          const resultado = await procesarSobre(db, fuente as FuenteParaProcesar, cuerpo);
          if (resultado.error === null) {
            resumen.nuevas += 1;
          } else {
            resumen.conError += 1;
            await marcarSobreConError(db, sobreId, dueno, cuerpo, resultado.error);
          }
        }
        cursor = pagina.nextCursor ?? undefined;
        if (pagina.nextCursor === null) termino = true;
      } while (!termino);
    } catch (error) {
      console.error(`lectura Form30x: fallo la fuente ${fuente.id}`, error);
      resumen.fuentesConError += 1;
    }
  }

  return resumen;
}
