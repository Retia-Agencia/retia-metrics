import { notFound } from "next/navigation";
import { and, asc, eq } from "drizzle-orm";
import { paginaConRol } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { programasVisibles } from "@/lib/auth/alcance";
import { esRolValido, trabajaContenido } from "@/lib/auth/roles";
import { db } from "@/lib/db";
import { piezas, tiposPieza } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { linkDePieza } from "@/lib/atribucion/link-de-pieza";
import { creadoresVisibles, veCreadoresSinPrograma } from "@/lib/media/piezas";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import { vigente } from "@/lib/queries/vigente";
import { PageShell } from "@/components/page-shell";
import {
  PestanasDeMedia,
  PESTANAS_DE_MEDIA,
  SIN_PROGRAMA,
  pestanaValida,
} from "@/components/media/pestanas-de-media";
import { PanelDeMedia, type CreadorVista } from "@/components/media/panel-de-media";

/**
 * La pagina minima de media (ADR 0107, tickets 316 y 317): donde aterriza quien
 * `trabajaContenido` hasta que exista su vista completa (321). La guarda deja pasar a media y
 * gerente; el developer pasa por `esAccesoTotal`, y la pregunta de fondo se repite sobre el rol
 * de VISTA. Los creadores salen filtrados por el alcance; los links se arman aqui, nunca se guardan.
 */
export default async function MediaPage({
  searchParams,
}: {
  searchParams?: Promise<{ tab?: string; programa?: string }>;
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
    .select({ id: tiposPieza.id, nombre: tiposPieza.nombre })
    .from(tiposPieza)
    .where(eq(tiposPieza.activo, true))
    .orderBy(asc(tiposPieza.nombre));
  const nombreDeTipo = new Map(tipos.map((t) => [t.id, t.nombre]));
  const todosLosTipos = await db.select({ id: tiposPieza.id, nombre: tiposPieza.nombre }).from(tiposPieza);
  for (const t of todosLosTipos) nombreDeTipo.set(t.id, t.nombre);

  const creadores: CreadorVista[] = await Promise.all(
    lista.map(async (c) => {
      const filas = await db
        .select()
        .from(piezas)
        .where(and(eq(piezas.creadorId, c.id), vigente(piezas)))
        .orderBy(asc(piezas.fechaPublicacion), asc(piezas.createdAt));
      return {
        id: c.id,
        nombre: c.nombre,
        activo: c.activo,
        programa: c.programId ? (nombreDePrograma.get(c.programId) ?? "otro programa") : null,
        piezas: await Promise.all(
          filas.map(async (p) => {
            let link: CreadorVista["piezas"][number]["link"];
            try {
              link = { ok: true, url: await linkDePieza(db, p.id) };
            } catch (e) {
              if (!(e instanceof ErrorDeApp)) throw e;
              link = { ok: false, motivo: e.message };
            }
            return {
              id: p.id,
              tipo: nombreDeTipo.get(p.tipoId) ?? "—",
              red: p.red,
              cta: p.cta,
              fecha: p.fechaPublicacion,
              permanente: p.permanente,
              publicada: p.publicadaEn !== null,
              link,
            };
          }),
        ),
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
          <PanelDeMedia
            creadores={creadores}
            opciones={{
              redes: REDES_DE_CONTENIDO,
              tipos,
              programas: visibles.map((p) => ({ id: p.id, nombre: p.nombre })),
              conSinPrograma,
              programaInicial: programa && programa !== SIN_PROGRAMA ? programa : "",
            }}
          />
        ) : (
          <p className="max-w-prose rounded-lg border border-dashed p-6 text-sm text-muted-foreground">
            {PESTANAS_DE_MEDIA.find((p) => p.id === tab)?.vacia}
          </p>
        )}
      </div>
    </PageShell>
  );
}
