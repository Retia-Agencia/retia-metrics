import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { registrarAbono } from "@/lib/deals/abonos";
import { exigirDealVisible } from "@/lib/deals/alcance";
import {
  estadoParaAccionDeal,
  huellaDeAccionAbonos,
} from "@/lib/deals/estado-para-accion";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

export const MENSAJE_COMPROBANTE_MCP = "Sin el enlace del comprobante, el abono se registra a mano en la app, donde se adjunta el archivo y se revisa antes de mover el deal.";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida."),
  monto: z.string().trim().regex(/^\d+(\.\d{1,2})?$/, "Monto inválido.").max(30),
  concepto: z.enum(["ticket", "adicional"]),
  nota: z.string().trim().max(500).optional(),
  plataforma_id: z.string().uuid("Plataforma inválida."),
  comprobante_url: z.string({ error: MENSAJE_COMPROBANTE_MCP })
    .url("El comprobante debe ser una URL válida.").max(2000),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  datos: z.output<typeof argumentos>;
}

async function ejecutar(
  db: Parameters<typeof registrarAbono>[0],
  actor: Parameters<typeof registrarAbono>[1],
  objetivo: Objetivo,
) {
  await exigirDealVisible(db, actor, objetivo.id);
  return registrarAbono(db, actor, {
    dealId: objetivo.id,
    fecha: objetivo.datos.fecha,
    monto: objetivo.datos.monto,
    moneda: "USD",
    concepto: objetivo.datos.concepto,
    nota: objetivo.datos.nota,
    plataformaId: objetivo.datos.plataforma_id,
    comprobanteUrl: objetivo.datos.comprobante_url,
  }, { origen: "mcp" });
}

export const registrarAbonoMcp: AccionMcp<typeof argumentos> = {
  clave: "registrar_abono",
  titulo: "Registrar abono",
  cuandoUsarla: `Cuando se recibió un pago y existe un enlace al comprobante. ${MENSAJE_COMPROBANTE_MCP}`,
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    fecha: "2026-11-13",
    monto: "500.00",
    concepto: "ticket",
    plataforma_id: "00000000-0000-4000-8000-000000000001",
    comprobante_url: "https://example.com/comprobante",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{ id: entrada.deal_id, datos: entrada }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, saldo] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      saldosDeDeals(db, [objetivo.id]).then((mapa) => mapa.get(objetivo.id) ?? null),
    ]);
    const prueba = await ensayar(db, async (tx) => ({
      resultado: await ejecutar(tx, actor, objetivo),
      saldo: (await saldosDeDeals(tx, [objetivo.id])).get(objetivo.id) ?? null,
    }));
    return {
      antes: deal
        ? { etapa: deal.etapa, pendiente: deal.pendiente, saldo: saldo?.saldo ?? null }
        : null,
      despues: prueba.ok
        ? { etapa: prueba.resultado.resultado.etapa, saldo: prueba.resultado.saldo?.saldo ?? null }
        : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionAbonos(db, objetivo.id, opciones),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  eventoDeshacer: (nuevos) => nuevos.find((evento) => evento.tabla === "abonos" && evento.esCreacion),
  seDeshace: true,
  efectoExterno: false,
};
