import { notFound } from "next/navigation";
import { and, asc, count, desc, inArray, sql } from "drizzle-orm";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programasVisibles } from "@/lib/auth/alcance";
import { esRolValido, trabajaContenido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { piezas, tiposPieza } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { UTM_MEDIUM_CONTENIDO } from "@/lib/atribucion/canal";
import { desglosarLink } from "@/lib/atribucion/parametros-de-contenido";
import { linkDePieza } from "@/lib/atribucion/link-de-pieza";
import { hoyEnBogota } from "@/lib/format";
import { creadoresVisibles, veCreadoresSinPrograma } from "@/lib/media/piezas";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import { vigente } from "@/lib/queries/vigente";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  PestanasDeMedia,
  PESTANAS_DE_MEDIA,
  SIN_PROGRAMA,
  hrefDeMedia,
  pestanaValida,
} from "@/components/media/pestanas-de-media";
import { PanelDeMedia } from "@/components/media/panel-de-media";
import type { EstadoDePieza, PiezaVista } from "@/components/media/tipos";
import { InfoUtmDeMedia } from "@/components/media/info-utm";

/**
 * La pagina de media (ADR 0107, tickets 316, 317 y 321): donde aterriza quien
 * `trabajaContenido` hasta que exista su vista completa (321). La guarda deja pasar a media y
 * gerente; el developer pasa por `esAccesoTotal`, y la pregunta de fondo se repite sobre el rol
 * de VISTA. Los creadores salen filtrados por el alcance; los links se arman aqui, nunca se guardan.
 */
const POR_PAGINA = 15;

export default async function MediaPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; programa?: string; pagina?: string }>;
}) {
  const session = await paginaConRol("media", "gerente");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol) || !trabajaContenido(rol)) notFound();

  const actor = { id: session.user.id, rol };
  const pedido = (await searchParams) ?? {};
  const tab = pestanaValida(pedido.tab);
  const visibles = await programasVisibles(session.user.id, rol);
  const conSinPrograma = await veCreadoresSinPrograma(actor);
  // El programa de la URL solo vale si esta en el alcance: cualquier otro valor equivale a "todos".
  const programa =
    pedido.programa === SIN_PROGRAMA
      ? conSinPrograma ? SIN_PROGRAMA : undefined
      : visibles.find((p) => p.id === pedido.programa)?.id;
  const todos = await creadoresVisibles(actor);
  const lista = programa === undefined ? todos : todos.filter((c) => (programa === SIN_PROGRAMA ? c.programId === null : c.programId === programa));
  const nombreDePrograma = new Map(visibles.map((p) => [p.id, p.nombre]));
  const tipos = await db
    .select({ id: tiposPieza.id, nombre: tiposPieza.nombre, activo: tiposPieza.activo })
    .from(tiposPieza)
    .orderBy(asc(tiposPieza.nombre));
  const nombreDeTipo = new Map(tipos.map((t) => [t.id, t.nombre]));
  const tiposActivos = tipos.filter((t) => t.activo).map(({ id, nombre }) => ({ id, nombre }));

  // Las piezas se paginan en la base: la pagina arma el link solo de las 15 que muestra.
  const ids = lista.map((c) => c.id);
  const dePieza = ids.length > 0 ? and(inArray(piezas.creadorId, ids), vigente(piezas)) : sql`false`;
  const [{ n: total }] = await db.select({ n: count() }).from(piezas).where(dePieza);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const pagina = Math.min(Math.max(1, Number.parseInt(pedido.pagina ?? "1", 10) || 1), paginas);
  const filas = ids.length === 0 ? [] : await db
    .select()
    .from(piezas)
    .where(dePieza)
    .orderBy(sql`${piezas.fechaPublicacion} desc nulls first`, desc(piezas.createdAt))
    .limit(POR_PAGINA)
    .offset((pagina - 1) * POR_PAGINA);

  const creadorDe = new Map(lista.map((c) => [c.id, c]));
  const hoy = hoyEnBogota();
  const vistas: PiezaVista[] = await Promise.all(
    filas.map(async (p) => {
      let link: PiezaVista["link"];
      try {
        const url = await linkDePieza(db, p.id);
        link = { ok: true, url, desglose: desglosarLink(url, REDES_DE_CONTENIDO) };
      } catch (e) {
        if (!(e instanceof ErrorDeApp)) throw e;
        link = { ok: false, motivo: e.message };
      }
      const estado: EstadoDePieza = p.publicadaEn !== null
        ? "publicada"
        : p.permanente ? "fija" : p.fechaPublicacion && p.fechaPublicacion < hoy ? "atrasada" : "programada";
      const creador = creadorDe.get(p.creadorId);
      return {
        id: p.id,
        creador: creador?.nombre ?? "—",
        programa: creador?.programId ? (nombreDePrograma.get(creador.programId) ?? "otro programa") : null,
        tipo: nombreDeTipo.get(p.tipoId) ?? "—",
        red: p.red,
        cta: p.cta,
        fecha: p.fechaPublicacion,
        permanente: p.permanente,
        estado,
        link,
      };
    }),
  );

  return (
    <PageShell titulo="Media" descripcion="Los creadores y su contenido: cada pieza tiene su link.">
      <div className="space-y-6">
        <PestanasDeMedia
          tab={tab}
          programa={programa}
          programas={visibles.map((p) => ({ id: p.id, nombre: p.nombre }))}
          conSinPrograma={conSinPrograma}
        />
        {tab === "creadores" ? (
          <>
            <PanelDeMedia
              piezas={vistas}
              total={total}
              opciones={{
                redes: REDES_DE_CONTENIDO,
                tipos: tiposActivos,
                programas: visibles.map((p) => ({ id: p.id, nombre: p.nombre })),
                creadores: lista
                  .filter((c) => c.activo)
                  .map((c) => ({ id: c.id, nombre: c.nombre, slug: c.slug, programa: c.programId ? (nombreDePrograma.get(c.programId) ?? "otro programa") : null })),
                conSinPrograma,
                programaInicial: programa && programa !== SIN_PROGRAMA ? programa : "",
                medioDeContenido: UTM_MEDIUM_CONTENIDO,
              }}
            />
            {paginas > 1 ? (
              <nav aria-label="Páginas" className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Página {pagina} de {paginas}</span>
                <span className="flex gap-2">
                  {pagina > 1 ? <Button variant="outline" size="sm" render={<Link href={hrefDeMedia(tab, programa, pagina - 1)} />}>Anterior</Button> : null}
                  {pagina < paginas ? <Button variant="outline" size="sm" render={<Link href={hrefDeMedia(tab, programa, pagina + 1)} />}>Siguiente</Button> : null}
                </span>
              </nav>
            ) : null}
          </>
        ) : tab === "info" ? (
          <InfoUtmDeMedia medio={UTM_MEDIUM_CONTENIDO} redes={REDES_DE_CONTENIDO} />
        ) : (
          <p className="max-w-prose rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {PESTANAS_DE_MEDIA.find((p) => p.id === tab)?.vacia}
          </p>
        )}
      </div>
    </PageShell>
  );
}
