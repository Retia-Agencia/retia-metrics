import { and, eq, lt } from "drizzle-orm";

import type { Almacen } from "@/lib/archivos/almacen";
import type { Espejo } from "@/lib/archivos/espejo";
import { extensionDeTipo, TIPOS_PERMITIDOS, type TipoPermitido } from "@/lib/archivos/reglas";
import { abonos, archivos, cohorts, deals, leads, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { fechaDeInstanteEnBogota, monto } from "@/lib/format";
import { incluyendoAnulados } from "@/lib/queries/vigente";

export type ResumenRespaldo = {
  subidos: number;
  movidos: number;
  sinCambios: number;
  barridos: number;
  errores: string[];
};

const UN_DIA_MS = 24 * 60 * 60 * 1000;
const CARACTERES_INVALIDOS = /[\\/:*?"<>|\u0000-\u001f]/g;

function nombreSeguro(nombre: string): string {
  return nombre.replace(CARACTERES_INVALIDOS, "-");
}

function extensionPara(tipoMime: string): string {
  if (!TIPOS_PERMITIDOS.includes(tipoMime as TipoPermitido)) {
    throw new Error("El tipo MIME del archivo no es válido.");
  }
  return extensionDeTipo(tipoMime as TipoPermitido);
}

function valorSinMoneda(valor: string | number, moneda: string): string {
  const legible = monto(Number(valor), moneda);
  const prefijo = `${moneda} `;
  return legible.startsWith(prefijo) ? legible.slice(prefijo.length) : legible;
}

/**
 * Reconcilia el espejo derivado y limpia subidas que nunca se confirmaron.
 *
 * ponytail: hoy se hace una llamada `ubicacion` a Drive por archivo y corrida. Si
 * el volumen crece, guardar el ultimo nombre/padre reflejado en `archivos` permite
 * comparar localmente y reservar la consulta remota para reparar divergencias.
 */
export async function respaldarComprobantes(
  db: Db,
  almacen: Almacen,
  espejo: Espejo | null,
  raizId: string | null,
  ahora: Date,
): Promise<ResumenRespaldo> {
  const limitePendientes = new Date(ahora.getTime() - UN_DIA_MS);
  const [filasArchivos, filasAbonos, filasDeals, filasLeads, filasCohortes, filasProgramas] =
    await Promise.all([
      db.select().from(archivos),
      db.select().from(abonos).where(incluyendoAnulados(abonos)),
      db.select().from(deals).where(incluyendoAnulados(deals)),
      db.select().from(leads),
      db.select().from(cohorts),
      db.select().from(programs),
    ]);

  const resumen: ResumenRespaldo = {
    subidos: 0,
    movidos: 0,
    sinCambios: 0,
    barridos: 0,
    errores: [],
  };
  const abonoPorArchivo = new Map(
    filasAbonos
      .filter((abono) => abono.comprobanteArchivoId)
      .map((abono) => [abono.comprobanteArchivoId as string, abono]),
  );
  const dealPorId = new Map(filasDeals.map((deal) => [deal.id, deal]));
  const leadPorId = new Map(filasLeads.map((lead) => [lead.id, lead]));
  const cohortePorId = new Map(filasCohortes.map((cohorte) => [cohorte.id, cohorte]));
  const programaPorId = new Map(filasProgramas.map((programa) => [programa.id, programa]));
  const carpetas = new Map<string, string>();

  async function asegurarCarpeta(nombre: string, padreId: string): Promise<string> {
    if (!espejo) throw new Error("El espejo no está configurado.");
    const seguro = nombreSeguro(nombre);
    const clave = `${padreId}\u0000${seguro}`;
    const conocida = carpetas.get(clave);
    if (conocida) return conocida;
    const id = await espejo.asegurarCarpeta(seguro, padreId);
    carpetas.set(clave, id);
    return id;
  }

  if (espejo && raizId) {
    for (const archivo of filasArchivos.filter((fila) => fila.estado === "listo")) {
      try {
        const programa = programaPorId.get(archivo.programId);
        if (!programa) throw new Error("El programa del archivo no existe.");
        const carpetaPrograma = await asegurarCarpeta(programa.nombre, raizId);
        const abono = abonoPorArchivo.get(archivo.id);
        let carpetaFinal: string;
        let nombre: string;

        if (abono) {
          const deal = dealPorId.get(abono.dealId);
          if (!deal) throw new Error("El deal del abono no existe.");
          const lead = leadPorId.get(deal.leadId);
          const cohorte = deal.cohortId ? cohortePorId.get(deal.cohortId) : null;
          carpetaFinal = await asegurarCarpeta(cohorte?.codigo ?? "Sin cohorte", carpetaPrograma);
          const persona = lead?.nombre || "Sin nombre";
          const prefijo = abono.anuladoEn ? "ANULADO " : "";
          nombre = nombreSeguro(
            `${prefijo}${abono.fecha} ${persona} ${abono.moneda} ` +
              `${valorSinMoneda(abono.monto, abono.moneda)} (${archivo.id.slice(0, 6)}).` +
              extensionPara(archivo.tipoMime),
          );
        } else {
          carpetaFinal = await asegurarCarpeta("Sin abono", carpetaPrograma);
          nombre = nombreSeguro(
            `${fechaDeInstanteEnBogota(archivo.createdAt)} (${archivo.id.slice(0, 6)}).` +
              extensionPara(archivo.tipoMime),
          );
        }

        if (!archivo.driveFileId) {
          const bytes = await almacen.leer(archivo.ruta);
          if (!bytes) throw new Error("El objeto no existe en el almacén.");
          const fileId = await espejo.subir({
            nombre,
            padreId: carpetaFinal,
            tipoMime: archivo.tipoMime,
            bytes,
            archivoId: archivo.id,
          });
          await db.update(archivos).set({ driveFileId: fileId, respaldadoEn: ahora })
            .where(eq(archivos.id, archivo.id));
          resumen.subidos++;
          continue;
        }

        const ubicacion = await espejo.ubicacion(archivo.driveFileId);
        if (!ubicacion) {
          const bytes = await almacen.leer(archivo.ruta);
          if (!bytes) throw new Error("El objeto no existe en el almacén.");
          const fileId = await espejo.subir({
            nombre,
            padreId: carpetaFinal,
            tipoMime: archivo.tipoMime,
            bytes,
            archivoId: archivo.id,
          });
          await db.update(archivos).set({ driveFileId: fileId, respaldadoEn: ahora })
            .where(eq(archivos.id, archivo.id));
          resumen.subidos++;
          continue;
        }

        if (ubicacion.nombre !== nombre || ubicacion.padreId !== carpetaFinal) {
          await espejo.mover(archivo.driveFileId, { nombre, padreId: carpetaFinal });
          resumen.movidos++;
        } else {
          resumen.sinCambios++;
        }
        await db.update(archivos).set({ respaldadoEn: ahora }).where(eq(archivos.id, archivo.id));
      } catch (error) {
        console.error(`[respaldo] archivo ${archivo.id}:`, error instanceof Error ? error.message : error);
        resumen.errores.push(`No se pudo respaldar el archivo ${archivo.id}.`);
      }
    }
  } else {
    resumen.errores.push("El espejo de Drive no está configurado; se omitió el respaldo.");
  }

  const pendientesViejos = await db.select().from(archivos).where(and(
    eq(archivos.estado, "pendiente"),
    lt(archivos.createdAt, limitePendientes),
  ));
  for (const archivo of pendientesViejos) {
    if (abonoPorArchivo.has(archivo.id)) continue;
    try {
      await almacen.borrar(archivo.ruta);
      await db.delete(archivos).where(and(
        eq(archivos.id, archivo.id),
        eq(archivos.estado, "pendiente"),
      ));
      resumen.barridos++;
    } catch (error) {
      console.error(`[respaldo] barrido ${archivo.id}:`, error instanceof Error ? error.message : error);
      resumen.errores.push(`No se pudo barrer el archivo pendiente ${archivo.id}.`);
    }
  }

  return resumen;
}
