import { z, ZodError } from "zod";
import { ACCIONES, accionPorClave, CLAVES_DE_ACCION } from "@/lib/mcp/acciones";
import { estadoParaAccionDeal, huellaDeAccionDeal } from "@/lib/deals/estado-para-accion";
import { eventosDeshacibles } from "@/lib/deshacer/deshacer";
import { ErrorDeApp } from "@/lib/errors";
import { MovimientoRechazado } from "@/lib/deals/mover-etapa";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { anotarFila, guardarVistaPrevia, leerVistaPreviaConfirmada, tomarVistaPrevia } from "@/lib/mcp/vistas-previas";
import type { ActorDeMovimiento } from "@/lib/deals/mover-deal";
import type { ContextoMcp, Herramienta } from "./tipos";
import { programaVisible } from "./programa";
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";

const claveAccion = z.enum(CLAVES_DE_ACCION);
const entradaPreparar = z.object({
  programa: z.string().min(1).max(100),
  accion: claveAccion,
  argumentos: z.record(z.string(), z.unknown()),
}).strict();
const entradaConfirmar = z.object({ id: z.string().uuid("Vista previa inválida.") }).strict();

const filaVista = z.object({
  objetivo_id: z.string().uuid().describe("Identificador opaco del deal revisado."),
  nombre: z.string().describe("Nombre de la persona del deal, o Sin nombre."),
  antes: z.record(z.string(), z.unknown()).nullable().describe("Estado relevante antes de la acción."),
  despues: z.record(z.string(), z.unknown()).nullable().describe("Estado esperado después de la acción."),
  se_puede_aplicar: z.boolean().describe("Si esta fila cumple hoy permisos y requisitos."),
  razon: z.string().nullable().describe("Motivo legible por el que la fila no se podrá aplicar."),
  efecto_externo: z.boolean().describe("Si la acción contactará un servicio fuera del CRM."),
  detalle: z.record(z.string(), z.unknown()).optional().describe("Requisitos y explicación adicional de la revisión."),
}).strict();
const salidaPreparar = z.object({
  id: z.string().uuid().describe("Identificador de uso único de la vista previa."),
  vence_en: z.string().datetime().describe("Instante hasta el que puede confirmarse la vista previa."),
  accion: z.string().describe("Clave estable de la acción revisada."),
  filas: z.array(filaVista).describe("Resultado de la revisión por deal."),
  como_confirmar: z.string().describe("Instrucción para confirmar después del sí explícito."),
  texto_para_la_persona: z.string().describe("Resumen legible que debe mostrarse antes de confirmar."),
}).strict();
const filaResultado = z.object({
  objetivo_id: z.string().uuid().describe("Identificador opaco del deal procesado."),
  estado: z.enum(["aplicada", "rechazada"]).describe("Resultado definitivo de esta fila."),
  razon: z.string().nullable().describe("Motivo legible del rechazo, cuando exista."),
  evento_id: z.string().uuid().nullable().describe("Evento con el que puede deshacerse la fila aplicada."),
}).strict();
const salidaConfirmar = z.object({
  id: z.string().uuid().describe("Identificador consumido de la vista previa."),
  filas: z.array(filaResultado).describe("Resultado independiente de cada fila del lote."),
  como_deshacer: z.string().nullable().describe("Instrucción para revertir las filas que lo permiten."),
}).strict();

function actorDe(contexto: ContextoMcp): ActorDeMovimiento {
  if (!contexto.rol) throw new ErrorDeApp("No tienes un rol válido para hacer cambios.", 403);
  return {
    tipo: "usuario",
    userId: contexto.session.user.id,
    rol: contexto.rol,
    operaComoCloser: contexto.session.user.operaComoCloser,
  };
}

function accionesPermitidas(contexto: ContextoMcp) {
  return ACCIONES.filter((accion) => accion.puede(contexto));
}

function errorDeArgumentos(error: ZodError, accion: (typeof ACCIONES)[number]): ErrorDeApp {
  const campo = error.issues[0]?.path.join(".") || "argumentos";
  const esperado = JSON.stringify(z.toJSONSchema(accion.argumentos, { io: "input", unrepresentable: "any" }));
  return new ErrorDeApp(`El campo ${campo} no es válido. Esquema esperado: ${esperado}`, 400);
}

function mensajeDeError(error: unknown): { mensaje: string; status: number } {
  if (error instanceof MovimientoRechazado || error instanceof ErrorDeApp) return { mensaje: error.message, status: error.status };
  throw error;
}

function etapaLegible(valor: unknown): string {
  return typeof valor === "string" ? nombreDeEtapa(valor) : "Sin etapa";
}

