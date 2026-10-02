import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, deals, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import { abrirDeal } from "@/lib/deals/mover-etapa";
import { rellenarOrigenDeDeals } from "@/lib/deals/rellenar-origen";
import { tableroKanban } from "@/lib/queries/kanban";
import { seccionesSinDueno } from "@/lib/queries/inbox-sin-dueno";
import { fichaDeDeal } from "@/lib/queries/ficha-deal";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 115, ADR 0060: el origen es del envio y el deal recuerda el que lo abrio. Ninguna
 * pantalla vuelve a mostrar una combinacion de UTM que no vino de un clic real.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;

const CAMPOS = {
  token: "Token",
  correo: "Correo",
  fechaEnvio: "Submitted At",
  estadoHoja: "Estado",
  utmSource: "utm_source",
  utmMedium: "utm_medium",
  utmCampaign: "utm_campaign",
} as const;

function entrada(o: {
  token: string;
  correo: string;
  fecha?: string | null;
  estado: string;
  utm?: [string, string, string];
}): EntradaEnvio {
  const [s, m, c] = o.utm ?? ["", "", ""];
  return {
    sourceId,
    zona: "UTC",
    posicion: null,
    columnas: {
      Token: o.token,
      Correo: o.correo,
      "Submitted At": o.fecha === null ? "1/1/0001 0:00:00" : (o.fecha ?? "2026-09-20T15:00:00Z"),
      Estado: o.estado,
      utm_source: s,
      utm_medium: m,
      utm_campaign: c,
    },
    campos: { ...CAMPOS },
  };
}

const conRegla = { aplicarReglaDeDeals: true } as const;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "t", nombre: "T", ticketUsd: "1500" }).returning();
  programId = p.id;
  const [f] = await db.insert(sources).values({ programId, nombre: "Typeform", tipo: "google_sheet" }).returning();
  sourceId = f.id;
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function envioDeToken(token: string) {
  const [e] = await db.select().from(submissions).where(eq(submissions.token, token));
  return e;
}

describe("el deal que abre la ingesta recuerda el envio que lo abrio", () => {
  it("dos envios con UTM distintas: el origen es el que abrio el deal, completo, sin mezclarlos", async () => {
    // El primero no abre deal (entra sin la regla, como el traslado desde la hoja) y trae campaña; el
    // segundo la abre y NO trae campaña. Un resumen "el mas reciente no vacio" le pegaba la campaña del
    // primero. (Desde el ADR 0069 todo envío por el webhook abre deal: ya no hay un Estado que no abra.)
    await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t1", correo: "ana@correo.co", fecha: "2026-09-10T15:00:00Z", estado: "", utm: ["facebook", "cpc", "camp-a"] })],
    );
    expect(await db.select().from(deals)).toHaveLength(0);
    await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t2", correo: "ana@correo.co", fecha: "2026-09-20T15:00:00Z", estado: "setteo_no_calificado", utm: ["instagram", "stories", ""] })],
      conRegla,
    );

    const [deal] = await db.select().from(deals);
    expect(deal.submissionOrigenId).toBe((await envioDeToken("t2")).id);

    const esperado = { utmSource: "instagram", utmMedium: "stories", utmCampaign: null };
    const { pendienteSetteo } = await seccionesSinDueno(db, programId);
    expect(pendienteSetteo[0].origen).toMatchObject(esperado);
    const tablero = await tableroKanban(db, programId, { tipo: "todos" }, {}, "2026-09-21");
    const tarjeta = tablero.columnas.flatMap((c) => c.tarjetas)[0];
    expect([tarjeta.utmSource, tarjeta.utmMedium]).toEqual(["instagram", "stories"]);
    const ficha = await fichaDeDeal(db, programId, deal.id);
    // Desde el 139 la ficha devuelve el envío de origen con sus seis UTM crudos (`utmsDelEnvio`).
    expect(ficha!.origen).toMatchObject({
      envioId: deal.submissionOrigenId,
      utm: { source: "instagram", medium: "stories", campaign: null },
    });
    // A-31: la fecha del origen es la del ENVIO (20-sep), no la de ingesta (hoy).
    expect(ficha!.origen!.fecha.toISOString()).toBe("2026-09-20T15:00:00.000Z");
  });

  it("un lead con deal Completo que vuelve a enviar abre un deal nuevo con el envio nuevo; el cerrado no cambia", async () => {
    await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t1", correo: "ana@correo.co", fecha: "2026-09-10T15:00:00Z", estado: "setteo_no_calificado", utm: ["facebook", "cpc", "c1"] })],
      conRegla,
    );
    const [primero] = await db.select().from(deals);
    // Prepara el estado directo en la base: no es lo que prueba este test.
    await db.update(deals).set({ etapa: "ganado_completo" }).where(eq(deals.id, primero.id));

    await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t2", correo: "ana@correo.co", fecha: "2026-09-25T15:00:00Z", estado: "setteo_no_calificado", utm: ["tiktok", "linktree", "c2"] })],
      conRegla,
    );

    const todos = await db.select().from(deals);
    expect(todos).toHaveLength(2);
    const cerrado = todos.find((d) => d.id === primero.id)!;
    const nuevo = todos.find((d) => d.id !== primero.id)!;
    expect(cerrado.submissionOrigenId).toBe((await envioDeToken("t1")).id);
    expect(nuevo.submissionOrigenId).toBe((await envioDeToken("t2")).id);
  });

  it("un parcial que abre el deal es su origen", async () => {
    await ingerirEntradas(
      db,
      programId,
      [entrada({ token: "t1", correo: "ana@correo.co", fecha: null, estado: "setteo_no_calificado", utm: ["ig", "paid_social", "c1"] })],
      conRegla,
    );
    const [envio] = await db.select().from(submissions);
    expect(envio.esParcial).toBe(true);
    const [deal] = await db.select().from(deals);
    expect(deal.submissionOrigenId).toBe(envio.id);
  });

  it("abrirDeal rechaza un envio de origen de otro lead", async () => {
    await ingerirEntradas(db, programId, [
      entrada({ token: "t1", correo: "ana@correo.co", estado: "descartado" }),
      entrada({ token: "t2", correo: "beto@correo.co", estado: "descartado" }),
    ]);
    const [ana] = await db.select().from(leads).where(eq(leads.emailNormalizado, "ana@correo.co"));
    await expect(
      abrirDeal(db, {
        leadId: ana.id,
        programId,
        etapa: "registrado",
        actor: { tipo: "sistema" },
        submissionOrigenId: (await envioDeToken("t2")).id,
      }),
    ).rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(deals)).toHaveLength(0);
  });
});

