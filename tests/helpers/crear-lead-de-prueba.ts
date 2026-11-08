import { randomUUID } from "node:crypto";
import { leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * La fecha con la que nace un lead de formulario en los tests. Desde la migracion 0119 la base
 * rechaza un lead de formulario sin `fecha_primera_aplicacion` (CHECK `leads_formulario_con_fecha`,
 * ADR 0121). Es fija y lejana (antes de cualquier rango que un test consulte) para que sembrar un
 * lead no lo meta, sin querer, en una metrica por fecha: antes de la 0119 estos leads tenian la
 * fecha en null y tampoco caian en ningun rango.
 */
export const FECHA_LEAD_DE_PRUEBA = new Date("2020-01-01T12:00:00-05:00");

type LeadNuevo = typeof leads.$inferInsert;

/**
 * Inserta UN lead con valores validos y devuelve la fila. `programId` es obligatorio (el programa
 * es frontera, no un defecto); el correo sale unico si no se pasa. Un lead `entrada: "crm"` nace
 * sin fecha, como en la app, salvo que el test la pida. Para sembrar muchos o con una forma
 * especial, escribe el `insert(leads)` y agrega `fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA`.
 */
export async function crearLeadDePrueba(
  db: Db,
  datos: Partial<LeadNuevo> & Pick<LeadNuevo, "programId">,
) {
  const entrada = datos.entrada ?? "formulario";
  const [lead] = await db
    .insert(leads)
    .values({
      emailNormalizado: `lead-${randomUUID()}@correo.co`,
      ...(entrada === "formulario" ? { fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA } : {}),
      ...datos,
    })
    .returning();
  return lead;
}
