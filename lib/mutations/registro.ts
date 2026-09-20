import { and, eq } from "drizzle-orm";
import { z } from "zod";
import type { Session } from "next-auth";
import { db as dbDeLaApp } from "@/lib/db";
import {
  abonos,
  calls,
  miembrosPrograma,
  people,
  productos,
  resultadoLlamadaEnum,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esquemaAbono } from "@/lib/abonos/esquema";
import { exigirPlataformaActiva } from "@/lib/abonos/plataforma";
import { closerDeLaSesion } from "@/lib/auth/closer";
import { igualCloser } from "@/lib/closers/identidad";
import { cohorteActiva } from "@/lib/queries/cohortes";
import { vigente } from "@/lib/queries/vigente";

/**
 * Registro nativo de una llamada escrita por un closer logueado (ticket 002, ADR
 * 0010/0011/0013/0015). Es logica pura, sin "use server": una server action la
 * envuelve, igual que `lib/catalogo/productos.ts`. El enforcement de rol NO va aca
 * (lo hace quien la invoque con `requireRole`); esto solo valida y escribe.
 *
 * La base entra por inyeccion (por defecto la de la app) para poder testear sobre
 * PGlite sin Neon.
 */

/**
 * Los datos de la venta cuando la llamada cierra. El producto y su precio del
 * contrato viven aca; el primer abono reusa el esquema de `lib/abonos/esquema.ts`
 * (`.pick`) para no duplicar las regex de monto/fecha ni la moneda. `saleId` y
 * `programId` no se piden aca: la venta aun no existe y el programa ya viene en el
 * nivel de arriba.
 */
const esquemaVenta = z
  .object({
    productoId: z.string().uuid("Producto inválido."),
    precioAplicadoUsd: z
      .string()
      .trim()
      .regex(
        /^\d+(\.\d{1,2})?$/,
        "El precio aplicado debe ser un monto (por ejemplo 797 o 797.00).",
      )
      .refine((v) => Number(v) > 0, "El precio aplicado debe ser mayor que cero."),
  })
  .merge(
    esquemaAbono.pick({
      fecha: true,
      monto: true,
      moneda: true,
      plataformaId: true,
      comprobanteUrl: true,
    }),
  );

/**
 * El unico esquema zod del registro de una llamada. Exige los campos segun el
 * resultado (tabla del ADR 0015) via `superRefine`, para que la misma validacion la
 * usen la server action y cualquier codigo.
 */
export const esquemaRegistroLlamada = z
  .object({
    programId: z.string().uuid("Programa inválido."),
    personId: z.string().uuid("Persona inválida.").optional(),
    emailLead: z.string().email("El correo del lead no es válido.").optional(),
    fechaAgenda: z.date().optional(),
    fechaLlamada: z.date().optional(),
    resultado: z.enum(resultadoLlamadaEnum.enumValues),
    origenId: z.string().uuid("Origen inválido.").optional(),
    motivoId: z.string().uuid("Motivo inválido.").optional(),
    fechaSeguimiento: z.date().optional(),
    notas: z.string().optional(),
    venta: esquemaVenta.optional(),
  })
  .superRefine((datos, ctx) => {
    // Tabla del ADR 0015: cada resultado exige sus campos.
    if (
      (datos.resultado === "reagendada" || datos.resultado === "compromiso_pago") &&
      datos.fechaSeguimiento === undefined
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fechaSeguimiento"],
        message:
          "Una llamada reagendada o con compromiso de pago necesita fecha de seguimiento.",
      });
    }
    if (datos.resultado === "perdida" && datos.motivoId === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["motivoId"],
        message: "Una llamada perdida necesita un motivo.",
      });
    }
    if (datos.resultado === "cerrada" && datos.venta === undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["venta"],
        message: "Una llamada cerrada necesita los datos de la venta y su primer abono.",
      });
    }
  });