describe("rellenarOrigenDeDeals: el relleno unico de los deals viejos", () => {
  let actorId: string;
  let n = 0;

  beforeEach(async () => {
    const [u] = await db.insert(users).values({ email: "mani@retia.co", rol: "developer" }).returning();
    actorId = u.id;
  });

  /** Un lead con sus envios (fechas ISO; null = sin fecha) y un deal creado en `creado`. */
  async function dealViejo(o: { envios: (string | null)[]; creado: string; anulado?: boolean }) {
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: `l${++n}@correo.co` }).returning();
    const ids: string[] = [];
    for (const [i, f] of o.envios.entries()) {
      const [e] = await db
        .insert(submissions)
        .values({ leadId: l.id, sourceId, token: `l${n}-${i}`, fechaEnvio: f === null ? null : new Date(f), esParcial: f === null })
        .returning();
      ids.push(e.id);
    }
    const [d] = await db
      .insert(deals)
      .values({
        leadId: l.id,
        programId,
        etapa: "registrado",
        createdAt: new Date(o.creado),
        ...(o.anulado ? { anuladoEn: new Date(), anuladoPor: actorId, motivoAnulacion: "error de tecleo" } : {}),
      })
      .returning();
    return { dealId: d.id, envios: ids };
  }

  it("elige el envio mas reciente anterior al deal, deja en nulo sin envios o con solo posteriores, y no toca anulados", async () => {
    const conPrevios = await dealViejo({
      envios: ["2026-09-01T15:00:00Z", "2026-09-05T15:00:00Z", "2026-09-20T15:00:00Z"],
      creado: "2026-09-10T15:00:00Z",
    });
    const sinEnvios = await dealViejo({ envios: [], creado: "2026-09-10T15:00:00Z" });
    const soloPosteriores = await dealViejo({ envios: ["2026-09-15T15:00:00Z"], creado: "2026-09-10T15:00:00Z" });
    const anulado = await dealViejo({ envios: ["2026-09-01T15:00:00Z"], creado: "2026-09-10T15:00:00Z", anulado: true });

    const ensayo = await rellenarOrigenDeDeals(db, { actorId, aplicar: false });
    expect(ensayo).toEqual({ sinOrigen: 3, rellenados: 1, sinEnvios: 1, sinEnviosPrevios: 1 });
    expect((await db.select().from(deals)).every((d) => d.submissionOrigenId === null)).toBe(true);

    const real = await rellenarOrigenDeDeals(db, { actorId, aplicar: true });
    expect(real).toEqual(ensayo);

    const origenDe = async (id: string) =>
      (await db.select().from(deals).where(eq(deals.id, id)))[0].submissionOrigenId;
    expect(await origenDe(conPrevios.dealId)).toBe(conPrevios.envios[1]);
    expect(await origenDe(sinEnvios.dealId)).toBeNull();
    expect(await origenDe(soloPosteriores.dealId)).toBeNull();
    expect(await origenDe(anulado.dealId)).toBeNull();

    const rastro = await db
      .select()
      .from(changeLog)
      .where(and(eq(changeLog.tabla, "deals"), eq(changeLog.registroId, conPrevios.dealId)));
    expect(rastro).toMatchObject([{ campo: "submissionOrigenId", valorNuevo: conPrevios.envios[1], userId: actorId }]);

    // Segunda corrida: nada que rellenar, nada que escribir.
    const otra = await rellenarOrigenDeDeals(db, { actorId, aplicar: true });
    expect(otra).toEqual({ sinOrigen: 2, rellenados: 0, sinEnvios: 1, sinEnviosPrevios: 1 });
    expect(await db.select().from(changeLog).where(eq(changeLog.tabla, "deals"))).toHaveLength(1);
  });

  it("un envio sin fecha (parcial) cuenta como previo, pero nunca le gana a uno fechado", async () => {
    const soloParcial = await dealViejo({ envios: [null], creado: "2026-09-10T15:00:00Z" });
    const ambos = await dealViejo({ envios: [null, "2026-09-02T15:00:00Z"], creado: "2026-09-10T15:00:00Z" });
    await rellenarOrigenDeDeals(db, { actorId, aplicar: true });
    const [a] = await db.select().from(deals).where(eq(deals.id, soloParcial.dealId));
    const [b] = await db.select().from(deals).where(eq(deals.id, ambos.dealId));
    expect(a.submissionOrigenId).toBe(soloParcial.envios[0]);
    expect(b.submissionOrigenId).toBe(ambos.envios[1]);
  });
});
