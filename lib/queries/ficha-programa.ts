import { db as dbDeLaApp } from "@/lib/db";
import type { Cohorte } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { listarCohortes } from "@/lib/catalogo/cohortes";
import { listarFuentes } from "@/lib/catalogo/fuentes";
import { programaPorId } from "@/lib/catalogo/programas";
import { membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { enlacesDePagoVigentes } from "@/lib/queries/recursos";

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
  /** El destino del formulario (ADR 0057). Nulo = no hay a donde mandar un link. */
  formUrl: string | null;
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

  const [cohortes, fuentes, enlaces, miembros] = await Promise.all([
    listarCohortes(db, programId),
    listarFuentes(db, programId),
    enlacesDePagoVigentes({ programId }, db),
    membresiasConCalendly(db, programId),
  ]);

  return {
    programa: {
      id: String(programa.id),
      slug: String(programa.slug),
      nombre: String(programa.nombre),
      activo: Boolean(programa.activo),
      ticketUsd: String(programa.ticketUsd),
      comisionPorcentaje: programa.comisionPorcentaje == null ? null : String(programa.comisionPorcentaje),
      formUrl: (programa.formUrl as string | null) ?? null,
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
    })),
    equipo: miembros.map((m) => ({
      membresiaId: m.id,
      userId: m.userId,
      nombre: m.usuario,
      email: m.emailUsuario,
      calendlyEmail: m.calendlyEmail,
    })),
  };
}

/**
 * Lo que la ficha dice sobre el destino del formulario. Es la respuesta de la ficha a "¿hay
 * a donde mandar un link de captacion?": sin URL, no hay link que repartir y se dice, en vez
 * de mostrar uno roto. El generador de links (ticket 092) lo resuelve con la fuente
 * principal (ADR 0068); hasta entonces el destino es `programs.form_url`.
 */
export function avisoDelFormulario(formUrl: string | null): string | null {
  return formUrl
    ? null
    : "Este programa no tiene URL del formulario: no hay a dónde mandar un link de captación, y el programa no se puede activar de nuevo sin ella.";
}
