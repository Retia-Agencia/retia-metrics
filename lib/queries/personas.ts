import { and, asc, eq, ilike, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import { abonos, miembrosPrograma, people, productos, programs, sales } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";

/**
 * Lecturas de la pantalla `/mi-dia` (ticket 003, ADR 0021, 0023, 0011, 0013). Solo
 * SELECT: lo que escribe ya vive en `lib/mutations/*`. La base entra por inyeccion
 * (por defecto la de la app) para correr los tests sobre PGlite sin Neon, igual que
 * `lib/queries/ventas.ts` y `lib/queries/programas.ts`.
 *
 * El buscador se limita a los programas donde el closer tiene membresia ACTIVA: la
 * misma regla que `programasGestionablesPorUsuario(userId, "closer")`, expresada con
 * el mismo join a `miembros_programa` para no cruzar a personas de programas ajenos
 * (ADR 0021).
 */

/** Una persona como la ve el buscador de `/mi-dia`. */
export interface PersonaEncontrada {
  id: string;
  nombre: string | null;
  emailNormalizado: string;
  telefono: string | null;
  programId: string;
  programaNombre: string;
  /** Closer responsable en texto (ADR 0011), o `null` si no tiene ("sin responsable"). */
  responsableCloserId: string | null;
  /** Por donde entro la persona (formulario o crm). */
  entrada: string;
}

/** Cuantas caracteres minimos exige el buscador antes de tocar la base. */
const MINIMO_TEXTO = 2;
/** Tope de filas: el buscador es para elegir a una persona, no para listar la base. */
const MAXIMO_FILAS = 20;

/**
 * Busca personas por nombre O por correo, insensible a mayusculas (ILIKE), limitada
 * a los programas donde el closer tiene membresia activa.
 *
 * Con texto vacio o de menos de 2 caracteres devuelve un arreglo vacio sin tocar la
 * base: un buscador que ante "a" devuelve la base entera no sirve y filtra datos
 * personales de gente que nadie busco.
 */
export async function buscarPersonas(
  userId: string,
  texto: string,
  db: Db = dbDeLaApp,
): Promise<PersonaEncontrada[]> {
  const termino = texto.trim();
  if (termino.length < MINIMO_TEXTO) return [];

  // El `%` se escapa antes de meterlo en el patron para que un texto con `%` o `_`
  // no se lea como comodin de LIKE.
  const patron = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const filas = await db
    .select({
      id: people.id,
      nombre: people.nombre,
      emailNormalizado: people.emailNormalizado,
      telefono: people.telefono,
      programId: people.programId,
      programaNombre: programs.nombre,
      responsableCloserId: people.responsableCloserId,
      entrada: people.entrada,
    })
    .from(people)
    .innerJoin(programs, eq(programs.id, people.programId))
    .innerJoin(miembrosPrograma, eq(miembrosPrograma.programId, people.programId))
    .where(
      and(
        eq(miembrosPrograma.userId, userId),
        eq(miembrosPrograma.activo, true),
        eq(programs.activo, true),
        or(ilike(people.nombre, patron), ilike(people.emailNormalizado, patron)),
      ),
    )
    .orderBy(asc(people.nombre), asc(people.emailNormalizado))
    .limit(MAXIMO_FILAS);

  return filas;
}

/** Una venta de la persona con lo que lleva pagado. */
export interface VentaDePersona {
  saleId: string;
  fecha: string | null;
  productoId: string | null;
  productoNombre: string | null;
  moneda: string;
  /** Precio del contrato (`sales.precioAplicadoUsd`). `null` en filas viejas de Sheets. */
  precioAplicadoUsd: string | null;
  /** Suma de los abonos de la venta. "0" si no tiene ninguno. */
  abonado: string;
  /** Precio del contrato menos lo abonado. `null` si la venta no tiene precio. */
  saldo: string | null;
}

/**
 * Las ventas de una persona con su producto, precio, lo abonado y el saldo, para
 * ofrecer "registrar abono" sobre cada una (ticket 019, ADR 0013).
 *
 * El dinero se suma y se resta en SQL sobre `numeric` y sale como texto —igual que
 * `saldoDeVenta` en `lib/queries/ventas.ts`—: Postgres es exacto con decimales y
 * JavaScript no, asi que el dinero nunca pasa por un `float`.
 */
export async function ventasDePersona(
  personId: string,
  db: Db = dbDeLaApp,
): Promise<VentaDePersona[]> {
  const filas = await db
    .select({
      saleId: sales.id,
      fecha: sales.fecha,
      productoId: sales.productoId,
      moneda: sales.moneda,
      precioAplicadoUsd: sales.precioAplicadoUsd,
      abonado: sql<string>`coalesce(sum(${abonos.monto}), 0)::text`,
      saldo: sql<
        string | null
      >`(${sales.precioAplicadoUsd} - coalesce(sum(${abonos.monto}), 0))::text`,
      productoNombre: sql<string | null>`max(${productos.nombre})`,
    })
    .from(sales)
    .leftJoin(abonos, eq(abonos.saleId, sales.id))
    .leftJoin(productos, eq(productos.id, sales.productoId))
    .where(eq(sales.personId, personId))
    .groupBy(sales.id)
    .orderBy(asc(sales.fecha));

  return filas;
}