function textoDeFila(fila: { nombre: string; antes: Record<string, unknown> | null; despues: Record<string, unknown> | null }): string {
  return `${fila.nombre}: ${etapaLegible(fila.antes?.etapa)} → ${etapaLegible(fila.despues?.etapa)}`;
}

export const prepararAccionMcp: Herramienta<typeof entradaPreparar> = {
  nombre: "preparar_accion",
  titulo: "Preparar una acción",
  descripcion: "Úsala cuando una persona pida cambiar algo. Revisa permisos y requisitos, muestra el antes y el después y guarda una vista previa por diez minutos; no modifica datos del negocio.",
  entrada: entradaPreparar,
  salida: salidaPreparar,
  puede: (contexto) => contexto.escritura,
  soloLectura: true,
  async ejecutar(contexto, pedido) {
    const visible = await programaVisible(contexto, pedido.programa);
    const accion = accionPorClave(pedido.accion);
    if (!accion) throw new ErrorDeApp("No existe esa acción.", 404);
    const permitidas = accionesPermitidas(contexto);
    if (!accion.puede(contexto)) {
      throw new ErrorDeApp(`No puedes usar esa acción. Acciones disponibles: ${permitidas.map((a) => a.clave).join(", ") || "ninguna"}.`, 403);
    }
    const analisis = accion.argumentos.safeParse(pedido.argumentos);
    if (!analisis.success) throw errorDeArgumentos(analisis.error, accion as (typeof ACCIONES)[number]);
    const actor = actorDe(contexto);
    const objetivos = accion.objetivos(analisis.data);
    const filas = [];
    const huellas = [];
    for (const objetivo of objetivos) {
      const estado = await estadoParaAccionDeal(contexto.db, objetivo.id);
      if (!estado || estado.programId !== visible.id) {
        filas.push({ objetivo_id: objetivo.id, nombre: "Sin nombre", antes: null, despues: null, se_puede_aplicar: false, razon: "No existe ese deal", efecto_externo: accion.efectoExterno });
        huellas.push({ objetivo_id: objetivo.id, huella: null });
        continue;
      }
      try {
        const revision = await accion.revisar(contexto.db, actor, objetivo);
        filas.push({
          objetivo_id: objetivo.id,
          nombre: estado.nombreLead ?? "Sin nombre",
          antes: revision.antes,
          despues: revision.despues,
          se_puede_aplicar: revision.sePuedeAplicar,
          razon: revision.razon,
          efecto_externo: accion.efectoExterno,
          ...(revision.detalle ? { detalle: revision.detalle } : {}),
        });
      } catch (error) {
        const falla = mensajeDeError(error);
        filas.push({ objetivo_id: objetivo.id, nombre: estado.nombreLead ?? "Sin nombre", antes: { etapa: estado.etapa, pendiente: estado.pendiente }, despues: null, se_puede_aplicar: false, razon: falla.mensaje, efecto_externo: accion.efectoExterno });
      }
      huellas.push({ objetivo_id: objetivo.id, huella: await accion.huella(contexto.db, objetivo) });
    }
    const guardada = await guardarVistaPrevia(contexto.db, {
      tokenId: contexto.tokenId,
      userId: contexto.session.user.id,
      programId: visible.id,
      accion: accion.clave,
      argumentos: analisis.data,
      huellas,
      vistaPrevia: filas,
    });
    const texto = filas.map((fila) => `${textoDeFila(fila)}: ${fila.se_puede_aplicar ? "se puede aplicar" : `no se podrá aplicar: ${fila.razon}`}`).join("\n");
    const estructurado = {
      id: guardada.id,
      vence_en: guardada.venceEn.toISOString(),
      accion: accion.clave,
      filas,
      como_confirmar: "Confirma esta vista previa después del sí explícito de la persona.",
      texto_para_la_persona: texto,
    };
    return { texto: `${texto}\nLa vista previa vence en diez minutos. Confirma solo con el sí explícito de la persona.`, estructurado };
  },
};

type HuellaGuardada = { objetivo_id: string; huella: string | null };
type VistaGuardada = {
  objetivo_id: string;
  nombre: string;
  antes: Record<string, unknown> | null;
  despues: Record<string, unknown> | null;
  se_puede_aplicar: boolean;
  razon: string | null;
};

function respuestaDeConfirmacion(
  id: string,
  filas: z.output<typeof filaResultado>[],
  vistas: Map<string, VistaGuardada>,
) {
  const comoDeshacer = filas.some((fila) => fila.evento_id)
    ? "Para deshacer una fila aplicada, prepara la acción deshacer_evento con su deal_id y evento_id."
    : null;
  const estructurado = { id, filas, como_deshacer: comoDeshacer };
  const texto = filas.map((fila) => {
    const vista = vistas.get(fila.objetivo_id) ?? { nombre: "Sin nombre", antes: null, despues: null };
    return `${textoDeFila(vista)}: ${fila.estado}${fila.razon ? `: ${fila.razon}` : ""}${fila.evento_id ? "; se puede deshacer" : ""}`;
  }).join("\n");
  return { texto, estructurado };
}

