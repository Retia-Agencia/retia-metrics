import { and, eq } from "drizzle-orm";
import { cohorts, leadContactos, leads, plataformasPago, productos, rarezasMigracion } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  abrirDealHistorico,
  duenoDesdeLaHoja,
  registrarAbonoHistorico,
  registrarLlamadaHistorica,
} from "@/lib/deals/historico";
import { normalizarTexto } from "@/lib/sheets/mapeo";
import { consolidar } from "./consolidar";
import type { Extraccion, RarezaTemplate, TipoRareza } from "./template";

/**
 * El IMPORTADOR de la migracion de las pestañas de gestion (ADR 0059 punto 4, ticket 078
 * paso 4): lee el template de UN programa y lo escribe por `lib/deals/historico.ts`. Nunca un
 * `insert` crudo sobre deals, llamadas o abonos (ADR 0029): el escritor da la frontera de
 * programa, el rastro y la idempotencia.
 *
 * - **Idempotente:** cada fila lleva su huella y la base rechaza la repetida, asi que correrlo
 *   dos veces devuelve `ya_migrado` y no escribe nada. Las rarezas tambien: unico
 *   `(huella, tipo)`.
 * - **No toca lo vivo** (punto 3): si el lead ya tiene un deal abierto, gana el vivo y la fila
 *   queda como rareza; sus abonos y llamadas no se cuelgan de el.
 * - **Cruza con la base, no adivina:** el lead por su correo (principal o contacto de correo
 *   confirmado) dentro del programa; la cohorte por su codigo; el producto solo si UN producto
 *   del programa tiene exactamente ese precio; la plataforma por nombre sin mayusculas ni
 *   espacios. Lo que no cruza es rareza, nunca un valor parecido.
 * - **El ensayo lo da quien llama:** el script corre esto dentro de una transaccion y la
 *   deshace. Los escritores abren savepoints, asi que un choque de huella no la tumba.
 */

export interface OpcionesImportacion {
  programId: string;
  /** `actorDelScript()`: quien corre la migracion. Va solo a `change_log`. */
  actorId: string;
  /**
   * `Mail onboarding = Si` → `onboarded_at` con la fecha de la venta. Apagado por defecto: es
   * la pregunta abierta 5 del 077 y la decide Mani.
   */
  onboardedDesdeMail?: boolean;
}

type Conteo = Record<string, number>;

export interface ReporteImportacion {
  deals: Conteo;
  abonos: Conteo;
  llamadas: Conteo;
  sinDeal: Conteo;
  /** Rarezas por tipo, contando las del extractor y las del cruce con la base. */
  rarezas: Conteo;
  /** Rarezas que se escribieron en esta corrida (0 en la segunda). */
  rarezasNuevas: number;
}

interface Enlaces {
  leadId?: string;
  dealId?: string;
  abonoId?: string;
  callId?: string;
}

