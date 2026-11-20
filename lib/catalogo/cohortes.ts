import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { META_LEADS_DIA_POR_DEFECTO } from "@/lib/cohortes-por-defecto";
import { changeLog, cohorts, productos, programs, skus } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { claveDe, unaVezPorSolicitud } from "@/lib/db/por-solicitud";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando as normalizandoZod } from "@/lib/errors-zod";
import { esViolacionExclusion, esViolacionUnica } from "@/lib/db/errores";
import { columnasCohorteConEstado } from "@/lib/cohortes/estado";
import { hoyEnBogota } from "@/lib/format";

/**
 * Cohortes (ticket 014, ADR 0012 + ADR 0005), sobre las mismas piezas del molde.
 *
 * Una cohorte es una instancia editable por programa. No se apoya en
 * `moldeDeCatalogo` porque el molde traduce TODA violacion de indice unico (23505)
 * al mismo mensaje "ya existe ... con ese nombre", y aca conviven dos indices con
 * mensajes distintos: el de `(program_id, codigo)` y el PARCIAL de "una sola
 * cohorte activa por programa" (ADR 0005). Por eso las escrituras se arman aca con
 * `ejecutarJuntas` (alta + `change_log` en un lote, ADR 0020) y cada 23505 se
 * traduce a su mensaje propio.
 *
 * La regla dura vive en la base (indice unico parcial), no solo en codigo: un
 * pre-chequeo da un mensaje mas amable, pero la garantia es el indice. Aunque dos
 * peticiones pasen el pre-chequeo a la vez, la base rechaza la segunda.
 *
 * "Desactivar" una cohorte no usa una columna `activo` (no la tiene): la pasa a
 * estado `cerrado`, que ademas libera el cupo de "activa" para otra cohorte. Es la
 * lectura correcta del dominio (una cohorte cierra, no se "desactiva"), y encaja
 * con el molde: nunca se borra la fila.
 */

/** id de una cohorte: uuid o error de validacion (400). */
const esquemaId = z.string().uuid("El identificador no es válido.");

/** Un monto en USD/COP como texto: entero o con hasta dos decimales. */
const monto = (etiqueta: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d{1,2})?$/, `${etiqueta} debe ser un monto (por ejemplo 797 o 797.00).`);

/** Una fecha ISO `YYYY-MM-DD`. */
const fechaIso = (etiqueta: string) =>
  z.string().trim().regex(/^\d{4}-\d{2}-\d{2}$/, `${etiqueta} debe tener formato AAAA-MM-DD.`);

/**
 * El unico esquema zod de una cohorte. Lo usan la pantalla, las server actions y
 * cualquier codigo: una sola validacion de la misma entidad.
 */
export const esquemaCohorte = z.object({
  programId: z.string().uuid("Programa inválido."),
  codigo: z.string().trim().min(1, "El código es obligatorio.").max(20, "Máximo 20 caracteres."),
  metaCupos: z.coerce.number().int("Debe ser un entero.").nonnegative("No puede ser negativo."),
  metaLeadsDia: z.coerce
    .number()
    .int("Debe ser un entero.")
    .nonnegative("No puede ser negativo.")
    .nullable()
    .optional()
    .transform((v) => (v === undefined ? META_LEADS_DIA_POR_DEFECTO : v)),
  precioUsd: monto("El precio"),
  /**
   * Inicio de clases. Nullable solo mientras la cohorte es FUTURA y queda "por definir"
   * (ticket 227): Gerencia la crea antes de saber la fecha. OBLIGATORIO para una cohorte
   * que no es futura (activa o cerrada), que es lo que exige el CHECK
   * `cohorts_definida_si_no_es_futura` en la base; el `superRefine` de abajo da el 400
   * amable antes de tocarla. Vacio ("") o ausente se normaliza a null.
   */
  fechaInicioClases: fechaIso("La fecha de inicio de clases")
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  /**
   * Primer dia de la ventana de venta (ADR 0022). Opcional en base y aca, pero
   * OBLIGATORIO cuando la cohorte esta activa (regla dura en la base como CHECK; el
   * `superRefine` de abajo da el 400 amable antes de tocarla). Vacio ("") o
   * ausente se normaliza a null.
   */
  fechaInicioVentas: fechaIso("La fecha de inicio de ventas")
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
  /**
   * Ultimo dia de la ventana de venta. Nullable igual que el inicio de clases: solo una
   * cohorte futura puede quedar "por definir" sin ella (ticket 227). Obligatoria para una
   * cohorte que no es futura, por el mismo CHECK.
   */
  fechaCierreVentas: fechaIso("La fecha de cierre de ventas")
    .or(z.literal(""))
    .nullable()
    .optional()
    .transform((v) => (v === undefined || v === "" ? null : v)),
}).superRefine((datos, ctx) => {
  // El cierre no puede ser anterior al inicio de ventas (solo cuando ambas existen).
  if (
    datos.fechaInicioVentas !== null &&
    datos.fechaCierreVentas !== null &&
    datos.fechaCierreVentas < datos.fechaInicioVentas
  ) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fechaCierreVentas"],
      message: "El cierre de ventas no puede ser anterior al inicio de ventas.",
    });
  }
});

