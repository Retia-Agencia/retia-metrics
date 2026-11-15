"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { esAdministrador, esRolValido } from "@/lib/auth/roles";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { rolDeVista } from "@/lib/auth/vista";
import { activarCuenta, desactivarCuenta, vincularCuenta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";

export type ResultadoCuentaMeta =
  | { ok: true }
  | { ok: false; error: string; status: number };

async function actorAdministrador(programaId: string): Promise<string> {
  const session = await requireRole("gerente");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol) || !esAdministrador(rol)) throw new ErrorDeApp("No autorizado.", 403);
  // `exigirAccesoAlPrograma` y no `programaEnAlcance`: la cuenta de Meta se vincula también
  // mientras el programa está inactivo, en su recorrido de configuración (ADR 0094 punto 4, ADR 0132).
  await exigirAccesoAlPrograma(db, { id: session.user.id, rol }, programaId, "No autorizado para este programa.");
  return session.user.id;
}

async function ejecutar(
  programaId: string,
  operacion: (actorId: string) => Promise<void>,
): Promise<ResultadoCuentaMeta> {
  try {
    await operacion(await actorAdministrador(programaId));
    revalidatePath("/p/[programa]/programa", "page");
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeApp) {
      return { ok: false, error: error.message, status: error.status };
    }
    console.error("[cuentas-meta] error no controlado", error);
    return { ok: false, error: "Error interno.", status: 500 };
  }
}

export async function vincularCuentaMetaAccion(
  programaId: string,
  idMeta: string,
): Promise<ResultadoCuentaMeta> {
  return ejecutar(programaId, (actorId) => vincularCuenta(db, actorId, programaId, idMeta));
}

export async function activarCuentaMetaAccion(
  programaId: string,
  id: string,
): Promise<ResultadoCuentaMeta> {
  return ejecutar(programaId, (actorId) => activarCuenta(db, actorId, programaId, id));
}

export async function desactivarCuentaMetaAccion(
  programaId: string,
  id: string,
): Promise<ResultadoCuentaMeta> {
  return ejecutar(programaId, (actorId) => desactivarCuenta(db, actorId, programaId, id));
}