export async function importarGestion(db: Db, extraccion: Extraccion, op: OpcionesImportacion): Promise<ReporteImportacion> {
  const t = consolidar(extraccion);
  const ctx = await cargarContexto(db, op.programId);
  const sumar = (c: Conteo, k: string) => (c[k] = (c[k] ?? 0) + 1);
  const reporte: ReporteImportacion = { deals: {}, abonos: {}, llamadas: {}, sinDeal: {}, rarezas: {}, rarezasNuevas: 0 };
  for (const s of t.sinDeal) sumar(reporte.sinDeal, s.razon);

  const rarezas: RarezaTemplate[] = [...t.rarezas];
  const marcar = (huella: string, tipo: TipoRareza, detalle: string) => rarezas.push({ huella, tipo, detalle });
  const enlaces = new Map<string, Enlaces>();
  const enlazar = (huella: string, e: Enlaces) => enlaces.set(huella, { ...enlaces.get(huella), ...e });

  // ── deals
  const dealPorHuella = new Map<string, { id: string; cohorte: string | null }>();
  const duenos = new Map<string, string | null>();
  for (const d of t.deals) {
    const leadId = ctx.leadDeCorreo.get(d.correo);
    if (!leadId) {
      marcar(d.huella, "lead_no_encontrado", "El correo no es un lead del programa en el CRM: no se crea un lead desde la gestión (ADR 0004).");
      sumar(reporte.deals, "lead_no_encontrado");
      continue;
    }
    enlazar(d.huella, { leadId });

    let cohortId: string | null = null;
    if (d.cohorte) {
      cohortId = ctx.cohortes.get(d.cohorte)?.id ?? null;
      if (!cohortId) marcar(d.huella, "sin_cohorte", `La cohorte ${d.cohorte} no existe en el programa: el deal entra sin cohorte.`);
    }
    let productoId: string | null = null;
    if (d.precio) {
      const candidatos = ctx.productosPorPrecio.get(Number(d.precio)) ?? [];
      if (candidatos.length === 1) productoId = candidatos[0];
      else {
        marcar(
          d.huella,
          "producto_no_encontrado",
          `${candidatos.length === 0 ? "Ningún" : "Más de un"} producto del programa cuesta USD ${d.precio}: el deal entra sin producto.`,
        );
      }
    }
    const closer = d.closer ?? "";
    if (!duenos.has(closer)) duenos.set(closer, await duenoDesdeLaHoja(db, op.programId, d.closer));

    const r = await abrirDealHistorico(db, {
      leadId,
      programId: op.programId,
      etapa: d.etapa,
      huella: d.huella,
      actorId: op.actorId,
      fechaEtapa: d.fechaEtapa ? new Date(d.fechaEtapa) : null,
      ownerUserId: duenos.get(closer) ?? null,
      productoId,
      cohortId,
      acuerdoPago: d.acuerdoPago,
      onboardedAt: op.onboardedDesdeMail && d.mailOnboarding && d.fechaEtapa ? new Date(d.fechaEtapa) : null,
      notas: d.notas.map((n) => ({ texto: n.texto, fecha: n.fecha ? new Date(n.fecha) : null })),
    });
    sumar(reporte.deals, r.estado);
    if (r.estado === "lead_con_deal_vivo") {
      marcar(d.huella, "ya_tiene_deal_vivo", "El lead ya tiene un deal abierto en el CRM: gana el vivo y no se le cuelga nada.");
      enlazar(d.huella, { dealId: r.dealVivoId });
      continue;
    }
    dealPorHuella.set(d.huella, { id: r.dealId, cohorte: d.cohorte });
    enlazar(d.huella, { dealId: r.dealId });
  }

  // ── abonos
  for (const a of t.abonos) {
    const deal = dealPorHuella.get(a.dealHuella);
    if (!deal) {
      // Su deal no entro (sin lead, gana el vivo, o la huella no casa tras corregir el
      // template): la plata de la hoja queda visible, nunca descartada en silencio.
      marcar(a.huella, "abono_sin_deal", `Abono de USD ${a.monto} sin deal migrado al que colgarse: no se registra.`);
      sumar(reporte.abonos, "sin_deal");
      continue;
    }
    const fecha = a.fecha ?? (deal.cohorte ? ctx.cohortes.get(deal.cohorte)?.cierreVentas : undefined) ?? null;
    if (!fecha) {
      marcar(a.huella, "sin_fecha", "El abono no tiene fecha y su cohorte tampoco: no se registra.");
      sumar(reporte.abonos, "sin_fecha");
      continue;
    }
    const plataformaId = a.plataforma ? (ctx.plataformas.get(clavePlataforma(a.plataforma)) ?? null) : null;
    const r = await registrarAbonoHistorico(db, {
      dealId: deal.id,
      huella: a.huella,
      actorId: op.actorId,
      fecha,
      monto: a.monto,
      plataformaId,
      closer: a.closer,
    });
    sumar(reporte.abonos, r.estado);
    enlazar(a.huella, { dealId: deal.id, abonoId: r.id });
    if (a.plataforma && !plataformaId) {
      marcar(a.huella, "plataforma_fuera_de_catalogo", `Plataforma "${a.plataforma}": no está en el catálogo (o viene combinada). El abono entra sin plataforma.`);
    }
  }

  // ── llamadas
  for (const l of t.llamadas) {
    const dealHuella = l.correo ? t.dealDeCorreo.get(l.correo) : undefined;
    const dealId = dealHuella ? dealPorHuella.get(dealHuella)?.id : undefined;
    const notas = [l.notas, l.link ? `Link: ${l.link}` : null].filter(Boolean).join("\n") || null;
    const r = await registrarLlamadaHistorica(db, {
      programId: op.programId,
      dealId: dealId ?? null,
      huella: l.huella,
      actorId: op.actorId,
      resultado: l.resultado,
      fechaLlamada: l.fecha ? new Date(l.fecha) : null,
      closer: l.closer,
      emailLead: l.correo,
      // `motivo_perdida` es el texto libre de las filas viejas de Sheets (ADR 0015).
      motivoPerdida: [l.categoria, l.subcategoria].filter(Boolean).join(" · ") || null,
      notas,
    });
    sumar(reporte.llamadas, dealId ? r.estado : `${r.estado}_suelta`);
    enlazar(l.huella, { dealId, callId: r.id });
    // Sin correo ya es rareza del extractor; con correo y sin deal migrado, es de aqui.
    if (!dealId && l.correo) {
      marcar(l.huella, "llamada_sin_deal", "La llamada no tiene un deal migrado de su correo al que colgarse: entra suelta.");
    }
  }

  // ── rarezas: visibles, con sus enlaces, y sin duplicarse en la segunda corrida
  for (const r of rarezas) sumar(reporte.rarezas, r.tipo);
  const filas = rarezas.map((r) => ({
    programId: op.programId,
    huella: r.huella,
    tipo: r.tipo,
    detalle: r.detalle,
    ...(enlaces.get(r.huella) ?? enlaces.get(r.huella.replace(/:fila-\d+$/, "")) ?? {}),
  }));
  for (let i = 0; i < filas.length; i += 200) {
    const escritas = await db
      .insert(rarezasMigracion)
      .values(filas.slice(i, i + 200))
      .onConflictDoNothing()
      .returning();
    reporte.rarezasNuevas += escritas.length;
  }

  return reporte;
}

