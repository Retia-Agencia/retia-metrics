import { eq, sql } from "drizzle-orm";
import type { PgTable } from "drizzle-orm/pg-core";
import { creadores as moldeCreadores } from "@/lib/catalogo/creadores";
import {
  calificaciones,
  candidatos,
  colecciones,
  coleccionesVideos,
  creadores,
  descartes,
  guionesLimpios,
  referentes,
  referentesSugeridos,
  referentesSugeridosTematicas,
  referentesTematicas,
  tandas,
  tematicas,
  transcripciones,
  trasladoCockpit,
  videosGrabados,
  videosReferentes,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esRedDeContenido } from "@/lib/media/redes";
import type { ExtraccionCockpit, FilaCockpit } from "./tipos";

/**
 * El traslado UNICO del cockpit al CRM (ticket 322, ADR 0111 punto 2b).
 *
 * - **Los creadores salen del molde** (`lib/catalogo/creadores`, ADR 0029): las "voces" del
 *   cockpit son los creadores del CRM. Si ya hay un creador con ese slug se REUTILIZA (no se
 *   duplica y no se registra en la huella, asi el deshacer no lo toca). Sin programa: asignarlo
 *   es decision de Mani.
 * - **El resto entra por lotes con huella** (`traslado_cockpit`): una fila por fila trasladada
 *   con su id en el cockpit. La huella es el rastro de este traslado, el reconocedor del
 *   deshacer y lo que vuelve idempotente una segunda corrida. Es una excepcion nombrada al
 *   "todo por el molde": son ~40.000 filas de datos, no de catalogo, y un `change_log` por fila
 *   las ahogaria (el mismo criterio de `ingerirEntradas` y del importador de gestion).
 * - **Lo que el cockpit no tenia no se inventa:** `colecciones.creador_id` nace nulo, y
 *   `tandas.creada_por` no se traslada (sus usuarios no existen en el CRM).
 * - **Una red desconocida falla ruidosamente** (nada se adivina): la lista cerrada es la de
 *   `lib/media/redes.ts`.
 *
 * Corre DENTRO de la transaccion del llamador: el ensayo la deshace al final.
 */

export interface ConteoDeTabla {
  origen: number;
  nuevas: number;
  yaTrasladadas: number;
  /** Filas del cockpit que no se trasladaron, con el motivo en `motivos`. */
  omitidas: number;
}
export interface ReporteCockpit {
  tablas: Record<string, ConteoDeTabla>;
  creadoresReutilizados: number;
  motivos: Record<string, number>;
}

const LOTE = 500;

type Fila = FilaCockpit;
type Refs = Map<string, Map<string, string>>;

const txt = (v: unknown): string | null => (typeof v === "string" && v.length > 0 ? v : null);
const txtObl = (v: unknown, que: string): string => {
  const t = txt(v);
  if (t === null) throw new Error(`El cockpit trae ${que} vacio.`);
  return t;
};
const num = (v: unknown): string | null => (v === null || v === undefined ? null : String(v));
const ent = (v: unknown): number | null => (v === null || v === undefined ? null : Number(v));
const fecha = (v: unknown): Date | null => (typeof v === "string" ? new Date(v) : null);
const fechaObl = (v: unknown): Date => fecha(v) ?? new Date();

function red(v: unknown): string {
  if (!esRedDeContenido(v)) throw new Error(`Red desconocida en el cockpit: "${String(v)}".`);
  return v;
}

