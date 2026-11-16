import { eq } from "drizzle-orm";
import type { Db } from "@/lib/db/tipos";
import { comprasPasarela } from "@/lib/db/schema";
import { EVENTOS_DE_COMPRA_HOTMART, telefonoDelComprador } from "./hotmart";
import { traducirCompra } from "./traducir";
import { emparejarComprador } from "./emparejar";
import { normalizarEmail } from "@/lib/sheets/mapeo";
import { normalizarTelefono } from "@/lib/ingesta/envio";
import { PROVEEDORES_DE_PAGO } from "./proveedores";

export interface IntegracionDePago { id: string; programId: string }
export async function procesarCompra(db: Db, integracion: IntegracionDePago, cuerpo: string, sobreId: string | null) {
  // El nombre del evento se mira antes del contrato completo: un reembolso u otro evento se
  // guarda en la caja negra y se ignora (453), sin marcar el sobre con error por su forma.
  const nombre = (JSON.parse(cuerpo) as { event?: unknown }).event;
  if (typeof nombre !== "string" || !EVENTOS_DE_COMPRA_HOTMART.has(nombre)) return { compraId: null, motivo: "procesado" as const };
  const evento = PROVEEDORES_DE_PAGO.hotmart.leerCompra(cuerpo);
  const compra = evento.data.purchase;
  return db.transaction(async (tx) => {
    const base = tx as Db;
    const [insertada] = await base.insert(comprasPasarela).values({
      programId: integracion.programId, integracionId: integracion.id, sobreId, proveedor: "hotmart",
      transaccion: compra.transaction, evento: evento.event, estado: "en_revision",
      aprobadaEn: new Date(compra.approved_date),
    }).onConflictDoNothing().returning();
    if (!insertada) return { compraId: null, motivo: "procesado" as const };
    const traduccion = await traducirCompra(base, integracion.programId, compra);
    const buyer = evento.data.buyer;
    const emparejamiento = traduccion.estado === "sin_emparejar"
      ? await emparejarComprador(base, integracion.programId, { correo: buyer.email, telefono: telefonoDelComprador(buyer) })
      : { leadId: null, emparejadaPor: null, correo: normalizarEmail(buyer.email), telefono: normalizarTelefono(telefonoDelComprador(buyer)), notaSistema: null };
    await base.update(comprasPasarela).set({
      estado: emparejamiento.leadId ? "emparejada" : traduccion.estado,
      motivoRevision: traduccion.motivoRevision, codigoOferta: traduccion.codigoOferta,
      enlacePagoId: traduccion.enlacePagoId, cohortId: traduccion.cohortId,
      // Moneda visible: un monto en una moneda que el CRM no maneja no se guarda sin su unidad.
      ...(traduccion.motivoRevision === "moneda_no_soportada"
        ? { monto: null, moneda: null }
        : { monto: String(traduccion.monto), moneda: traduccion.moneda }),
      correo: emparejamiento.correo, telefono: emparejamiento.telefono, nombre: buyer.name ?? null,
      leadId: emparejamiento.leadId, emparejadaPor: emparejamiento.emparejadaPor,
      notaSistema: emparejamiento.notaSistema, updatedAt: new Date(),
    }).where(eq(comprasPasarela.id, insertada.id));
    return { compraId: insertada.id, motivo: "procesado" as const };
  });
}
