import { and, asc, desc, eq, ilike, inArray, or, sql } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  abonos,
  calls,
  miembrosPrograma,
  motivos,
  origenes,
  plataformasPago,
  leads,
  productos,
  programs,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { esAdministrador, type Rol } from "@/lib/auth/roles";
import { ABONADO, SALDO } from "./saldo";
import { incluyendoAnulados, vigente } from "./vigente";

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
  /** Por donde entro la persona (formulario o crm). */
  entrada: string;
}

/** Cuantas caracteres minimos exige el buscador antes de tocar la base. */
const MINIMO_TEXTO = 2;
/** Tope de filas: el buscador es para elegir a una persona, no para listar la base. */
const MAXIMO_FILAS = 20;

/**
 * Busca personas por nombre O por correo, insensible a mayusculas (ILIKE), dentro de
 * los programas que ESE usuario trabaja.
 *
 * Y "que trabaja" depende del rol, que es lo que este buscador no preguntaba (18-sep):
 * quien ADMINISTRA busca en todos los programas activos, un closer solo donde tiene
 * membresia activa. Antes el filtro era siempre la membresia, sin mirar el rol, y como
 * un gerente no necesita membresias, **un gerente no encontraba a nadie, nunca**. No
 * era un buscador vacio y ya: `/personas/[id]` solo se alcanza desde aqui, asi que un
 * gerente no tenia NINGUNA forma de abrir el historial de un lead. Misma familia que el
 * bug de `/productos`: la pregunta era del rol y se contesto con la membresia.
 *
 * Con texto vacio o de menos de 2 caracteres devuelve un arreglo vacio sin tocar la
 * base: un buscador que ante "a" devuelve la base entera no sirve y filtra datos
 * personales de gente que nadie busco.
 */
