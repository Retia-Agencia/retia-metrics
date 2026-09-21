import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { changeLog, cohorts, estadoCohorteEnum } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando as normalizandoZod } from "@/lib/errors-zod";
import { esViolacionCheck, esViolacionUnica } from "@/lib/db/errores";

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

const ESTADO_ACTIVO = "activo" as const;
const ESTADO_CERRADO = "cerrado" as const;

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
    .transform((v) => (v === undefined ? null : v)),
  precioUsd: monto("El precio"),
  fechaInicioClases: fechaIso("La fecha de inicio de clases"),
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
  fechaCierreVentas: fechaIso("La fecha de cierre de ventas"),
  trmCohorte: monto("La TRM"),
  estado: z.enum(estadoCohorteEnum.enumValues),
}).superRefine((datos, ctx) => {
  // Una cohorte activa no puede quedar sin inicio de ventas (ADR 0022).
  if (datos.estado === "activo" && datos.fechaInicioVentas === null) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["fechaInicioVentas"],
      message: "Una cohorte activa necesita fecha de inicio de ventas.",
    });
  }
  // El cierre no puede ser anterior al inicio de ventas.
  if (
    datos.fechaInicioVentas !== null &&
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
 * viven en `lib/db/errores.ts` y se importan aca. El unico CHECK de esta tabla es
 * `cohorts_activa_con_inicio_ventas` (ADR 0022): una cohorte no puede quedar activa
 * sin inicio de ventas.
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
      if (esViolacionCheck(error)) {
        // El CHECK cohorts_activa_con_inicio_ventas (ADR 0022): una cohorte no puede
        // quedar activa sin inicio de ventas. La garantia vive en la base; aca se
        // traduce a un 400 claro, igual que se hace con el indice unico (23505).
        throw new ErrorDeApp(
          "Una cohorte activa necesita fecha de inicio de ventas.",
          400,
        );
      }
      throw error;
    }
  });
}

/** Lee una cohorte por id. */
async function leerCohorte(db: Db, id: string) {
  const [fila] = await db.select().from(cohorts).where(eq(cohorts.id, id));
  return fila;
}

/**
 * Pre-chequeo amable de "una sola cohorte activa por programa" (ADR 0005). Da un
 * mensaje claro antes de tocar la base; la garantia dura sigue siendo el indice.
 * `exceptoId` deja fuera a la propia cohorte al editarla/activarla.
 */
async function yaHayActiva(
  db: Db,
  programId: string,
  exceptoId?: string,
): Promise<boolean> {
  const filas = await db
    .select({ id: cohorts.id })
    .from(cohorts)
    .where(and(eq(cohorts.programId, programId), eq(cohorts.estado, ESTADO_ACTIVO)));
  return filas.some((f) => f.id !== exceptoId);
}

const MENSAJE_UNA_ACTIVA =
  "Ya hay una cohorte activa en este programa. Cierra la activa antes de activar otra.";

/** Lista las cohortes de un programa. */
export async function listarCohortes(db: Db, programId: string) {
  return db.select().from(cohorts).where(eq(cohorts.programId, idValido(programId)));
}

/** Crea una cohorte. Si nace activa, respeta la regla de una sola activa por programa. */
export async function crearCohorte(db: Db, actorId: string, input: EntradaCohorte) {
  return normalizando(async () => {
    const datos = esquemaCohorte.parse(input);
    if (datos.estado === ESTADO_ACTIVO && (await yaHayActiva(db, datos.programId))) {
      throw new ErrorDeApp(MENSAJE_UNA_ACTIVA, 400);
    }

    const id = crypto.randomUUID();
    const etiqueta = etiquetaDe(datos);
    await ejecutarJuntas(db, (tx) => [
      (tx as Db).insert(cohorts).values({ id, ...datos } as never),
      ...Object.entries(datos).map(([campo, valor]) =>
        (tx as Db).insert(changeLog).values({
          tabla: "cohorts",
          registroId: id,
          etiqueta,
          campo,
          valorAnterior: null,
          valorNuevo: aTexto(valor),
          origen: "app" as const,
          userId: actorId,
        }),
      ),
    ]);
    return (await leerCohorte(db, id))!;
  });
}

/** Edita una cohorte. Registra solo los campos que cambian. Respeta la regla de una activa. */
export async function editarCohorte(db: Db, actorId: string, id: string, input: EntradaCohorte) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const datos = esquemaCohorte.parse(input);
    const actual = await leerCohorte(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una cohorte con ese id.", 404);

    if (
      datos.estado === ESTADO_ACTIVO &&
      actual.estado !== ESTADO_ACTIVO &&
      (await yaHayActiva(db, datos.programId, objetivoId))
    ) {
      throw new ErrorDeApp(MENSAJE_UNA_ACTIVA, 400);
    }

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

/**
 * Activa una cohorte (pasa su `estado` a `activo`). Falla con un 400 claro si el
 * programa ya tiene otra activa (pre-chequeo + garantia del indice parcial).
 */
export async function activarCohorte(db: Db, actorId: string, id: string) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerCohorte(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una cohorte con ese id.", 404);
    if (actual.estado === ESTADO_ACTIVO) return actual;
    if (await yaHayActiva(db, actual.programId, objetivoId)) {
      throw new ErrorDeApp(MENSAJE_UNA_ACTIVA, 400);
    }
    return cambiarEstado(db, actorId, actual, ESTADO_ACTIVO);
  });
}

/**
 * "Desactiva" una cohorte: la pasa a estado `cerrado`. Nunca se borra la fila (las
 * metricas historicas la siguen apuntando) y ademas libera el cupo de "activa".
 */
export async function desactivarCohorte(db: Db, actorId: string, id: string) {
  return normalizando(async () => {
    const objetivoId = idValido(id);
    const actual = await leerCohorte(db, objetivoId);
    if (!actual) throw new ErrorDeApp("No existe una cohorte con ese id.", 404);
    if (actual.estado === ESTADO_CERRADO) return actual;
    return cambiarEstado(db, actorId, actual, ESTADO_CERRADO);
  });
}

/** Cambia el estado de una cohorte y deja el rastro en `change_log`. */
async function cambiarEstado(
  db: Db,
  actorId: string,
  actual: typeof cohorts.$inferSelect,
  nuevo: typeof estadoCohorteEnum.enumValues[number],
) {
  await ejecutarJuntas(db, (tx) => [
    (tx as Db)
      .update(cohorts)
      .set({ estado: nuevo } as never)
      .where(eq(cohorts.id, actual.id)),
    (tx as Db).insert(changeLog).values({
      tabla: "cohorts",
      registroId: actual.id,
      etiqueta: etiquetaDe(actual),
      campo: "estado",
      valorAnterior: actual.estado,
      valorNuevo: nuevo,
      origen: "app" as const,
      userId: actorId,
    }),
  ]);
  return (await leerCohorte(db, actual.id))!;
}
