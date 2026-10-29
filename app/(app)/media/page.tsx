import { notFound } from "next/navigation";
import { asc } from "drizzle-orm";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programasVisibles } from "@/lib/auth/alcance";
import { esRolValido, trabajaContenido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { tiposPieza } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { UTM_MEDIUM_CONTENIDO } from "@/lib/atribucion/canal";
import { desglosarLink } from "@/lib/atribucion/parametros-de-contenido";
import { linkDePieza } from "@/lib/atribucion/link-de-pieza";
import { hoyEnBogota } from "@/lib/format";
import { creadoresVisibles, veCreadoresSinPrograma } from "@/lib/media/piezas";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import { ORDENES_DE_PIEZAS, filtroDePiezasDesdeUrl, hayFiltroActivo, piezasDeMedia } from "@/lib/media/lista-de-piezas";
import { ESTADOS_DE_PIEZA, estadoDePieza } from "@/lib/media/estado-de-pieza";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import { ESTADOS } from "@/components/media/estado-de-pieza";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import {
  PestanasDeMedia,
  PESTANAS_DE_MEDIA,
  SIN_PROGRAMA,
  pestanaValida,
} from "@/components/media/pestanas-de-media";
import { PanelDeMedia } from "@/components/media/panel-de-media";
import type { PiezaVista } from "@/components/media/tipos";
import { InfoUtmDeMedia } from "@/components/media/info-utm";

/**
 * La pagina de media (ADR 0107, tickets 316, 317 y 321): donde aterriza quien
 * `trabajaContenido` hasta que exista su vista completa (321). La guarda deja pasar a media y
 * gerente; el developer pasa por `esAccesoTotal`, y la pregunta de fondo se repite sobre el rol
 * de VISTA. Los creadores salen filtrados por el alcance; los links se arman aqui, nunca se guardan.
 */
export default async function MediaPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
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

  // Filtros, orden y pagina se resuelven en la base; el link se arma solo de las 15 que se muestran.
  const filtro = filtroDePiezasDesdeUrl(pedido);
  const hoy = hoyEnBogota();
  const { filas, total, paginas, pagina } = await piezasDeMedia(
    db,
    lista.map((c) => c.id),
    filtro,
    hoy,
    Number.parseInt(pedido.pagina ?? "1", 10) || 1,
  );

  const creadorDe = new Map(lista.map((c) => [c.id, c]));
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
      const estado = estadoDePieza(p, hoy);
      const creador = creadorDe.get(p.creadorId);
      return {
        id: p.id,
        nombre: p.nombre,
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

  const filtros: FiltroDeclarado[] = [
    { tipo: "select", nombre: "estado", etiqueta: "Estado", opciones: ESTADOS_DE_PIEZA.map((e) => ({ value: e, label: ESTADOS[e].texto })) },
    { tipo: "select", nombre: "creador", etiqueta: "Creador", todos: "Todos los creadores", opciones: lista.map((c) => ({ value: c.id, label: c.nombre })) },
    { tipo: "select", nombre: "tipo", etiqueta: "Tipo", todos: "Todos los tipos", opciones: tipos.map((t) => ({ value: t.id, label: t.nombre })) },
    { tipo: "select", nombre: "red", etiqueta: "Red", todos: "Todas las redes", opciones: REDES_DE_CONTENIDO.map((r) => ({ value: r, label: r })) },
  ];
  // La paginacion conserva los filtros: solo cambia `pagina`.
  const hrefDePagina = (n: number) => {
    const q = new URLSearchParams(Object.entries(pedido).filter((e): e is [string, string] => typeof e[1] === "string" && e[0] !== "pagina"));
    if (n > 1) q.set("pagina", String(n));
    const t = q.toString();
    return t ? `/media?${t}` : "/media";
  };

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
              filtrado={hayFiltroActivo(filtro)}
              barra={
                <BarraDeLista
                  total={total}
                  sustantivo={{ singular: "pieza", plural: "piezas" }}
                  filtros={filtros}
                  buscador={<BuscadorUrl placeholder="Buscar por nombre de pieza, creador o tipo" />}
                  clavesCompuestas={["q"]}
                  compuestoActivo={filtro.q !== ""}
                  orden={<ControlDeOrden nombre="orden" valor={filtro.orden} opciones={ORDENES_DE_PIEZAS.map((o) => ({ value: o.value, label: o.label }))} />}
                />
              }
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
                  {pagina > 1 ? <Button variant="outline" size="sm" render={<Link href={hrefDePagina(pagina - 1)} />}>Anterior</Button> : null}
                  {pagina < paginas ? <Button variant="outline" size="sm" render={<Link href={hrefDePagina(pagina + 1)} />}>Siguiente</Button> : null}
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
