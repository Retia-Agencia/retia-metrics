import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";

import { almacenDeArchivos, urlParaVer } from "@/lib/archivos";
import { programaVisiblePorSlug } from "@/lib/auth/alcance";
import { requireRole, respuestaDeError } from "@/lib/auth/guards";
import { esRolValido } from "@/lib/auth/roles";
import { rolDeVista } from "@/lib/auth/vista";
import { db } from "@/lib/db";
import { archivos } from "@/lib/db/schema";
import { ErrorDeApp } from "@/lib/errors";

export const runtime = "nodejs";

const ES_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request, { params }: { params: Promise<{ programa: string; id: string }> }) {
  try {
    const session = await requireRole("gerente", "closer");
    const { programa: slug, id } = await params;
    const rol = await rolDeVista(session);
    const programa = esRolValido(rol) ? await programaVisiblePorSlug(session.user.id, rol, slug, db) : null;
    if (!programa || !ES_UUID.test(id)) throw new ErrorDeApp("No existe el archivo.", 404);

    const [archivo] = await db.select({ id: archivos.id }).from(archivos).where(and(
      eq(archivos.id, id),
      eq(archivos.programId, programa.id),
    ));
    if (!archivo) throw new ErrorDeApp("No existe el archivo.", 404);
    const destino = await urlParaVer(db, almacenDeArchivos(), id);
    return NextResponse.redirect(new URL(destino, request.url));
  } catch (error) {
    return respuestaDeError(error);
  }
}
