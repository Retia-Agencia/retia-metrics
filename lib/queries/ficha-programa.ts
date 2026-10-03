import { db as dbDeLaApp } from "@/lib/db";
import type { Cohorte } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { listarFuentes } from "@/lib/catalogo/fuentes";
import { plataformasDePago, plataformasDelPrograma } from "@/lib/catalogo/plataformas";
import { programaPorId } from "@/lib/catalogo/programas";
import { membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { enlacesDePagoVigentes } from "@/lib/queries/recursos";
import { fuentesParaAdmin } from "@/lib/queries/fuentes";
import { saludDeFuentes } from "@/lib/queries/salud-fuentes";
import { haceCuanto } from "@/lib/format";
import type { ProgramaConFuentes } from "@/components/admin/fuentes-admin";

/**
 * La ficha del programa (ticket 100, ADR 0050): todo lo que define un programa en una
 * lectura, para la tab Programa. Solo LEE, y cada pieza sale del modulo que ya es dueño de
 * esa pregunta, no de un SELECT nuevo: el programa por `programaPorId` (sin el token de
 * Calendly ni la clave de firma, ADR 0057), las cohortes por `listarCohortes`, las fuentes
 * por `listarFuentes` (sin el secreto del webhook, ticket 105), los checkouts por
 * `enlacesDePagoVigentes` y el equipo por `membresiasConCalendly`.
 *
 * NO decide alcance: la pagina resuelve antes, con `programaVisiblePorSlug`, que la sesion
 * ve este programa (ADR 0048), y un programa ajeno es 404 antes de llegar aqui. Todo lo que
 * devuelve es de UN programa: el programa es frontera, no filtro.
 *
 * Lo que la ficha proyecta es una forma propia y chica, no las filas del catalogo: una
 * pantalla que muestra "tiene token" no necesita el mapeo de columnas de una fuente.
 */

export interface DatosDelPrograma {
  id: string;
  slug: string;
  nombre: string;
  activo: boolean;
  /** Solo prellena el precio al crear una cohorte (ningun calculo lo lee). */
  ticketUsd: string;
  /** El porcentaje vigente (ADR 0065 punto 7). Nulo = no cargado, nunca 0. */
  comisionPorcentaje: string | null;
  /** Link de configuracion; no reemplaza a la fuente principal como destino visible. */
  formUrl: string | null;
  /**
   * El destino del formulario: la fuente principal del programa (ADR 0068). Nulo = no hay a
   * donde mandar un link. Ya no sale de `programs.form_url`, que se retira en dos pasos.
   */
  formulario: { fuente: string; url: string } | null;
  calendlyUrl: string | null;
  tieneTokenCalendly: boolean;
  webhookCalendlyConectado: boolean;
  diasSinActividad: number;
}

export interface FuenteDeLaFicha {
  id: string;
  nombre: string;
  tipo: string;
  proveedor: string | null;
  activo: boolean;
  /** `activa` o `rota` (ticket 055): una fuente rota sigue activa y la app avisa. */
  estado: string;
  /** Donde la gente llena este formulario (ADR 0068). */
  urlPublica: string | null;
  principal: boolean;
}

export interface MiembroDeLaFicha {
  membresiaId: string;
  userId: string;
  nombre: string;
  email: string;
  /** La cuenta de Calendly de esta persona EN ESTE programa (ticket 096). */
  calendlyEmail: string | null;
}

export interface CheckoutDeLaFicha {
  id: string;
  url: string;
  monto: string;
  moneda: string;
  plataforma: string | null;
}

/**
 * Una cohorte como la pinta la ficha. Misma forma que `CohorteVista` de `CohortesAdmin`,
 * que la recibe tal cual (tipado estructural): lib no importa de un componente.
 */
export interface CohorteVista {
  id: string;
  codigo: string;
  metaCupos: number;
  metaLeadsDia: number | null;
  precioUsd: string;
  fechaInicioClases: string;
  fechaInicioVentas: string | null;
  fechaCierreVentas: string;
  estado: Cohorte["estado"];
}

export interface FichaDelPrograma {
  programa: DatosDelPrograma;
  cohortes: CohorteVista[];
  checkouts: CheckoutDeLaFicha[];
  fuentes: FuenteDeLaFicha[];
  equipo: MiembroDeLaFicha[];
  plataformas: { id: string; nombre: string }[];
  plataformasDisponibles: { id: string; nombre: string }[];
}

/**
 * Una cohorte en la forma que pinta `CohortesAdmin` y la lista de la ficha. Vive aqui, y no
 * en el componente, porque el componente es de cliente y una pagina de servidor no puede
 * llamar a una funcion exportada desde un modulo `"use client"`.
 */
export function aCohorteVista(c: Cohorte): CohorteVista {
  return {
    id: c.id,
    codigo: c.codigo,
    metaCupos: c.metaCupos,
    metaLeadsDia: c.metaLeadsDia ?? null,
    precioUsd: String(c.precioUsd),
    fechaInicioClases: c.fechaInicioClases,
    fechaInicioVentas: c.fechaInicioVentas ?? null,
    fechaCierreVentas: c.fechaCierreVentas,
    estado: c.estado,
  };
}

/** Orden de las cohortes en la ficha: la activa primero, luego las futuras, luego las cerradas, y dentro, la mas nueva arriba. */
const ORDEN_DE_ESTADO: Record<CohorteVista["estado"], number> = { activo: 0, futuro: 1, cerrado: 2 };

/** La ficha del programa, o `null` si el id no existe. */
export async function fichaDelPrograma(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<FichaDelPrograma | null> {
  const programa = await programaPorId(db, programId);
  if (!programa) return null;

  const [cohortes, fuentes, enlaces, miembros, plataformas, catalogoDePlataformas] =
    await Promise.all([
      listarCohortes(db, programId),
      listarFuentes(db, programId),
      enlacesDePagoVigentes({ programId }, db),
      membresiasConCalendly(db, programId),
      plataformasDelPrograma(db, programId),
      plataformasDePago(db).listar({ soloActivos: true }),
    ]);
  const idsVinculados = new Set(plataformas.map((plataforma) => plataforma.id));

  return {
    programa: {
      id: String(programa.id),
      slug: String(programa.slug),
      nombre: String(programa.nombre),
      activo: Boolean(programa.activo),
      ticketUsd: String(programa.ticketUsd),
      comisionPorcentaje: programa.comisionPorcentaje == null ? null : String(programa.comisionPorcentaje),
      formUrl: (programa.formUrl as string | null) ?? null,
      formulario: formularioPrincipal(fuentes),
      calendlyUrl: (programa.calendlyUrl as string | null) ?? null,
      tieneTokenCalendly: programa.tieneTokenCalendly,
      webhookCalendlyConectado: programa.webhookCalendlyConectado,
      diasSinActividad: Number(programa.diasSinActividad),
    },
    cohortes: cohortes
      .map(aCohorteVista)
      .sort(
        (a, b) =>
          ORDEN_DE_ESTADO[a.estado] - ORDEN_DE_ESTADO[b.estado] ||
          b.fechaInicioClases.localeCompare(a.fechaInicioClases),
      ),
    checkouts: enlaces.map((e) => ({
      id: e.id,
      url: e.url,
      monto: String(e.monto),
      moneda: e.moneda,
      plataforma: e.plataformaNombre,
    })),
    fuentes: fuentes.map((f) => ({
      id: String(f.id),
      nombre: f.nombre,
      tipo: f.tipo,
      proveedor: f.proveedor,
      activo: Boolean(f.activo),
      estado: String(f.estado),
      urlPublica: f.urlPublica ?? null,
      principal: Boolean(f.principal),
    })),
    equipo: miembros.map((m) => ({
      membresiaId: m.id,
      userId: m.userId,
      nombre: m.usuario,
      email: m.emailUsuario,
      calendlyEmail: m.calendlyEmail,
    })),
    plataformas: plataformas.map(({ id, nombre }) => ({ id, nombre: String(nombre) })),
    plataformasDisponibles: catalogoDePlataformas
      .filter((plataforma) => !idsVinculados.has(plataforma.id))
      .map(({ id, nombre }) => ({ id, nombre: String(nombre) }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
  };
}

/** La fuente principal, si la hay (ADR 0068 punto 2: la base garantiza que es repartible). */
function formularioPrincipal(
  fuentes: readonly { nombre: string; urlPublica?: string | null; principal?: boolean }[],
): DatosDelPrograma["formulario"] {
  const principal = fuentes.find((f) => f.principal && f.urlPublica);
  return principal?.urlPublica ? { fuente: principal.nombre, url: principal.urlPublica } : null;
}

/**
 * Lo que la ficha dice sobre el destino del formulario. Es la respuesta de la ficha a "¿hay
 * a donde mandar un link de captacion?": sin fuente principal no hay link que repartir y se
 * dice, en vez de mostrar uno roto (ADR 0068 punto 4). El generador (092) hace la misma
 * pregunta con `destinoDeCaptacion`.
 */
export function avisoDelFormulario(formulario: DatosDelPrograma["formulario"]): string | null {
  return formulario
    ? null
    : "Este programa no tiene fuente principal: no hay a dónde mandar un link de captación. Márcala en Formularios.";
}

export type FaltaParaActivar = {
  clave: "forms_link" | "calendly_token" | "fuente_principal";
  texto: string;
};

/** Lista estable de lo que impide activar un programa. */
export function faltaParaActivar(
  programa: Pick<DatosDelPrograma, "formUrl" | "tieneTokenCalendly" | "formulario">,
): FaltaParaActivar[] {
  const faltan: FaltaParaActivar[] = [];
  if (!programa.formUrl) faltan.push({ clave: "forms_link", texto: "Forms Link" });
  if (!programa.tieneTokenCalendly) {
    faltan.push({ clave: "calendly_token", texto: "Calendly Token" });
  }
  if (!programa.formulario) {
    faltan.push({ clave: "fuente_principal", texto: "Fuente principal" });
  }
  return faltan;
}

type MapeoColumnas = Record<string, string | string[]>;

/** La vista completa de FuentesAdmin, acotada a un solo programa. */
export async function fuentesDelProgramaParaAdmin(
  programId: string,
  db: Db = dbDeLaApp,
): Promise<ProgramaConFuentes | null> {
  const { programas, fuentes } = await fuentesParaAdmin(db);
  const programa = programas.find((p) => p.id === programId);
  if (!programa) return null;
  const saludPorFuente = new Map((await saludDeFuentes(db)).map((s) => [s.sourceId, s]));

  return {
    id: programa.id,
    slug: programa.slug,
    nombre: programa.nombre,
    plantillaLead: (programa.plantillaLead as MapeoColumnas | null) ?? null,
    fuentes: fuentes
      .filter((fuente) => fuente.programId === programId)
      .map((fuente) => {
        const salud = saludPorFuente.get(fuente.id);
        return {
          id: fuente.id,
          programId: fuente.programId,
          nombre: fuente.nombre,
          tipo: fuente.tipo,
          sheetId: fuente.sheetId,
          tab: fuente.tab,
          rango: fuente.rango,
          mapeoColumnas: (fuente.mapeoColumnas as MapeoColumnas) ?? {},
          proveedor: fuente.proveedor,
          tieneSecreto: fuente.tieneSecreto,
          activo: fuente.activo,
          ultimaSync: fuente.ultimaSync ? fuente.ultimaSync.toISOString() : null,
          orden: fuente.orden,
          umbralSinRespuestaHoras: fuente.umbralSinRespuestaHoras,
          umbralMuertaHoras: fuente.umbralMuertaHoras,
          urlPublica: fuente.urlPublica ?? null,
          principal: Boolean(fuente.principal),
          salud: salud
            ? {
                estado: salud.estado,
                ultimoHace: haceCuanto(salud.ultimo),
                sobresPendientes: salud.sobresPendientes,
                sinCalidad: salud.sinCalidad,
              }
            : null,
        };
      }),
  };
}
