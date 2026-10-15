import { max, min } from "drizzle-orm";
import { gastoPauta, tasasCambio } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { desplazarFecha, fechaBogotaSchema } from "./fecha";
import { leerTrmPublicada, type TrmPublicada } from "./fuente";

const FUENTE = "datos.gov.co 32sa-8pi3";

type DbEscritura = Pick<Db, "insert">;

export async function registrarTasa(db: DbEscritura, fila: TrmPublicada): Promise<void> {
  await db.insert(tasasCambio).values({
    vigenteDesde: fila.vigenteDesde,
    vigenteHasta: fila.vigenteHasta,
    pesosPorDolar: String(fila.pesosPorDolar),
    fuente: FUENTE,
    leidaEn: new Date(),
  }).onConflictDoUpdate({
    target: tasasCambio.vigenteDesde,
    set: {
      vigenteHasta: fila.vigenteHasta,
      pesosPorDolar: String(fila.pesosPorDolar),
      fuente: FUENTE,
      leidaEn: new Date(),
    },
  });
}

export async function leerTrm(
  db: Db,
  opciones: { hoy: string; fetchImpl?: typeof fetch },
): Promise<{ leidas: number; desde: string; hasta: string }> {
  const hoy = fechaBogotaSchema.parse(opciones.hoy);
  const [[{ primeraTasa, ultima }], [{ primerGasto }]] = await Promise.all([
    db.select({ primeraTasa: min(tasasCambio.vigenteDesde), ultima: max(tasasCambio.vigenteDesde) })
      .from(tasasCambio),
    db.select({ primerGasto: min(gastoPauta.fecha) }).from(gastoPauta),
  ]);
  // Lo normal es repasar la última semana. Pero un gasto anterior a la primera tasa guardada
  // (uno manual cargado tarde) también tiene que poder convertirse: el relleno baja hasta él.
  let desde = ultima ? desplazarFecha(ultima, -7) : primerGasto ?? desplazarFecha(hoy, -30);
  if (primeraTasa && primerGasto && primerGasto < primeraTasa) desde = primerGasto;
  const hasta = desplazarFecha(hoy, 1);
  const filas = await leerTrmPublicada(desde, hasta, opciones.fetchImpl);

  await db.transaction(async (tx) => {
    for (const fila of filas) await registrarTasa(tx, fila);
  });

  return { leidas: filas.length, desde, hasta };
}
