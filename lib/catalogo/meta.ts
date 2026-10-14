import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import {
  changeLog,
  cuentasPublicitarias,
  metaConexiones,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { normalizando } from "@/lib/errors-zod";
import { cuentasVisibles, usuarioDelToken, type CuentaVisibleMeta } from "@/lib/pauta/meta-api";
import { moldeDeCatalogo } from "./molde";

type FetchMeta = typeof globalThis.fetch;

/** Valor auditable que confirma el cambio sin copiar el secreto. */
export const TOKEN_OCULTO = "(oculto)";

const esquemaTokenMeta = z.string().trim().min(1, "El token de Meta es obligatorio.");
const esquemaIdMeta = z.string().trim().min(1, "La cuenta de Meta es obligatoria.");

const esquemaCuenta = z.object({
  idMeta: esquemaIdMeta,
  programId: z.string().uuid("Programa inválido."),
  nombre: z.string().trim().min(1),
  moneda: z.string().trim().min(1),
  zonaHoraria: z.string().trim().min(1),
});

function catalogoCuentas(db: Db, mensajeDuplicado = "Esa cuenta de Meta ya está vinculada.") {
  return moldeDeCatalogo(
    {
      tabla: cuentasPublicitarias,
      nombreTabla: "cuentas_publicitarias",
      esquema: esquemaCuenta,
      etiqueta: (fila) => String(fila.nombre),
      nombreEntidad: "una cuenta de Meta",
      mensajeDuplicado,
    },
    db,
  );
}

/** Único lector del secreto: ninguna función pública puede devolverlo. */
async function tokenActivo(db: Db): Promise<string> {
  const [conexion] = await db
    .select({ token: metaConexiones.tokenSecreto })
    .from(metaConexiones)
    .where(eq(metaConexiones.activo, true));
  if (!conexion) throw new ErrorDeApp("Primero conecta Meta en Ajustes.", 422);
  return conexion.token;
}

/** Lector deliberadamente estrecho para los dos disparadores de la sincronización. */
export async function tokenActivoMeta(db: Db): Promise<string> {
  return tokenActivo(db);
}

/** Prueba el token antes de tocar la base y conserva una única conexión activa. */
export async function guardarTokenMeta(
  db: Db,
  actorId: string,
  token: string,
  f: FetchMeta = globalThis.fetch,
): Promise<{ nombre: string; cuentasVisibles: number }> {
  return normalizando(async () => {
    const valor = esquemaTokenMeta.parse(token);
    const [usuario, cuentas] = await Promise.all([
      usuarioDelToken(valor, f),
      cuentasVisibles(valor, f),
    ]);

    await db.transaction(async (tx) => {
      const [actual] = await tx
        .select({ id: metaConexiones.id })
        .from(metaConexiones)
        .where(eq(metaConexiones.activo, true));
      const registroId = actual?.id ?? crypto.randomUUID();
      if (actual) {
        await tx
          .update(metaConexiones)
          .set({ tokenSecreto: valor, nombre: usuario.nombre })
          .where(eq(metaConexiones.id, actual.id));
      } else {
        await tx.insert(metaConexiones).values({
          id: registroId,
          tokenSecreto: valor,
          nombre: usuario.nombre,
        });
      }
      await tx.insert(changeLog).values({
        tabla: "meta_conexiones",
        registroId,
        etiqueta: usuario.nombre,
        campo: "token_secreto",
        valorAnterior: actual ? TOKEN_OCULTO : null,
        valorNuevo: TOKEN_OCULTO,
        origen: "app",
        userId: actorId,
      });
    });

    return { nombre: usuario.nombre, cuentasVisibles: cuentas.length };
  });
}

export type EstadoConexionMeta =
  | { conectada: false }
  | { conectada: true; nombre: string; desde: Date };

/** Estado seguro para la pantalla: selecciona sólo columnas no secretas. */
export async function estadoConexionMeta(db: Db): Promise<EstadoConexionMeta> {
  const [conexion] = await db
    .select({
      id: metaConexiones.id,
      nombre: metaConexiones.nombre,
      creadaEn: metaConexiones.createdAt,
    })
    .from(metaConexiones)
    .where(eq(metaConexiones.activo, true));
  if (!conexion) return { conectada: false };

  const [cambioDelToken] = await db
    .select({ desde: changeLog.detectadoEn })
    .from(changeLog)
    .where(
      and(
        eq(changeLog.tabla, "meta_conexiones"),
        eq(changeLog.registroId, conexion.id),
        eq(changeLog.campo, "token_secreto"),
      ),
    )
    .orderBy(desc(changeLog.detectadoEn))
    .limit(1);

  return {
    conectada: true,
    nombre: conexion.nombre,
    desde: cambioDelToken?.desde ?? conexion.creadaEn,
  };
}

/** Cuentas que Meta muestra y que todavía no pertenecen a ningún programa. */
export async function cuentasDisponibles(
  db: Db,
  f: FetchMeta = globalThis.fetch,
): Promise<CuentaVisibleMeta[]> {
  const visibles = await cuentasVisibles(await tokenActivo(db), f);
  const vinculadas = await db.select({ idMeta: cuentasPublicitarias.idMeta }).from(cuentasPublicitarias);
  const ids = new Set(vinculadas.map((cuenta) => cuenta.idMeta));
  return visibles.filter((cuenta) => !ids.has(cuenta.idMeta));
}

async function programaDeCuenta(db: Db, idMeta: string): Promise<string | null> {
  const [fila] = await db
    .select({ programa: programs.nombre })
    .from(cuentasPublicitarias)
    .innerJoin(programs, eq(programs.id, cuentasPublicitarias.programId))
    .where(eq(cuentasPublicitarias.idMeta, idMeta));
  return fila?.programa ?? null;
}

/** Vincula sólo una cuenta que el token ve; Meta decide sus datos descriptivos. */
export async function vincularCuenta(
  db: Db,
  actorId: string,
  programaId: string,
  idMeta: string,
  f: FetchMeta = globalThis.fetch,
): Promise<void> {
  return normalizando(async () => {
    const cuentaId = esquemaIdMeta.parse(idMeta);
    const token = await tokenActivo(db);
    const cuenta = (await cuentasVisibles(token, f)).find((visible) => visible.idMeta === cuentaId);
    if (!cuenta) throw new ErrorDeApp("Esa cuenta no la ve el token de Meta.", 422);

    const programaExistente = await programaDeCuenta(db, cuentaId);
    if (programaExistente) {
      throw new ErrorDeApp(`Esa cuenta ya está vinculada a ${programaExistente}.`, 409);
    }
    try {
      await catalogoCuentas(db).crear(actorId, { ...cuenta, programId: programaId });
    } catch (error) {
      // El prechequeo da el mensaje normal; esta segunda lectura cubre la carrera que
      // cierre el índice único entre el SELECT y el INSERT del molde.
      if (error instanceof ErrorDeApp && error.status === 409) {
        const programa = await programaDeCuenta(db, cuentaId);
        if (programa) throw new ErrorDeApp(`Esa cuenta ya está vinculada a ${programa}.`, 409);
      }
      throw error;
    }
  });
}

async function exigirCuentaDelPrograma(db: Db, id: string, programaId: string): Promise<void> {
  const [cuenta] = await db
    .select({ id: cuentasPublicitarias.id })
    .from(cuentasPublicitarias)
    .where(
      and(
        eq(cuentasPublicitarias.id, id),
        eq(cuentasPublicitarias.programId, programaId),
      ),
    );
  if (!cuenta) throw new ErrorDeApp("No existe una cuenta de Meta con ese id en el programa.", 404);
}

export async function activarCuenta(
  db: Db,
  actorId: string,
  programaId: string,
  id: string,
): Promise<void> {
  await exigirCuentaDelPrograma(db, id, programaId);
  await catalogoCuentas(db).reactivar(actorId, id);
}

export async function desactivarCuenta(
  db: Db,
  actorId: string,
  programaId: string,
  id: string,
): Promise<void> {
  await exigirCuentaDelPrograma(db, id, programaId);
  await catalogoCuentas(db).desactivar(actorId, id);
}

export interface CuentaDelPrograma {
  id: string;
  idMeta: string;
  nombre: string;
  moneda: string;
  zonaHoraria: string;
  activo: boolean;
  zonaDistintaDeBogota: boolean;
}

export async function cuentasDelPrograma(db: Db, programaId: string): Promise<CuentaDelPrograma[]> {
  const filas = await db
    .select({
      id: cuentasPublicitarias.id,
      idMeta: cuentasPublicitarias.idMeta,
      nombre: cuentasPublicitarias.nombre,
      moneda: cuentasPublicitarias.moneda,
      zonaHoraria: cuentasPublicitarias.zonaHoraria,
      activo: cuentasPublicitarias.activo,
    })
    .from(cuentasPublicitarias)
    .where(and(eq(cuentasPublicitarias.programId, programaId)))
    .orderBy(asc(cuentasPublicitarias.nombre));
  return filas.map((fila) => ({
    ...fila,
    zonaDistintaDeBogota: fila.zonaHoraria !== "America/Bogota",
  }));
}

export interface CuentaVinculada extends CuentaDelPrograma {
  programId: string;
  programa: string;
}

/** Inventario seguro para Ajustes: agrupa por programa sin leer la conexión ni su token. */
export async function cuentasVinculadas(db: Db): Promise<CuentaVinculada[]> {
  const filas = await db
    .select({
      id: cuentasPublicitarias.id,
      idMeta: cuentasPublicitarias.idMeta,
      nombre: cuentasPublicitarias.nombre,
      moneda: cuentasPublicitarias.moneda,
      zonaHoraria: cuentasPublicitarias.zonaHoraria,
      activo: cuentasPublicitarias.activo,
      programId: programs.id,
      programa: programs.nombre,
    })
    .from(cuentasPublicitarias)
    .innerJoin(programs, eq(programs.id, cuentasPublicitarias.programId))
    .orderBy(asc(programs.nombre), asc(cuentasPublicitarias.nombre));

  return filas.map((fila) => ({
    ...fila,
    zonaDistintaDeBogota: fila.zonaHoraria !== "America/Bogota",
  }));
}
