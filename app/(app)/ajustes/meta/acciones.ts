"use server";

import { revalidatePath } from "next/cache";
import { requireAdministracionGlobal } from "@/lib/auth/guards";
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
    const session = await requireAdministracionGlobal();
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
    await requireAdministracionGlobal();
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
