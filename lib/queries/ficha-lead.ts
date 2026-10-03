import { and, asc, eq, inArray } from "drizzle-orm";
import { cohorts, deals, leadContactos, leads, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal, PendienteDeal } from "@/lib/deals/etapas";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { columnasUtmDelEnvio, utmsDelEnvio } from "@/lib/atribucion/utm-del-envio";

/**
 * La ficha del Lead (ticket 073): de una persona dentro de un programa, **todo lo que dijo y
 * cuando lo dijo**. Es el historial de la ficha del lead.
 *
 * - **El programa es frontera** (ADR 0043): recibe `programId` Y `leadId`; un lead de otro
 *   programa devuelve `null`, igual que uno inexistente, y la ruta responde 404 sin decir cual.
 * - **Los envios van en el orden en que ocurrieron, no por fecha** (ADR 0036): por
 *   `posicion_en_hoja`, porque los parciales de Typeform llevan una fecha placeholder. Lo que
 *   entro por webhook no tiene hoja y va despues, en el orden en que llego (`created_at`).
 * - **El diff entre envios distingue "no habia" de "vacio"**: una columna que el formulario no
 *   tenia cuando se lleno el envio viejo no es una respuesta en blanco. `respuestas` guarda el
 *   encabezado como llave, asi que una llave ausente es justo eso: la pregunta no existia.
 * - **Los deals cerrados y los anulados se ven** (ADR 0037, ADR 0026 punto 4), marcados. Es una
 *   ficha, no una metrica: `incluyendoAnulados(deals)`.
 * - Solo lectura. Lo que viene del formulario lo manda el formulario (ADR 0004).
 */

/** El valor de un campo en UN envio. "no_habia" = la pregunta no existia en ese envio. */
export type ValorDeCampo = { tipo: "no_habia" } | { tipo: "vacio" } | { tipo: "valor"; texto: string };

export interface CampoDelEnvio {
  /** La llave con la que se compara: el encabezado tal como llego, o el nombre del campo promovido. */
  campo: string;
  valor: ValorDeCampo;
}

export interface DiferenciaEntreEnvios {
  campo: string;
  antes: ValorDeCampo;
  despues: ValorDeCampo;
}

export interface EnvioDeLaFicha {
  id: string;
  /** 1 = el primero que hizo. Es el numero con el que la ficha lo nombra. */
  numero: number;
  esParcial: boolean;
  /**
   * Si este completo empezó como parcial: cuándo llegó ese parcial. El parcial y su completo son
   * el MISMO envío para quien mira (mismo token, ADR 0073); se guardan como dos filas hermanas
   * (ADR 0036 punto 4) y aquí se muestran como uno.
   */
  empezoComoParcial: Date | null;
  /** La fecha que trae el formulario (en un parcial puede ser aproximada) o, sin ella, cuando llego. */
  fecha: Date;
  fechaEsDeLlegada: boolean;
  /** De la hoja (traslado) o por webhook. */
  posicionEnHoja: number | null;
  calificacion: string | null;
  /** Todos los campos del envio, promovidos y crudos, en orden. */
  campos: CampoDelEnvio[];
  /** Lo que cambio respecto al envio anterior. `null` en el primero. */
  cambios: DiferenciaEntreEnvios[] | null;
}

export interface ContactoDeLaFicha {
  id: string;
  tipo: "correo" | "telefono";
  valor: string;
  esPrincipal: boolean;
  /** Falso = "unido por telefono" y nadie lo confirmo (ADR 0035 punto 4). */
  confirmado: boolean;
  /** El numero del envio con el que llego; `null` si se agrego a mano o el envio no es de este lead. */
  envioNumero: number | null;
  agregadoAMano: boolean;
  creadoEn: Date;
}

export interface DealDeLaFicha {
  id: string;
  etapa: EtapaDeal;
  pendiente: PendienteDeal | null;
  cerrado: boolean;
  ownerNombre: string | null;
  cohorteCodigo: string | null;
  /** El envio que lo abrio, por su numero en la ficha. */
  envioNumero: number | null;
  creadoEn: Date;
  anulado: { en: Date; motivo: string } | null;
}

