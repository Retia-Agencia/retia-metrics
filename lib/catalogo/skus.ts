import { and, asc, desc, eq, min } from "drizzle-orm";
import { z } from "zod";
import { META_LEADS_DIA_POR_DEFECTO } from "@/lib/cohortes-por-defecto";
import { changeLog, cohorts, programs, skus, users } from "@/lib/db/schema";
import { esViolacionExclusion, esViolacionUnica } from "@/lib/db/errores";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando as normalizandoZod } from "@/lib/errors-zod";
import { normalizarProducto } from "./normalizar-producto";
import { codigoDeSku } from "./codigo-de-sku";
import { heredarUmbrales, type HerenciaDeUmbrales } from "./objetivos";
export { codigoDeSku } from "./codigo-de-sku";

const esquemaId = z.string().uuid("El identificador no es válido.");

const monto = (etiqueta: string) =>
  z.string().trim().regex(/^\d+(\.\d{1,2})?$/, `${etiqueta} debe ser un monto (por ejemplo 797 o 797.00).`);

const fechaIso = (etiqueta: string) =>
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${etiqueta} debe tener formato AAAA-MM-DD.`);

const esquemaVentana = z.object({
  fechaInicioVentas: fechaIso("La fecha de inicio de ventas").optional(),
  fechaCierreVentas: fechaIso("La fecha de cierre de ventas").optional(),
  metaCupos: z.coerce.number().int("La meta de cupos debe ser un entero.").nonnegative("La meta de cupos no puede ser negativa.").optional(),
  metaLeadsDia: z.coerce.number().int("La meta de leads debe ser un entero.").nonnegative("La meta de leads no puede ser negativa.").default(META_LEADS_DIA_POR_DEFECTO),
}).superRefine((ventana, ctx) => {
  if (ventana.fechaInicioVentas && ventana.fechaCierreVentas && ventana.fechaCierreVentas < ventana.fechaInicioVentas) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fechaCierreVentas"],
      message: "El cierre de ventas no puede ser anterior al inicio de ventas.",
    });
  }
});

/** Única validación compartida por el alta, la edición y la futura pantalla de SKU. */
export const esquemaSku = z.object({
  programId: z.string().uuid("Programa inválido."),
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Máximo 80 caracteres."),
  cohorteN: z.coerce.number().int("La cohorte debe ser un entero.").min(1, "La cohorte debe ser al menos 1."),
  precioListaUsd: monto("El precio de lista"),
  comisionPorcentaje: z.coerce.number()
    .min(0, "La comisión debe estar entre 0 y 100.")
    .max(100, "La comisión debe estar entre 0 y 100.")
    .refine((valor) => /^\d+(\.\d{1,2})?$/.test(String(valor)), "La comisión debe tener máximo dos decimales."),
  cuentaComoCupo: z.boolean().default(false),
  predeterminado: z.boolean().default(false),
  ventana: esquemaVentana.optional(),
});

export type EntradaSku = z.input<typeof esquemaSku>;
type SkuValidado = z.output<typeof esquemaSku>;

function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  return parsed.data;
}

function aTexto(valor: unknown): string | null {
  return valor === null || valor === undefined ? null : String(valor);
}

function decimal(valor: string | number): string {
  return Number(valor).toFixed(2);
}

async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  return normalizandoZod(async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ErrorDeApp) throw error;
      if (esViolacionExclusion(error)) {
        throw new ErrorDeApp(
          "Las fechas de venta se solapan con otra cohorte de este programa. Ajusta el inicio o el cierre para que no compartan ningún día.",
          400,
        );
      }
      throw error;
    }
  });
}

function rastroDeAlta(tabla: "skus" | "cohorts", registroId: string, etiqueta: string, actorId: string, valores: Record<string, unknown>) {
  return Object.entries(valores).map(([campo, valor]) => ({
    tabla,
    registroId,
    etiqueta,
    campo,
    valorAnterior: null,
    valorNuevo: aTexto(valor),
    origen: "app" as const,
    userId: actorId,
  }));
}

async function insertarSku(tx: Db, actorId: string, datos: SkuValidado, programaSlug: string, cohortId: string) {
  const id = crypto.randomUUID();
  const slug = normalizarProducto(datos.nombre);
  const codigo = codigoDeSku(programaSlug, datos.nombre, datos.cohorteN);
  const valores = {
    programId: datos.programId,
    nombre: datos.nombre,
    slug,
    productoId: null,
    cohortId,
    codigo,
    precioListaUsd: decimal(datos.precioListaUsd),
    comisionPorcentaje: decimal(datos.comisionPorcentaje),
    cuentaComoCupo: datos.cuentaComoCupo,
    predeterminado: datos.predeterminado,
  };
  try {
    const [creado] = await tx.insert(skus).values({ id, ...valores }).returning();
    await tx.insert(changeLog).values(rastroDeAlta("skus", id, codigo, actorId, valores));
    return creado;
  } catch (error) {
    if (esViolacionUnica(error)) {
      throw new ErrorDeApp(`Ya existe ese SKU en la cohorte C${datos.cohorteN}.`, 400);
    }
    throw error;
  }
}

export async function crearSku(db: Db, actorId: string, input: EntradaSku) {
  return normalizando(async () => {
    const datos = esquemaSku.parse(input);
    return db.transaction(async (txBase) => {
      const tx = txBase as Db;
      const [programa] = await tx.select({ slug: programs.slug }).from(programs).where(eq(programs.id, datos.programId));
      if (!programa) throw new ErrorDeApp("No existe el programa.", 404);
      const codigoCohorte = `C${datos.cohorteN}`;
      let herencia: HerenciaDeUmbrales | null = null;
      let [cohorte] = await tx.select().from(cohorts).where(and(
        eq(cohorts.programId, datos.programId), eq(cohorts.codigo, codigoCohorte),
      ));
      if (!cohorte) {
        const ventana = datos.ventana;
        if (!ventana?.fechaInicioVentas || !ventana.fechaCierreVentas || ventana.metaCupos === undefined) {
          throw new ErrorDeApp(
            `La cohorte ${codigoCohorte} es nueva: pon inicio y cierre de ventas y meta de cupos.`,
            400,
          );
        }
        if (!datos.cuentaComoCupo) {
          throw new ErrorDeApp(`La cohorte ${codigoCohorte} nace con un SKU que cuenta como cupo.`, 400);
        }
        const cohortId = crypto.randomUUID();
        const valoresCohorte = {
          programId: datos.programId,
          codigo: codigoCohorte,
          metaCupos: ventana.metaCupos,
          metaLeadsDia: ventana.metaLeadsDia,
          precioUsd: decimal(datos.precioListaUsd),
          fechaInicioVentas: ventana.fechaInicioVentas,
          fechaCierreVentas: ventana.fechaCierreVentas,
        };
        [cohorte] = await tx.insert(cohorts).values({ id: cohortId, ...valoresCohorte }).returning();
        await tx.insert(changeLog).values(rastroDeAlta("cohorts", cohortId, codigoCohorte, actorId, valoresCohorte));
        const [actor] = await tx.select({ rol: users.rol }).from(users).where(eq(users.id, actorId));
        if (!actor) throw new ErrorDeApp("No existe el usuario que crea el SKU.", 404);
        herencia = await heredarUmbrales(tx, { id: actorId, rol: actor.rol }, {
          programId: datos.programId,
          cohortIdNuevo: cohortId,
          inicioVentasNuevo: ventana.fechaInicioVentas,
        });
      }
      const creado = await insertarSku(tx, actorId, datos, programa.slug, cohorte.id);
      return { ...creado, herencia };
    });
  });
}

async function leerSkuConContexto(db: Db, id: string) {
  const [fila] = await db.select({ sku: skus, codigoCohorte: cohorts.codigo, programSlug: programs.slug })
    .from(skus)
    .innerJoin(cohorts, eq(cohorts.id, skus.cohortId))
    .innerJoin(programs, eq(programs.id, skus.programId))
    .where(eq(skus.id, id));
  return fila;
}

export async function editarSku(db: Db, actorId: string, id: string, input: EntradaSku) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaSku.parse(input);
    return db.transaction(async (txBase) => {
      const tx = txBase as Db;
      const actual = await leerSkuConContexto(tx, objetivoId);
      if (!actual) throw new ErrorDeApp("No existe un SKU con ese id.", 404);
      const coincidencia = /^C(\d+)$/.exec(actual.codigoCohorte);
      if (!coincidencia) throw new Error(`La cohorte ${actual.codigoCohorte} no tiene un número válido.`);
      const n = Number(coincidencia[1]);
      const valores = {
        nombre: datos.nombre,
        slug: normalizarProducto(datos.nombre),
        codigo: codigoDeSku(actual.programSlug, datos.nombre, n),
        precioListaUsd: decimal(datos.precioListaUsd),
        comisionPorcentaje: decimal(datos.comisionPorcentaje),
        cuentaComoCupo: datos.cuentaComoCupo,
        predeterminado: datos.predeterminado,
      };
      const cambiados = Object.entries(valores).filter(([campo, valor]) =>
        aTexto((actual.sku as Record<string, unknown>)[campo]) !== aTexto(valor));
      if (cambiados.length > 0) {
        try {
          await tx.update(skus).set(valores).where(eq(skus.id, objetivoId));
        } catch (error) {
          if (esViolacionUnica(error)) {
            throw new ErrorDeApp(`Ya existe ese SKU en la cohorte ${actual.codigoCohorte}.`, 400);
          }
          throw error;
        }
        await tx.insert(changeLog).values(cambiados.map(([campo, valor]) => ({
          tabla: "skus",
          registroId: objetivoId,
          etiqueta: valores.codigo,
          campo,
          valorAnterior: aTexto((actual.sku as Record<string, unknown>)[campo]),
          valorNuevo: aTexto(valor),
          origen: "app" as const,
          userId: actorId,
        })));
      }
      return (await leerSkuConContexto(tx, objetivoId))!.sku;
    });
  });
}

async function cambiarActivo(db: Db, actorId: string, id: string, activo: boolean) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    return db.transaction(async (txBase) => {
      const tx = txBase as Db;
      const actual = await leerSkuConContexto(tx, objetivoId);
      if (!actual) throw new ErrorDeApp("No existe un SKU con ese id.", 404);
      if (actual.sku.activo !== activo) {
        await tx.update(skus).set({ activo }).where(eq(skus.id, objetivoId));
        await tx.insert(changeLog).values({
          tabla: "skus",
          registroId: objetivoId,
          etiqueta: actual.sku.codigo,
          campo: "activo",
          valorAnterior: String(actual.sku.activo),
          valorNuevo: String(activo),
          origen: "app",
          userId: actorId,
        });
      }
      return (await leerSkuConContexto(tx, objetivoId))!.sku;
    });
  });
}

export function desactivarSku(db: Db, actorId: string, id: string) {
  return cambiarActivo(db, actorId, id, false);
}

export function reactivarSku(db: Db, actorId: string, id: string) {
  return cambiarActivo(db, actorId, id, true);
}

export async function listarSkus(db: Db, programId: string) {
  const id = idValido(programId);
  return db.select({ sku: skus, codigoCohorte: cohorts.codigo })
    .from(skus)
    .innerJoin(cohorts, eq(cohorts.id, skus.cohortId))
    .where(eq(skus.programId, id))
    .orderBy(desc(cohorts.codigo), asc(skus.nombre));
}

export async function slugsDelPrograma(db: Db, programId: string) {
  const id = idValido(programId);
  return db.select({ slug: skus.slug, nombre: min(skus.nombre) })
    .from(skus)
    .where(eq(skus.programId, id))
    .groupBy(skus.slug)
    .orderBy(asc(skus.slug));
}
