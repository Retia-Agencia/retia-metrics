import { eq, inArray } from "drizzle-orm";
import { existsSync, readFileSync } from "node:fs";
import { parse } from "dotenv";
import { db } from "../lib/db";
import { deals, etapaDealEnum, leads, programs, submissions, users } from "../lib/db/schema";
import type { PendienteDeal } from "../lib/deals/etapas";
import { actorDelScript } from "./actor";
import { LOCAL_DB_URL, validarUrlLocal } from "./db-local-url";
import {
  crearPrograma,
  editarPlantillaLead,
  editarPrograma,
  guardarTokenCalendly,
  reactivarPrograma,
} from "../lib/catalogo/programas";
import { PLANTILLA_LEAD_BASE } from "./plantilla-lead-base";
import { crearCohorte } from "../lib/catalogo/cohortes";
import { activarFuente, crearFuente, rotarSecretoDeFuente } from "../lib/catalogo/fuentes";
import { crearUsuario } from "../lib/catalogo/usuarios";
import { motivos } from "../lib/catalogo/motivos";
import { areas } from "../lib/catalogo/areas";
import { canales } from "../lib/catalogo/canales";
import { ingerirEntradas } from "../lib/ingesta/ingerir";
import type { EntradaEnvio } from "../lib/ingesta/envio";
import { abrirDeal, moverEtapa } from "../lib/deals/mover-etapa";
import { registrarActividad } from "../lib/deals/actividades";
import { agregarLlamada, marcarFallida, pegarGrain } from "../lib/deals/llamadas";
import {
  abrirDealesHistoricos,
  registrarAbonosHistoricos,
  registrarLlamadasHistoricas,
  type AbonoHistorico,
  type AltaHistorica,
  type LlamadaHistorica,
} from "../lib/deals/historico";
import { anularAbono, registrarAbono } from "../lib/deals/abonos";
import { anularDeal } from "../lib/deals/anular-deal";
import { registrarLlamadaDeCalendly } from "../lib/calendly/colgar-llamada";
import { ORIGEN_DE_SUELTA_ASIGNABLE } from "../lib/calendly/suelta";
import { marcarOnboarded } from "../lib/deals/estudiante";
import { vigente } from "../lib/queries/vigente";

/**
 * Un PAT de Calendly para la base local (ticket 096), del entorno o de `.env.local`. De ese
 * archivo se lee SOLO esta llave, nunca el archivo entero: ahi esta el `DATABASE_URL` de
 * produccion, y este seed no debe verlo.
 */
function patLocal(nombre: string): string | undefined {
  const delEntorno = process.env[nombre]?.trim();
  if (delEntorno) return delEntorno;
  if (!existsSync(".env.local")) return undefined;
  const valor = parse(readFileSync(".env.local"))[nombre]?.trim();
  return valor ? valor : undefined;
}

/**
 * Semilla de datos de prueba para desarrollo local (Ticket 113).
 *
 * Características:
 *  - Trabaja sobre la base local de Docker (127.0.0.1:54329).
 *  - Posee guardia estricta contra producción.
 *  - Pasa 100% por las funciones de `lib/`:
 *      * Catálogo: `lib/catalogo/` (programas, cohortes, fuentes, usuarios, motivos, áreas).
 *      * Leads: `ingerirEntradas` de `lib/ingesta/`.
 *      * Etapas: `abrirDeal` y `moverEtapa` de `lib/deals/`.
 *      * Llamadas: `agregarLlamada`, `pegarGrain`, `marcarFallida` de `lib/deals/llamadas`.
 *      * Abonos: `registrarAbono`, que congela el valor vendido y deja su `change_log`.
 *  - Idempotencia: comprueba si la base ya tiene datos antes de sembrar; no duplica.
 *  - Cero datos reales de producción (todos ficticios con dominio `.local`).
 */

const CAMPOS_MAPEO = {
  token: "Token",
  correo: "Correo",
  telefono: "WhatsApp",
  nombre: "Nombre completo",
  fechaEnvio: "Submitted At",
  estadoHoja: "Estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
  utmContent: "utm_content",
  utmTerm: "utm_term",
  utmId: "utm_id",
} as const;

function entradaDePrueba(
  fuenteId: string,
  o: {
    token: string;
    correo: string;
    nombre: string;
    telefono: string;
    estado: string;
    fecha?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    utmTerm?: string;
    utmId?: string;
    sinUtm?: boolean;
    esParcial?: boolean;
  },
): EntradaEnvio {
  const vacio = o.sinUtm ? "" : undefined;
  return {
    sourceId: fuenteId,
    zona: "America/Bogota",
    posicion: null,
    columnas: {
      Token: o.token,
      Correo: o.correo,
      WhatsApp: o.telefono,
      "Nombre completo": o.nombre,
      "Submitted At": o.fecha ?? "2026-09-20T10:00:00-05:00",
      Estado: o.estado,
      utm_source: vacio ?? o.utmSource ?? "meta",
      utm_medium: vacio ?? o.utmMedium ?? "cpc",
      utm_campaign: vacio ?? o.utmCampaign ?? "campana_lanzamiento",
      utm_content: vacio ?? o.utmContent ?? "",
      utm_term: vacio ?? o.utmTerm ?? "",
      utm_id: vacio ?? o.utmId ?? "",
    },
    campos: { ...CAMPOS_MAPEO },
    esParcial: o.esParcial,
  };
}

type EtapaVolumen = (typeof etapaDealEnum.enumValues)[number];

interface ProgramaVolumen {
  id: string;
  nombre: string;
  slug: string;
  ticketUsd: string;
  formUrl: string;
  fuenteId: string;
  cohorteId: string;
  totalLeads: number;
  comisionPorcentaje: string;
  prefijo: "p1" | "p2";
  distribucion: readonly { etapa: EtapaVolumen; pendiente?: PendienteDeal; cantidad: number }[];
}

interface LeadDeVolumen {
  correo: string;
  fecha: string;
  entrada: EntradaEnvio;
}

interface DealDeVolumen {
  id: string;
  etapa: EtapaVolumen;
  pendiente: PendienteDeal | null;
  fechaEtapa: string;
  fechaLlamada: string;
  fechaAbono: string;
  correo: string;
  ownerUserId: string;
  closerId: string;
}

