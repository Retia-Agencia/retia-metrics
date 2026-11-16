import { and, eq } from "drizzle-orm";
import { programaEnAlcance } from "@/lib/auth/alcance";
import { asignaPagosDePasarela, AuthorizationError, type Rol } from "@/lib/auth/roles";
import { changeLog, comprasPasarela, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";

export async function asignarCompraALead(db: Db, actor: { userId: string; rol: Rol | null }, compraId: string, leadId: string) {
  if (!asignaPagosDePasarela(actor.rol)) throw new AuthorizationError();
  return db.transaction(async (tx) => {
    const [compra] = await tx.select().from(comprasPasarela).where(eq(comprasPasarela.id, compraId)).for("update");
    if (!compra || !(await programaEnAlcance(actor.userId, actor.rol, compra.programId, tx as Db))) throw new ErrorDeApp("No existe la compra.", 404);
    if (compra.estado !== "sin_emparejar") throw new ErrorDeApp("La compra ya no está pendiente de asignación.", 409);
    const [lead] = await tx.select({ id: leads.id }).from(leads).where(and(eq(leads.id, leadId), eq(leads.programId, compra.programId)));
    if (!lead) throw new ErrorDeApp("No existe el lead.", 404);
    await tx.update(comprasPasarela).set({ leadId, estado: "emparejada", emparejadaPor: "manual", asignadaPorUserId: actor.userId, updatedAt: new Date() }).where(eq(comprasPasarela.id, compraId));
    await tx.insert(changeLog).values({ tabla: "compras_pasarela", registroId: compraId, campo: "leadId", valorAnterior: null, valorNuevo: leadId, origen: "app", userId: actor.userId });
    return { compraId, leadId };
  });
}