/**
 * Clave → id, solo si la clave es de UNA plataforma: `Mercado Pago` y `MercadoPago` pueden
 * convivir en el catalogo (el indice es sobre `lower(nombre)`), y elegir una en silencio seria
 * adivinar. Una clave ambigua no cruza y el abono queda como rareza.
 */
function plataformasPorClave(filas: { id: string; nombre: string }[]): Map<string, string> {
  const ids = new Map<string, string[]>();
  for (const p of filas) ids.set(clavePlataforma(p.nombre), [...(ids.get(clavePlataforma(p.nombre)) ?? []), p.id]);
  return new Map([...ids].filter(([, v]) => v.length === 1).map(([k, v]) => [k, v[0]]));
}

/** `Mercado pago`, `MercadoPago` y `mercadopago` son la misma plataforma. */
function clavePlataforma(nombre: string): string {
  return normalizarTexto(nombre).replace(/\s+/g, "");
}

async function cargarContexto(db: Db, programId: string) {
  const [principales, contactos, cohortes, plataformas, prods] = await Promise.all([
    db.select({ id: leads.id, correo: leads.emailNormalizado }).from(leads).where(eq(leads.programId, programId)),
    db
      .select({ leadId: leadContactos.leadId, valor: leadContactos.valor })
      .from(leadContactos)
      .where(and(eq(leadContactos.programId, programId), eq(leadContactos.tipo, "correo"), eq(leadContactos.confirmado, true))),
    db
      .select({ id: cohorts.id, codigo: cohorts.codigo, cierreVentas: cohorts.fechaCierreVentas })
      .from(cohorts)
      .where(eq(cohorts.programId, programId)),
    db.select({ id: plataformasPago.id, nombre: plataformasPago.nombre }).from(plataformasPago),
    db
      .select({ id: productos.id, precio: productos.precioLista })
      .from(productos)
      // Solo USD: el precio de la hoja es USD y nunca se convierte en silencio (AGENTS.md).
      .where(and(eq(productos.programId, programId), eq(productos.moneda, "USD"))),
  ]);

  const leadDeCorreo = new Map<string, string>();
  for (const c of contactos) leadDeCorreo.set(c.valor.trim().toLowerCase(), c.leadId);
  // El correo principal manda sobre un contacto secundario.
  for (const l of principales) if (l.correo) leadDeCorreo.set(l.correo, l.id);

  const productosPorPrecio = new Map<number, string[]>();
  for (const p of prods) productosPorPrecio.set(Number(p.precio), [...(productosPorPrecio.get(Number(p.precio)) ?? []), p.id]);

  return {
    leadDeCorreo,
    cohortes: new Map(cohortes.map((c) => [c.codigo, { id: c.id, cierreVentas: c.cierreVentas }])),
    plataformas: plataformasPorClave(plataformas),
    productosPorPrecio,
  };
}