export const confirmarCambioMcp: Herramienta<typeof entradaConfirmar> = {
  nombre: "confirmar_cambio",
  titulo: "Confirmar un cambio",
  descripcion: "Úsala cuando la persona ya dio su sí explícito a una vista previa vigente. Aplica cada fila una sola vez y explica cuáles se rechazaron y cómo deshacer las aplicadas.",
  entrada: entradaConfirmar,
  salida: salidaConfirmar,
  puede: (contexto) => contexto.escritura,
  soloLectura: false,
  destructiva: true,
  async ejecutar(contexto, pedido) {
    let guardada;
    let esReintento = false;
    try {
      guardada = await tomarVistaPrevia(contexto.db, { id: pedido.id, tokenId: contexto.tokenId });
    } catch (error) {
      if (!(error instanceof ErrorDeApp) || error.status !== 409) throw error;
      const confirmada = await leerVistaPreviaConfirmada(contexto.db, { id: pedido.id, tokenId: contexto.tokenId });
      if (!confirmada) throw error;
      guardada = confirmada;
      esReintento = true;
    }
    if (!await programaEnAlcance(contexto.session.user.id, contexto.rol, guardada.programId, contexto.db)) {
      throw new ErrorDeApp("No existe ese programa.", 404);
    }
    const accion = accionPorClave(guardada.accion);
    if (!accion || !accion.puede(contexto)) throw new ErrorDeApp("Ya no puedes usar esa acción.", 403);
    const argumentos = accion.argumentos.parse(guardada.argumentos);
    const objetivos = accion.objetivos(argumentos);
    const huellas = new Map((guardada.huellas as HuellaGuardada[]).map((fila) => [fila.objetivo_id, fila.huella]));
    const vistas = new Map((guardada.vistaPrevia as VistaGuardada[]).map((fila) => [fila.objetivo_id, fila]));
    const actor = actorDe(contexto);
    if (esReintento) {
      const resultados = Array.isArray(guardada.resultado) ? guardada.resultado : [];
      const guardados = new Map<string, z.output<typeof filaResultado>>();
      for (const resultado of resultados) {
        const valido = filaResultado.safeParse(resultado);
        if (valido.success) guardados.set(valido.data.objetivo_id, valido.data);
      }
      const filas = objetivos.map((objetivo) => guardados.get(objetivo.id) ?? {
        objetivo_id: objetivo.id,
        estado: "rechazada" as const,
        razon: "No se aplicó: prepárala de nuevo.",
        evento_id: null,
      });
      return respuestaDeConfirmacion(guardada.id, filas, vistas);
    }
    const filas: z.output<typeof filaResultado>[] = [];
    for (const objetivo of objetivos) {
      const vista = vistas.get(objetivo.id);
      if (!vista?.se_puede_aplicar) {
        const fila = { objetivo_id: objetivo.id, estado: "rechazada" as const, razon: vista?.razon ?? "La vista previa rechazó esta fila.", evento_id: null };
        await anotarFila(contexto.db, guardada.id, fila);
        filas.push(fila);
        continue;
      }
      try {
        const fila = await contexto.db.transaction(async (tx) => {
          const actual = await huellaDeAccionDeal(tx, objetivo.id, { bloquear: true });
          if (actual == null || actual !== huellas.get(objetivo.id)) {
            throw new ErrorDeApp("El deal cambió desde la vista previa.", 409);
          }
          const anteriores = new Set((await eventosDeshacibles(tx, actor, objetivo.id)).map((evento) => evento.id));
          await accion.aplicar(tx, actor, objetivo, { origen: "mcp" });
          const nuevo = accion.seDeshace
            ? (await eventosDeshacibles(tx, actor, objetivo.id)).find((evento) => (
              !anteriores.has(evento.id) && evento.puedeDeshacer && evento.tabla === "deal_etapa_historial"
            ))
            : null;
          const resultado = { objetivo_id: objetivo.id, estado: "aplicada" as const, razon: null, evento_id: nuevo?.id ?? null };
          await anotarFila(tx, guardada.id, resultado);
          return resultado;
        });
        filas.push(fila);
      } catch (error) {
        const falla = mensajeDeError(error);
        const fila = { objetivo_id: objetivo.id, estado: "rechazada" as const, razon: falla.mensaje, evento_id: null };
        await anotarFila(contexto.db, guardada.id, fila);
        filas.push(fila);
      }
    }
    return respuestaDeConfirmacion(guardada.id, filas, vistas);
  },
};
