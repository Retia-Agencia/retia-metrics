import { and, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import {
  abonos,
  changeLog,
  enlacesPago,
  plataformasPago,
  plataformasPrograma,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ejecutarJuntas } from "@/lib/db/ejecutar-juntas";
import { ErrorDeApp } from "@/lib/errors";
import { esAdministrador } from "@/lib/auth/roles";
import { exigirAccesoAlPrograma, type ActorConAcceso } from "./acceso-programa";
import { moldeDeCatalogo, type FilaCatalogo } from "./molde";

/**
 * Plataformas de pago (ADR 0012), estrenando el molde de catalogo.
 *
 * Un solo esquema zod para toda la entidad: lo usan el formulario, el route
 * handler y cualquier codigo. No hay dos validaciones de la misma cosa.
 */
export const esquemaPlataformaPago = z.object({
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(80, "Maximo 80 caracteres."),
});

/** Entrada validada para crear o editar una plataforma de pago. */
export type EntradaPlataformaPago = z.infer<typeof esquemaPlataformaPago>;

/** Catalogo de plataformas de pago. Recibe la base (por defecto la de la app). */
export function plataformasDePago(db?: Db) {
  return moldeDeCatalogo(
    {
      tabla: plataformasPago,
      nombreTabla: "plataformas_pago",
      esquema: esquemaPlataformaPago,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una plataforma de pago",
      // Quien apunta a una plataforma por FK `restrict`: los abonos (`plataforma_id`)
      // y los enlaces de pago (`plataforma_id`). Se declaran las DOS: si solo se
      // contaran los abonos, un enlace de pago que aun la usa daria conteo cero y el
      // `DELETE` chocaria contra su FK, saliendo como el 400 de "carrera" cuando en
      // realidad la plataforma SI esta en uso. Contar ambas hace que se desactive y
      // se explique, que es lo correcto.
      dependientes: [
        { tabla: abonos, columna: abonos.plataformaId },
        { tabla: enlacesPago, columna: enlacesPago.plataformaId },
      ],
    },
    db,
  );
}


// ──────────────────────────────── que programas sirve una plataforma (ADR 0034)

/**
 * El vinculo plataforma-programa es una TABLA PUENTE, no una columna (ADR 0034).
 *
 * Una columna `program_id` en `plataformas_pago` obligaria a aflojar el indice unico
 * sobre `lower(nombre)` —el que existe para que "Paypal" y "PayPal" no partan las
 * metricas en dos— y PayPal pasaria a ser dos filas con dos ids. Con la puente, el
 * indice queda intacto y PayPal sirviendo a dos programas son dos vinculos.
 *
 * Y el vinculo es DATO PROPIO, no derivado de `enlaces_pago`: un abono por
 * transferencia o Zelle no pasa por ningun link, y derivarlo haria invisible justo
 * ese caso (Mani, 20-sep).
 *
 * Una plataforma SI puede existir sin programa: queda invisible en los selectores
 * hasta que alguien la asocie, y eso esta bien. Lo que no puede existir sin programa
 * es el ENLACE, y `enlaces_pago.program_id` ya es NOT NULL desde el ticket 022.
 *
 * Desasociar BORRA la fila puente, y esa es la operacion honesta: el vinculo no lo
 * referencia nadie —ninguna venta ni abono apunta a el—, asi que no hay historial que
 * proteger, que es lo que el "nunca se borra" del ADR 0012 cuida. El rastro de quien
 * lo quito y cuando queda en `change_log`. El guardian de `tests/catalogo.test.ts`
 * nombra esta excepcion: sigue prohibido un DELETE sobre una tabla de catalogo.
 */

/** id de una fila: uuid o error de validacion (400), nunca un 500 del driver. */
const esquemaUuid = z.string().uuid("El identificador no es válido.");

function uuidValido(id: string): string {
  const parsed = esquemaUuid.safeParse(id);
  if (!parsed.success) {
    throw new ErrorDeApp(parsed.error.issues[0]?.message ?? "Identificador inválido.", 400);
  }
  return parsed.data;
}

const NEGADO_PLATAFORMA = "No puedes gestionar las plataformas de un programa donde no vendes.";

/**
 * Que programas sirve cada plataforma, en UNA consulta.
 *
 * La pantalla pinta las plataformas con sus programas, asi que preguntarlo por
 * plataforma seria un N+1 (el mismo que costo arreglar en `/recursos` el 19-sep). Se
 * agrupa en memoria, que a esta escala es gratis, en vez de con una subconsulta
 * correlacionada — la plantilla `sql` con una tabla adentro deja las columnas sin
 * calificar y el conteo da cero sin lanzar un error (ticket 025).
 */
export async function vinculosDePlataformas(db: Db): Promise<Map<string, string[]>> {
  const filas = await db
    .select({
      plataformaId: plataformasPrograma.plataformaId,
      programId: plataformasPrograma.programId,
    })
    .from(plataformasPrograma);

  const porPlataforma = new Map<string, string[]>();
  for (const fila of filas) {
    const yaEstan = porPlataforma.get(fila.plataformaId) ?? [];
    yaEstan.push(fila.programId);
    porPlataforma.set(fila.plataformaId, yaEstan);
  }
  return porPlataforma;
}

/**
 * Las plataformas ACTIVAS que sirven a un programa: es lo que muestra un selector al
 * registrar una venta o un abono, y al crear un enlace de pago.
 *
 * Una plataforma sin vinculo no sale aca, que es el punto del ADR 0034.
 */
export async function plataformasDelPrograma(
  db: Db,
  programId: string,
): Promise<FilaCatalogo[]> {
  const vinculos = await db
    .select({ plataformaId: plataformasPrograma.plataformaId })
    .from(plataformasPrograma)
    .where(eq(plataformasPrograma.programId, programId));

  const ids = vinculos.map((v) => v.plataformaId);
  if (ids.length === 0) return [];

  const filas = await db
    .select()
    .from(plataformasPago)
    .where(and(inArray(plataformasPago.id, ids), eq(plataformasPago.activo, true)));

  return filas.sort((a, b) => a.nombre.localeCompare(b.nombre, "es"));
}

/** Lee la plataforma y el programa, o lanza el 404 que corresponda. */
async function parValido(db: Db, plataformaId: string, programId: string) {
  const [plataforma] = await db
    .select()
    .from(plataformasPago)
    .where(eq(plataformasPago.id, uuidValido(plataformaId)));
  if (!plataforma) throw new ErrorDeApp("No existe una plataforma de pago con ese id.", 404);

  const [programa] = await db
    .select()
    .from(programs)
    .where(eq(programs.id, uuidValido(programId)));
  if (!programa) throw new ErrorDeApp("No existe un programa con ese id.", 404);

  return { plataforma, programa };
}

/**
 * Asocia una plataforma a un programa. Idempotente: si el vinculo ya existe no hace
 * nada y no escribe una segunda fila en `change_log` (el indice unico del par lo
 * garantiza en la base, ADR 0005; esto solo evita el ruido).
 *
 * Un closer solo asocia donde tiene membresia ACTIVA; quien administra, en cualquier
 * programa. La regla es de DATOS y la responde `exigirAccesoAlPrograma`, no la
 * pantalla.
 */
export async function asociarPrograma(
  db: Db,
  actor: ActorConAcceso,
  plataformaId: string,
  programId: string,
): Promise<void> {
  const { plataforma, programa } = await parValido(db, plataformaId, programId);
  await exigirAccesoAlPrograma(db, actor, programa.id, NEGADO_PLATAFORMA);

  const [yaEsta] = await db
    .select({ id: plataformasPrograma.id })
    .from(plataformasPrograma)
    .where(
      and(
        eq(plataformasPrograma.plataformaId, plataforma.id),
        eq(plataformasPrograma.programId, programa.id),
      ),
    )
    .limit(1);
  if (yaEsta) return;

  await ejecutarJuntas(db, (tx) => [
    tx.insert(plataformasPrograma).values({ plataformaId: plataforma.id, programId: programa.id }),
    tx.insert(changeLog).values({
      tabla: "plataformas_programa",
      registroId: plataforma.id,
      etiqueta: plataforma.nombre,
      campo: "programa",
      valorAnterior: null,
      valorNuevo: programa.nombre,
      origen: "app" as const,
      userId: actor.id,
    }),
  ]);
}

/**
 * Quita el vinculo. Idempotente igual que asociar: desasociar lo que ya no esta no es
 * un error, solo no escribe nada.
 *
 * La plataforma NO se toca: sigue existiendo y puede seguir sirviendo a otros
 * programas. Lo unico que cambia es que deja de salir en los selectores de ESTE.
 */
export async function desasociarPrograma(
  db: Db,
  actor: ActorConAcceso,
  plataformaId: string,
  programId: string,
): Promise<void> {
  const { plataforma, programa } = await parValido(db, plataformaId, programId);
  await exigirAccesoAlPrograma(db, actor, programa.id, NEGADO_PLATAFORMA);

  const [vinculo] = await db
    .select({ id: plataformasPrograma.id })
    .from(plataformasPrograma)
    .where(
      and(
        eq(plataformasPrograma.plataformaId, plataforma.id),
        eq(plataformasPrograma.programId, programa.id),
      ),
    )
    .limit(1);
  if (!vinculo) return;

  await ejecutarJuntas(db, (tx) => [
    tx.delete(plataformasPrograma).where(eq(plataformasPrograma.id, vinculo.id)),
    tx.insert(changeLog).values({
      tabla: "plataformas_programa",
      registroId: plataforma.id,
      etiqueta: plataforma.nombre,
      campo: "programa",
      valorAnterior: programa.nombre,
      valorNuevo: null,
      origen: "app" as const,
      userId: actor.id,
    }),
  ]);
}


/**
 * Crea una plataforma y la asocia a sus programas en UNA operacion (decision de Mani,
 * 20-sep).
 *
 * Es UNA funcion y no dos llamadas seguidas porque una plataforma creada sin vinculo
 * nace INVISIBLE: no sale en ningun selector. Para un administrador eso es valido —
 * puede asociarla despues—, pero para un closer seria trabajo perdido que ademas no
 * avisa: crea la plataforma, no la ve, y no hay ningun error que mirar. Por eso a
 * quien no administra se le exige al menos un programa.
 *
 * El acceso se verifica ANTES de crear: al reves, un programa ajeno dejaria la
 * plataforma ya creada y sin vincular, que es justo la fila huerfana que se queria
 * evitar.
 */
export async function crearPlataformaConProgramas(
  db: Db,
  actor: ActorConAcceso,
  input: EntradaPlataformaPago,
  programIds: readonly string[],
): Promise<FilaCatalogo> {
  // Se valida aca y no se deja al molde: el molde lanza `ZodError`, que la server
  // action no reconoce y convertiria en "Error interno." en vez de un 400 legible.
  const entrada = esquemaPlataformaPago.safeParse(input);
  if (!entrada.success) {
    throw new ErrorDeApp(entrada.error.issues[0]?.message ?? "Petición inválida.", 400);
  }

  if (!esAdministrador(actor.rol) && programIds.length === 0) {
    throw new ErrorDeApp(
      "Elige al menos un programa: una plataforma sin programa no aparece en ningún selector.",
      400,
    );
  }

  for (const programId of programIds) {
    const [programa] = await db
      .select({ id: programs.id })
      .from(programs)
      .where(eq(programs.id, uuidValido(programId)));
    if (!programa) throw new ErrorDeApp("No existe un programa con ese id.", 404);
    await exigirAccesoAlPrograma(db, actor, programa.id, NEGADO_PLATAFORMA);
  }

  // ponytail: crear y asociar son operaciones separadas, no un solo lote. Como el
  // acceso ya se verifico arriba, lo unico que puede cortar a la mitad es un fallo de
  // red o de la base, y el resultado seria una plataforma sin algun vinculo: visible
  // en /ajustes/catalogos y reparable con un clic. Si eso llegara a pasar de verdad,
  // el arreglo es un `crear` del molde que acepte consultas extra para `ejecutarJuntas`.
  const creada = await plataformasDePago(db).crear(actor.id, entrada.data);
  for (const programId of programIds) {
    await asociarPrograma(db, actor, creada.id, programId);
  }
  return creada;
}
