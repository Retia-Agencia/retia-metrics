import { asc } from "drizzle-orm";
import type { Rol } from "@/lib/auth/roles";
import { programasVisibles } from "@/lib/auth/alcance";
import { desglosarLink } from "@/lib/atribucion/parametros-de-contenido";
import { UTM_MEDIUM_CONTENIDO } from "@/lib/atribucion/canal";
import { linkDePieza } from "@/lib/atribucion/link-de-pieza";
import { tiposPieza } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { estadoDePieza } from "@/lib/media/estado-de-pieza";
import { filtroDePiezasDesdeUrl, piezasDeMedia } from "@/lib/media/lista-de-piezas";
import { creadoresVisibles, linksFijosVisibles, veCreadoresSinPrograma } from "@/lib/media/piezas";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import type { CreadorConLinksVista, OpcionesDeMedia, PiezaVista } from "@/components/media/tipos";
import { SIN_PROGRAMA, pestanaValida } from "@/components/media/pestanas-de-media";

type Busqueda = Record<string, string | undefined>;

export async function cargarDatosDeMedia(db: Db, entrada: { userId: string; rol: Rol; pedido: Busqueda; hoy: string }) {
  const actor = { id: entrada.userId, rol: entrada.rol };
  const tab = pestanaValida(entrada.pedido.tab);
  const visibles = await programasVisibles(entrada.userId, entrada.rol, db);
  const conSinPrograma = await veCreadoresSinPrograma(actor, db);
  const programa = entrada.pedido.programa === SIN_PROGRAMA
    ? conSinPrograma ? SIN_PROGRAMA : undefined
    : visibles.find((fila) => fila.id === entrada.pedido.programa)?.id;
  const todos = await creadoresVisibles(actor, db);
  const lista = programa === undefined ? todos : todos.filter((creador) => programa === SIN_PROGRAMA ? creador.programId === null : creador.programId === programa);
  const nombreDePrograma = new Map(visibles.map((fila) => [fila.id, fila.nombre]));
  const tipos = await db.select({ id: tiposPieza.id, nombre: tiposPieza.nombre, activo: tiposPieza.activo }).from(tiposPieza).orderBy(asc(tiposPieza.nombre));
  const nombreDeTipo = new Map(tipos.map((tipo) => [tipo.id, tipo.nombre]));
  const linksFijos = (await linksFijosVisibles(actor, db, todos)).filter((pieza) => lista.some((creador) => creador.id === pieza.creadorId));
  async function resolverLink(piezaId: string): Promise<PiezaVista["link"]> {
    try {
      const url = await linkDePieza(db, piezaId);
      return { ok: true, url, desglose: desglosarLink(url, REDES_DE_CONTENIDO) };
    } catch (error) {
      if (!(error instanceof ErrorDeApp)) throw error;
      return { ok: false, motivo: error.message };
    }
  }
  const filtro = filtroDePiezasDesdeUrl(entrada.pedido);
  const { filas, total, paginas, pagina } = await piezasDeMedia(db, lista.map((creador) => creador.id), filtro, entrada.hoy, Number.parseInt(entrada.pedido.pagina ?? "1", 10) || 1);
  const creadorDe = new Map(lista.map((creador) => [creador.id, creador]));
  const vistas: PiezaVista[] = await Promise.all(filas.map(async (pieza) => {
    const creador = creadorDe.get(pieza.creadorId);
    return {
      id: pieza.id, nombre: pieza.nombre, creador: creador?.nombre ?? "—",
      programa: creador?.programId ? (nombreDePrograma.get(creador.programId) ?? "otro programa") : null,
      tipo: nombreDeTipo.get(pieza.tipoId) ?? "—", red: pieza.red, cta: pieza.cta,
      fecha: pieza.fechaPublicacion, permanente: pieza.permanente, estado: estadoDePieza(pieza, entrada.hoy),
      link: await resolverLink(pieza.id),
    };
  }));
  const creadoresConLinks: CreadorConLinksVista[] = await Promise.all(lista.map(async (creador) => ({
    id: creador.id, nombre: creador.nombre,
    programa: creador.programId ? (nombreDePrograma.get(creador.programId) ?? "otro programa") : null,
    activo: creador.activo,
    links: await Promise.all(linksFijos.filter((pieza) => pieza.creadorId === creador.id).map(async (pieza) => ({ id: pieza.id, red: pieza.red, link: await resolverLink(pieza.id) }))),
  })));
  const opciones: OpcionesDeMedia = {
    redes: REDES_DE_CONTENIDO,
    tipos: tipos.filter((tipo) => tipo.activo).map(({ id, nombre }) => ({ id, nombre })),
    programas: visibles.map((fila) => ({ id: fila.id, nombre: fila.nombre })),
    creadores: lista.filter((creador) => creador.activo).map((creador) => ({ id: creador.id, nombre: creador.nombre, slug: creador.slug, programa: creador.programId ? (nombreDePrograma.get(creador.programId) ?? "otro programa") : null })),
    conSinPrograma, programaInicial: programa && programa !== SIN_PROGRAMA ? programa : "", medioDeContenido: UTM_MEDIUM_CONTENIDO,
  };
  return { tab, visibles, conSinPrograma, programa, lista, tipos, filtro, total, paginas, pagina, vistas, creadoresConLinks, opciones };
}
