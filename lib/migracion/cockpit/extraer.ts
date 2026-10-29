import { TABLAS_DEL_COCKPIT, type ExtraccionCockpit, type FilaCockpit, type TablaDelCockpit } from "./tipos";

/**
 * Lee, SOLO LECTURA, las tablas del cockpit por su REST (PostgREST). Nunca escribe: solo hace
 * `GET`. Cada tabla se filtra por el tenant (`client_id` en las que lo tienen, `instance_id` en
 * las demas) para que el traslado de un cliente no arrastre filas de otro (ADR 0111 punto 3).
 */
export interface ConexionCockpit {
  url: string;
  llave: string;
  /** `fetch` inyectable para los tests. */
  fetch?: typeof fetch;
}

const PAGINA = 1000; // tope de filas por consulta de PostgREST

interface Origen {
  esquema: "app" | "public";
  tabla: string;
  /** Filtro PostgREST adicional, ya sin el tenant. */
  filtro?: string;
  /** Columnas por las que ordenar: la paginacion necesita un orden estable. */
  orden: string;
  /** Cual columna lleva el tenant: `client_id`, `instance_id` o ninguna (se filtra por padre). */
  tenant?: "client_id" | "instance_id";
}

const ORIGENES: Record<TablaDelCockpit, Origen> = {
  voces: { esquema: "app", tabla: "voces", orden: "id", tenant: "client_id" },
  proyectos: { esquema: "app", tabla: "proyectos", orden: "id", tenant: "client_id" },
  referentes: { esquema: "app", tabla: "referentes", orden: "id", tenant: "client_id" },
  referentes_proyectos: { esquema: "app", tabla: "referentes_proyectos", orden: "referente_id,proyecto_id" },
  referentes_propuestos: { esquema: "app", tabla: "referentes_propuestos", orden: "id", tenant: "instance_id" },
  referentes_propuestos_proyectos: {
    esquema: "app",
    tabla: "referentes_propuestos_proyectos",
    orden: "propuesto_id,proyecto_id",
  },
  candidatos: { esquema: "app", tabla: "candidatos", orden: "id", tenant: "instance_id" },
  calificados: { esquema: "public", tabla: "outputs", filtro: "tipo=eq.guion_reel", orden: "id", tenant: "instance_id" },
  descartes: { esquema: "app", tabla: "descartes", orden: "id", tenant: "instance_id" },
  tandas: { esquema: "app", tabla: "tandas", orden: "id", tenant: "instance_id" },
  transcripciones: { esquema: "app", tabla: "transcripciones", orden: "id", tenant: "instance_id" },
  guiones_limpios: { esquema: "app", tabla: "guiones_limpios", orden: "plataforma,external_id", tenant: "instance_id" },
  colecciones: { esquema: "app", tabla: "colecciones", orden: "id", tenant: "instance_id" },
  colecciones_videos: {
    esquema: "app",
    tabla: "colecciones_videos",
    orden: "coleccion_id,plataforma,external_id",
    tenant: "instance_id",
  },
  videos_meta: { esquema: "app", tabla: "videos_meta", orden: "plataforma,external_id", tenant: "instance_id" },
  grabados: { esquema: "app", tabla: "grabados", orden: "id", tenant: "instance_id" },
};

export async function extraerDelCockpit(
  conexion: ConexionCockpit,
  opciones: { cliente: string; instanceId: string },
): Promise<ExtraccionCockpit> {
  const f = conexion.fetch ?? fetch;
  const cabeceras = (esquema: string) => ({
    apikey: conexion.llave,
    Authorization: `Bearer ${conexion.llave}`,
    "Accept-Profile": esquema,
  });

  async function leer(origen: Origen): Promise<FilaCockpit[]> {
    const filtros: string[] = [];
    if (origen.tenant === "client_id") filtros.push(`client_id=eq.${encodeURIComponent(opciones.cliente)}`);
    if (origen.tenant === "instance_id") filtros.push(`instance_id=eq.${opciones.instanceId}`);
    if (origen.filtro) filtros.push(origen.filtro);
    const filas: FilaCockpit[] = [];
    for (let desde = 0; ; desde += PAGINA) {
      const partes = ["select=*", `order=${origen.orden}`, `limit=${PAGINA}`, `offset=${desde}`, ...filtros];
      const r = await f(`${conexion.url}/rest/v1/${origen.tabla}?${partes.join("&")}`, {
        headers: cabeceras(origen.esquema),
      });
      if (!r.ok) throw new Error(`El cockpit respondio ${r.status} al leer ${origen.tabla}.`);
      const pagina = (await r.json()) as FilaCockpit[];
      filas.push(...pagina);
      if (pagina.length < PAGINA) return filas;
    }
  }

  const tablas = {} as Record<TablaDelCockpit, FilaCockpit[]>;
  for (const nombre of TABLAS_DEL_COCKPIT) tablas[nombre] = await leer(ORIGENES[nombre]);

  // Las tablas puente no llevan tenant: se acotan a los padres que si lo llevan.
  const proyectos = new Set(tablas.proyectos.map((p) => p.id));
  const referentes = new Set(tablas.referentes.map((r) => r.id));
  tablas.referentes_proyectos = tablas.referentes_proyectos.filter(
    (x) => referentes.has(x.referente_id) && proyectos.has(x.proyecto_id),
  );
  const propuestos = new Set(tablas.referentes_propuestos.map((r) => r.id));
  tablas.referentes_propuestos_proyectos = tablas.referentes_propuestos_proyectos.filter(
    (x) => propuestos.has(x.propuesto_id) && proyectos.has(x.proyecto_id),
  );

  return { cliente: opciones.cliente, extraidoEn: new Date().toISOString(), tablas };
}
