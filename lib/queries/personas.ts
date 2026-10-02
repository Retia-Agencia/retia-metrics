import { and, asc, desc, eq, ilike, inArray, or } from "drizzle-orm";
import { db as dbDeLaApp } from "@/lib/db";
import {
  calls,
  motivos,
  origenes,
  deals,
  leads,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { Rol } from "@/lib/auth/roles";
import { idsDeProgramasVisibles, programaEnAlcance } from "@/lib/auth/alcance";
import { incluyendoAnulados } from "./vigente";

/**
 * Lecturas sobre una persona (ADR 0021, 0023, 0011, 0013, 0015). Solo SELECT: lo
 * que escribe ya vive en `lib/mutations/*`. La base entra por inyeccion (por
 * defecto la de la app) para correr los tests sobre PGlite sin Neon, igual que
 * `lib/queries/programas.ts`.
 *
 * Dos pantallas se sirven de aca:
 * - `/mi-dia` (ticket 003): `buscarPersonas` y `ventasDePersona`.
 * - `/personas/[id]` (ticket 006): `historialDePersona`, que COMPONE
 *   `ventasDePersona` en vez de repetir el calculo del saldo. El dinero se suma y
 *   se resta en un solo lugar; dos definiciones de "saldo" se desincronizan sin
 *   que nadie lo note.
 *
 * El buscador se limita a los programas que ESA sesión ve, y esa pregunta la
 * contesta `programasVisibles` en `lib/auth/alcance.ts` (ADR 0048, ticket 094): un
 * closer solo sus membresías activas, quien administra todos los activos. Antes este
 * módulo tenía su PROPIO join a `miembros_programa` con su propia rama por rol; era
 * una frontera copiada, y una frontera copiada es una que alguien puede olvidar
 * cerrar. Ahora importa el alcance como todo lo demás. `historialDePersona` SÍ lo
 * aplica desde el 094: se entra por id y un lead de un programa fuera del alcance es
 * un 404, igual que un id inexistente.
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
 * los programas que ESA sesión ve.
 *
 * Y "que ve" depende del rol, que es lo que este buscador no preguntaba (18-sep):
 * quien ADMINISTRA busca en todos los programas activos, un closer solo donde tiene
 * membresia activa. Antes el filtro era siempre la membresia, sin mirar el rol, y como
 * un gerente no necesita membresias, **un gerente no encontraba a nadie, nunca**. No
 * era un buscador vacio y ya: `/personas/[id]` solo se alcanza desde aqui, asi que un
 * gerente no tenia NINGUNA forma de abrir el historial de un lead. Misma familia que el
 * bug histórico de los catálogos: la pregunta era del rol y se contestó con la membresía. Desde el
 * 094 esa pregunta la contesta una sola funcion, `programasVisibles`, y este buscador
 * ya no la re-implementa: pide los ids del alcance y filtra por ellos.
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

  // El alcance —qué programas ve esta sesión— sale de la única función que lo
  // contesta (ADR 0048). Sin programas visibles no hay a quién buscar: se corta antes
  // de tocar la base.
  const idsVisibles = await idsDeProgramasVisibles(userId, rol, db);
  if (idsVisibles.size === 0) return [];

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

  // Se filtra por los ids del alcance en memoria: a esta escala (~2 programas) traer
  // el alcance y usar `inArray` es gratis y evita repetir el join a `miembros_programa`
  // —cada copia de ese join es una frontera que puede quedar desincronizada—. El join
  // a `programs` sigue: proyecta el nombre del programa y no cruza nada, porque los
  // ids ya vienen acotados al alcance.
  return db
    .select(columnas)
    .from(leads)
    .innerJoin(programs, eq(programs.id, leads.programId))
    .where(and(inArray(leads.programId, [...idsVisibles]), coincide))
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

/**
 * El historial de una persona: quien es y sus llamadas.
 *
 * ⚠️ Las ventas se fueron con `sales` (ticket 038). Vuelven como DEALS en la
 * etapa 6, que es donde se define la ficha del Lead completa (envios con diff,
 * contactos, deals abiertos y cerrados).
 */
export interface HistorialDePersona {
  persona: PersonaDelHistorial;
  /** De la mas reciente a la mas vieja: el historial se lee de arriba hacia abajo. */
  llamadas: LlamadaDelHistorial[];
}

/**
 * El historial de una persona, o `null` si no existe o queda FUERA del alcance de la
 * sesion (ticket 006, ADR 0048, ticket 094).
 *
 * La pagina traduce el `null` a un 404 en vez de inventar una ficha vacia: un id
 * que no existe y una persona sin actividad son cosas distintas. Y un lead de un
 * programa que esta sesion NO ve devuelve el MISMO `null`, para que la ruta responda
 * 404 exactamente igual que un id inexistente: un closer que teclea el id de una
 * persona del otro programa no recibe una pista de que existe. Antes no llevaba
 * filtro de alcance a proposito (se entraba desde el dashboard "todos ven todo", ADR
 * 0009 retirado); el 094 cierra esa frontera con la misma funcion que todo lo demas.
 */
export async function historialDePersona(
  personId: string,
  userId: string,
  rol: Rol | null,
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

  // El programa es una FRONTERA (AGENTS.md): un lead fuera del alcance de esta sesion
  // responde como si no existiera. Se comprueba contra la unica funcion de alcance
  // (ADR 0048); nunca un filtro de membresia copiado aca.
  if (!(await programaEnAlcance(userId, rol, persona.programId, db))) return null;

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
    // Una llamada cuelga del DEAL, no del lead (ADR 0037), asi que se llega a ella
    // por sus deals. `innerJoin` y no `leftJoin` a proposito: una llamada sin deal
    // no es de ningun lead y colarla aqui seria adivinar de quien es.
    //
    // `incluyendoAnulados(deals)` y no `vigente(deals)`: el historial muestra lo
    // anulado tachado (ADR 0026 punto 4). Las llamadas de un deal que se anulo por
    // error de tecleo ocurrieron de verdad, y esconderlas convertiria la anulacion
    // en un borrado con otro nombre. La regla es fuera de las metricas, dentro del
    // historial.
    .innerJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(motivos, eq(motivos.id, calls.motivoId))
    .leftJoin(origenes, eq(origenes.id, calls.origenId))
    // El historial SI muestra lo anulado, tachado (ADR 0026 punto 4): "aqui hubo una
    // llamada que se anulo porque se registro al lead equivocado" es informacion.
    // Fuera de las metricas, dentro del historial.
    .where(and(eq(deals.leadId, personId), incluyendoAnulados(calls)))
    // `createdAt` desempata: dos llamadas del mismo dia sin hora quedarian en
    // orden arbitrario, y un historial que cambia de orden entre recargas no se
    // puede leer.
    .orderBy(desc(calls.fechaLlamada), desc(calls.createdAt));

  // Quien anulo se resuelve a nombre en UNA consulta, en vez de un `leftJoin` a
  // `users`: `users.nombre` chocaria con las otras columnas `nombre` dentro de la
  // plantilla `sql`, que NO califica las columnas (AGENTS.md).
  const nombres = await nombresDeQuienAnulo(
    llamadas.map((f) => f.anuladoPor),
    db,
  );

  return {
    persona,
    llamadas: llamadas.map(({ anuladoEn, anuladoPor, motivoAnulacion, ...llamada }) => ({
      ...llamada,
      anulacion: anulacionDe({ anuladoEn, anuladoPor, motivoAnulacion }, nombres),
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
