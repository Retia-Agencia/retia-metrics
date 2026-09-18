import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  abonos,
  calls,
  miembrosPrograma,
  motivos,
  origenes,
  plataformasPago,
  people,
  productos,
  programs,
  sales,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ABONADO, SALDO } from "./saldo";

/**
 * Lecturas sobre una persona (ADR 0021, 0023, 0011, 0013, 0015). Solo SELECT: lo
 * que escribe ya vive en `lib/mutations/*`. La base entra por inyeccion (por
 * defecto la de la app) para correr los tests sobre PGlite sin Neon, igual que
 * `lib/queries/ventas.ts` y `lib/queries/programas.ts`.
 *
 * Dos pantallas se sirven de aca:
 * - `/mi-dia` (ticket 003): `buscarPersonas` y `ventasDePersona`.
 * - `/personas/[id]` (ticket 006): `historialDePersona`, que COMPONE
 *   `ventasDePersona` en vez de repetir el calculo del saldo. El dinero se suma y
 *   se resta en un solo lugar; dos definiciones de "saldo" se desincronizan sin
 *   que nadie lo note.
 *
 * El buscador se limita a los programas donde el closer tiene membresia ACTIVA: la
 * misma regla que `programasGestionablesPorUsuario(userId, "closer")`, expresada con
 * el mismo join a `miembros_programa` para no cruzar a personas de programas ajenos
 * (ADR 0021). `historialDePersona` NO lleva ese filtro: se entra desde el dashboard,
 * que abre a los dos roles sin mirar membresia (ADR 0009).
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

/** La persona tal como la muestra su historial (ticket 006). */
export interface PersonaDelHistorial {
  id: string;
  nombre: string | null;
  emailNormalizado: string;
  telefono: string | null;
  programId: string;
  programaNombre: string;
  responsableCloserId: string | null;
  entrada: string;
  estado: string;
}

/** Una llamada como la muestra el historial (tabla del ADR 0015). */
export interface LlamadaDelHistorial {
  id: string;
  fechaLlamada: Date | null;
  fechaAgenda: Date | null;
  resultado: string;
  closerId: string | null;
  notas: string | null;
  /** Nombre del motivo de perdida, ya resuelto contra el catalogo (nunca el uuid). */
  motivoNombre: string | null;
  /** Nombre del origen del lead, ya resuelto contra el catalogo. */
  origenNombre: string | null;
  fechaSeguimiento: Date | null;
  /** De donde salio el registro: 'sheets' la fila migrada, 'app' la nativa (ADR 0010). */
  origen: string;
}

/** Un abono como lo muestra el historial, bajo su venta. */
export interface AbonoDelHistorial {
  id: string;
  fecha: string;
  monto: string;
  moneda: string;
  /** Nombre de la plataforma de pago, ya resuelto contra el catalogo. */
  plataformaNombre: string | null;
  closerId: string | null;
  origen: string;
}

/** Una venta con el detalle de los abonos que la pagaron. */
export interface VentaDelHistorial extends VentaDePersona {
  /** Del mas viejo al mas reciente: es el orden en que se pago. */
  abonos: AbonoDelHistorial[];
}

/** El historial completo de una persona: quien es, sus llamadas y sus ventas. */
export interface HistorialDePersona {
  persona: PersonaDelHistorial;
  /** De la mas reciente a la mas vieja: el historial se lee de arriba hacia abajo. */
  llamadas: LlamadaDelHistorial[];
  ventas: VentaDelHistorial[];
}

/**
 * El historial de una persona, o `null` si no existe (ticket 006).
 *
 * La pagina traduce el `null` a un 404 en vez de inventar una ficha vacia: un id
 * que no existe y una persona sin actividad son cosas distintas.
 */
export async function historialDePersona(
  personId: string,
  db: Db = dbDeLaApp,
): Promise<HistorialDePersona | null> {
  const [persona] = await db
    .select({
      id: people.id,
      nombre: people.nombre,
      emailNormalizado: people.emailNormalizado,
      telefono: people.telefono,
      programId: people.programId,
      programaNombre: programs.nombre,
      responsableCloserId: people.responsableCloserId,
      entrada: people.entrada,
      estado: people.estado,
    })
    .from(people)
    .innerJoin(programs, eq(programs.id, people.programId))
    .where(eq(people.id, personId))
    .limit(1);

  if (!persona) return null;

  // Los catalogos entran por `leftJoin`: una llamada vieja de Sheets no tiene
  // motivo ni origen del catalogo, y debe salir igual en el historial.
  const llamadas = await db
    .select({
      id: calls.id,
      fechaLlamada: calls.fechaLlamada,
      fechaAgenda: calls.fechaAgenda,
      resultado: calls.resultado,
      closerId: calls.closerId,
      notas: calls.notas,
      motivoNombre: motivos.nombre,
      origenNombre: origenes.nombre,
      fechaSeguimiento: calls.fechaSeguimiento,
      origen: calls.origen,
    })
    .from(calls)
    .leftJoin(motivos, eq(motivos.id, calls.motivoId))
    .leftJoin(origenes, eq(origenes.id, calls.origenId))
    .where(eq(calls.personId, personId))
    // `createdAt` desempata: dos llamadas del mismo dia sin hora quedarian en
    // orden arbitrario, y un historial que cambia de orden entre recargas no se
    // puede leer.
    .orderBy(desc(calls.fechaLlamada), desc(calls.createdAt));

  // Las ventas con su saldo salen de `ventasDePersona`: el calculo del dinero en
  // SQL vive en un solo lugar. Duplicarlo aca dejaria dos definiciones de "saldo"
  // que se desincronizan sin que nadie lo note.
  const ventas = await ventasDePersona(personId, db);

  // Los abonos de todas esas ventas en UNA consulta, no una por venta: el numero
  // de consultas no depende de cuantas ventas tenga la persona.
  const ids = ventas.map((v) => v.saleId);
  const filasDeAbonos = ids.length
    ? await db
        .select({
          id: abonos.id,
          saleId: abonos.saleId,
          fecha: abonos.fecha,
          monto: abonos.monto,
          moneda: abonos.moneda,
          plataformaNombre: plataformasPago.nombre,
          closerId: abonos.closerId,
          origen: abonos.origen,
        })
        .from(abonos)
        .leftJoin(plataformasPago, eq(plataformasPago.id, abonos.plataformaId))
        .where(inArray(abonos.saleId, ids))
        .orderBy(asc(abonos.fecha), asc(abonos.createdAt))
    : [];

  return {
    persona,
    llamadas,
    ventas: ventas.map((venta) => ({
      ...venta,
      abonos: filasDeAbonos
        .filter((fila) => fila.saleId === venta.saleId)
        .map((fila) => ({
          id: fila.id,
          fecha: fila.fecha,
          monto: fila.monto,
          moneda: fila.moneda,
          plataformaNombre: fila.plataformaNombre,
          closerId: fila.closerId,
          origen: fila.origen,
        })),
    })),
  };
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
      abonado: ABONADO,
      saldo: SALDO,
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
