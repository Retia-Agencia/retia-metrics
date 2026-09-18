import "./load-env";
import { readFileSync } from "node:fs";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../lib/db";
import { enlacesPago, plataformasPago, productos, programs } from "../lib/db/schema";
import { crearEnlacePago, esquemaEnlacePago } from "../lib/catalogo/enlaces-pago";
import { actorDelScript } from "./actor";

/**
 * Carga los enlaces de pago (ADR 0017, ticket 022). NO escribe ningun link en el
 * codigo: los links son datos sensibles y cambian con la TRM del momento, asi que
 * viven fuera del repo. El ticket pide cargar los 5 links de PayPal de Comunicarte
 * (797, 697, 400, 300 y 200 USD), pero esos datos los carga Mani despues; este
 * script solo sabe COMO cargarlos.
 *
 * La fuente es un archivo JSON fuera del repo, cuya ruta se pasa por la variable de
 * entorno `ENLACES_PAGO_JSON`. Si no esta configurada, el script falla con un
 * mensaje que dice exactamente que configurar (nunca inventa datos ni pone
 * placeholders que parezcan reales).
 *
 * El archivo es un array de filas con esta forma (los ids se resuelven por
 * nombre/slug, para que el archivo sea legible y no dependa de uuids de la base):
 *
 *   [
 *     {
 *       "programa": "comunicarte",       // slug del programa
 *       "plataforma": "PayPal",          // nombre de la plataforma de pago
 *       "producto": "Programa completo", // opcional: nombre del producto
 *       "monto": "797.00",
 *       "moneda": "USD",
 *       "url": "https://..."
 *     }
 *   ]
 *
 * Cada fila se crea con la MISMA funcion que usa la pantalla (`crearEnlacePago`),
 * no con un `db.insert` en crudo (ADR 0029). De ahi salen gratis la validacion con
 * el esquema zod de la entidad y la fila de `change_log` con quien y cuando. El
 * "quien" lo da `SCRIPT_ACTOR_EMAIL` (ver `scripts/actor.ts`): un script que
 * escribe en una base viva tiene que decir quien esta actuando.
 *
 * Es idempotente: una fila que ya existe (mismo programa, plataforma, monto, moneda
 * y url, vigente y activa) no se duplica.
 */

/** Forma de cada fila en el JSON externo, antes de resolver los ids. */
const esquemaFilaCruda = z.object({
  programa: z.string().min(1, "Falta el slug del programa."),
  plataforma: z.string().min(1, "Falta el nombre de la plataforma."),
  producto: z.string().min(1).optional(),
  monto: z.string(),
  moneda: z.string().optional(),
  url: z.string(),
});

function rutaDelJson(): string {
  const ruta = process.env.ENLACES_PAGO_JSON;
  if (!ruta) {
    throw new Error(
      "Falta ENLACES_PAGO_JSON en .env.local. Debe ser la RUTA a un archivo JSON " +
        "fuera del repo con los enlaces de pago (un array de filas con programa, " +
        "plataforma, producto opcional, monto, moneda y url). Los links no se " +
        "escriben en el codigo (ADR 0017): pide el archivo a Mani y apunta la " +
        "variable a su ruta local.",
    );
  }
  return ruta;
}

async function idPorSlugPrograma(slug: string): Promise<string> {
  const [fila] = await db.select().from(programs).where(eq(programs.slug, slug)).limit(1);
  if (!fila) throw new Error(`No existe un programa con slug "${slug}". Siembra los programas primero.`);
  return fila.id;
}

async function idPorNombrePlataforma(nombre: string): Promise<string> {
  const [fila] = await db.select().from(plataformasPago).where(eq(plataformasPago.nombre, nombre)).limit(1);
  if (!fila) {
    throw new Error(
      `No existe una plataforma de pago "${nombre}". Creala en /ajustes/catalogos o siembra las plataformas primero.`,
    );
  }
  return fila.id;
}

async function idPorNombreProducto(programId: string, nombre: string): Promise<string> {
  const [fila] = await db
    .select()
    .from(productos)
    .where(and(eq(productos.programId, programId), eq(productos.nombre, nombre)))
    .limit(1);
  if (!fila) throw new Error(`No existe el producto "${nombre}" en ese programa.`);
  return fila.id;
}

async function yaExiste(datos: {
  programId: string;
  plataformaId: string;
  monto: string;
  moneda: string;
  url: string;
}): Promise<boolean> {
  const filas = await db
    .select({ id: enlacesPago.id })
    .from(enlacesPago)
    .where(
      and(
        eq(enlacesPago.programId, datos.programId),
        eq(enlacesPago.plataformaId, datos.plataformaId),
        eq(enlacesPago.monto, datos.monto),
        eq(enlacesPago.moneda, datos.moneda),
        eq(enlacesPago.url, datos.url),
        eq(enlacesPago.vigente, true),
        eq(enlacesPago.activo, true),
      ),
    )
    .limit(1);
  return filas.length > 0;
}

async function main() {
  const ruta = rutaDelJson();
  // Antes de leer nada: si no hay a quien atribuirle los cambios, el script no
  // arranca. Falla aca y no a mitad de la carga, con filas ya escritas.
  const userId = await actorDelScript();

  let crudo: unknown;
  try {
    crudo = JSON.parse(readFileSync(ruta, "utf8"));
  } catch (e) {
    throw new Error(`No pude leer o parsear ${ruta}: ${(e as Error).message}`);
  }

  const filas = z.array(esquemaFilaCruda).parse(crudo);
  console.log(`Cargando ${filas.length} enlace(s) de pago desde ${ruta}\n`);

  let insertados = 0;
  let saltados = 0;
  for (const [i, fila] of filas.entries()) {
    const programId = await idPorSlugPrograma(fila.programa);
    const plataformaId = await idPorNombrePlataforma(fila.plataforma);
    const productoId = fila.producto ? await idPorNombreProducto(programId, fila.producto) : undefined;

    // Se valida con el MISMO esquema zod de la entidad: si un monto o una url no
    // cumplen (por ejemplo un http://), la carga falla ruidosamente en esa fila.
    let datos;
    try {
      datos = esquemaEnlacePago.parse({
        programId,
        plataformaId,
        productoId,
        monto: fila.monto,
        moneda: fila.moneda ?? "USD",
        url: fila.url,
      });
    } catch (e) {
      if (e instanceof z.ZodError) {
        throw new Error(`Fila ${i + 1} invalida: ${e.issues.map((x) => x.message).join("; ")}`);
      }
      throw e;
    }

    if (await yaExiste({ programId, plataformaId, monto: datos.monto, moneda: datos.moneda, url: datos.url })) {
      console.log(`  = ${fila.programa} / ${fila.plataforma} / ${datos.monto} ${datos.moneda} (ya existe)`);
      saltados += 1;
      continue;
    }

    // Por el molde, no por `db.insert`: valida, crea la fila vigente y deja el
    // rastro en `change_log` igual que si alguien la hubiera creado desde la app.
    await crearEnlacePago(db, userId, {
      programId,
      plataformaId,
      productoId: datos.productoId,
      monto: datos.monto,
      moneda: datos.moneda,
      url: datos.url,
    });
    console.log(`  + ${fila.programa} / ${fila.plataforma} / ${datos.monto} ${datos.moneda}`);
    insertados += 1;
  }

  console.log(`\nCarga completa: ${insertados} insertado(s), ${saltados} ya existia(n).\n`);
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error("Fallo:", e instanceof Error ? e.message : e);
    process.exit(1);
  });
