import { createHash } from "node:crypto";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirDealVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  huellaDeAccionAbonos,
} from "@/lib/deals/estado-para-accion";
import { anularLinea, asignarLinea, editarValorDeLinea, quitarLinea } from "@/lib/deals/lineas";
import type { ActorDeMovimiento } from "@/lib/deals/mover-deal";
import { puedeTrabajarDeal } from "@/lib/deals/permiso";
import { dealLineas, deals, leads, skus } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados, vigente } from "@/lib/queries/vigente";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

/**
 * Acciones de líneas (SKUs) de un deal del MCP (ticket 386). Llaman las MISMAS funciones que la ficha
 * (`lib/deals/lineas.ts`): el valor vendido del deal, la cohorte, el rastro y la etapa tras anular se
 * recalculan allá. Quién puede es la regla de la ficha: el deal visible en el alcance de la sesión y
 * `puedeTrabajarDeal` (dueño o quien administra). La línea anulada no se edita ni se quita (`lineaVigente`).
 */

const MENSAJE_SIN_PERMISO = "Solo el dueño o quien administra puede editar los SKUs del deal.";

/** Lo mismo que `dealEditable` de la ficha, con el mismo orden de rejas: alcance, deal vigente, dueño o administrador. */
async function dealEditable(db: Db, actor: ActorDeMovimiento, dealId: string) {
  await exigirDealVisible(db, actor, dealId);
  const [deal] = await db.select().from(deals).where(and(eq(deals.id, dealId), vigente(deals)));
  if (!deal) throw new ErrorDeApp("No existe el deal vigente.", 404);
  if (!puedeTrabajarDeal(actor, deal)) throw new ErrorDeApp(MENSAJE_SIN_PERMISO, 403);
  const [lead] = await db.select({ nombre: leads.nombre, email: leads.emailNormalizado }).from(leads).where(eq(leads.id, deal.leadId));
  return { deal, etiqueta: lead?.nombre ?? lead?.email ?? deal.id };
}

async function lineasDelDeal(db: Db, dealId: string, bloquear = false) {
  const consulta = db.select({
    id: dealLineas.id,
    sku: skus.codigo,
    skuId: dealLineas.skuId,
    valorVendidoUsd: dealLineas.valorVendidoUsd,
    anuladaEn: dealLineas.anuladaEn,
  }).from(dealLineas)
    .innerJoin(skus, eq(skus.id, dealLineas.skuId))
    .where(and(eq(dealLineas.dealId, dealId), incluyendoAnulados(dealLineas)))
    .orderBy(asc(dealLineas.asignadaEn), asc(dealLineas.id));
  return bloquear ? await consulta.for("update", { of: dealLineas }) : await consulta;
}

async function estadoDeLineas(db: Db, dealId: string) {
  const [deal] = await db.select({ etapa: deals.etapa, valorVendidoUsd: deals.valorVendidoUsd })
    .from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  if (!deal) return null;
  const lineas = (await lineasDelDeal(db, dealId)).filter((linea) => linea.anuladaEn == null);
  return {
    etapa: deal.etapa,
    valor_vendido_usd: deal.valorVendidoUsd,
    lineas: lineas.map((linea) => ({ id: linea.id, sku: linea.sku, valor_vendido_usd: linea.valorVendidoUsd })),
  };
}

async function huellaDeLineas(db: Db, dealId: string, opciones?: { bloquear?: true }): Promise<string | null> {
  const base = await huellaDeAccionAbonos(db, dealId, opciones);
  if (!base) return null;
  const lineas = await lineasDelDeal(db, dealId, opciones?.bloquear === true);
  const estable = textoDeBitacora({ base, lineas });
  return createHash("sha256").update(estable ?? "null").digest("hex");
}

type Ejecucion = (db: Db, actor: ActorDeMovimiento, objetivo: ObjetivoAccionMcp) => Promise<unknown>;

/** Lo común de las cuatro: revisar es ensayar la ejecución real y comparar el estado de las líneas antes y después. */
function accionDeLinea<E extends z.ZodObject>(definicion: {
  clave: string;
  titulo: string;
  cuandoUsarla: string;
  argumentos: E;
  ejemplo: z.input<E>;
  objetivos: AccionMcp<E>["objetivos"];
  ejecutar: Ejecucion;
  irreversible?: boolean;
}): AccionMcp<E> {
  return {
    clave: definicion.clave,
    titulo: definicion.titulo,
    cuandoUsarla: definicion.cuandoUsarla,
    argumentos: definicion.argumentos,
    ejemplo: definicion.ejemplo,
    puede: (contexto) => puedeVerOperacion(contexto.rol),
    objetivos: definicion.objetivos,
    async revisar(db, actor, objetivo) {
      const [deal, antes] = await Promise.all([estadoParaAccionDeal(db, objetivo.id), estadoDeLineas(db, objetivo.id)]);
      const prueba = await ensayar(db, async (tx) => {
        await definicion.ejecutar(tx, actor, objetivo);
        return estadoDeLineas(tx, objetivo.id);
      });
      return {
        antes: deal && antes ? { ...antes, pendiente: deal.pendiente } : null,
        despues: prueba.ok ? prueba.resultado : null,
        sePuedeAplicar: prueba.ok,
        razon: prueba.ok ? null : prueba.razon,
        ...(definicion.irreversible ? { detalle: { aviso: "Una anulación no se puede deshacer." } } : {}),
      };
    },
    huella: (db, objetivo, opciones) => huellaDeLineas(db, objetivo.id, opciones),
    aplicar: (db, actor, objetivo) => definicion.ejecutar(db, actor, objetivo),
    seDeshace: false,
    efectoExterno: false,
  };
}

