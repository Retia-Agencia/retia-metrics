import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { calls, dealEtapaHistorial, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { armarReporteDiario } from "@/lib/queries/reporte-diario";
import { ReporteDeTodosLosProgramas } from "@/components/hub-reporte/reporte";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

const DIA = "2026-11-03";

function texto(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

describe("/hub/reporte", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;

  beforeAll(async () => { ({ db, cerrar, vaciar } = await crearBaseReutilizable()); });
  beforeEach(async () => { await vaciar(); }, 60_000);
  afterAll(async () => cerrar());

  async function sembrarTresProgramas() {
    const [closer] = await db.insert(users).values({
      email: "closer-reporte@retia.co", rol: "closer", nombre: "Jerónimo", closerId: "Jero",
    }).returning();
    const programasSembrados = [];
    for (let indice = 1; indice <= 3; indice += 1) {
      const [programa] = await db.insert(programs).values({
        ...PROGRAMA_DE_PRUEBA,
        slug: `reporte-${indice}`,
        nombre: `Programa ${indice}`,
        ticketUsd: String(700 + indice),
      }).returning();
      programasSembrados.push(programa);
      for (let venta = 1; venta <= indice; venta += 1) {
        const [lead] = await db.insert(leads).values({
          fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
          programId: programa.id,
          emailNormalizado: `p${indice}-v${venta}@retia.co`,
          nombre: `Persona ${indice}-${venta}`,
        }).returning();
        const [deal] = await db.insert(deals).values({
          programId: programa.id,
          leadId: lead.id,
          etapa: "ganado_parcial",
          valorVendidoUsd: String(700 + indice),
          ownerUserId: closer.id,
        }).returning();
        await db.insert(dealEtapaHistorial).values({
          dealId: deal.id, de: "atendido", a: "ganado_parcial", fecha: new Date(`${DIA}T15:00:00Z`),
        });
        await db.insert(calls).values({
          programId: programa.id,
          dealId: deal.id,
          closerUserId: closer.id,
          fechaAgenda: new Date(`${DIA}T14:00:00Z`),
          resultado: "cerrada",
        });
        await abonoDePrueba(db, {
          dealId: deal.id, programId: programa.id, fecha: DIA, monto: "100", moneda: "USD",
        });
      }
    }
    return { programasSembrados, closer };
  }

  it("tres programas muestran, por programa, las mismas cifras que armarReporteDiario / Hub › Hoy", async () => {
    const { programasSembrados } = await sembrarTresProgramas();
    const reportes = await Promise.all(programasSembrados.map(async (programa) => ({
      programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre },
      reporte: await armarReporteDiario({ programId: programa.id, dia: DIA }, db),
    })));
    const html = renderToStaticMarkup(
      createElement(ReporteDeTodosLosProgramas, {
        reportes, dia: DIA, generado: "3 nov 2026, 18:00", veEquipo: true,
      }),
    );
    const visible = texto(html);

    for (const { programa, reporte } of reportes) {
      expect(visible).toContain(programa.nombre);
      expect(reporte.vista.embudo.agendas).toBe(reporte.agendaDeHoy.length);
      expect(reporte.vista.embudo.llamadasConShow).toBe(reporte.vista.embudo.agendas);
      expect(reporte.vista.embudo.cierres).toBe(reporte.ventas.length);
      expect(visible).toContain(`USD ${(reporte.caja[0]?.total ?? 0).toFixed(2).replace(".", ",")}`);
    }
    expect(visible).toContain("Por closer");
    expect(visible).toContain("Jero");
    expect(visible).not.toContain("Sin responsable");
  }, 60_000);

  it("el paid trafficker recibe el reporte sin nombres ni desglose de closers", async () => {
    const { programasSembrados } = await sembrarTresProgramas();
    const programa = programasSembrados[0];
    const reporte = await armarReporteDiario({ programId: programa.id, dia: DIA }, db);
    const html = renderToStaticMarkup(
      createElement(ReporteDeTodosLosProgramas, {
        reportes: [{ programa: { id: programa.id, slug: programa.slug, nombre: programa.nombre }, reporte }],
        dia: DIA,
        generado: "3 nov 2026, 18:00",
        veEquipo: false,
      }),
    );
    expect(texto(html)).not.toContain("Por closer");
    expect(texto(html)).not.toContain("Jero");
  }, 60_000);
});