export function slugDeCreador(nombre: string): string {
  return nombre
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

export async function importarCockpit(tx: Db, extraccion: ExtraccionCockpit, actorId: string): Promise<ReporteCockpit> {
  const t = extraccion.tablas;
  const reporte: ReporteCockpit = { tablas: {}, creadoresReutilizados: 0, motivos: {} };
  const refs: Refs = new Map();
  for (const f of await tx.select().from(trasladoCockpit)) {
    if (!refs.has(f.tabla)) refs.set(f.tabla, new Map());
    refs.get(f.tabla)!.set(f.refCockpit, f.filaId);
  }
  const conteo = (nombre: string, origen: number): ConteoDeTabla =>
    (reporte.tablas[nombre] ??= { origen, nuevas: 0, yaTrasladadas: 0, omitidas: 0 });
  const omitir = (nombre: string, motivo: string, n = 1) => {
    conteo(nombre, 0).omitidas += n;
    reporte.motivos[`${nombre}: ${motivo}`] = (reporte.motivos[`${nombre}: ${motivo}`] ?? 0) + n;
  };

  /** Inserta por lotes las filas con id propio y deja su huella. Devuelve cockpitId -> crmId. */
  async function colocar(
    tabla: PgTable,
    nombre: string,
    origen: Fila[],
    armar: (f: Fila) => { ref: string; valores: Record<string, unknown> } | null,
  ): Promise<Map<string, string>> {
    const c = conteo(nombre, origen.length);
    c.origen = origen.length;
    const mapa = refs.get(nombre) ?? new Map<string, string>();
    refs.set(nombre, mapa);
    const nuevas: { ref: string; id: string; valores: Record<string, unknown> }[] = [];
    for (const f of origen) {
      const a = armar(f);
      if (!a) continue;
      if (mapa.has(a.ref)) c.yaTrasladadas += 1;
      else nuevas.push({ ref: a.ref, id: crypto.randomUUID(), valores: a.valores });
    }
    for (let i = 0; i < nuevas.length; i += LOTE) {
      const lote = nuevas.slice(i, i + LOTE);
      await tx.insert(tabla as never).values(lote.map((x) => ({ id: x.id, ...x.valores })) as never);
      await tx
        .insert(trasladoCockpit)
        .values(lote.map((x) => ({ tabla: nombre, filaId: x.id, refCockpit: x.ref })));
      for (const x of lote) mapa.set(x.ref, x.id);
    }
    c.nuevas += nuevas.length;
    return mapa;
  }

  /** Puentes y filas sin id: cuelgan de un padre trasladado, que las arrastra al deshacer (cascade). */
  async function colgar(tabla: PgTable, nombre: string, origen: number, filas: Record<string, unknown>[]) {
    const c = conteo(nombre, origen);
    c.origen = origen;
    c.omitidas += origen - filas.length;
    for (let i = 0; i < filas.length; i += LOTE) {
      const lote = filas.slice(i, i + LOTE);
      const puestas = (await tx
        .insert(tabla as never)
        .values(lote as never)
        .onConflictDoNothing()
        .returning()) as unknown[];
      c.nuevas += puestas.length;
      c.yaTrasladadas += lote.length - puestas.length;
    }
  }

  // ── 1. Creadores: las voces del cockpit, por el molde del catalogo ──────────────────────────
  const huellaCreadores = (refs.get("creadores") ?? new Map<string, string>()) as Map<string, string>;
  refs.set("creadores", huellaCreadores);
  const creadorPorVoz = new Map<string, string>();
  const creadorPorNombre = new Map<string, string>();
  const cc = conteo("creadores", t.voces.length);
  for (const v of t.voces) {
    const vozId = txtObl(v.id, "una voz sin id");
    const nombre = txtObl(v.nombre, "una voz sin nombre");
    let id = huellaCreadores.get(vozId);
    if (id) cc.yaTrasladadas += 1;
    else {
      const slug = slugDeCreador(nombre);
      const [existente] = await tx
        .select({ id: creadores.id })
        .from(creadores)
        .where(eq(sql`lower(${creadores.slug})`, slug));
      if (existente) {
        id = existente.id;
        reporte.creadoresReutilizados += 1;
      } else {
        const nuevo = await moldeCreadores(tx).crear(actorId, { nombre, slug, cuentas: {}, programId: null });
        id = nuevo.id;
        await tx.insert(trasladoCockpit).values({ tabla: "creadores", filaId: id, refCockpit: vozId });
        huellaCreadores.set(vozId, id);
        cc.nuevas += 1;
      }
    }
    creadorPorVoz.set(vozId, id);
    creadorPorNombre.set(nombre.toLowerCase(), id);
  }
  const creadorDeVoz = (vozId: unknown): string | null => (typeof vozId === "string" ? (creadorPorVoz.get(vozId) ?? null) : null);

  // ── 2. Tematicas (los "proyectos") ──────────────────────────────────────────────────────────
  const tematicaPorProyecto = await colocar(tematicas, "tematicas", t.proyectos, (p) => {
    const creadorId = creadorDeVoz(p.voz_id);
    if (!creadorId) {
      omitir("tematicas", "su voz no existe");
      return null;
    }
    return {
      ref: txtObl(p.id, "un proyecto sin id"),
      valores: {
        creadorId,
        nombre: txtObl(p.nombre, "un proyecto sin nombre"),
        descripcion: txt(p.descripcion),
        criteriosRelevancia: String(p.criterios_relevancia ?? ""),
        criteriosAprendidos: txt(p.criterios_aprendidos),
        advertenciaCriterios: txt(p.advertencia_criterios),
        redes: ((p.plataformas as unknown[]) ?? []).map(red),
        metaEntrega: ent(p.n),
        activo: Boolean(p.activo),
        updatedAt: fechaObl(p.actualizado_en),
      },
    };
  });
  const tematicaDe = (id: unknown): string | null => (typeof id === "string" ? (tematicaPorProyecto.get(id) ?? null) : null);
  const tematicaPorClave = new Map<string, string | null>();
  for (const p of t.proyectos) {
    const id = tematicaDe(p.id);
    const creadorId = creadorDeVoz(p.voz_id);
    if (!id || !creadorId) continue;
    tematicaPorClave.set(`${creadorId}|${String(p.nombre).toLowerCase()}`, id);
    const solo = String(p.nombre).toLowerCase();
    tematicaPorClave.set(solo, tematicaPorClave.has(solo) ? null : id); // nulo = ambiguo
  }

  // ── 3. Referentes y su puente a las tematicas ───────────────────────────────────────────────
  const referentePorId = await colocar(referentes, "referentes", t.referentes, (r) => ({
    ref: txtObl(r.id, "un referente sin id"),
    valores: {
      handle: txtObl(r.handle, "un referente sin handle"),
      red: red(r.plataforma),
      notas: txt(r.notas),
      activo: Boolean(r.activo),
      updatedAt: fechaObl(r.actualizado_en),
    },
  }));
  const puente: Record<string, unknown>[] = [];
  for (const x of t.referentes_proyectos) {
    const referenteId = referentePorId.get(String(x.referente_id));
    const tematicaId = tematicaDe(x.proyecto_id);
    if (referenteId && tematicaId) puente.push({ referenteId, tematicaId });
  }
  await colgar(referentesTematicas, "referentes_tematicas", t.referentes_proyectos.length, puente);

  const sugeridoPorId = await colocar(referentesSugeridos, "referentes_sugeridos", t.referentes_propuestos, (r) => ({
    ref: txtObl(r.id, "un referente propuesto sin id"),
    valores: {
      handle: txtObl(r.handle, "un referente propuesto sin handle"),
      red: r.plataforma == null ? null : red(r.plataforma),
      afinidad: num(r.afinidad),
      razon: txt(r.razon),
      seguidores: ent(r.seguidores),
      bio: txt(r.bio),
      url: txt(r.url),
      semillas: txt(r.semillas),
      estado: txtObl(r.estado, "un referente propuesto sin estado"),
      createdAt: fechaObl(r.creado_en),
    },
  }));
  const puenteSugeridos: Record<string, unknown>[] = [];
  for (const x of t.referentes_propuestos_proyectos) {
    const sugeridoId = sugeridoPorId.get(String(x.propuesto_id));
    const tematicaId = tematicaDe(x.proyecto_id);
    if (sugeridoId && tematicaId) puenteSugeridos.push({ sugeridoId, tematicaId });
  }
  await colgar(
    referentesSugeridosTematicas,
    "referentes_sugeridos_tematicas",
    t.referentes_propuestos_proyectos.length,
    puenteSugeridos,
  );

  // ── 4. Tandas y transcripciones ─────────────────────────────────────────────────────────────
  const tandaPorId = await colocar(tandas, "tandas", t.tandas, (x) => ({
    ref: txtObl(x.id, "una tanda sin id"),
    valores: { titulo: txt(x.titulo), createdAt: fechaObl(x.creado_en) },
  }));
  await colocar(transcripciones, "transcripciones", t.transcripciones, (x) => ({
    ref: txtObl(x.id, "una transcripcion sin id"),
    valores: {
      red: red(x.plataforma),
      externalId: txtObl(x.external_id, "una transcripcion sin external_id"),
      url: String(x.url ?? ""),
      estado: txtObl(x.estado, "una transcripcion sin estado"),
      guion: txt(x.script),
      idioma: txt(x.idioma),
      error: txt(x.error),
      origen: txtObl(x.origen, "una transcripcion sin origen"),
      modo: txt(x.modo),
      coberturaSeg: num(x.cobertura_seg),
      duracionSeg: num(x.duracion_seg),
      tandaId: typeof x.tanda_id === "string" ? (tandaPorId.get(x.tanda_id) ?? null) : null,
      createdAt: fechaObl(x.creado_en),
      procesadaEn: fecha(x.procesado_en),
    },
  }));

  // ── 5. Guiones limpios ──────────────────────────────────────────────────────────────────────
  await colocar(guionesLimpios, "guiones_limpios", t.guiones_limpios, (x) => ({
    ref: `${red(x.plataforma)}:${txtObl(x.external_id, "un guion limpio sin external_id")}`,
    valores: {
      red: red(x.plataforma),
      externalId: String(x.external_id),
      creadorId: creadorDeVoz(x.voz_id),
      texto: String(x.texto ?? ""),
      modelo: txtObl(x.modelo, "un guion limpio sin modelo"),
      criteriosHash: txt(x.criterios_hash),
      updatedAt: fechaObl(x.actualizado_en),
    },
  }));

  // ── 6. Colecciones, sus videos, lo grabado y la meta de cada video ──────────────────────────
  const coleccionPorId = await colocar(colecciones, "colecciones", t.colecciones, (x) => ({
    ref: txtObl(x.id, "una coleccion sin id"),
    valores: {
      creadorId: null,
      nombre: txtObl(x.nombre, "una coleccion sin nombre"),
      createdAt: fechaObl(x.creado_en),
      updatedAt: fechaObl(x.actualizado_en),
    },
  }));
  const videosDeColeccion: Record<string, unknown>[] = [];
  for (const x of t.colecciones_videos) {
    const coleccionId = coleccionPorId.get(String(x.coleccion_id));
    if (!coleccionId) continue;
    videosDeColeccion.push({
      coleccionId,
      red: red(x.plataforma),
      externalId: String(x.external_id),
      url: String(x.url ?? ""),
      agregadoEn: fechaObl(x.agregado_en),
    });
  }
  await colgar(coleccionesVideos, "colecciones_videos", t.colecciones_videos.length, videosDeColeccion);

  await colocar(videosReferentes, "videos_referentes", t.videos_meta, (x) => ({
    ref: `${red(x.plataforma)}:${txtObl(x.external_id, "un video sin external_id")}`,
    valores: {
      red: red(x.plataforma),
      externalId: String(x.external_id),
      titulo: txt(x.titulo),
      referente: txt(x.referente),
      miniaturaUrl: txt(x.thumbnail_url),
      vistas: ent(x.views),
      meGusta: ent(x.likes),
      seguidores: ent(x.seguidores),
      duracionSeg: num(x.duracion_seg),
      fuente: txtObl(x.fuente, "un video sin fuente"),
      traidoEn: fechaObl(x.traido_en),
    },
  }));
  await colocar(videosGrabados, "videos_grabados", t.grabados, (x) => ({
    ref: txtObl(x.id, "un grabado sin id"),
    valores: {
      red: red(x.plataforma),
      externalId: txtObl(x.external_id, "un grabado sin external_id"),
      url: String(x.url ?? ""),
      grabadoEn: fechaObl(x.grabado_en),
    },
  }));

  // ── 7. Candidatos, descartes y lo calificado ────────────────────────────────────────────────
  await colocar(candidatos, "candidatos", t.candidatos, (x) => ({
    ref: txtObl(x.id, "un candidato sin id"),
    valores: {
      creadorId: creadorDeVoz(x.voz_id),
      tematicaId: tematicaDe(x.proyecto_id),
      externalId: txt(x.external_id),
      titulo: txtObl(x.titulo, "un candidato sin titulo"),
      guion: txt(x.script),
      idioma: txt(x.idioma),
      miniaturaUrl: txt(x.thumbnail_url),
      referente: txt(x.referente),
      urlReferente: txt(x.url_referente),
      vistas: ent(x.views),
      meGusta: ent(x.likes),
      seguidores: ent(x.seguidores),
      engagement: num(x.engagement),
      heatScore: num(x.heat_score),
      prescoreMetrico: num(x.prescore_metrico),
      relevanciaScore: num(x.relevancia_score),
      relevanciaRazon: txt(x.relevancia_razon),
      viralPorTamano: Boolean(x.viral_por_tamano),
      calificacion: txt(x.calificacion),
      estado: txtObl(x.estado, "un candidato sin estado"),
      calificadoEn: fecha(x.fecha_calificacion),
      notasEquipo: txt(x.notas_equipo),
      huellaGuion: txt(x.huella_guion),
      duracionSeg: num(x.duracion_seg),
      coberturaSeg: num(x.cobertura_seg),
      origen: txtObl(x.origen, "un candidato sin origen"),
      fuenteTranscript: txt(x.fuente_transcript),
      publicadoEn: fecha(x.publicado_en),
      corridaExterna: txt(x.run_id),
      createdAt: fechaObl(x.creado_en),
    },
  }));
  await colocar(descartes, "descartes", t.descartes, (x) => ({
    ref: txtObl(x.id, "un descarte sin id"),
    valores: {
      tematicaId: tematicaDe(x.proyecto_id),
      externalId: txt(x.external_id),
      titulo: txtObl(x.titulo, "un descarte sin titulo"),
      guion: txt(x.script),
      referente: txt(x.referente),
      urlReferente: txt(x.url_referente),
      relevanciaScore: num(x.relevancia_score),
      relevanciaRazon: txt(x.relevancia_razon),
      miniaturaUrl: txt(x.thumbnail_url),
      veredicto: txt(x.veredicto),
      origen: txtObl(x.origen, "un descarte sin origen"),
      createdAt: fechaObl(x.creado_en),
    },
  }));
  await colocar(calificaciones, "calificaciones", t.calificados, (o) => {
    const m = (o.metadata ?? {}) as Fila;
    const creadorId = typeof m.voz === "string" ? (creadorPorNombre.get(m.voz.toLowerCase()) ?? null) : null;
    const nombreTematica = typeof m.proyecto === "string" ? m.proyecto.toLowerCase() : null;
    const tematicaId = nombreTematica
      ? ((creadorId && tematicaPorClave.get(`${creadorId}|${nombreTematica}`)) || tematicaPorClave.get(nombreTematica) || null)
      : null;
    if (!tematicaId) contarSinTematica();
    return {
      ref: txtObl(o.id, "una calificacion sin id"),
      valores: {
        creadorId,
        tematicaId,
        externalId: txt(o.external_id),
        titulo: txtObl(o.titulo, "una calificacion sin titulo"),
        guion: String(o.contenido_o_link ?? ""),
        resultado: txtObl(o.estado, "una calificacion sin estado"),
        calificacion: txt(m.calificacion),
        referente: txt(m.referente),
        urlReferente: txt(m.url_referente),
        idioma: txt(m.idioma),
        vistas: ent(m.views),
        meGusta: ent(m.likes),
        seguidores: ent(m.seguidores),
        engagement: num(m.engagement),
        heatScore: num(m.heat_score),
        relevanciaScore: num(m.relevancia_score),
        relevanciaRazon: txt(m.relevancia_razon),
        viralPorTamano: typeof m.viral_por_tamano === "boolean" ? m.viral_por_tamano : null,
        notasEquipo: txt(m.notas_equipo),
        calificadaEn: fecha(o.calificado_en),
        createdAt: fechaObl(o.creado_en),
      },
    };
  });

  /** Una calificacion sin tematica se traslada igual (lo calificado es historia), pero se cuenta aparte. */
  function contarSinTematica() {
    reporte.motivos["calificaciones: sin tematica resuelta (se traslada con tematica nula)"] =
      (reporte.motivos["calificaciones: sin tematica resuelta (se traslada con tematica nula)"] ?? 0) + 1;
  }

  return reporte;
}
