"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { asignarProximaCohorte } from "@/lib/deals/asignar-proxima-cohorte";
import { ErrorDeApp } from "@/lib/errors";

export type ResultadoAsignar = { ok: true } | { ok: false; error: string };

export async function asignarProximaCohorteAccion(entrada: {
  programId: string;
  dealIds: string[];
  destinoId: string;
}): Promise<ResultadoAsignar> {
  try {
    const session = await requireRole("gerente", "closer");
    const rol = await rolDeVista(session);
    if (!esRolValido(rol) || !(await programaEnAlcance(session.user.id, rol, entrada.programId, db))) {
      throw new ErrorDeApp("No existe el programa.", 404);
    }
    await asignarProximaCohorte(db, {
      dealIds: entrada.dealIds,
      destinoId: entrada.destinoId,
      actor: { userId: session.user.id, rol, operaComoCloser: session.user.operaComoCloser },
    });
    revalidatePath("/p/[programa]/proxima-cohorte", "page");
    revalidatePath("/p/[programa]/deals", "page");
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof ErrorDeApp ? error.message : "Error interno." };
  }
}