const dealId = z.string().uuid("Deal inválido.");
const lineaId = z.string().uuid("Línea inválida.");
const valor = z.number().nonnegative("El valor vendido no puede ser negativo.");
const EJEMPLO_DEAL = "00000000-0000-4000-8000-000000000000";
const EJEMPLO_LINEA = "00000000-0000-4000-8000-000000000001";

// ───────────────────────────────────────────── asignar

const argumentosAsignar = z.object({
  deal_id: dealId,
  sku_id: z.string().uuid("SKU inválido."),
  valor_vendido_usd: valor.optional(),
}).strict();

export const asignarSkuMcp = accionDeLinea({
  clave: "asignar_sku",
  titulo: "Asignar SKU a un deal",
  cuandoUsarla: "Cuando un deal debe llevar un SKU más. Sin valor vendido se usa el precio de lista del SKU. El SKU tiene que estar activo y ser del programa del deal.",
  argumentos: argumentosAsignar,
  ejemplo: { deal_id: EJEMPLO_DEAL, sku_id: EJEMPLO_LINEA, valor_vendido_usd: 797 },
  objetivos: (entrada) => [{ id: entrada.deal_id, skuId: entrada.sku_id, valor: entrada.valor_vendido_usd }],
  async ejecutar(db, actor, objetivo) {
    const { deal, etiqueta } = await dealEditable(db, actor, objetivo.id);
    return asignarLinea(db, {
      deal,
      skuId: objetivo.skuId as string,
      valorVendidoUsd: objetivo.valor as number | undefined,
      actorId: actor.userId,
      etiqueta,
      origen: "mcp",
    });
  },
});

// ───────────────────────────────────────────── editar valor

const argumentosEditarValor = z.object({
  deal_id: dealId,
  linea_id: lineaId,
  valor_vendido_usd: valor,
}).strict();

export const editarValorLineaMcp = accionDeLinea({
  clave: "editar_valor_linea",
  titulo: "Editar el valor vendido de una línea",
  cuandoUsarla: "Cuando el valor vendido de un SKU del deal se pactó distinto al precio de lista. No sirve con una línea anulada.",
  argumentos: argumentosEditarValor,
  ejemplo: { deal_id: EJEMPLO_DEAL, linea_id: EJEMPLO_LINEA, valor_vendido_usd: 697 },
  objetivos: (entrada) => [{ id: entrada.deal_id, lineaId: entrada.linea_id, valor: entrada.valor_vendido_usd }],
  async ejecutar(db, actor, objetivo) {
    const { deal, etiqueta } = await dealEditable(db, actor, objetivo.id);
    return editarValorDeLinea(db, {
      deal,
      lineaId: objetivo.lineaId as string,
      valorVendidoUsd: objetivo.valor as number,
      actorId: actor.userId,
      etiqueta,
      origen: "mcp",
    });
  },
});

// ───────────────────────────────────────────── quitar y anular

const argumentosLinea = z.object({ deal_id: dealId, linea_id: lineaId }).strict();

export const quitarLineaMcp = accionDeLinea({
  clave: "quitar_linea",
  titulo: "Quitar una línea sin abonos",
  cuandoUsarla: "Cuando un SKU se asignó por error a un deal y todavía no tiene abonos. Con abonos se usa anular_linea. Una anulación no se puede deshacer.",
  argumentos: argumentosLinea,
  ejemplo: { deal_id: EJEMPLO_DEAL, linea_id: EJEMPLO_LINEA },
  objetivos: (entrada) => [{ id: entrada.deal_id, lineaId: entrada.linea_id }],
  irreversible: true,
  async ejecutar(db, actor, objetivo) {
    const { deal, etiqueta } = await dealEditable(db, actor, objetivo.id);
    return quitarLinea(db, { deal, lineaId: objetivo.lineaId as string, actorId: actor.userId, etiqueta, origen: "mcp" });
  },
});

export const anularLineaMcp = accionDeLinea({
  clave: "anular_linea",
  titulo: "Anular una línea con abonos",
  cuandoUsarla: "Cuando la línea de un deal que ya tiene abonos debe dejar de contar. Recalcula el valor vendido y la etapa del deal. Una anulación no se puede deshacer.",
  argumentos: argumentosLinea,
  ejemplo: { deal_id: EJEMPLO_DEAL, linea_id: EJEMPLO_LINEA },
  objetivos: (entrada) => [{ id: entrada.deal_id, lineaId: entrada.linea_id }],
  irreversible: true,
  async ejecutar(db, actor, objetivo) {
    const { deal, etiqueta } = await dealEditable(db, actor, objetivo.id);
    return anularLinea(db, { deal, lineaId: objetivo.lineaId as string, actorId: actor.userId, etiqueta, origen: "mcp" });
  },
});
