"use server";

import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/auth/guards";
import { manejaPauta } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { guardarTokenMeta, tokenActivoMeta } from "@/lib/catalogo/meta";
import { db } from "@/lib/db";
import { ErrorDeApp } from "@/lib/errors";
import { hoyEnBogota } from "@/lib/format";
import { sincronizarPauta, type ResumenSincronizacionPauta } from "@/lib/pauta/sincronizar";

export type ResultadoGuardarMeta =
  | { ok: true; nombre: string; cuentasVisibles: number }
  | { ok: false; error: string; status: number };

export async function guardarTokenMetaAccion(token: string): Promise<ResultadoGuardarMeta> {
  try {
    const session = await requireRole("gerente", "paid_trafficker");
    if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
    const resultado = await guardarTokenMeta(db, session.user.id, token);
    revalidatePath("/ajustes/meta");
    return { ok: true, ...resultado };
  } catch (error) {
    if (error instanceof ErrorDeApp) {
      return { ok: false, error: error.message, status: error.status };
    }
    console.error("[meta] error no controlado", error);
    return { ok: false, error: "Error interno.", status: 500 };
  }
}

export type ResultadoSincronizarMeta =
  | ({ ok: true } & ResumenSincronizacionPauta)
  | { ok: false; error: string; status: number };

export async function sincronizarMetaAccion(): Promise<ResultadoSincronizarMeta> {
  try {
    const session = await requireRole("gerente", "paid_trafficker");
    if (!manejaPauta(await rolDeVista(session))) throw new ErrorDeApp("No autorizado.", 403);
    const resumen = await sincronizarPauta(db, {
      token: await tokenActivoMeta(db),
      hoy: hoyEnBogota(),
      disparadaPor: "manual",
    });
    revalidatePath("/ajustes/meta");
    return { ok: true, ...resumen };
  } catch (error) {
    if (error instanceof ErrorDeApp) {
      return { ok: false, error: error.message, status: error.status };
    }
    console.error("[meta] error no controlado al sincronizar");
    return { ok: false, error: "Error interno.", status: 500 };
  }
}
