import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { areas, calls, canales, deals, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { agruparPorCanal, registrosYAgendasPorCanal } from "@/lib/queries/registros-agendas-canal";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 088: registros contra agendas por canal. Reagrupa la serie de Pauta (093) por el
 * catálogo de Canales; el denominador son ENVÍOS, no deals; los huérfanos van aparte, siempre.
 */

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };
const HOY = "2026-09-29";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let fuente: string;
let fuenteOtro: string;
let n = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p, q] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1000" },
    ])
    .returning();
  programId = p.id;
  otroProgramId = q.id;
  fuente = (await db.insert(sources).values({ programId, nombre: "Typeform" }).returning())[0].id;
  fuenteOtro = (await db.insert(sources).values({ programId: otroProgramId, nombre: "Typeform" }).returning())[0].id;
  const [pauta, organico] = await db.insert(areas).values([{ nombre: "Pauta" }, { nombre: "Orgánico" }]).returning();
  await db.insert(canales).values([
    { nombre: "Meta", utmSource: "facebook", utmMedium: "cpc", areaId: pauta.id },
    { nombre: "TikTok", utmSource: "tiktok", utmMedium: "organic", areaId: organico.id },
  ]);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function envio(utm: [string | null, string | null, string | null], programa: "p" | "q" = "p") {
  const pid = programa === "q" ? otroProgramId : programId;
  const [l] = await db.insert(leads).values({ programId: pid, emailNormalizado: `l${++n}@correo.co` }).returning();
  const [e] = await db
    .insert(submissions)
    .values({
      leadId: l.id,
      sourceId: programa === "q" ? fuenteOtro : fuente,
      token: `t${n}`,
      esParcial: false,
      fechaEnvio: new Date("2026-09-10T15:00:00-05:00"),
      utmSource: utm[0],
      utmMedium: utm[1],
      utmCampaign: utm[2],
    })
    .returning();
  return { leadId: l.id, envioId: e.id, programa: pid };
}

async function agendar(o: { leadId: string; envioId: string | null; programa: string }) {
  const [d] = await db
    .insert(deals)
    .values({ leadId: o.leadId, programId: o.programa, etapa: "agendado", submissionOrigenId: o.envioId })
    .returning();
  await db.insert(calls).values({ programId: o.programa, dealId: d.id, createdAt: new Date("2026-09-11T10:00:00-05:00") });
}

const fila = (r: Awaited<ReturnType<typeof registrosYAgendasPorCanal>>, clave: string) =>
  r.filas.find((f) => f.canal === clave || f.origen === clave);

describe("registrosYAgendasPorCanal", () => {
  it("el denominador son envíos: un registro sin deal cuenta, y la tasa del canal no es 100%", async () => {
    await agendar(await envio(["tiktok", "organic", "c"]));
    await envio(["tiktok", "organic", "c"]);
    await envio(["tiktok", "organic", "c"]);
    const r = await registrosYAgendasPorCanal(db, programId, RANGO, HOY);
    expect(fila(r, "TikTok")).toMatchObject({ registros: 3, agendas: 1, area: "Orgánico" });
  });

  it("un canal con registros y sin agendas se muestra con 0 agendas", async () => {
    await envio(["facebook", "cpc", "c"]);
    const r = await registrosYAgendasPorCanal(db, programId, RANGO, HOY);
    expect(fila(r, "Meta")).toMatchObject({ registros: 1, agendas: 0, area: "Pauta" });
  });

  it("sin UTM, sin clasificar y sin envío de origen van aparte, siempre, con su conteo", async () => {
    await envio([null, null, null]);
    await envio(["youtube", "video", "c"]);
    const suelto = await db.insert(leads).values({ programId, emailNormalizado: "suelto@c.co" }).returning();
    await agendar({ leadId: suelto[0].id, envioId: null, programa: programId });
    const r = await registrosYAgendasPorCanal(db, programId, RANGO, HOY);
    expect(fila(r, "sin_utm")).toMatchObject({ registros: 1, agendas: 0 });
    expect(fila(r, "sin_clasificar")).toMatchObject({ registros: 1, agendas: 0 });
    expect(fila(r, "sin_envio_origen")).toMatchObject({ registros: 0, agendas: 1 });
    expect(r.total).toEqual({ registros: 2, agendas: 1 });
  });

  it("los huérfanos salen aunque estén en cero, al final y en orden fijo", async () => {
    await envio(["facebook", "cpc", "c"]);
    const r = await registrosYAgendasPorCanal(db, programId, RANGO, HOY);
    expect(r.filas.map((f) => f.canal ?? f.origen)).toEqual(["Meta", "sin_clasificar", "sin_utm", "sin_envio_origen"]);
  });

  it("otro programa no cuenta", async () => {
    await envio(["facebook", "cpc", "c"], "q");
    const r = await registrosYAgendasPorCanal(db, programId, RANGO, HOY);
    expect(r.total).toEqual({ registros: 0, agendas: 0 });
  });
});

describe("agruparPorCanal", () => {
  it("da lo mismo con el catálogo en otro orden", () => {
    const serie = [
      { dia: "2026-09-10", categoria: "con_utm" as const, source: "facebook", medium: "cpc", campaign: "c", content: null, term: null, registros: 2, agendas: 1 },
    ];
    const base = { formato: null, activo: true, areaId: "a" };
    const exacto = { ...base, id: "1", nombre: "Meta", utmSource: "facebook", utmMedium: "cpc" };
    const comodin = { ...base, id: "2", nombre: "Cualquier CPC", utmSource: null, utmMedium: "cpc" };
    const areas = new Map([["a", "Pauta"]]);
    const uno = agruparPorCanal(serie, [exacto, comodin], areas);
    const otro = agruparPorCanal(serie, [comodin, exacto], areas);
    expect(uno).toEqual(otro);
    expect(uno.filas[0]).toMatchObject({ canal: "Meta", registros: 2, agendas: 1 });
  });
});
