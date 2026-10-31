import { and, eq, isNull } from "drizzle-orm";
import { changeLog, pautaObjetos, reportesWhatsapp } from "@/lib/db/schema";
import { textoDeBitacora } from "@/lib/db/texto-de-bitacora";
import type { Db } from "@/lib/db/tipos";

export type PropositoCampana = "agenda" | "lanzamiento";

export interface AsignacionDeProposito {
  codigo: string;
  proposito: PropositoCampana;
}

export interface ParseoDePropositos {
  asignaciones: AsignacionDeProposito[];
  sinProposito: string[];
  ambiguos: string[][];
}

export async function idsDeCampanas(db: Db): Promise<string[]> {
  const filas = await db.select({ idMeta: pautaObjetos.idMeta }).from(pautaObjetos)
    .where(eq(pautaObjetos.nivel, "campana"));
  return filas.map((fila) => fila.idMeta);
}

export function codigoCortoDeCampana(idMeta: string, idsDeTodasLasCampanas: readonly string[]): string {
  let largo = Math.min(4, idMeta.length);
  while (largo < idMeta.length) {
    const codigo = idMeta.slice(-largo);
    if (idsDeTodasLasCampanas.filter((id) => id.endsWith(codigo)).length === 1) return codigo;
    largo += 1;
  }
  return idMeta;
}

export function parsearClasificacionDeCampanas(texto: string): ParseoDePropositos | null {
  const asignaciones = new Map<string, PropositoCampana>();
  const sinProposito: string[] = [];
  const ambiguos: string[][] = [];
  let tieneCodigos = false;
  const trozos = texto.toLocaleLowerCase("es-CO").split(/[,;·\n]+/)
    .map((trozo) => trozo.trim())
    .filter(Boolean);
  for (const trozo of trozos) {
    const codigos: string[] = [];
    const marcas: string[] = [];
    for (const token of trozo.split(/\s+/)) {
      if (/^#?\d{4,}$/.test(token)) codigos.push(token.replace(/^#/, ""));
      else if (/^(?:a|l|agenda|lanzamiento|lanz)$/.test(token)) marcas.push(token);
      else return null;
    }
    if (codigos.length === 0) continue;
    tieneCodigos = true;
    const propositos = new Set<PropositoCampana>(marcas.map((marca) =>
      marca === "agenda" || marca === "a" ? "agenda" : "lanzamiento"
    ));
    if (propositos.size !== 1) {
      if (propositos.size === 0) sinProposito.push(...codigos);
      else ambiguos.push(codigos);
      continue;
    }
    const [proposito] = propositos;
    for (const codigo of codigos) asignaciones.set(codigo, proposito);
  }
  if (!tieneCodigos) return null;
  return {
    asignaciones: [...asignaciones].map(([codigo, valor]) => ({ codigo, proposito: valor })),
    sinProposito,
    ambiguos,
  };
}

function nombreDelProposito(proposito: PropositoCampana): string {
  return proposito === "agenda" ? "Agenda" : "Lanzamiento";
}

export async function clasificarCampanas(
  db: Db,
  args: {
    texto: string;
    destino: string | null;
    autor: { nombre: string | null; telefono: string | null };
  },
): Promise<string | null> {
  const parseo = parsearClasificacionDeCampanas(args.texto);
  if (parseo === null) return null;
  if (parseo.asignaciones.length === 0) {
    const avisos = parseo.sinProposito.map((codigo) => `⚠️ ${codigo} necesita agenda o lanzamiento`);
    avisos.push(...parseo.ambiguos.map((codigos) => `⚠️ ${codigos.join(" ")}: pon solo A o L`));
    avisos.push("Responde con el código y A (agenda) o L (lanzamiento), por ejemplo: 4521 A, 8830 L");
    return avisos.join("\n");
  }

  const idsGlobales = await idsDeCampanas(db);
  return db.transaction(async (tx) => {
    const campanas = await tx.select({
      id: pautaObjetos.id,
      programId: pautaObjetos.programId,
      idMeta: pautaObjetos.idMeta,
      nombre: pautaObjetos.nombre,
      proposito: pautaObjetos.proposito,
    }).from(pautaObjetos).innerJoin(
      reportesWhatsapp,
      eq(reportesWhatsapp.programId, pautaObjetos.programId),
    ).where(and(
      eq(pautaObjetos.nivel, "campana"),
      eq(reportesWhatsapp.activo, true),
      args.destino === null
        ? isNull(reportesWhatsapp.destino)
        : eq(reportesWhatsapp.destino, args.destino),
    ));
    const exitos: string[] = [];
    const avisos = parseo.sinProposito.map((codigo) => `⚠️ ${codigo} necesita agenda o lanzamiento`);
    avisos.push(...parseo.ambiguos.map((codigos) => `⚠️ ${codigos.join(" ")}: pon solo A o L`));
    const autor = args.autor.nombre?.trim() || args.autor.telefono?.trim() || "Autor desconocido";
    for (const asignacion of parseo.asignaciones) {
      const coincidencias = campanas.filter((campana) => campana.idMeta.endsWith(asignacion.codigo));
      if (coincidencias.length === 0) {
        avisos.push(`⚠️ No encontré ${asignacion.codigo}`);
        continue;
      }
      if (coincidencias.length > 1) {
        const codigos = coincidencias.map(
          (campana) => `#${codigoCortoDeCampana(campana.idMeta, idsGlobales)}`,
        );
        avisos.push(`⚠️ El código ${asignacion.codigo} coincide con ${coincidencias.length} campañas, usa: ${codigos.join(", ")}`);
        continue;
      }
      const [campana] = coincidencias;
      exitos.push(`${campana.nombre} → ${nombreDelProposito(asignacion.proposito)}`);
      if (campana.proposito === asignacion.proposito) continue;
      await tx.update(pautaObjetos)
        .set({ proposito: asignacion.proposito })
        .where(eq(pautaObjetos.id, campana.id));
      await tx.insert(changeLog).values({
        tabla: "pauta_objetos",
        registroId: campana.id,
        etiqueta: `${campana.nombre} · ${autor} por WhatsApp`,
        campo: "proposito",
        valorAnterior: textoDeBitacora(campana.proposito),
        valorNuevo: textoDeBitacora(asignacion.proposito),
        origen: "whatsapp",
        userId: null,
      });
    }

    const lineas: string[] = [];
    if (exitos.length > 0) {
      lineas.push(`✅ ${exitos.join(" · ")}. Cuenta desde el próximo semáforo.`);
    }
    lineas.push(...avisos);
    if (lineas.length === 0) {
      lineas.push("Responde con el código y A (agenda) o L (lanzamiento), por ejemplo: 4521 A, 8830 L");
    }
    return lineas.join("\n");
  });
}
