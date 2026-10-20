"use server";

import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { z } from "zod";
import { requireRole } from "@/lib/auth/guards";
import { rolDeVista } from "@/lib/auth/vista";
import { esRolValido } from "@/lib/auth/roles";
import { exigirAccesoAlPrograma } from "@/lib/catalogo/acceso-programa";
import { db } from "@/lib/db";
import { programs, tipoIntegracionEnum, type TipoIntegracion } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota } from "@/lib/format";
import { guardarIntegracion, tokensMeta } from "@/lib/integraciones";
import { sincronizarPauta, type ResumenSincronizacionPauta } from "@/lib/pauta/sincronizar";
import type { ResultadoAccion } from "./acciones-programa";

const esquemaTipo = z.enum(tipoIntegracionEnum.enumValues);

async function actorGerente(programId: string) {
  const session = await requireRole("gerente");
  const rol = await rolDeVista(session);
  if (!esRolValido(rol)) throw new ErrorDeApp("Rol inválido.", 403);
  const [programa] = await db.select({ id: programs.id }).from(programs).where(eq(programs.id, programId));
  if (!programa) throw new ErrorDeApp("No existe el programa.", 404);
  await exigirAccesoAlPrograma(db, { id: session.user.id, rol }, programId, "No puedes administrar este programa.");
  return session.user.id;
}

function fallo(error: unknown): { ok: false; error: string } {
  if (error instanceof ErrorDeApp) return { ok: false, error: error.message };
  console.error("[integraciones] error no controlado");
  return { ok: false, error: "Error interno." };
}

export async function guardarIntegracionAccion(
  programId: string, tipoCrudo: TipoIntegracion, valor: string,
): Promise<ResultadoAccion> {
  try {
    const actorId = await actorGerente(programId);
    const tipoLeido = esquemaTipo.safeParse(tipoCrudo);
    if (!tipoLeido.success) throw new ErrorDeApp("Integración inválida.", 400);
    const tipo = tipoLeido.data;
    await guardarIntegracion(db, actorId, programId, tipo, valor);
    revalidatePath("/p/[programa]/programa", "page");
    return { ok: true };
  } catch (error) {
    return fallo(error);
  }
}

export type ResultadoSincronizarPrograma =
  | ({ ok: true } & ResumenSincronizacionPauta)
  | { ok: false; error: string };

export async function sincronizarMetaDelProgramaAccion(programId: string): Promise<ResultadoSincronizarPrograma> {
  try {
    await actorGerente(programId);
    const resumen = await sincronizarPauta(db, {
      tokens: await tokensMeta(db), hoy: hoyEnBogota(), disparadaPor: "manual", programId,
    });
    revalidatePath("/p/[programa]/programa", "page");
    return { ok: true, ...resumen };
  } catch (error) {
    return fallo(error);
  }
}