const DIAS_HABILES_SEPTIEMBRE = [
  "2026-09-01", "2026-09-02", "2026-09-03", "2026-09-04", "2026-09-07",
  "2026-09-08", "2026-09-09", "2026-09-10", "2026-09-11", "2026-09-14",
  "2026-09-15", "2026-09-16", "2026-09-17", "2026-09-18", "2026-09-21",
  "2026-09-22", "2026-09-23", "2026-09-24", "2026-09-25", "2026-09-28",
  "2026-09-29", "2026-09-30",
] as const;

function mulberry32(semilla: number): () => number {
  let estado = semilla;
  return () => {
    estado += 0x6d2b79f5;
    let n = estado;
    n = Math.imul(n ^ (n >>> 15), n | 1);
    n ^= n + Math.imul(n ^ (n >>> 7), n | 61);
    return ((n ^ (n >>> 14)) >>> 0) / 4294967296;
  };
}

function mezclar<T>(valores: readonly T[], azar: () => number): T[] {
  const copia = [...valores];
  for (let i = copia.length - 1; i > 0; i -= 1) {
    const j = Math.floor(azar() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

function repetir<T>(valor: T, veces: number): T[] {
  return Array.from({ length: veces }, () => valor);
}

function instanteDeBogota(fecha: string, hora: number): Date {
  return new Date(`${fecha}T${String(hora).padStart(2, "0")}:00:00-05:00`);
}

function categoriasUtm(total: number, azar: () => number): string[] {
  const cantidades = total === 150
    ? { meta: 83, macro: 5, closer: 15, directo: 18, sinClasificar: 7, sinUtm: 22 }
    : { meta: 66, macro: 4, closer: 12, directo: 14, sinClasificar: 6, sinUtm: 18 };
  return mezclar([
    ...repetir("meta", cantidades.meta),
    ...repetir("macro", cantidades.macro),
    ...repetir("closer", cantidades.closer),
    ...repetir("directo", cantidades.directo),
    ...repetir("sin_clasificar", cantidades.sinClasificar),
    ...repetir("sin_utm", cantidades.sinUtm),
  ], azar);
}

function etapasDeVolumen(
  distribucion: ProgramaVolumen["distribucion"],
  azar: () => number,
): { etapa: EtapaVolumen; pendiente: PendienteDeal | null }[] {
  return mezclar(
    distribucion.flatMap(({ etapa, pendiente, cantidad }) => repetir({ etapa, pendiente: pendiente ?? null }, cantidad)),
    azar,
  );
}

function crearLeadsDeVolumen(
  programa: ProgramaVolumen,
  azar: () => number,
): LeadDeVolumen[] {
  const categorias = categoriasUtm(programa.totalLeads, azar);
  const campanas = ["CA Lanzamiento Septiembre", "CA Evergreen", "CA Testimonios"];
  const anuncios = ["Video caso real", "Carrusel beneficios", "Reel objeciones"];
  const placements = ["instagram_reels", "facebook_feed", "instagram_stories"];
  const codigosCloser = ["ref-7f3a-carlos", "ref-91bd-maria"];

  return categorias.map((categoria, indice) => {
    const numero = indice + 1;
    const totalDeals = programa.distribucion.reduce((total, fila) => total + fila.cantidad, 0);
    const diasDisponibles = indice < totalDeals ? 19 : DIAS_HABILES_SEPTIEMBRE.length;
    const fecha = DIAS_HABILES_SEPTIEMBRE[Math.floor(azar() * diasDisponibles)];
    const correo = `persona-${programa.prefijo}-${String(numero).padStart(3, "0")}@ejemplo.local`;
    const base = {
      token: `tok-vol-${programa.prefijo}-${numero}`,
      correo,
      nombre: `Persona ${programa.prefijo.toUpperCase()} ${String(numero).padStart(3, "0")}`,
      telefono: `+57300${programa.prefijo === "p1" ? "1" : "2"}${String(numero).padStart(6, "0")}`,
      fecha: `${fecha}T${String(8 + Math.floor(azar() * 10)).padStart(2, "0")}:00:00-05:00`,
      estado: (() => {
        const valor = azar();
        if (valor < 0.42) return "setteo_no_calificado";
        if (valor < 0.77) return "con_calendly";
        if (valor < 0.97) return "descartado";
        return "estado_local_desconocido";
      })(),
    };
    const variante = numero % 3;
    let utm: Parameters<typeof entradaDePrueba>[1] = base;
    if (categoria === "meta" || categoria === "macro") {
      utm = {
        ...base,
        utmSource: numero % 2 === 0 ? "facebook" : "instagram",
        utmMedium: "paid_social",
        utmCampaign: categoria === "macro" ? "{{campaign.name}}" : campanas[variante],
        utmContent: anuncios[variante],
        utmTerm: placements[variante],
        utmId: String(900000000000 + (programa.prefijo === "p1" ? 1000 : 2000) + numero),
      };
    } else if (categoria === "closer") {
      utm = { ...base, utmSource: "closer", utmMedium: "referido", utmCampaign: "referidos_septiembre", utmContent: codigosCloser[numero % 2] };
    } else if (categoria === "directo") {
      utm = { ...base, utmSource: "direct", utmMedium: "organic", utmCampaign: "contenido_septiembre" };
    } else if (categoria === "sin_clasificar") {
      utm = { ...base, utmSource: "google", utmMedium: "cpc", utmCampaign: "busqueda_sin_catalogar" };
    } else {
      utm = { ...base, sinUtm: true };
    }
    return { correo, fecha, entrada: entradaDePrueba(programa.fuenteId, utm) };
  });
}

async function sembrarVolumen(
  actorId: string,
  programasDeVolumen: readonly ProgramaVolumen[],
  closersPorPrograma: ReadonlyMap<
    string,
    { closers: readonly { id: string; closerId: string | null }[]; closerConMuestras?: { id: string; closerId: string | null } }
  >,
  motivosPerdidaIds: readonly string[],
): Promise<void> {
  console.log("[seed:local] Sembrando volumen determinista para el dashboard...");
  const azar = mulberry32(0x5eed2026);

  for (const programa of programasDeVolumen) {
    await editarPrograma(db, actorId, programa.id, {
      nombre: programa.nombre,
      slug: programa.slug,
      ticketUsd: programa.ticketUsd,
      formUrl: programa.formUrl,
      comisionPorcentaje: programa.comisionPorcentaje,
    });
  }

  const leadsPorPrograma = programasDeVolumen.map((programa) => ({
    programa,
    leads: crearLeadsDeVolumen(programa, azar),
  }));
  for (const grupo of leadsPorPrograma) {
    await ingerirEntradas(db, grupo.programa.id, grupo.leads.map((lead) => lead.entrada), {
      aplicarReglaDeDeals: false,
    });
  }

  const correos = leadsPorPrograma.flatMap((grupo) => grupo.leads.map((lead) => lead.correo));
  const leadsCreados = await db.select().from(leads).where(inArray(leads.emailNormalizado, correos));
  const leadPorCorreo = new Map(leadsCreados.map((lead) => [lead.emailNormalizado, lead]));
  const envios = await db
    .select({ id: submissions.id, leadId: submissions.leadId })
    .from(submissions)
    .where(inArray(submissions.leadId, leadsCreados.map((lead) => lead.id)));
  const envioPorLead = new Map(envios.map((envio) => [envio.leadId, envio.id]));

  const dealsCreados: DealDeVolumen[] = [];
  for (const grupo of leadsPorPrograma) {
    const equipo = closersPorPrograma.get(grupo.programa.id);
    if (!equipo || equipo.closers.length === 0) {
      throw new Error(`El programa ${grupo.programa.nombre} no tiene closers para el volumen local.`);
    }
    const etapasConMuestra = new Set<EtapaVolumen>(["en_gestion", "contactado", "calificado", "agendado"]);
    const muestrasAsignadas = new Set<EtapaVolumen>();
    const destinos = etapasDeVolumen(grupo.programa.distribucion, azar);
    const altas: AltaHistorica[] = grupo.leads.slice(0, destinos.length).map((leadVolumen, indice) => {
      const lead = leadPorCorreo.get(leadVolumen.correo)!;
      const destino = destinos[indice];
      const asignarMuestra = equipo.closerConMuestras
        && etapasConMuestra.has(destino.etapa)
        && !muestrasAsignadas.has(destino.etapa);
      const owner = asignarMuestra
        ? equipo.closerConMuestras!
        : equipo.closers[indice % equipo.closers.length];
      if (asignarMuestra) muestrasAsignadas.add(destino.etapa);
      const indiceFecha = DIAS_HABILES_SEPTIEMBRE.indexOf(
        leadVolumen.fecha as (typeof DIAS_HABILES_SEPTIEMBRE)[number],
      );
      return {
        leadId: lead.id,
        programId: grupo.programa.id,
        etapa: destino.etapa === "cierre_perdido" ? "contactado" : destino.etapa,
        pendiente: destino.etapa === "cierre_perdido" ? null : destino.pendiente,
        huella: `seed-local:${grupo.programa.prefijo}:deal:${indice + 1}`,
        actorId,
        fechaEtapa: instanteDeBogota(DIAS_HABILES_SEPTIEMBRE[indiceFecha + 2], 10 + (indice % 7)),
        ownerUserId: owner.id,
        cohortId: grupo.programa.cohorteId,
        submissionOrigenId: indice % 10 === 0 ? null : envioPorLead.get(lead.id),
      };
    });
    const resultados = await abrirDealesHistoricos(db, altas);
    resultados.forEach((resultado, indice) => {
      if (resultado.estado === "lead_con_deal_vivo") {
        throw new Error(`El lead de volumen ${grupo.leads[indice].correo} ya tenia un deal vivo.`);
      }
      const alta = altas[indice];
      const owner = equipo.closers.find((closer) => closer.id === alta.ownerUserId)!;
      const indiceFecha = DIAS_HABILES_SEPTIEMBRE.indexOf(
        grupo.leads[indice].fecha as (typeof DIAS_HABILES_SEPTIEMBRE)[number],
      );
      dealsCreados.push({
        id: resultado.dealId,
        etapa: destinos[indice].etapa,
        pendiente: destinos[indice].pendiente,
        fechaLlamada: DIAS_HABILES_SEPTIEMBRE[indiceFecha + 1],
        fechaEtapa: DIAS_HABILES_SEPTIEMBRE[indiceFecha + 2],
        fechaAbono: DIAS_HABILES_SEPTIEMBRE[indiceFecha + 3],
        correo: grupo.leads[indice].correo,
        ownerUserId: owner.id,
        closerId: owner.closerId ?? "",
      });
    });
  }

  for (const [indice, deal] of dealsCreados.filter((item) => item.etapa === "cierre_perdido").entries()) {
    await moverEtapa(db, {
      dealId: deal.id,
      a: "cierre_perdido",
      actor: { tipo: "usuario", userId: deal.ownerUserId, rol: "closer" },
      motivoId: motivosPerdidaIds[indice % motivosPerdidaIds.length],
    });
  }

  const llamadas: LlamadaHistorica[] = [];
  const etapasConShow = new Set<EtapaVolumen>([
    "atendido",
    "compromiso_verbal",
    "ganado_parcial",
    "ganado_completo",
  ]);
  for (const programa of programasDeVolumen) {
    const candidatas = dealsCreados
      .filter((deal) => deal.id && leadPorCorreo.get(deal.correo)?.programId === programa.id)
      .filter((deal) => etapasConShow.has(deal.etapa)
        || deal.pendiente === "proxima_cohorte"
        || deal.etapa === "agendado"
        || deal.pendiente === "reagenda");
    candidatas.forEach((deal, indice) => {
      const show = etapasConShow.has(deal.etapa) || deal.pendiente === "proxima_cohorte";
      const resultado = show ? "show" : deal.pendiente === "reagenda" ? "no_show" : "agendada";
      llamadas.push({
        programId: programa.id,
        dealId: deal.id,
        huella: `seed-local:${programa.prefijo}:llamada:${indice + 1}`,
        actorId,
        resultado,
        fechaAgenda: instanteDeBogota(deal.fechaLlamada, 14),
        fechaLlamada: show ? instanteDeBogota(deal.fechaLlamada, 15) : null,
        closer: deal.closerId,
        emailLead: deal.correo,
        notas: show
          ? "Llamada de demostracion con asistencia."
          : resultado === "no_show"
            ? "No asistio a la llamada de demostracion."
            : "Llamada de demostracion agendada.",
      });
    });
  }
  await registrarLlamadasHistoricas(db, llamadas);

  const abonosHistoricos: AbonoHistorico[] = [];
  const candidatosParaAnular: number[] = [];
  for (const programa of programasDeVolumen) {
    const precio = Number(programa.ticketUsd);
    let abonadosVistos = 0;
    const pagadores = dealsCreados.filter(
      (deal) => leadPorCorreo.get(deal.correo)?.programId === programa.id
        && (deal.etapa === "ganado_parcial" || deal.etapa === "ganado_completo"),
    );
    pagadores.forEach((deal, indice) => {
      const numeroDeAbonado = deal.etapa === "ganado_parcial" ? abonadosVistos++ : -1;
      const montos = deal.etapa === "ganado_completo"
        ? (indice % 2 === 0 ? [precio] : [precio * 0.4, precio * 0.6])
        : (numeroDeAbonado < 2 || numeroDeAbonado % 2 === 0
          ? [precio * 0.2, precio * 0.25]
          : [precio * 0.35]);
      montos.forEach((monto, numeroAbono) => {
        const posicion = abonosHistoricos.length;
        abonosHistoricos.push({
          dealId: deal.id,
          huella: `seed-local:${programa.prefijo}:abono:${indice + 1}:${numeroAbono + 1}`,
          actorId,
          fecha: deal.fechaAbono,
          monto: monto.toFixed(2),
          closer: deal.closerId,
        });
        if (deal.etapa === "ganado_parcial" && montos.length === 2 && numeroAbono === 0) {
          candidatosParaAnular.push(posicion);
        }
      });
    });
  }
  const abonosCreados = await registrarAbonosHistoricos(db, abonosHistoricos);
  for (const posicion of candidatosParaAnular.slice(0, 2)) {
    await anularAbono(db, { userId: actorId, rol: "developer" }, {
      abonoId: abonosCreados[posicion].id,
      motivo: "Abono ficticio anulado para probar metricas vigentes.",
    });
  }

  const dealParaAnular = dealsCreados.find((deal) => deal.etapa === "registrado")!;
  await anularDeal(db, { userId: actorId, rol: "developer" }, {
    dealId: dealParaAnular.id,
    motivo: "Deal ficticio anulado para probar metricas vigentes.",
  });

  for (const programa of programasDeVolumen) {
    const estudiante = dealsCreados.find(
      (deal) => deal.etapa === "ganado_completo" && leadPorCorreo.get(deal.correo)?.programId === programa.id,
    );
    if (!estudiante) throw new Error(`Falta un estudiante completo para ${programa.nombre}.`);
    await marcarOnboarded(db, { userId: actorId, rol: "developer" }, { dealId: estudiante.id });
  }

  for (const programa of programasDeVolumen) {
    const conteos = programa.distribucion.map((fila) => `${fila.etapa}${fila.pendiente ? `/${fila.pendiente}` : ""}=${fila.cantidad}`).join(", ");
    console.log(`[seed:local] ${programa.nombre}: ${programa.totalLeads} leads; ${conteos}`);
  }
}

export async function sembrarLocal(): Promise<void> {
  // 1. Guardia de seguridad: la base TIENE que ser local
  const urlDestino = process.env.DATABASE_URL ?? LOCAL_DB_URL;
  validarUrlLocal(urlDestino);
  // `npm run seed:local` suelto no trae DATABASE_URL: el cliente de lib/db es perezoso
  // y la lee al primer uso, asi que fijarla aqui basta.
  process.env.DATABASE_URL = urlDestino;

  console.log(`[seed:local] Iniciando siembra contra: ${urlDestino}`);

  // 2. Comprobar si ya fue sembrada (Idempotencia)
  const programasPrevios = await db.select().from(programs);
  if (programasPrevios.length >= 2) {
    console.log("[seed:local] La base de datos ya contiene programas sembrados.");
    console.log("             Omitiendo siembra para no duplicar datos.");
    console.log("             (Para reiniciar de cero: docker compose down -v && npm run db:local)");
    return;
  }

  // 3. Bootstrap del usuario actor en users (excepción de base vacía ADR 0029)
  const correoActor = (process.env.SCRIPT_ACTOR_EMAIL ?? "dev@retia.local").trim().toLowerCase();
  const [actorExistente] = await db.select().from(users).where(eq(users.email, correoActor)).limit(1);

  if (!actorExistente) {
    await db.insert(users).values({
      email: correoActor,
      nombre: "Developer Local",
      rol: "developer",
      activo: true,
    });
    console.log(`[seed:local] Usuario actor creado: ${correoActor}`);
  }

  process.env.SCRIPT_ACTOR_EMAIL = correoActor;
  const actorId = await actorDelScript(db);
  const actor = { id: actorId, rol: "developer" as const };

  // 4. Catálogo de Motivos (requeridos para transiciones de etapas)
  console.log("[seed:local] Configurando catálogo de motivos...");
  const catMotivos = motivos(db);
  const motivosExistentes = await catMotivos.listar();
  const mapaMotivos = new Map<string, string>();
  for (const m of motivosExistentes) {
    mapaMotivos.set(`${m.tipo}|${m.nombre}`, m.id);
  }

  const MOTIVOS_BASE = [
    { tipo: "perdida" as const, nombre: "Sin dinero para invertir ahora" },
    { tipo: "perdida" as const, nombre: "El programa no se ajusta a su nivel o necesidad" },
    { tipo: "reagenda" as const, nombre: "Faltó tiempo para terminar la llamada" },
    { tipo: "reagenda" as const, nombre: "Tiene que estar quien toma la decisión" },
    { tipo: "retroceso" as const, nombre: "Necesita más tiempo para pensarlo" },
    { tipo: "recuperacion" as const, nombre: "Volvió a mostrar interés" },
  ];

  for (const m of MOTIVOS_BASE) {
    const clave = `${m.tipo}|${m.nombre}`;
    if (!mapaMotivos.has(clave)) {
      const creado = await catMotivos.crear(actorId, m);
      mapaMotivos.set(clave, creado.id);
    }
  }

  // 4b. Catálogo global de Áreas
  console.log("[seed:local] Configurando catálogo de áreas...");
  const catAreas = areas(db);
  const areasExistentes = await catAreas.listar();
  const nombresDeAreas = new Set(
    areasExistentes.map((area) => String(area.nombre).toLowerCase()),
  );
  const AREAS_BASE = ["Paid", "Orgánico", "Referidos"];

  for (const nombre of AREAS_BASE) {
    if (!nombresDeAreas.has(nombre.toLowerCase())) {
      await catAreas.crear(actorId, { nombre });
    }
  }

  // 4c. Canales mínimos para recorrer atribución y los tres formatos en local.
  console.log("[seed:local] Configurando catálogo de canales...");
  const areasPorNombre = new Map(
    (await catAreas.listar({ soloActivos: true })).map((area) => [String(area.nombre).toLowerCase(), area.id]),
  );
  const catCanales = canales(db);
  const canalesExistentes = new Set(
    (await catCanales.listar()).map((canal) =>
      `${String(canal.utmSource ?? "").trim().toLowerCase()}|${String(canal.utmMedium).trim().toLowerCase()}`,
    ),
  );
  const CANALES_BASE = [
    { nombre: "Meta (cualquier source) / paid_social", utmSource: "", utmMedium: "paid_social", area: "paid", formato: "plantilla_pauta" as const },
    { nombre: "closer / referido", utmSource: "closer", utmMedium: "referido", area: "referidos", formato: "closer" as const },
    { nombre: "direct / organic", utmSource: "direct", utmMedium: "organic", area: "orgánico", formato: null },
  ];
  for (const canal of CANALES_BASE) {
    const par = `${canal.utmSource}|${canal.utmMedium}`;
    if (!canalesExistentes.has(par)) {
      await catCanales.crear(actorId, { ...canal, areaId: areasPorNombre.get(canal.area)! });
    }
  }

  // 5. Dos Programas activos. El token de Calendly de cada uno sale de
  // CALENDLY_PAT_LOCAL_COMUNICARTE / CALENDLY_PAT_LOCAL_TACTICAL si estan (ver .env.example):
  // con un PAT real, las pantallas que leen Calendly (la cuenta por membresia en
  // /ajustes/usuarios, ticket 096) funcionan en local. Sin ellos va un token de mentira y
  // esas pantallas muestran el rechazo de Calendly, que es lo correcto.
  console.log("[seed:local] Creando programas activos...");
  const p1 = await crearPrograma(db, actorId, {
    nombre: "ComunicArte Local",
    slug: "comunicarte-local",
    ticketUsd: "797.00",
    formUrl: "https://form.typeform.com/to/comunicarte-demo",
  });
  await guardarTokenCalendly(
    db,
    actorId,
    p1.id,
    patLocal("CALENDLY_PAT_LOCAL_COMUNICARTE") ?? "calendly-token-local-comunicarte",
  );
  const prog1 = await reactivarPrograma(db, actorId, p1.id);

  const p2 = await crearPrograma(db, actorId, {
    nombre: "Tactical Investor Local",
    slug: "tactical-local",
    ticketUsd: "1500.00",
    formUrl: "https://form.typeform.com/to/tactical-demo",
  });
  await guardarTokenCalendly(
    db,
    actorId,
    p2.id,
    patLocal("CALENDLY_PAT_LOCAL_TACTICAL") ?? "calendly-token-local-tactical",
  );
  const prog2 = await reactivarPrograma(db, actorId, p2.id);

  // 5b. Estados de llegada y plantilla de lead (ticket 117): sin ellos ningun envio abre
  // deal y el webhook no sabe que pregunta trae el correo.
  console.log("[seed:local] Sembrando plantillas de lead...");
  for (const programa of [prog1, prog2]) {
    await editarPlantillaLead(db, actorId, programa.id, PLANTILLA_LEAD_BASE);
  }

  // 6. Cohortes activas
  console.log("[seed:local] Creando cohortes activas...");
  const coh1 = await crearCohorte(db, actorId, {
    programId: prog1.id,
    codigo: "C1",
    metaCupos: 30,
    precioUsd: "797.00",
    fechaInicioClases: "2026-11-01",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-10-31",
    estado: "activo",
  });

  const coh2 = await crearCohorte(db, actorId, {
    programId: prog2.id,
    codigo: "C1",
    metaCupos: 50,
    precioUsd: "1500.00",
    fechaInicioClases: "2026-11-15",
    fechaInicioVentas: "2026-09-01",
    fechaCierreVentas: "2026-11-14",
    estado: "activo",
  });

  // 7. Fuentes Webhook activas
  console.log("[seed:local] Creando fuentes webhook activas...");
  const f1 = await crearFuente(db, actor, {
    programId: prog1.id,
    nombre: "Formulario Webhook ComunicArte",
    tipo: "webhook",
    proveedor: "typeform",
    mapeoColumnas: {},
  });
  await rotarSecretoDeFuente(db, actor, f1.id);
  await activarFuente(db, actor, f1.id);

  const f2 = await crearFuente(db, actor, {
    programId: prog2.id,
    nombre: "Formulario Webhook Tactical",
    tipo: "webhook",
    proveedor: "typeform",
    mapeoColumnas: {},
  });
  await rotarSecretoDeFuente(db, actor, f2.id);
  await activarFuente(db, actor, f2.id);

  // 9. Usuarios locales con sus membresías
  console.log("[seed:local] Creando usuarios locales con sus membresías...");
  const gerente = await crearUsuario(db, actorId, {
    email: "gerente@retia.local",
    nombre: "Gerente Local",
    rol: "gerente",
    programas: [],
  });

  const closer1 = await crearUsuario(db, actorId, {
    email: "carlos.closer@retia.local",
    nombre: "Carlos Closer",
    rol: "closer",
    closerId: "carlos",
    programas: [prog1.id, prog2.id],
  });

  const closer2 = await crearUsuario(db, actorId, {
    email: "maria.closer@retia.local",
    nombre: "María Closer",
    rol: "closer",
    closerId: "maria",
    programas: [prog1.id, prog2.id],
  });

  const closerMani = await crearUsuario(db, actorId, {
    email: "mani.closer@retia.local",
    nombre: "Mani Closer",
    rol: "closer",
    closerId: "mani-local",
    programas: [prog1.id],
  });

  // 10. Leads vía ingerirEntradas
  console.log("[seed:local] Ingiriendo leads por la puerta oficial (ingerirEntradas)...");
  const entradasProg1: EntradaEnvio[] = [
    entradaDePrueba(f1.id, {
      token: "tok-p1-1",
      correo: "andrea.morales@ejemplo.local",
      nombre: "Andrea Morales",
      telefono: "+573001110001",
      estado: "setteo_no_calificado",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-2",
      correo: "bernardo.gomez@ejemplo.local",
      nombre: "Bernardo Gómez",
      telefono: "+573001110002",
      estado: "setteo_no_calificado",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-3",
      correo: "camilo.rodriguez@ejemplo.local",
      nombre: "Camilo Rodríguez",
      telefono: "+573001110003",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-4",
      correo: "diana.castro@ejemplo.local",
      nombre: "Diana Castro",
      telefono: "+573001110004",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-5",
      correo: "esteban.duque@ejemplo.local",
      nombre: "Esteban Duque",
      telefono: "+573001110005",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-6",
      correo: "felipe.torres@ejemplo.local",
      nombre: "Felipe Torres",
      telefono: "+573001110006",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-7",
      correo: "gloria.vargas@ejemplo.local",
      nombre: "Gloria Vargas",
      telefono: "+573001110007",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-8",
      correo: "hector.sanchez@ejemplo.local",
      nombre: "Héctor Sánchez",
      telefono: "+573001110008",
      estado: "con_calendly",
    }),
    entradaDePrueba(f1.id, {
      token: "tok-p1-9",
      correo: "isabel.navarro@ejemplo.local",
      nombre: "Isabel Navarro",
      telefono: "+573001110009",
      estado: "setteo_no_calificado",
    }),
  ];

  const entradasProg2: EntradaEnvio[] = [
    entradaDePrueba(f2.id, {
      token: "tok-p2-1",
      correo: "jorge.perez@ejemplo.local",
      nombre: "Jorge Pérez",
      telefono: "+573002220001",
      estado: "con_calendly",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-2",
      correo: "karina.lopez@ejemplo.local",
      nombre: "Karina López",
      telefono: "+573002220002",
      estado: "setteo_no_calificado",
      utmSource: "google",
      utmMedium: "cpc",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-3",
      correo: "luis.mendoza@ejemplo.local",
      nombre: "Luis Mendoza",
      telefono: "+573002220003",
      estado: "con_calendly",
      utmSource: "google",
      utmMedium: "organic",
    }),
    entradaDePrueba(f2.id, {
      token: "tok-p2-4",
      correo: "marta.rios@ejemplo.local",
      nombre: "Marta Ríos",
      telefono: "+573002220004",
      estado: "con_calendly",
    }),
  ];

  await ingerirEntradas(db, prog1.id, entradasProg1, { aplicarReglaDeDeals: false });
  await ingerirEntradas(db, prog2.id, entradasProg2, { aplicarReglaDeDeals: false });

  // Dos envíos por persona: el parcial guarda el avance y el completo aplica la regla 151.
  for (const [programa, fuente, prefijo] of [
    [prog1, f1, "p1"],
    [prog2, f2, "p2"],
  ] as const) {
    const dobles = [1, 2].map((numero) => ({
      correo: `doble-${prefijo}-${numero}@ejemplo.local`,
      nombre: `Formulario doble ${prefijo.toUpperCase()} ${numero}`,
      telefono: `+573009${prefijo === "p1" ? "1" : "2"}${String(numero).padStart(5, "0")}`,
    }));
    await ingerirEntradas(
      db,
      programa.id,
      dobles.map((lead, indice) => entradaDePrueba(fuente.id, {
        ...lead,
        token: `tok-doble-${prefijo}-${indice + 1}-parcial`,
        estado: "setteo_no_calificado",
        fecha: `2026-09-29T${10 + indice}:00:00-05:00`,
        esParcial: true,
      })),
    );
    await ingerirEntradas(
      db,
      programa.id,
      dobles.map((lead, indice) => entradaDePrueba(fuente.id, {
        ...lead,
        token: `tok-doble-${prefijo}-${indice + 1}-completo`,
        estado: "setteo_no_calificado",
        fecha: `2026-09-30T${10 + indice}:00:00-05:00`,
        esParcial: false,
      })),
    );
  }

  // Una cita sin candidato por programa queda en el Inbox para asignarla a mano.
  for (const [programa, prefijo] of [[prog1, "p1"], [prog2, "p2"]] as const) {
    const llamada = await registrarLlamadaDeCalendly(db, programa.id, {
      uuidInvitado: `seed-local-suelta-${prefijo}`,
      inicio: instanteDeBogota("2026-10-01", prefijo === "p1" ? 10 : 11),
      correoInvitado: `sin-lead-${prefijo}@ejemplo.local`,
      correoHost: null,
      linkCalendly: `https://calendly.com/retia-demo/suelta-${prefijo}`,
    });
    if (llamada.tipo !== "suelta") {
      throw new Error(`La llamada ${prefijo} debia quedar ${ORIGEN_DE_SUELTA_ASIGNABLE} suelta.`);
    }
  }

  // 11. Cargar leads recién creados
  const todosLeadsP1 = await db.select().from(leads).where(eq(leads.programId, prog1.id));
  const todosLeadsP2 = await db.select().from(leads).where(eq(leads.programId, prog2.id));

  const mapaLeads = new Map<string, typeof leads.$inferSelect>();
  for (const l of [...todosLeadsP1, ...todosLeadsP2]) {
    mapaLeads.set(l.emailNormalizado, l);
  }

  console.log("[seed:local] Creando deals y distribuyéndolos en varias etapas con llamadas y abonos...");
  // Desde el 121 el motor pide el área declarada para comprometer, abonar y completar.
  const areaDeclaradaSeed = areasPorNombre.get("paid")!;

  // Deal 1 -> Etapa: registrado
  const lead1 = mapaLeads.get("andrea.morales@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead1.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });

  // Deal 2 -> Etapa: contactado
  const lead2 = mapaLeads.get("bernardo.gomez@ejemplo.local")!;
  const deal2Id = await abrirDeal(db, {
    leadId: lead2.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
  });
  await registrarActividad(
    db,
    { userId: closer2.id, rol: "closer" },
    {
      dealId: deal2Id,
      tipo: "contacto",
      canal: "WhatsApp",
      nota: "Respondió y confirmó interés en el programa.",
    },
  );

  // Deal 3 -> Etapa: agendado (vía agregarLlamada)
  const lead3 = mapaLeads.get("camilo.rodriguez@ejemplo.local")!;
  const deal3Id = await abrirDeal(db, {
    leadId: lead3.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal3Id,
      fechaAgenda: new Date("2026-10-02T15:00:00-05:00"),
      linkCalendly: "https://calendly.com/retia-demo/cita-camilo",
      notas: "Interesado en mejorar comunicación de equipo.",
    },
  );

  // Deal 4 -> Etapa: atendido (vía agregarLlamada + pegarGrain)
  const lead4 = mapaLeads.get("diana.castro@ejemplo.local")!;
  const deal4Id = await abrirDeal(db, {
    leadId: lead4.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  const resLlamada4 = await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal4Id,
      fechaAgenda: new Date("2026-09-25T11:00:00-05:00"),
    },
  );
  await pegarGrain(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      callId: resLlamada4.callId,
      linkGrain: "https://grain.com/share/recording-diana-demo",
    },
  );

  // Deal 5 -> Etapa: compromiso_verbal
  const lead5 = mapaLeads.get("esteban.duque@ejemplo.local")!;
  const deal5Id = await abrirDeal(db, {
    leadId: lead5.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
    fechaLimitePago: "2026-10-10",
  });
  await registrarActividad(
    db,
    { userId: closer2.id, rol: "closer" },
    {
      dealId: deal5Id,
      tipo: "contacto",
      canal: "Llamada",
      nota: "Confirmó que realizará el pago antes de la fecha acordada.",
    },
  );
  await moverEtapa(db, {
    dealId: deal5Id,
    a: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
  });

  // Deal 6 -> Etapa: abonado (abono parcial con comprobante + moverEtapa sistema)
  const lead6 = mapaLeads.get("felipe.torres@ejemplo.local")!;
  const deal6Id = await abrirDeal(db, {
    leadId: lead6.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
    fechaLimitePago: "2026-10-05",
  });
  await registrarActividad(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal6Id,
      tipo: "contacto",
      canal: "WhatsApp",
      nota: "Acordó hacer un primer abono para reservar su cupo.",
    },
  );
  await moverEtapa(db, {
    dealId: deal6Id,
    a: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
  });
  // El abono por la puerta de la app: congela el valor vendido y mueve el deal a ganado.
  await registrarAbono(db, { userId: closer1.id, rol: "closer" }, {
    dealId: deal6Id,
    fecha: "2026-09-26",
    monto: "300.00",
    comprobanteUrl: "https://ejemplo.local/comprobantes/abono-felipe.pdf",
  });

  // Deal 7 -> Etapa: completo (pago total con comprobante + moverEtapa sistema)
  const lead7 = mapaLeads.get("gloria.vargas@ejemplo.local")!;
  const deal7Id = await abrirDeal(db, {
    leadId: lead7.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
    fechaLimitePago: "2026-10-01",
  });
  await registrarActividad(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal7Id,
      tipo: "contacto",
      canal: "Llamada",
      nota: "Confirmó el pago total para ingresar a la cohorte.",
    },
  );
  await moverEtapa(db, {
    dealId: deal7Id,
    a: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
  });
  // El abono por la puerta de la app: congela el valor vendido y mueve el deal a ganado.
  await registrarAbono(db, { userId: closer1.id, rol: "closer" }, {
    dealId: deal7Id,
    fecha: "2026-09-27",
    monto: "797.00",
    comprobanteUrl: "https://ejemplo.local/comprobantes/completo-gloria.pdf",
  });

  // Deal 8 -> Etapa: agendado con Re-agenda pendiente (llamada fallida)
  const lead8 = mapaLeads.get("hector.sanchez@ejemplo.local")!;
  const deal8Id = await abrirDeal(db, {
    leadId: lead8.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh1.id,
  });
  const resLlamada8 = await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal8Id,
      fechaAgenda: new Date("2026-09-26T16:00:00-05:00"),
    },
  );
  await marcarFallida(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      callId: resLlamada8.callId,
      resultado: "no_show",
    },
  );

  // Deal 9 -> Etapa: cierre_perdido
  const lead9 = mapaLeads.get("isabel.navarro@ejemplo.local")!;
  const deal9Id = await abrirDeal(db, {
    leadId: lead9.id,
    programId: prog1.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    ownerUserId: closer2.id,
    cohortId: coh1.id,
  });
  await registrarActividad(
    db,
    { userId: closer2.id, rol: "closer" },
    {
      dealId: deal9Id,
      tipo: "contacto",
      canal: "WhatsApp",
      nota: "Respondió, pero no cuenta con presupuesto para invertir ahora.",
    },
  );
  const motivoPerdidaId = mapaMotivos.get("perdida|Sin dinero para invertir ahora")!;
  await moverEtapa(db, {
    dealId: deal9Id,
    a: "cierre_perdido",
    actor: { tipo: "usuario", userId: closer2.id, rol: "closer" },
    motivoId: motivoPerdidaId,
  });

  // Deal 10 -> Tactical Investor: etapa abonado
  const lead10 = mapaLeads.get("jorge.perez@ejemplo.local")!;
  const deal10Id = await abrirDeal(db, {
    leadId: lead10.id,
    programId: prog2.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
    fechaLimitePago: "2026-10-15",
  });
  await registrarActividad(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal10Id,
      tipo: "contacto",
      canal: "Llamada",
      nota: "Acordó iniciar con un abono de 500 USD.",
    },
  );
  await moverEtapa(db, {
    dealId: deal10Id,
    a: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
  });
  // El abono por la puerta de la app: congela el valor vendido y mueve el deal a ganado.
  await registrarAbono(db, { userId: closer1.id, rol: "closer" }, {
    dealId: deal10Id,
    fecha: "2026-09-28",
    monto: "500.00",
    comprobanteUrl: "https://ejemplo.local/comprobantes/abono-jorge.pdf",
  });

  // Deal 11 -> Tactical: registrado
  const lead11 = mapaLeads.get("karina.lopez@ejemplo.local")!;
  await abrirDeal(db, {
    leadId: lead11.id,
    programId: prog2.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
  });

  // Deal 12 -> Tactical: agendado (vía agregarLlamada)
  const lead12 = mapaLeads.get("luis.mendoza@ejemplo.local")!;
  const deal12Id = await abrirDeal(db, {
    leadId: lead12.id,
    programId: prog2.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "registrado",
    actor: { tipo: "sistema" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
  });
  await agregarLlamada(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal12Id,
      fechaAgenda: new Date("2026-10-06T15:00:00-05:00"),
      linkCalendly: "https://calendly.com/retia-demo/cita-luis",
      notas: "Quiere entender la estrategia antes de decidir.",
    },
  );

  // Deal 13 -> Tactical: compromiso_verbal (con fecha límite pasada, para ver el aviso)
  const lead13 = mapaLeads.get("marta.rios@ejemplo.local")!;
  const deal13Id = await abrirDeal(db, {
    leadId: lead13.id,
    programId: prog2.id,
    areaDeclaradaId: areaDeclaradaSeed,
    etapa: "en_gestion",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
    ownerUserId: closer1.id,
    cohortId: coh2.id,
    fechaLimitePago: "2026-09-20",
  });
  await registrarActividad(
    db,
    { userId: closer1.id, rol: "closer" },
    {
      dealId: deal13Id,
      tipo: "contacto",
      canal: "WhatsApp",
      nota: "Prometió pagar antes de la fecha límite, que ya venció.",
    },
  );
  await moverEtapa(db, {
    dealId: deal13Id,
    a: "compromiso_verbal",
    actor: { tipo: "usuario", userId: closer1.id, rol: "closer" },
  });

  // 12. Volumen adicional para recorrer todas las métricas y filtros del dashboard.
  await sembrarVolumen(
    actorId,
    [
      {
        id: prog1.id,
        nombre: "ComunicArte Local",
        slug: "comunicarte-local",
        ticketUsd: "797.00",
        formUrl: "https://form.typeform.com/to/comunicarte-demo",
        fuenteId: f1.id,
        cohorteId: coh1.id,
        totalLeads: 150,
        comisionPorcentaje: "10.04",
        prefijo: "p1",
        distribucion: [
          { etapa: "registrado", cantidad: 24 },
          { etapa: "potencial", cantidad: 6 },
          { etapa: "en_gestion", cantidad: 8 },
          { etapa: "contactado", cantidad: 18 },
          { etapa: "calificado", cantidad: 8 },
          { etapa: "agendado", pendiente: "reagenda", cantidad: 8 },
          { etapa: "agendado", cantidad: 14 },
          { etapa: "atendido", cantidad: 12 },
          { etapa: "compromiso_verbal", cantidad: 10 },
          { etapa: "ganado_parcial", cantidad: 8 },
          { etapa: "ganado_completo", cantidad: 6 },
          { etapa: "registrado", pendiente: "proxima_cohorte", cantidad: 5 },
          { etapa: "cierre_perdido", cantidad: 8 },
          { etapa: "atendido", pendiente: "seguimiento", cantidad: 7 },
        ],
      },
      {
        id: prog2.id,
        nombre: "Tactical Investor Local",
        slug: "tactical-local",
        ticketUsd: "1500.00",
        formUrl: "https://form.typeform.com/to/tactical-demo",
        fuenteId: f2.id,
        cohorteId: coh2.id,
        totalLeads: 120,
        comisionPorcentaje: "6.67",
        prefijo: "p2",
        distribucion: [
          { etapa: "registrado", cantidad: 20 },
          { etapa: "potencial", cantidad: 5 },
          { etapa: "en_gestion", cantidad: 6 },
          { etapa: "contactado", cantidad: 14 },
          { etapa: "calificado", cantidad: 6 },
          { etapa: "agendado", pendiente: "reagenda", cantidad: 7 },
          { etapa: "agendado", cantidad: 11 },
          { etapa: "atendido", cantidad: 9 },
          { etapa: "compromiso_verbal", cantidad: 8 },
          { etapa: "ganado_parcial", cantidad: 6 },
          { etapa: "ganado_completo", cantidad: 5 },
          { etapa: "registrado", pendiente: "proxima_cohorte", cantidad: 4 },
          { etapa: "cierre_perdido", cantidad: 7 },
          { etapa: "atendido", pendiente: "seguimiento", cantidad: 5 },
        ],
      },
    ],
    new Map([
      [prog1.id, {
        closers: [
          { id: closer1.id, closerId: closer1.closerId },
          { id: closer2.id, closerId: closer2.closerId },
          { id: closerMani.id, closerId: closerMani.closerId },
        ],
        closerConMuestras: { id: closerMani.id, closerId: closerMani.closerId },
      }],
      [prog2.id, {
        closers: [
          { id: closer1.id, closerId: closer1.closerId },
          { id: closer2.id, closerId: closer2.closerId },
        ],
      }],
    ]),
    [
      motivoPerdidaId,
      mapaMotivos.get("perdida|El programa no se ajusta a su nivel o necesidad")!,
    ],
  );

  const filasDeDeals = await db
    .select({ programId: deals.programId, etapa: deals.etapa })
    .from(deals)
    .where(vigente(deals));
  const nombresDePrograma = new Map([[prog1.id, prog1.nombre], [prog2.id, prog2.nombre]]);
  console.log("\n[seed:local] Deals vigentes por programa y etapa:");
  console.table(
    [prog1, prog2].flatMap((programa) => etapaDealEnum.enumValues.map((etapa) => ({
      programa: nombresDePrograma.get(programa.id),
      etapa,
      deals: filasDeDeals.filter((deal) => deal.programId === programa.id && deal.etapa === etapa).length,
    }))),
  );
  console.log("[seed:local] Correos de acceso por rol:");
  console.table([
    { rol: "developer", email: correoActor },
    { rol: gerente.rol, email: gerente.email },
    { rol: closer1.rol, email: closer1.email },
    { rol: closer2.rol, email: closer2.email },
    { rol: closerMani.rol, email: closerMani.email },
  ]);

  console.log("\n[seed:local] Siembra local finalizada exitosamente.");
}

if (process.argv[1]?.endsWith("seed-local.ts")) {
  sembrarLocal()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error("\n[seed:local] Falló la siembra:", error);
      process.exit(1);
    });
}