export interface FichaDeLead {
  id: string;
  programId: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  empresa: string | null;
  cargo: string | null;
  ciudad: string | null;
  pais: string | null;
  entrada: "formulario" | "crm";
  leadQuality: string | null;
  leadValue: string | null;
  numAplicaciones: number;
  fechaPrimeraAplicacion: Date | null;
  fechaUltimaAplicacion: Date | null;
  creadoEn: Date;
  /** Algun contacto entro por un telefono conocido y nadie lo confirmo (ADR 0035). */
  unidoPorTelefono: boolean;
  /** Tiene envios y todos son parciales. */
  soloParciales: boolean;
  /** Del mas reciente al primero: la pantalla se lee de arriba hacia abajo. */
  envios: EnvioDeLaFicha[];
  contactos: ContactoDeLaFicha[];
  /** Abiertos primero; dentro de cada grupo, el mas reciente arriba. */
  deals: DealDeLaFicha[];
}

const ETAPAS_CERRADAS: readonly EtapaDeal[] = ["ganado_completo", "cierre_perdido"];

function legible(valor: unknown): ValorDeCampo {
  if (valor === null || valor === undefined) return { tipo: "vacio" };
  if (typeof valor === "string") return valor.trim() === "" ? { tipo: "vacio" } : { tipo: "valor", texto: valor };
  if (typeof valor === "number" || typeof valor === "boolean") return { tipo: "valor", texto: String(valor) };
  if (Array.isArray(valor)) {
    const partes = valor.map(legible).flatMap((v) => (v.tipo === "valor" ? [v.texto] : []));
    return partes.length > 0 ? { tipo: "valor", texto: partes.join(", ") } : { tipo: "vacio" };
  }
  return { tipo: "valor", texto: JSON.stringify(valor) };
}

/**
 * Lo que se lee de un envio: las columnas promovidas y las respuestas crudas. Los UTM entran con
 * la forma que pide `utmsDelEnvio` (que es quien los lee, ADR 0062), sin nombrarlos aqui.
 */
export type EnvioParaComparar = Parameters<typeof utmsDelEnvio>[0] & {
  nombre: string | null;
  calificacion: string | null;
  estadoHoja: string | null;
  leadQuality: string | null;
  leadValue: string | null;
};

/**
 * Los campos de UN envio, en orden: primero los promovidos (que siempre existen como columna,
 * asi que su ausencia es "vacio"), luego cada llave de `respuestas` tal como llego. Las llaves
 * `utm_*` de `respuestas` se omiten: los UTM ya salen arriba, leidos por `utmsDelEnvio`
 * (que es quien sabe leerlos, ADR 0062), y repetirlos haria un diff doble.
 */
export function camposDelEnvio(envio: EnvioParaComparar): CampoDelEnvio[] {
  const utm = utmsDelEnvio(envio);
  const promovidos: [string, string | null][] = [
    ["Nombre", envio.nombre],
    ["Estado de llegada", envio.calificacion],
    ["Estado en la hoja", envio.estadoHoja],
    ["Lead quality", envio.leadQuality],
    ["Lead value", envio.leadValue],
    ["UTM Source", utm.source],
    ["UTM Medium", utm.medium],
    ["UTM Campaign", utm.campaign],
    ["UTM Content", utm.content],
    ["UTM Term", utm.term],
    ["UTM ID", utm.id],
  ];
  const campos: CampoDelEnvio[] = promovidos.map(([campo, v]) => ({ campo, valor: legible(v) }));
  const r = envio.respuestas;
  if (r !== null && typeof r === "object" && !Array.isArray(r)) {
    for (const [llave, v] of Object.entries(r as Record<string, unknown>)) {
      if (llave.trim().toLowerCase().startsWith("utm_")) continue;
      campos.push({ campo: llave, valor: legible(v) });
    }
  }
  return campos;
}

function mismoValor(a: ValorDeCampo, b: ValorDeCampo): boolean {
  if (a.tipo === "valor" && b.tipo === "valor") return a.texto.trim() === b.texto.trim();
  // "No habia" contra "vacio" no es un cambio: ninguno de los dos dijo nada.
  return a.tipo !== "valor" && b.tipo !== "valor";
}

/**
 * Lo que cambio de un envio al siguiente. Una llave que el envio viejo no tenia sale como
 * "no habia" (la pregunta no existia), no como vacia; una que el nuevo ya no trae, al reves.
 * Pura: el orden de salida es el del envio nuevo, y despues lo que solo estaba en el viejo.
 */
