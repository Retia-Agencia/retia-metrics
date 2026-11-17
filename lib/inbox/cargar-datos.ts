import type { Session } from "next-auth";
import { eq } from "drizzle-orm";
import type { Rol } from "@/lib/auth/roles";
import { asignaPagosDePasarela } from "@/lib/auth/roles";
import { duenosPosibles } from "@/lib/deals/duenos";
import { motivos } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { pagosPendientes } from "@/lib/pagos/inbox";
import { bandejaParaActor } from "@/lib/queries/operacion";

export async function cargarDatosDeInbox(db: Db, entrada: { programId: string; session: Session; rol: Rol }) {
  const bandejaPendiente = bandejaParaActor(db, entrada.programId, entrada.session, entrada.rol);
  const [bandeja, duenos, motivosFilas, pagos] = await Promise.all([
    bandejaPendiente,
    duenosPosibles(db, entrada.programId),
    db.select().from(motivos).where(eq(motivos.activo, true)),
    asignaPagosDePasarela(entrada.rol) ? pagosPendientes(db, entrada.programId) : Promise.resolve([]),
  ]);
  return { bandeja, duenos, motivosFilas, pagos };
}
