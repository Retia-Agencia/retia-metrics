import { and, eq } from "drizzle-orm";
import { programaEnAlcance } from "@/lib/auth/alcance";
import type { Rol } from "@/lib/auth/roles";
import { abonos, calls, deals } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import { incluyendoAnulados } from "@/lib/queries/vigente";

type ActorDeAlcance = { userId: string; rol: Rol };

async function exigirPrograma(db: Db, actor: ActorDeAlcance, programId: string | undefined) {
  if (!programId || !(await programaEnAlcance(actor.userId, actor.rol, programId, db))) {
    throw new ErrorDeApp("No existe el deal.", 404);
  }
}

export async function exigirDealVisible(db: Db, actor: ActorDeAlcance, dealId: string): Promise<{ programId: string }> {
  const [fila] = await db.select({ programId: deals.programId }).from(deals)
    .where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  await exigirPrograma(db, actor, fila?.programId);
  return fila!;
}

export async function exigirLlamadaVisible(db: Db, actor: ActorDeAlcance, callId: string): Promise<{ programId: string; dealId: string | null }> {
  const [fila] = await db.select({ programId: calls.programId, dealId: calls.dealId }).from(calls)
    .where(and(eq(calls.id, callId), incluyendoAnulados(calls)));
  await exigirPrograma(db, actor, fila?.programId);
  return fila!;
}

export async function exigirAbonoVisible(db: Db, actor: ActorDeAlcance, abonoId: string): Promise<{ programId: string; dealId: string }> {
  const [fila] = await db.select({ programId: abonos.programId, dealId: abonos.dealId }).from(abonos)
    .where(and(eq(abonos.id, abonoId), incluyendoAnulados(abonos)));
  await exigirPrograma(db, actor, fila?.programId);
  return fila!;
}