export function diferenciasEntreEnvios(anterior: CampoDelEnvio[], actual: CampoDelEnvio[]): DiferenciaEntreEnvios[] {
  const NO_HABIA: ValorDeCampo = { tipo: "no_habia" };
  const viejo = new Map(anterior.map((c) => [c.campo, c.valor] as const));
  const nuevo = new Map(actual.map((c) => [c.campo, c.valor] as const));
  const salida: DiferenciaEntreEnvios[] = [];
  for (const { campo, valor } of actual) {
    const antes = viejo.get(campo) ?? NO_HABIA;
    if (!mismoValor(antes, valor)) salida.push({ campo, antes, despues: valor });
  }
  for (const { campo, valor } of anterior) {
    if (nuevo.has(campo)) continue;
    if (!mismoValor(valor, NO_HABIA)) salida.push({ campo, antes: valor, despues: NO_HABIA });
  }
  return salida;
}

/** El orden real de los envios (ADR 0036): hoja primero por posicion, luego lo que llego por webhook. */
export function ordenarEnvios<T extends { posicionEnHoja: number | null; createdAt: Date; id: string }>(envios: T[]): T[] {
  return [...envios].sort((a, b) => {
    if (a.posicionEnHoja !== null && b.posicionEnHoja !== null && a.posicionEnHoja !== b.posicionEnHoja) {
      return a.posicionEnHoja - b.posicionEnHoja;
    }
    if (a.posicionEnHoja !== null && b.posicionEnHoja === null) return -1;
    if (a.posicionEnHoja === null && b.posicionEnHoja !== null) return 1;
    const t = a.createdAt.getTime() - b.createdAt.getTime();
    return t !== 0 ? t : a.id.localeCompare(b.id);
  });
}

/** El envío para quien mira: misma fuente y mismo token (el parcial y su completo). */
const llaveDeToken = (e: { sourceId: string; token: string }) => `${e.sourceId}\u0000${e.token}`;

/**
 * Un envío por token: el completo absorbe a su parcial hermano (mismo `sourceId` y `token`), y el
 * parcial solo queda solo si nunca se completó (abandonó). Devuelve cada fila con la llegada del
 * parcial que absorbió, si hubo. Pura, para poder probarla sin base.
 */
export function unirParcialesConSuCompleto<
  T extends { sourceId: string; token: string; esParcial: boolean; fechaEnvio: Date | null; createdAt: Date },
>(envios: T[]): (T & { empezoComoParcial: Date | null })[] {
  const completos = new Set(envios.filter((e) => !e.esParcial).map(llaveDeToken));
  const parcialDe = new Map(envios.filter((e) => e.esParcial).map((e) => [llaveDeToken(e), e.fechaEnvio ?? e.createdAt] as const));
  return envios
    .filter((e) => !e.esParcial || !completos.has(llaveDeToken(e)))
    .map((e) => ({ ...e, empezoComoParcial: e.esParcial ? null : (parcialDe.get(llaveDeToken(e)) ?? null) }));
}