export async function buscarPersonas(
  userId: string,
  rol: Rol | null,
  texto: string,
  db: Db = dbDeLaApp,
): Promise<PersonaEncontrada[]> {
  const termino = texto.trim();
  if (termino.length < MINIMO_TEXTO) return [];

  // El `%` se escapa antes de meterlo en el patron para que un texto con `%` o `_`
  // no se lea como comodin de LIKE.
  const patron = `%${termino.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;

  const columnas = {
    id: leads.id,
    nombre: leads.nombre,
    emailNormalizado: leads.emailNormalizado,
    telefono: leads.telefono,
    programId: leads.programId,
    programaNombre: programs.nombre,
    entrada: leads.entrada,
  };
  const coincide = or(ilike(leads.nombre, patron), ilike(leads.emailNormalizado, patron));
  const orden = [asc(leads.nombre), asc(leads.emailNormalizado)] as const;

  // Quien administra ve todos los programas activos. El developer entra por aca
  // (ADR 0025 punto 5: no se le restringe nada), no por el camino de la membresia,
  // donde no tiene ninguna y encontraria cero.
  if (esAdministrador(rol)) {
    return db
      .select(columnas)
      .from(leads)
      .innerJoin(programs, eq(programs.id, leads.programId))
      .where(and(eq(programs.activo, true), coincide))
      .orderBy(...orden)
      .limit(MAXIMO_FILAS);
  }

  return db
    .select(columnas)
    .from(leads)
    .innerJoin(programs, eq(programs.id, leads.programId))
    .innerJoin(miembrosPrograma, eq(miembrosPrograma.programId, leads.programId))
    .where(
      and(
        eq(miembrosPrograma.userId, userId),
        eq(miembrosPrograma.activo, true),
        eq(programs.activo, true),
        coincide,
      ),
    )
    .orderBy(...orden)
    .limit(MAXIMO_FILAS);
}

/** La persona tal como la muestra su historial (ticket 006). */
export interface PersonaDelHistorial {
  id: string;
  nombre: string | null;
  emailNormalizado: string;
  telefono: string | null;
  programId: string;
  programaNombre: string;
  entrada: string;
  estado: string;
}

/**
 * Lo que hay que saber de un registro anulado (ADR 0026 punto 1): quien, cuando y
 * por que. `null` cuando el registro sigue vigente.
 *
 * Los tres datos viajan juntos y no como tres campos sueltos porque juntos van en la
 * base (el CHECK `*_anulacion_completa`) y juntos se muestran: "anulada" sin motivo
 * ni autor es el estado que el ADR descarta.
 */
export interface Anulacion {
  fecha: Date;
  /** Nombre (o correo) de quien anulo, ya resuelto. Nunca el uuid. */
  porNombre: string;
  motivo: string;
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
  /** Anulada (ADR 0026): se muestra tachada, no se esconde, y no cuenta en nada. */
  anulacion: Anulacion | null;
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
  /** Anulado (ADR 0026). Un abono anulado NO suma a `abonado` ni a la caja. */
  anulacion: Anulacion | null;
}

/** Una venta con el detalle de los abonos que la pagaron. */
export interface VentaDelHistorial extends VentaDePersona {
  /** Del mas viejo al mas reciente: es el orden en que se pago. */
  abonos: AbonoDelHistorial[];
  /** Anulada (ADR 0026). Anular una venta anula sus abonos en la misma escritura. */
  anulacion: Anulacion | null;
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
      id: leads.id,
      nombre: leads.nombre,
      emailNormalizado: leads.emailNormalizado,
      telefono: leads.telefono,
      programId: leads.programId,
      programaNombre: programs.nombre,
        entrada: leads.entrada,
      estado: leads.estado,
    })
    .from(leads)
    .innerJoin(programs, eq(programs.id, leads.programId))
    .where(eq(leads.id, personId))
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
      anuladoEn: calls.anuladoEn,
      anuladoPor: calls.anuladoPor,
      motivoAnulacion: calls.motivoAnulacion,
    })
    .from(calls)
    .leftJoin(motivos, eq(motivos.id, calls.motivoId))
    .leftJoin(origenes, eq(origenes.id, calls.origenId))
    // El historial SI muestra lo anulado, tachado (ADR 0026 punto 4): "aqui hubo una
    // llamada que se anulo porque se registro al lead equivocado" es informacion.
    // Fuera de las metricas, dentro del historial.
    .where(and(eq(calls.personId, personId), incluyendoAnulados(calls)))
    // `createdAt` desempata: dos llamadas del mismo dia sin hora quedarian en
    // orden arbitrario, y un historial que cambia de orden entre recargas no se
    // puede leer.
    .orderBy(desc(calls.fechaLlamada), desc(calls.createdAt));

  // Las ventas salen de `ventasParaHistorial`, NO de `ventasDePersona`: son dos
  // preguntas distintas que hoy dan casi el mismo SQL (AGENTS.md). El historial
  // muestra las anuladas tachadas; `/mi-dia` no puede ofrecer registrar un abono
  // sobre una venta anulada. El calculo del dinero sigue viviendo en un solo lugar
  // (`ABONADO`/`SALDO` de `saldo.ts`), que es lo que no se puede duplicar.
  const ventas = await ventasParaHistorial(personId, db);

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
          anuladoEn: abonos.anuladoEn,
          anuladoPor: abonos.anuladoPor,
          motivoAnulacion: abonos.motivoAnulacion,
        })
        .from(abonos)
        .leftJoin(plataformasPago, eq(plataformasPago.id, abonos.plataformaId))
        // Tambien tachados, por la misma razon: un abono devuelto explica por que la
        // caja de ese dia bajo. Lo que NO hace es sumar — de eso se encarga el
        // `vigente(abonos)` del agregado en `ventasParaHistorial`.
        .where(and(inArray(abonos.saleId, ids), incluyendoAnulados(abonos)))
        .orderBy(asc(abonos.fecha), asc(abonos.createdAt))
    : [];

  // Quien anulo se resuelve a nombre en UNA consulta para las tres listas, en vez
  // de tres `leftJoin` a `users`: dos de esas tres consultas son agregados con
  // `groupBy(sales.id)`, donde una columna de otra tabla obliga a envolverla en un
  // `max(...)`, y ademas `users.nombre` chocaria con `productos.nombre` dentro de la
  // plantilla `sql`, que NO califica las columnas (AGENTS.md).
  const nombres = await nombresDeQuienAnulo(
    [...llamadas, ...ventas, ...filasDeAbonos].map((f) => f.anuladoPor),
    db,
  );

  return {
    persona,
    llamadas: llamadas.map(({ anuladoEn, anuladoPor, motivoAnulacion, ...llamada }) => ({
      ...llamada,
      anulacion: anulacionDe({ anuladoEn, anuladoPor, motivoAnulacion }, nombres),
    })),
    ventas: ventas.map(({ anuladoEn, anuladoPor, motivoAnulacion, ...venta }) => ({
      ...venta,
      anulacion: anulacionDe({ anuladoEn, anuladoPor, motivoAnulacion }, nombres),
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
          anulacion: anulacionDe(fila, nombres),
        })),
    })),
  };
}

/** Las tres columnas de anulacion tal como salen de la base. */
interface ColumnasDeAnulacion {
  anuladoEn: Date | null;
  anuladoPor: string | null;
  motivoAnulacion: string | null;
}

/**
 * Nombre (o correo, si la cuenta no tiene nombre) de cada usuario que anulo algo.
 * Los `null` y los repetidos se descartan antes de consultar.
 */
async function nombresDeQuienAnulo(
  ids: readonly (string | null)[],
  db: Db,
): Promise<Map<string, string>> {
  const unicos = [...new Set(ids.filter((id): id is string => id !== null))];
  if (unicos.length === 0) return new Map();
  const filas = await db
    .select({ id: users.id, nombre: users.nombre, email: users.email })
    .from(users)
    .where(inArray(users.id, unicos));
  return new Map(filas.map((f) => [f.id, f.nombre ?? f.email]));
}

/**
 * Arma la anulacion de un registro, o `null` si sigue vigente.
 *
 * Los tres campos van juntos por el CHECK de la base, asi que basta con mirar
 * `anuladoEn`. El `??` sobre el nombre no puede pasar en la practica —`anulado_por`
 * es una FK con `restrict`, asi que el usuario no puede desaparecer— y esta ahi para
 * no tener que mentir en el tipo.
 */
function anulacionDe(
  { anuladoEn, anuladoPor, motivoAnulacion }: ColumnasDeAnulacion,
  nombres: Map<string, string>,
): Anulacion | null {
  if (anuladoEn === null) return null;
  return {
    fecha: anuladoEn,
    porNombre: (anuladoPor && nombres.get(anuladoPor)) || "desconocido",
    motivo: motivoAnulacion ?? "",
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
    .select(COLUMNAS_DE_VENTA)
    .from(sales)
    .leftJoin(abonos, and(eq(abonos.saleId, sales.id), vigente(abonos)))
    .leftJoin(productos, eq(productos.id, sales.productoId))
    // Una venta anulada no se puede abonar: ofrecerla seria invitar al closer a
    // meter plata en un registro que no cuenta en ninguna metrica (ADR 0026).
    .where(and(eq(sales.personId, personId), vigente(sales)))
    .groupBy(sales.id)
    .orderBy(asc(sales.fecha));

  return filas;
}

/**
 * Las ventas de una persona **incluidas las anuladas**, para el historial de
 * `/personas/[id]` (ADR 0026 punto 4).
 *
 * Es una funcion aparte y no un parametro de `ventasDePersona` a proposito: son dos
 * preguntas distintas ("¿sobre cual puedo registrar un abono?" y "¿que le paso a
 * esta persona?") que hoy comparten casi todo el SQL. Un booleano las volveria una
 * sola con dos comportamientos, y el dia que una cambie habria que acordarse de la
 * otra.
 *
 * Lo que NO cambia entre las dos es el dinero: el `leftJoin` lleva `vigente(abonos)`
 * igual, porque un abono anulado no suma a lo abonado ni aqui ni alla.
 */
export async function ventasParaHistorial(personId: string, db: Db = dbDeLaApp) {
  return db
    .select({
      ...COLUMNAS_DE_VENTA,
      anuladoEn: sales.anuladoEn,
      anuladoPor: sales.anuladoPor,
      motivoAnulacion: sales.motivoAnulacion,
    })
    .from(sales)
    .leftJoin(abonos, and(eq(abonos.saleId, sales.id), vigente(abonos)))
    .leftJoin(productos, eq(productos.id, sales.productoId))
    .where(and(eq(sales.personId, personId), incluyendoAnulados(sales)))
    .groupBy(sales.id)
    .orderBy(asc(sales.fecha));
}

/**
 * Las columnas de una venta con su dinero ya resuelto, compartidas por las dos
 * preguntas de arriba. El `max(...)` sobre el nombre del producto es obligado por el
 * `groupBy(sales.id)`: Postgres deja proyectar las columnas de `sales` porque
 * dependen de su clave, pero no las de una tabla unida.
 */
const COLUMNAS_DE_VENTA = {
  saleId: sales.id,
  fecha: sales.fecha,
  productoId: sales.productoId,
  moneda: sales.moneda,
  precioAplicadoUsd: sales.precioAplicadoUsd,
  abonado: ABONADO,
  saldo: SALDO,
  productoNombre: sql<string | null>`max(${productos.nombre})`,
} as const;
