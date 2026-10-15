"use server";

import { requireRole } from "@/lib/auth/guards";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import {
  guardarReporte,
  type EntradaReporteWhatsapp,
} from "@/lib/catalogo/reportes-whatsapp";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";

export type ResultadoAccionReporte =
  | { ok: true }
  | { ok: false; error: string; status: number };

export async function guardarReporteWhatsappAccion(
  programId: string,
  input: EntradaReporteWhatsapp,
): Promise<ResultadoAccionReporte> {
  try {
    const session = await requireRole("gerente");
    const rol = await rolDeVista(session);
    if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
    if (!(await programaEnAlcance(session.user.id, rol, programId, db))) {
      throw new ErrorDeApp("No autorizado para este programa.", 403);
    }
    await guardarReporte(db, { id: session.user.id, rol }, programId, input);
    return { ok: true };
  } catch (error) {
    if (error instanceof ErrorDeApp) {
      return { ok: false, error: error.message, status: error.status };
    }
    console.error("[programa/reporte-whatsapp] error no controlado", error);
    return { ok: false, error: "Error interno.", status: 500 };
  }
}
