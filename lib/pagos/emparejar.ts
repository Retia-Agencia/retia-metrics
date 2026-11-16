import { and, eq, inArray, or } from "drizzle-orm";
import { leadContactos, leads } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { resolverIdentidad, type ContactoConocido } from "@/lib/ingesta/identidad";
import { normalizarTelefono } from "@/lib/ingesta/envio";
import { normalizarEmail } from "@/lib/sheets/mapeo";

export async function emparejarComprador(db: Db, programId: string, datos: { correo?: string; telefono?: string }) {
  const correo = normalizarEmail(datos.correo); const telefono = normalizarTelefono(datos.telefono);
  const conocidos: ContactoConocido[] = [];
  if (correo) {
    const filas = await db.select({ leadId: leads.id, valor: leads.emailNormalizado }).from(leads)
      .where(and(eq(leads.programId, programId), eq(leads.emailNormalizado, correo)));
    conocidos.push(...filas.map((f) => ({ ...f, tipo: "correo" as const, confirmado: true })));
  }
  const valores = [correo, telefono].filter((v): v is string => v !== null);
  if (valores.length) conocidos.push(...await db.select({ leadId: leadContactos.leadId, tipo: leadContactos.tipo, valor: leadContactos.valor, confirmado: leadContactos.confirmado })
    .from(leadContactos).where(and(eq(leadContactos.programId, programId), inArray(leadContactos.valor, valores), or(eq(leadContactos.tipo, "correo"), eq(leadContactos.tipo, "telefono")))));
  const r = resolverIdentidad([{ token: "compra", posicion: null, correo, telefono }], conocidos);
  const a = r.asignaciones[0];
  const leadId = a?.lead?.tipo === "existente" && (a.motivo === "correo" || a.motivo === "telefono") ? a.lead.leadId : null;
  const choque = r.posiblesDuplicados.find((x) => x.motivo === "telefono_de_otro_lead");
  return { leadId, emparejadaPor: leadId ? a.motivo as "correo" | "telefono" : null, correo, telefono,
    notaSistema: choque ? `El teléfono también coincide con otro lead (${choque.leads[1]}). El correo tiene prioridad.` : null };
}
