import { z } from "zod";
import { db as dbDeLaApp } from "@/lib/db";
import { integracionHotmartPorId } from "@/lib/integraciones";
import { guardarSobre, marcarSobreConError, type DuenoDelSobre } from "@/lib/ingesta/caja-negra";
import { registrarEntrega } from "@/lib/queries/entregas-webhook";
import { PROVEEDORES_DE_PAGO } from "@/lib/pagos/proveedores";
import { procesarCompra } from "@/lib/pagos/procesar";

export const runtime = "nodejs";
export const maxDuration = 60;
export async function POST(req: Request, { params }: { params: Promise<{ fuente: string }> }) {
  const { fuente } = await params; const db = dbDeLaApp;
  if (!z.string().uuid().safeParse(fuente).success) {
    await registrarEntrega(db, { programId: null, sourceId: null, sobreId: null, leadId: null, codigoHttp: 404, motivo: "fuente_no_encontrada" });
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }
  const integracion = await integracionHotmartPorId(db, fuente);
  if (!integracion) {
    await registrarEntrega(db, { programId: null, sourceId: null, sobreId: null, leadId: null, codigoHttp: 404, motivo: "fuente_no_encontrada" });
    return Response.json({ error: "No encontrado." }, { status: 404 });
  }
  if (!integracion.hottok) {
    await registrarEntrega(db, { programId: integracion.programId, sourceId: null, sobreId: null, leadId: null, codigoHttp: 401, motivo: "sin_secreto" });
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const cuerpo = await req.text(); const proveedor = PROVEEDORES_DE_PAGO.hotmart;
  const header = req.headers.get(proveedor.headerSecreto);
  if (!proveedor.verificar(cuerpo, header, integracion.hottok)) {
    await registrarEntrega(db, { programId: integracion.programId, sourceId: null, sobreId: null, leadId: null, codigoHttp: 401, motivo: header ? "firma_invalida" : "firma_ausente" });
    return Response.json({ error: "No autorizado." }, { status: 401 });
  }
  const dueno: DuenoDelSobre = { canal: "pago", programId: integracion.programId };
  const sobreId = await guardarSobre(db, dueno, cuerpo);
  try {
    await procesarCompra(db, integracion, cuerpo, sobreId);
    await registrarEntrega(db, { programId: integracion.programId, sourceId: null, sobreId, leadId: null, codigoHttp: 200, motivo: "procesado" });
    return Response.json({ ok: true }, { status: 200 });
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "Error desconocido.";
    await marcarSobreConError(db, sobreId, dueno, cuerpo, mensaje);
    await registrarEntrega(db, { programId: integracion.programId, sourceId: null, sobreId, leadId: null, codigoHttp: 200, motivo: "fallo_ingesta" });
    return Response.json({ ok: false, guardado: true }, { status: 200 });
  }
}
