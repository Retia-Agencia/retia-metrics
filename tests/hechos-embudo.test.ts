import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  areas,
  calls,
  canales,
  dealEtapaHistorial,
  deals,
  leads,
  programs,
  sources,
  submissions,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { embudoDelRango } from "@/lib/queries/dashboard";
import { hechosDelEmbudo, type FilaHechosDelEmbudo } from "@/lib/queries/hechos-embudo";
import { periodoAnterior } from "@/lib/queries/serie";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const RANGO = { desde: "2026-09-01", hasta: "2026-09-30" };

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let sourceId: string;
let sourceOtroId: string;
let ownerUserId: string;
let areaId: string;
let canalId: string;
let secuencia = 0;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  [programId, otroProgramId] = await Promise.all([
    db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "serie", nombre: "Serie", ticketUsd: "1000" }).returning().then(([p]) => p.id),
    db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" }).returning().then(([p]) => p.id),
  ]);
  [sourceId, sourceOtroId] = await Promise.all([
    db.insert(sources).values({ programId, nombre: "Formulario" }).returning().then(([f]) => f.id),
    db.insert(sources).values({ programId: otroProgramId, nombre: "Formulario" }).returning().then(([f]) => f.id),
  ]);
  ownerUserId = await db
    .insert(users)
    .values({ email: "duena@retia.co", rol: "closer", closerId: "Mani" })
    .returning()
    .then(([u]) => u.id);
  areaId = await db.insert(areas).values({ nombre: "Pauta" }).returning().then(([a]) => a.id);
  canalId = await db
    .insert(canales)
    .values({ nombre: "Meta", utmSource: "facebook", utmMedium: "cpc", areaId })
    .returning()
    .then(([c]) => c.id);
}, 60_000);

afterEach(async () => {
  await cerrar();
});

async function crearEnvio(
  programa = programId,
  utm: [string | null, string | null, string | null] = ["facebook", "cpc", "campana"],
) {
  const [lead] = await db
    .insert(leads)
    .values({ programId: programa, emailNormalizado: `serie-${++secuencia}@correo.co` })
    .returning();
  const [source, medium, campaign] = utm;
  const [envio] = await db
    .insert(submissions)
    .values({
      leadId: lead.id,
      sourceId: programa === programId ? sourceId : sourceOtroId,
      token: `token-${secuencia}`,
      esParcial: false,
      fechaEnvio: new Date("2026-09-10T10:00:00-05:00"),
      utmSource: source,
      utmMedium: medium,
      utmCampaign: campaign,
    })
    .returning();
  return { leadId: lead.id, envioId: envio.id, programId: programa };
}

async function crearVenta(
  origen: Awaited<ReturnType<typeof crearEnvio>>,
  opciones: { anulada?: boolean; closerId?: string } = {},
) {
  const [deal] = await db
    .insert(deals)
    .values({
      leadId: origen.leadId,
      programId: origen.programId,
      submissionOrigenId: origen.envioId,
      ownerUserId,
      etapa: "ganado_parcial",
      ...(opciones.anulada
        ? { anuladoEn: new Date(), anuladoPor: ownerUserId, motivoAnulacion: "error" }
        : {}),
    })
    .returning();
  await db.insert(dealEtapaHistorial).values({
    dealId: deal.id,
    de: "compromiso_verbal",
    a: "ganado_parcial",
    fecha: new Date("2026-09-12T11:00:00-05:00"),
    userId: ownerUserId,
  });
  if (opciones.closerId !== undefined) {
    await db.insert(calls).values({
      dealId: deal.id,
      programId: origen.programId,
      closerId: opciones.closerId,
      fechaAgenda: new Date("2026-09-11T09:00:00-05:00"),
      resultado: "show",
    });
  }
  return deal.id;
}

const sumar = (filas: FilaHechosDelEmbudo[], campo: keyof Pick<FilaHechosDelEmbudo, "envios" | "agendas" | "shows" | "ventas">) =>
  filas.reduce((total, fila) => total + fila[campo], 0);

describe("periodo anterior", () => {
  it("conserva la cantidad inclusiva de dias", () => {
    expect(periodoAnterior(RANGO)).toEqual({ desde: "2026-08-02", hasta: "2026-08-31" });
    expect(periodoAnterior({ desde: "2026-09-15", hasta: "2026-09-15" })).toEqual({
      desde: "2026-09-14",
      hasta: "2026-09-14",
    });
  });
});

describe("hechos del embudo", () => {
  it("exige el programa en el contrato", () => {
    if (false) {
      // @ts-expect-error El programa es una frontera obligatoria de toda serie.
      void hechosDelEmbudo(db, { rango: RANGO });
    }
  });

  it("cuadra con el embudo y conserva atribucion, vigencia y dueno", async () => {
    const ventaUno = await crearEnvio();
    const ventaDos = await crearEnvio();
    await crearEnvio(programId, [null, null, null]);
    await crearEnvio(programId, ["desconocido", "organico", "campana"]);
    await crearVenta(ventaUno, { closerId: "mani" });
    await crearVenta(ventaDos, { closerId: "Mani" });

    const ventaAnulada = await crearEnvio();
    await crearVenta(ventaAnulada, { anulada: true });
    const ventaAjena = await crearEnvio(otroProgramId);
    await crearVenta(ventaAjena, { closerId: "Mani" });

    await db.insert(calls).values([
      {
        programId,
        fechaAgenda: new Date("2026-09-13T09:00:00-05:00"),
        resultado: "agendada",
      },
      {
        programId,
        fechaAgenda: new Date("2026-09-14T09:00:00-05:00"),
        resultado: "show",
        anuladoEn: new Date(),
        anuladoPor: ownerUserId,
        motivoAnulacion: "error",
      },
    ]);

    const filas = await hechosDelEmbudo(db, { programId, rango: RANGO });
    const embudo = await embudoDelRango({ programId, rango: RANGO }, db);

    expect(sumar(filas, "agendas")).toBe(embudo.agendas);
    expect(sumar(filas, "shows")).toBe(embudo.llamadasConShow);
    expect(sumar(filas, "ventas")).toBe(embudo.cierres);
    expect(sumar(filas, "ventas")).toBe(2);
    expect(filas.every((fila) => fila.programId === programId)).toBe(true);

    expect(filas.some((fila) => fila.origen === "canal" && fila.canalId === canalId && fila.areaId === areaId)).toBe(true);
    expect(filas.some((fila) => fila.origen === "sin_utm" && fila.envios === 1)).toBe(true);
    expect(filas.some((fila) => fila.origen === "sin_clasificar" && fila.envios === 1)).toBe(true);
    expect(filas.some((fila) => fila.origen === "sin_envio_origen" && fila.agendas === 1)).toBe(true);

    const duenosDeVentas = new Set(
      filas.filter((fila) => fila.ventas > 0).map((fila) => fila.duenoUserId),
    );
    expect([...duenosDeVentas]).toEqual([ownerUserId]);
  });
});
