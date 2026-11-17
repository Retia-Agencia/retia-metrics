import { notFound } from "next/navigation";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido, trabajaContenido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { UTM_MEDIUM_CONTENIDO } from "@/lib/atribucion/canal";
import { hoyEnBogota } from "@/lib/format";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import { ORDENES_DE_PIEZAS, hayFiltroActivo } from "@/lib/media/lista-de-piezas";
import { ESTADOS_DE_PIEZA } from "@/lib/media/estado-de-pieza";
import { BarraDeLista, ControlDeOrden } from "@/components/filtros/barra-de-lista";
import { BuscadorUrl } from "@/components/filtros/buscador-url";
import type { FiltroDeclarado } from "@/components/filtros/declaracion";
import { ESTADOS } from "@/components/media/estado-de-pieza";
import { PageShell } from "@/components/page-shell";
import { Button } from "@/components/ui/button";
import { Enlace } from "@/components/enlace";
import {
  PestanasDeMedia,
  PESTANAS_DE_MEDIA,
} from "@/components/media/pestanas-de-media";
import { PanelDeMedia } from "@/components/media/panel-de-media";
import { PanelDeCreadores } from "@/components/media/panel-de-creadores";
import { InfoUtmDeMedia } from "@/components/media/info-utm";
import { cargarDatosDeMedia } from "@/lib/media/cargar-datos";

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

  const pedido = (await searchParams) ?? {};
  const hoy = hoyEnBogota();
  const { tab, visibles, conSinPrograma, programa, lista, tipos, filtro, total, paginas, pagina, vistas, creadoresConLinks, opciones } = await cargarDatosDeMedia(db, {
    userId: session.user.id, rol, pedido, hoy,
  });

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
              opciones={opciones}
            />
            {paginas > 1 ? (
              <nav aria-label="Páginas" className="flex items-center justify-between text-sm text-muted-foreground">
                <span>Página {pagina} de {paginas}</span>
                <span className="flex gap-2">
                  {pagina > 1 ? <Button variant="outline" size="sm" render={<Enlace precarga="nunca" href={hrefDePagina(pagina - 1)} />}>Anterior</Button> : null}
                  {pagina < paginas ? <Button variant="outline" size="sm" render={<Enlace precarga="nunca" href={hrefDePagina(pagina + 1)} />}>Siguiente</Button> : null}
                </span>
              </nav>
            ) : null}
          </>
        ) : tab === "links" ? (
          <PanelDeCreadores creadores={creadoresConLinks} opciones={opciones} />
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
