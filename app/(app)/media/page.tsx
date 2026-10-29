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
import { creadoresVisibles } from "@/lib/media/piezas";
import { REDES_DE_CONTENIDO } from "@/lib/media/redes";
import { vigente } from "@/lib/queries/vigente";
import { PageShell } from "@/components/page-shell";
import { PanelDeMedia, type CreadorVista } from "@/components/media/panel-de-media";

/**
 * La pagina minima de media (ADR 0107, tickets 316 y 317): donde aterriza quien
 * `trabajaContenido` hasta que exista su vista completa (321). La guarda deja pasar a media y
 * gerente; el developer pasa por `esAccesoTotal`, y la pregunta de fondo se repite sobre el rol
 * de VISTA. Los creadores salen filtrados por el alcance; los links se arman aqui, nunca se guardan.
 */
export default async function MediaPage() {
  const session = await paginaConRol("media", "gerente");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol) || !trabajaContenido(rol)) notFound();

  const lista = await creadoresVisibles({ id: session.user.id, rol });
  const visibles = await programasVisibles(session.user.id, rol);
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
      <PanelDeMedia
        creadores={creadores}
        opciones={{ redes: REDES_DE_CONTENIDO, tipos, programas: visibles.map((p) => ({ id: p.id, nombre: p.nombre })) }}
      />
    </PageShell>
  );
}
