import { and, asc, eq, inArray } from "drizzle-orm";
import { calls, changeLog, deals, leads, motivos, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { incluyendoAnulados } from "@/lib/queries/vigente";

export interface DetalleDeLlamada {
  id: string;
  resultado: (typeof calls.$inferSelect)["resultado"];
  fechaAgenda: Date | null;
  fechaLlamada: Date | null;
  fechaSeguimiento: Date | null;
  origen: string;
  linkCalendly: string | null;
  linkGrain: string | null;
  calendlyHostEmail: string | null;
  emailLead: string | null;
  notas: string | null;
  closer: { nombre: string | null; email: string | null } | null;
  dealId: string | null;
  lead: { nombre: string | null; email: string } | null;
  setter: { nombre: string | null } | null;
  motivo: { nombre: string } | null;
  anuladoEn: Date | null;
  anuladoPorNombre: string | null;
  motivoAnulacion: string | null;
  createdAt: Date;
  historial: {
    campo: string;
    valorAnterior: string | null;
    valorNuevo: string | null;
    detectadoEn: Date;
    userNombre: string | null;
  }[];
  nombresDelHistorial: Record<string, string>;
}

export async function detalleDeLlamada(
  db: Db,
  programId: string,
  callId: string,
): Promise<DetalleDeLlamada | null> {
  const [fila] = await db
    .select({
      llamada: calls,
      dealId: deals.id,
      setterUserId: deals.setterUserId,
      leadNombre: leads.nombre,
      leadEmail: leads.emailNormalizado,
      motivoNombre: motivos.nombre,
    })
    .from(calls)
    .leftJoin(deals, and(eq(deals.id, calls.dealId), incluyendoAnulados(deals)))
    .leftJoin(leads, eq(leads.id, deals.leadId))
    .leftJoin(motivos, eq(motivos.id, calls.motivoId))
    .where(and(eq(calls.id, callId), eq(calls.programId, programId), incluyendoAnulados(calls)));
  if (!fila) return null;

  const idsDeUsuarios = [fila.llamada.closerUserId, fila.setterUserId, fila.llamada.anuladoPor].filter(
    (id): id is string => id != null,
  );
  const [usuarios, historial] = await Promise.all([
    idsDeUsuarios.length === 0
      ? Promise.resolve([])
      : db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(inArray(users.id, idsDeUsuarios)),
    db
      .select({
        campo: changeLog.campo,
        valorAnterior: changeLog.valorAnterior,
        valorNuevo: changeLog.valorNuevo,
        detectadoEn: changeLog.detectadoEn,
        userNombre: users.nombre,
      })
      .from(changeLog)
      .leftJoin(users, eq(users.id, changeLog.userId))
      .where(and(eq(changeLog.tabla, "calls"), eq(changeLog.registroId, callId)))
      .orderBy(asc(changeLog.detectadoEn)),
  ]);
  const usuario = (id: string | null) => usuarios.find((u) => u.id === id) ?? null;
  const closer = usuario(fila.llamada.closerUserId);
  const setter = usuario(fila.setterUserId);
  const anuladoPor = usuario(fila.llamada.anuladoPor);
  const esUuid = (valor: string): boolean => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(valor);
  const valoresDeCampos = (campos: Set<string>): string[] => [...new Set(
    historial.flatMap((cambio) => campos.has(cambio.campo)
      ? [cambio.valorAnterior, cambio.valorNuevo].filter((valor): valor is string => valor != null && esUuid(valor))
      : []),
  )];
  const idsDeUsuariosDelHistorial = valoresDeCampos(new Set(["closerUserId", "closer_user_id", "anuladoPor", "anulado_por"]));
  const idsDeMotivosDelHistorial = valoresDeCampos(new Set(["motivoId", "motivo_id"]));
  const [usuariosDelHistorial, motivosDelHistorial] = await Promise.all([
    idsDeUsuariosDelHistorial.length === 0
      ? Promise.resolve([])
      : db.select({ id: users.id, nombre: users.nombre, email: users.email }).from(users).where(inArray(users.id, idsDeUsuariosDelHistorial)),
    idsDeMotivosDelHistorial.length === 0
      ? Promise.resolve([])
      : db.select({ id: motivos.id, nombre: motivos.nombre }).from(motivos).where(inArray(motivos.id, idsDeMotivosDelHistorial)),
  ]);
  const nombresDelHistorial = Object.fromEntries([
    ...usuariosDelHistorial.map((u) => [u.id, u.nombre ?? u.email]),
    ...motivosDelHistorial.map((motivo) => [motivo.id, motivo.nombre]),
  ]);

  return {
    id: fila.llamada.id,
    resultado: fila.llamada.resultado,
    fechaAgenda: fila.llamada.fechaAgenda,
    fechaLlamada: fila.llamada.fechaLlamada,
    fechaSeguimiento: fila.llamada.fechaSeguimiento,
    origen: fila.llamada.origen,
    linkCalendly: fila.llamada.linkCalendly,
    linkGrain: fila.llamada.linkGrain,
    calendlyHostEmail: fila.llamada.calendlyHostEmail,
    emailLead: fila.llamada.emailLead,
    notas: fila.llamada.notas,
    closer: closer
      ? { nombre: closer.nombre ?? fila.llamada.closerId, email: closer.email }
      : fila.llamada.closerId
        ? { nombre: fila.llamada.closerId, email: null }
        : null,
    dealId: fila.dealId,
    lead: fila.dealId && fila.leadEmail
      ? { nombre: fila.leadNombre, email: fila.leadEmail }
      : null,
    setter: setter ? { nombre: setter.nombre } : null,
    motivo: fila.motivoNombre ? { nombre: fila.motivoNombre } : null,
    anuladoEn: fila.llamada.anuladoEn,
    anuladoPorNombre: anuladoPor?.nombre ?? null,
    motivoAnulacion: fila.llamada.motivoAnulacion,
    createdAt: fila.llamada.createdAt,
    historial,
    nombresDelHistorial,
  };
}