/** La ficha de un lead de ESTE programa, o `null` si no existe o es de otro. */
export async function fichaDeLead(db: Db, programId: string, leadId: string): Promise<FichaDeLead | null> {
  const [lead] = await db
    .select()
    .from(leads)
    .where(and(eq(leads.id, leadId), eq(leads.programId, programId)));
  if (!lead) return null;

  // Cada cosa aparte y unida en memoria (AGENTS.md: nada de subconsultas correlacionadas).
  const enviosFilas = await db
    .select({
      id: submissions.id,
      sourceId: submissions.sourceId,
      token: submissions.token,
      esParcial: submissions.esParcial,
      fechaEnvio: submissions.fechaEnvio,
      createdAt: submissions.createdAt,
      posicionEnHoja: submissions.posicionEnHoja,
      nombre: submissions.nombre,
      calificacion: submissions.calificacion,
      estadoHoja: submissions.estadoHoja,
      leadQuality: submissions.leadQuality,
      leadValue: submissions.leadValue,
      ...columnasUtmDelEnvio,
    })
    .from(submissions)
    .where(eq(submissions.leadId, lead.id));
  const contactosFilas = await db
    .select()
    .from(leadContactos)
    .where(and(eq(leadContactos.leadId, lead.id), eq(leadContactos.programId, programId)))
    .orderBy(asc(leadContactos.createdAt));
  const dealsFilas = await db
    .select()
    .from(deals)
    .where(and(eq(deals.leadId, lead.id), eq(deals.programId, programId), incluyendoAnulados(deals)));

  const idsDeOwners = [...new Set(dealsFilas.map((d) => d.ownerUserId).filter((x): x is string => x !== null))];
  const owners =
    idsDeOwners.length > 0
      ? await db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(inArray(users.id, idsDeOwners))
      : [];
  const idsDeCohortes = [...new Set(dealsFilas.map((d) => d.cohortId).filter((x): x is string => x !== null))];
  const cohortes =
    idsDeCohortes.length > 0
      ? await db.select({ id: cohorts.id, codigo: cohorts.codigo }).from(cohorts).where(inArray(cohorts.id, idsDeCohortes))
      : [];

  const ordenados = ordenarEnvios(unirParcialesConSuCompleto(enviosFilas));
  const numeroDe = new Map(ordenados.map((e, i) => [e.id, i + 1] as const));
  // Un parcial absorbido por su completo lleva el número de ese completo: un contacto o un deal
  // que nació del parcial nació del MISMO envío.
  const numeroPorToken = new Map(ordenados.map((e) => [llaveDeToken(e), numeroDe.get(e.id)!] as const));
  for (const e of enviosFilas) {
    if (!numeroDe.has(e.id)) numeroDe.set(e.id, numeroPorToken.get(llaveDeToken(e))!);
  }
  let previos: CampoDelEnvio[] | null = null;
  const envios: EnvioDeLaFicha[] = [];
  for (const [i, e] of ordenados.entries()) {
    const campos = camposDelEnvio(e);
    envios.push({
      id: e.id,
      numero: i + 1,
      esParcial: e.esParcial,
      empezoComoParcial: e.empezoComoParcial,
      fecha: e.fechaEnvio ?? e.createdAt,
      fechaEsDeLlegada: e.fechaEnvio === null,
      posicionEnHoja: e.posicionEnHoja,
      calificacion: e.calificacion,
      campos,
      cambios: previos === null ? null : diferenciasEntreEnvios(previos, campos),
    });
    previos = campos;
  }

  const dealsDeLaFicha: DealDeLaFicha[] = dealsFilas
    .map((d) => {
      const owner = owners.find((o) => o.id === d.ownerUserId);
      return {
        id: d.id,
        etapa: d.etapa,
        pendiente: d.pendiente,
        cerrado: ETAPAS_CERRADAS.includes(d.etapa),
        ownerNombre: owner ? (owner.nombre ?? owner.email) : null,
        cohorteCodigo: cohortes.find((c) => c.id === d.cohortId)?.codigo ?? null,
        envioNumero: d.submissionOrigenId ? (numeroDe.get(d.submissionOrigenId) ?? null) : null,
        creadoEn: d.createdAt,
        anulado: d.anuladoEn ? { en: d.anuladoEn, motivo: d.motivoAnulacion ?? "" } : null,
      };
    })
    // Abiertos y vigentes arriba; cerrados despues; anulados al final. El mas reciente primero.
    .sort((a, b) => {
      const peso = (x: DealDeLaFicha) => (x.anulado ? 2 : x.cerrado ? 1 : 0);
      return peso(a) - peso(b) || b.creadoEn.getTime() - a.creadoEn.getTime();
    });

  const contactos: ContactoDeLaFicha[] = contactosFilas
    .map((c) => ({
      id: c.id,
      tipo: c.tipo,
      valor: c.valor,
      esPrincipal: c.esPrincipal,
      confirmado: c.confirmado,
      envioNumero: c.submissionId ? (numeroDe.get(c.submissionId) ?? null) : null,
      agregadoAMano: c.submissionId === null,
      creadoEn: c.createdAt,
    }))
    .sort((a, b) => Number(b.esPrincipal) - Number(a.esPrincipal) || a.creadoEn.getTime() - b.creadoEn.getTime());

  return {
    id: lead.id,
    programId: lead.programId,
    nombre: lead.nombre,
    email: lead.emailNormalizado,
    telefono: lead.telefono,
    empresa: lead.empresa,
    cargo: lead.cargo,
    ciudad: lead.ciudad,
    pais: lead.pais,
    entrada: lead.entrada,
    leadQuality: lead.leadQuality,
    leadValue: lead.leadValue,
    numAplicaciones: lead.numAplicaciones,
    fechaPrimeraAplicacion: lead.fechaPrimeraAplicacion,
    fechaUltimaAplicacion: lead.fechaUltimaAplicacion,
    creadoEn: lead.createdAt,
    unidoPorTelefono: contactos.some((c) => !c.confirmado),
    soloParciales: envios.length > 0 && envios.every((e) => e.esParcial),
    envios: envios.reverse(),
    contactos,
    deals: dealsDeLaFicha,
  };
}