/** Entrada del registro (lo que el llamador escribe). */
export type EntradaRegistroLlamada = z.input<typeof esquemaRegistroLlamada>;
/** Registro ya validado y normalizado. */
export type RegistroLlamadaValidado = z.output<typeof esquemaRegistroLlamada>;

/** Lo que devuelve un registro: la llamada, y la venta/abono si cerro (o null). */
export interface ResultadoRegistro {
  llamada: typeof calls.$inferSelect;
  venta: typeof sales.$inferSelect | null;
  abono: typeof abonos.$inferSelect | null;
}

/**
 * Guarda una llamada escrita por un closer logueado y, si cerro, su venta y su
 * primer abono en la misma transaccion (ADR 0013).
 */
export async function registrarLlamada(
  session: Session,
  input: EntradaRegistroLlamada,
  db: Db = dbDeLaApp,
): Promise<ResultadoRegistro> {
  // a) El closerId se COPIA de la cuenta, el closer nunca lo escribe (ADR 0011).
  const closerId = closerDeLaSesion(session, "registrar llamadas");

  // b) Validacion del borde. El ZodError sale tal cual: `respuestaDeError` lo vuelve
  //    un 400 con el mensaje del primer issue.
  const datos = esquemaRegistroLlamada.parse(input);

  // c) El alcance sale de la cuenta, nunca del input: solo puede registrar en un
  // programa donde su usuario esta activo y tiene membresia activa. El join tambien
  // evita que una cuenta desactivada conserve capacidad de escritura.
  const [membresia] = await db
    .select({ id: miembrosPrograma.id })
    .from(miembrosPrograma)
    .innerJoin(users, eq(users.id, miembrosPrograma.userId))
    .where(
      and(
        eq(miembrosPrograma.userId, session.user.id),
        eq(miembrosPrograma.programId, datos.programId),
        eq(miembrosPrograma.activo, true),
        eq(users.activo, true),
        igualCloser(users.closerId, closerId),
      ),
    )
    .limit(1);
  if (!membresia) {
    throw new ErrorDeApp("No tienes una membresía activa en este programa.", 403);
  }

  // La persona tambien se valida en servidor: el correo es solo informativo y no
  // puede apuntar la llamada a otra persona ni cruzar programas.
  if (datos.personId) {
    const [persona] = await db
      .select({ id: people.id })
      .from(people)
      .where(and(eq(people.id, datos.personId), eq(people.programId, datos.programId)))
      .limit(1);
    if (!persona) {
      throw new ErrorDeApp("La persona no existe o no pertenece a este programa.", 400);
    }
  }

  // d) Toda llamada nativa se asigna a la cohorte activa sin que el closer la elija.
  //    Sin cohorte activa no hay donde colgarla: 400 amable, no un insert huerfano.
  const cohorte = await cohorteActiva(datos.programId, db);
  if (!cohorte) {
    throw new ErrorDeApp(
      "Este programa no tiene una cohorte activa. Activa una cohorte antes de registrar llamadas.",
      400,
    );
  }

  // e) Si cerro, el producto y la plataforma deben existir, estar activos y (el
  //    producto) pertenecer a este programa. Se valida antes de escribir para dar un
  //    400 claro en vez de un fallo de FK opaco.
  if (datos.venta) {
    const [producto] = await db
      .select({ id: productos.id })
      .from(productos)
      .where(
        and(
          eq(productos.id, datos.venta.productoId),
          eq(productos.programId, datos.programId),
          eq(productos.activo, true),
        ),
      )
      .limit(1);
    if (!producto) {
      throw new ErrorDeApp(
        "El producto no existe, no está activo o no pertenece a este programa.",
        400,
      );
    }

    await exigirPlataformaActiva(datos.venta.plataformaId, db);
  }

  // f) Ids generados ANTES: `ejecutarJuntas` usa `batch` sobre neon-http, que no deja
  //    encadenar el id recien insertado (ver lib/db/ejecutar-juntas.ts). Asi el abono
  //    puede apuntar a la venta dentro del mismo lote atomico.
  const callId = crypto.randomUUID();
  const cierra = datos.resultado === "cerrada";
  // Solo se toca sales/abonos si el resultado es "cerrada", aunque venga `venta`.
  const venta = cierra ? datos.venta! : null;
  const saleId = venta ? crypto.randomUUID() : null;
  const abonoId = venta ? crypto.randomUUID() : null;

  await ejecutarJuntas(db, (tx) => {
    const consultas: Promise<unknown>[] = [
      (tx as Db).insert(calls).values({
        id: callId,
        personId: datos.personId,
        cohortId: cohorte.id,
        programId: datos.programId,
        closerId,
        emailLead: datos.emailLead,
        fechaAgenda: datos.fechaAgenda,
        // Si el closer no escribio la fecha de la llamada, es ahora.
        fechaLlamada: datos.fechaLlamada ?? new Date(),
        resultado: datos.resultado,
        fechaSeguimiento: datos.fechaSeguimiento,
        motivoId: datos.motivoId,
        origenId: datos.origenId,
        notas: datos.notas,
        origen: "app",
        // `huellaFila` queda null: Postgres permite varios NULL en el indice unico,
        // asi que no choca con el dedup de filas de Sheets (ADR 0010).
      }),
    ];

    if (venta) {
      consultas.push(
        (tx as Db).insert(sales).values({
          id: saleId!,
          personId: datos.personId,
          // De cual llamada nacio esta venta (ADR 0026 punto 2): sin esta referencia,
          // anular la llamada no sabria a que venta arrastrar.
          callId,
          cohortId: cohorte.id,
          programId: datos.programId,
          closerId,
          emailComprador: datos.emailLead,
          // `sales.fecha` = la fecha del primer abono: el primer abono se recibe en el
          // momento del cierre y es un YYYY-MM-DD que el closer ya escribio. Se prefiere
          // a derivarla de un timestamp, que arrastraria conversion de zona horaria.
          fecha: venta.fecha,
          productoId: venta.productoId,
          precioAplicadoUsd: venta.precioAplicadoUsd,
          moneda: "USD",
          // No se escribe `montoAbonado` (ADR 0013) ni `precioListaUsd` (fuera de alcance).
        }),
        (tx as Db).insert(abonos).values({
          id: abonoId!,
          saleId: saleId!,
          programId: datos.programId,
          fecha: venta.fecha,
          monto: venta.monto,
          moneda: venta.moneda,
          plataformaId: venta.plataformaId,
          comprobanteUrl: venta.comprobanteUrl,
          closerId,
          origen: "app",
        }),
      );
    }

    return consultas;
  });

  // g) Se leen las filas por id despues del lote atomico: `batch` no devuelve las
  //    filas insertadas encadenadas, asi que se releen para devolver lo escrito.
  // El `vigente(...)` de estas relecturas no filtra nada en la practica: son lecturas
  // por clave primaria de filas insertadas microsegundos antes, cuyo id todavia no ha
  // salido del servidor, asi que nadie pudo anularlas. Va igual porque deja escrita
  // la invariante —lo que esta funcion devuelve son registros que cuentan— y porque
  // el guardian de `tests/vigencia-centralizada.test.ts` exige que TODA lectura de
  // estas tres tablas diga que decidio, tambien las de `lib/mutations/`.
  const [llamada] = await db
    .select()
    .from(calls)
    .where(and(eq(calls.id, callId), vigente(calls)))
    .limit(1);
  const ventaInsertada = saleId
    ? (
        await db
          .select()
          .from(sales)
          .where(and(eq(sales.id, saleId), vigente(sales)))
          .limit(1)
      )[0] ?? null
    : null;
  const abonoInsertado = abonoId
    ? (
        await db
          .select()
          .from(abonos)
          .where(and(eq(abonos.id, abonoId), vigente(abonos)))
          .limit(1)
      )[0] ?? null
    : null;

  return { llamada: llamada!, venta: ventaInsertada, abono: abonoInsertado };
}
