import { z } from "zod";
import { puedeVerOperacion } from "@/lib/auth/roles";
import { exigirAbonoVisible } from "@/lib/deals/alcance";
import { anularAbonoComo } from "@/lib/deals/anular";
import {
  estadoParaAccionAbono,
  estadoParaAccionDeal,
  huellaDeAccionAbono,
} from "@/lib/deals/estado-para-accion";
import { ErrorDeApp } from "@/lib/errors";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { ensayar } from "./ensayo";
import type { AccionMcp, ObjetivoAccionMcp } from "./tipos";

const argumentos = z.object({
  deal_id: z.string().uuid("Deal inválido."),
  abono_id: z.string().uuid("Abono inválido."),
  motivo: z.string().trim().min(1).max(500),
}).strict();

interface Objetivo extends ObjetivoAccionMcp {
  abonoId: string;
  motivo: string;
}

async function ejecutar(
  db: Parameters<typeof anularAbonoComo>[0],
  actor: Parameters<typeof anularAbonoComo>[1],
  objetivo: Objetivo,
) {
  const abono = await exigirAbonoVisible(db, actor, objetivo.abonoId);
  if (abono.dealId !== objetivo.id) {
    throw new ErrorDeApp("No existe ese abono en el deal.", 404);
  }
  const resultado = await anularAbonoComo(
    db,
    actor,
    { abonoId: objetivo.abonoId, motivo: objetivo.motivo },
    { origen: "mcp" },
  );
  return {
    resultado,
    abono: await estadoParaAccionAbono(db, objetivo.abonoId),
    saldo: (await saldosDeDeals(db, [objetivo.id])).get(objetivo.id) ?? null,
  };
}

export const anularAbonoMcp: AccionMcp<typeof argumentos> = {
  clave: "anular_abono",
  titulo: "Anular abono",
  cuandoUsarla: "Cuando un abono se registró por error y debe dejar de contar.",
  argumentos,
  ejemplo: {
    deal_id: "00000000-0000-4000-8000-000000000000",
    abono_id: "00000000-0000-4000-8000-000000000001",
    motivo: "Se registró por error",
  },
  puede: (contexto) => puedeVerOperacion(contexto.rol),
  objetivos: (entrada) => [{
    id: entrada.deal_id,
    abonoId: entrada.abono_id,
    motivo: entrada.motivo,
  }],
  async revisar(db, actor, base) {
    const objetivo = base as Objetivo;
    const [deal, abono, saldo] = await Promise.all([
      estadoParaAccionDeal(db, objetivo.id),
      estadoParaAccionAbono(db, objetivo.abonoId),
      saldosDeDeals(db, [objetivo.id]).then((mapa) => mapa.get(objetivo.id) ?? null),
    ]);
    const prueba = await ensayar(db, (tx) => ejecutar(tx, actor, objetivo));
    return {
      antes: deal && abono ? {
        etapa: deal.etapa,
        pendiente: deal.pendiente,
        saldo: saldo?.saldo ?? null,
        anulado: abono.anuladoEn != null,
      } : null,
      despues: prueba.ok ? {
        etapa: prueba.resultado.resultado.etapa,
        saldo: prueba.resultado.saldo?.saldo ?? null,
        anulado: prueba.resultado.abono?.anuladoEn != null,
      } : null,
      sePuedeAplicar: prueba.ok,
      razon: prueba.ok ? null : prueba.razon,
      detalle: { aviso: "Una anulación no se puede deshacer." },
    };
  },
  huella: (db, objetivo, opciones) => huellaDeAccionAbono(
    db,
    objetivo.id,
    (objetivo as Objetivo).abonoId,
    opciones,
  ),
  aplicar: (db, actor, objetivo) => ejecutar(db, actor, objetivo as Objetivo),
  seDeshace: false,
  efectoExterno: false,
};