/** Entrada validada de una cohorte (lo que el llamador escribe). */
export type EntradaCohorte = z.input<typeof esquemaCohorte>;
/** Cohorte ya validada y normalizada. */
export type CohorteValidada = z.output<typeof esquemaCohorte>;

/** Valida el id como uuid; un id invalido sale como ErrorDeApp 400, nunca como 500. */
function idValido(id: string): string {
  const parsed = esquemaId.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

/**
 * Detecta la violacion de indice unico (23505) y la de un CHECK (23514). Las dos
 * viven en `lib/db/errores.ts` y se importan aca. Los CHECK de esta tabla son
 * `cohorts_activa_con_inicio_ventas` (ADR 0022) y `cohorts_definida_si_no_es_futura`
 * (ticket 227): una cohorte activa no queda sin inicio de ventas, y solo una futura
 * puede quedar sin fechas de clases o cierre.
 */

/** Convierte un valor de columna a texto para `change_log`. */
function aTexto(valor: unknown): string | null {
  if (valor === null || valor === undefined) return null;
  return String(valor);
}

/** Etiqueta legible de una cohorte para `change_log`. */
function etiquetaDe(fila: { codigo: string }): string {
  return fila.codigo;
}

/**
 * Traduce un `ZodError` (delegando en `normalizandoZod`, que es la misma respuesta
 * que dan los otros ocho modulos) o una violacion de indice/CHECK propia de las
 * cohortes a un `ErrorDeApp` con mensaje claro.
 *
 * Es el UNICO catalogo que traduce errores del driver, asi que su envoltorio no se
 * pudo unificar con los demas: lo compartido se importa y lo suyo se queda aca.
 *
 * La capa de adentro deja pasar un `ErrorDeApp` ANTES de mirar el codigo SQLSTATE,
 * igual que hacia la version de una sola capa. No es redundante con la guarda de
 * `normalizandoZod`: sin ella, un `ErrorDeApp` que algun dia llevara un `cause` del
 * driver perderia su mensaje y saldria con el de "ya hay una cohorte activa". Hoy
 * no puede pasar (el constructor solo recibe mensaje y status), y por eso mismo el
 * dia que cambie nadie se va a acordar de esta rama.
 */
async function normalizando<T>(fn: () => Promise<T>): Promise<T> {
  return normalizandoZod(async () => {
    try {
      return await fn();
    } catch (error) {
      if (error instanceof ErrorDeApp) throw error;
      if (esViolacionUnica(error)) {
        // La unica escritura que puede chocar aca (tras el pre-chequeo) es la del
        // indice parcial de cohorte activa o el de (program_id, codigo).
        throw new ErrorDeApp(
          "Ya hay una cohorte activa en este programa, o el código ya existe. Cierra la activa antes de activar otra.",
          400,
        );
      }
      if (esViolacionExclusion(error)) {
        // `cohorts_sin_solape_de_ventas` (ticket 396, ADR 0125): dos cohortes del programa no venden el mismo dia.
        throw new ErrorDeApp(
          "Las fechas de venta se solapan con otra cohorte de este programa. Ajusta el inicio o el cierre para que no compartan ningún día.",
          400,
        );
      }
      throw error;
    }
  });
}

/** Lee una cohorte por id. */
async function leerCohorte(db: Db, id: string) {
  const [fila] = await db.select({
    ...columnasCohorteConEstado(hoyEnBogota()),
  }).from(cohorts).where(eq(cohorts.id, id));
  return fila;
}

/** Lista las cohortes de un programa. */
export async function listarCohortes(db: Db, programId: string) {
  const id = idValido(programId);
  const filas = await unaVezPorSolicitud(db, claveDe("listarCohortes", id), () =>
    db.select(columnasCohorteConEstado(hoyEnBogota()))
      .from(cohorts).where(eq(cohorts.programId, id)));
  return [...filas];
}

/** Crea una cohorte; su estado se deduce de la ventana de ventas. */
export async function crearCohorte(db: Db, actorId: string, input: EntradaCohorte) {
  return normalizando(async () => {
    const datos = esquemaCohorte.parse(input);
    const id = crypto.randomUUID();
    const etiqueta = etiquetaDe(datos);
    await (db as { transaction: (fn: (tx: Db) => Promise<void>) => Promise<void> }).transaction(async (tx) => {
      await tx.insert(cohorts).values({ id, ...datos } as never);
      await tx.insert(changeLog).values(Object.entries(datos).map(([campo, valor]) => ({
          tabla: "cohorts",
          registroId: id,
          etiqueta,
          campo,
          valorAnterior: null,
          valorNuevo: aTexto(valor),
          origen: "app" as const,
          userId: actorId,
      })));

      let [producto] = await tx.select().from(productos).where(and(
        eq(productos.programId, datos.programId), eq(productos.slug, "programa_virtual"),
      ));
      if (!producto) {
        const productoId = crypto.randomUUID();
        [producto] = await tx.insert(productos).values({
          id: productoId, programId: datos.programId, nombre: "Programa virtual",
          slug: "programa_virtual", cuentaComoCupo: true,
        }).onConflictDoNothing().returning();
        if (!producto) {
          [producto] = await tx.select().from(productos).where(and(
            eq(productos.programId, datos.programId), eq(productos.slug, "programa_virtual"),
          ));
        } else {
          await tx.insert(changeLog).values([
            ["programId", datos.programId], ["nombre", "Programa virtual"],
            ["slug", "programa_virtual"], ["cuentaComoCupo", "true"],
          ].map(([campo, valor]) => ({
            tabla: "productos", registroId: productoId, etiqueta: "Programa virtual", campo,
            valorAnterior: null, valorNuevo: valor, origen: "app" as const, userId: actorId,
          })));
        }
      }
      if (!producto) throw new Error("No se pudo crear el producto Programa virtual.");

      const [programa] = await tx.select({ slug: programs.slug }).from(programs)
        .where(eq(programs.id, datos.programId));
      if (!programa) throw new Error("No existe el programa de la cohorte.");
      const codigo = `${programa.slug.replaceAll("-", "_")}_programa_virtual_${datos.codigo.toLowerCase()}`;
      const skuId = crypto.randomUUID();
      const [sku] = await tx.insert(skus).values({
        id: skuId, programId: datos.programId, productoId: producto.id, cohortId: id,
        codigo, precioListaUsd: datos.precioUsd,
      }).returning();
      await tx.insert(changeLog).values(Object.entries({
        programId: datos.programId, productoId: producto.id, cohortId: id,
        codigo, precioListaUsd: datos.precioUsd,
      }).map(([campo, valor]) => ({
        tabla: "skus", registroId: sku.id, etiqueta: codigo, campo,
        valorAnterior: null, valorNuevo: valor, origen: "app" as const, userId: actorId,
      })));
    });
    return (await leerCohorte(db, id))!;
  });
}

/** Edita una cohorte. Registra solo los campos que cambian. */
export async function editarCohorte(db: Db, actorId: string, id: string, input: EntradaCohorte) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaCohorte.parse(input);
    const actual = await leerCohorte(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una cohorte con ese id.", 404);

    const cambiados = Object.entries(datos).filter(
      ([campo, valor]) =>
        aTexto((actual as Record<string, unknown>)[campo]) !== aTexto(valor),
    );
    if (cambiados.length === 0) return actual;

    const etiqueta = etiquetaDe(datos);
    await ejecutarJuntas(db, (tx) => [
      (tx as Db)
        .update(cohorts)
        .set(datos as never)
        .where(eq(cohorts.id, objetivoId)),
      ...cambiados.map(([campo, valor]) =>
        (tx as Db).insert(changeLog).values({
          tabla: "cohorts",
          registroId: objetivoId,
          etiqueta,
          campo,
          valorAnterior: aTexto((actual as Record<string, unknown>)[campo]),
          valorNuevo: aTexto(valor),
          origen: "app" as const,
          userId: actorId,
        }),
      ),
    ]);
    return (await leerCohorte(db, objetivoId))!;
  });
}
