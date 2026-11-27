import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { deals, leadContactos, leads, miembrosPrograma, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { clasificarFilasDeReclamo, reclamarDealsDeCsv } from "@/lib/deals/reclamar-por-csv";
import type { FilaDeReclamo } from "@/lib/deals/csv-reclamo";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";

/**
 * Falla si la clasificación cruza programas/personas, reclama una etapa no permitida o
 * confía en una vista previa vieja en vez de volver a validar dueño y estado.
 */
let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let closer: string;
let otroCloser: string;
let gerente: string;
let secuencia = 0;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa, otro] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  programId = programa.id;
  otroProgramId = otro.id;
  const [c, o, g] = await db.insert(users).values([
    { email: "closer@retia.co", nombre: "Closer Uno", rol: "closer", closerId: "C1" },
    { email: "otro@retia.co", nombre: "Closer Dos", rol: "closer", closerId: "C2" },
    { email: "gerente@retia.co", nombre: "Gerente", rol: "gerente" },
  ]).returning();
  closer = c.id;
  otroCloser = o.id;
  gerente = g.id;
  await db.insert(miembrosPrograma).values([
    { userId: closer, programId },
    { userId: otroCloser, programId },
  ]);
}, 60_000);

afterAll(async () => cerrar());

const comoCloser = () => ({ userId: closer, rol: "closer" as const, operaComoCloser: false });
const comoGerente = () => ({ userId: gerente, rol: "gerente" as const, operaComoCloser: false });

async function persona(
  correo: string,
  opciones: { etapa?: EtapaDeal; ownerUserId?: string | null; programId?: string; telefono?: string; sinDeal?: boolean } = {},
) {
  const programa = opciones.programId ?? programId;
  const [lead] = await db.insert(leads).values({
    programId: programa,
    emailNormalizado: correo,
    fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
  }).returning();
  if (opciones.telefono) await db.insert(leadContactos).values({
    leadId: lead.id,
    programId: programa,
    tipo: "telefono",
    valor: opciones.telefono,
  });
  if (opciones.sinDeal) return { leadId: lead.id, dealId: null };
  const [deal] = await db.insert(deals).values({
    leadId: lead.id,
    programId: programa,
    etapa: opciones.etapa ?? "registrado",
    ownerUserId: opciones.ownerUserId ?? null,
  }).returning();
  return { leadId: lead.id, dealId: deal.id };
}

function fila(correo: string | null, telefono: string | null): FilaDeReclamo {
  secuencia += 1;
  return {
    fila: secuencia + 1,
    correoOriginal: correo ?? "",
    telefonoOriginal: telefono ?? "",
    correo,
    telefono,
  };
}

async function capturar(promesa: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await promesa;
  } catch (error) {
    return error as ErrorDeApp;
  }
  throw new Error("Se esperaba un error.");
}

describe("clasificarFilasDeReclamo", () => {
  it("distingue cada resultado sin cruzar identidades y aplica el fallback de 10 dígitos", async () => {
    await persona("reclamable@c.co");
    await persona("tuyo@c.co", { ownerUserId: closer });
    await persona("otro@c.co", { ownerUserId: otroCloser });
    await persona("agendado@c.co", { etapa: "agendado" });
    await persona("sin-deal@c.co", { sinDeal: true });
    await persona("fallback@c.co", { telefono: "573001112222" });
    await persona("ambiguo-a@c.co", { telefono: "573009998888" });
    await persona("ambiguo-b@c.co", { telefono: "003009998888" });
    const correoGana = await persona("correo-gana@c.co");
    await persona("telefono-pierde@c.co", { telefono: "573007776666" });

    const resultados = await clasificarFilasDeReclamo(db, comoCloser(), programId, [
      fila("reclamable@c.co", null),
      fila("tuyo@c.co", null),
      fila("otro@c.co", null),
      fila("agendado@c.co", null),
      fila("sin-deal@c.co", null),
      fila("no-esta@c.co", null),
      fila(null, "3001112222"),
      fila(null, "3009998888"),
      fila(null, null),
      fila("correo-gana@c.co", "573007776666"),
    ]);

    expect(resultados.map((resultado) => resultado.categoria)).toEqual([
      "reclamable",
      "ya_es_tuyo",
      "de_otro",
      "sin_dueno_fuera_de_setteo",
      "sin_deal_abierto",
      "no_esta",
      "reclamable",
      "ambiguo",
      "invalida",
      "reclamable",
    ]);
    expect(resultados[6].detalle).toContain("últimos 10 dígitos");
    expect(resultados[9]).toMatchObject({ dealId: correoGana.dealId });
    expect(resultados[9].detalle).toContain("correo");
  });
});

describe("reclamarDealsDeCsv", () => {
  it("revalida programa, etapa y dueño, y el gerente recibe 403", async () => {
    const valido = await persona("valido@c.co");
    const fuera = await persona("fuera@c.co", { etapa: "agendado" });
    const ajeno = await persona("ajeno@c.co", { programId: otroProgramId });
    const ocupado = await persona("ocupado@c.co", { ownerUserId: otroCloser });
    const ids = [valido.dealId, fuera.dealId, ajeno.dealId, ocupado.dealId] as string[];

    expect(await reclamarDealsDeCsv(db, comoCloser(), programId, ids)).toEqual({
      reclamados: [valido.dealId],
      saltados: [fuera.dealId, ajeno.dealId, ocupado.dealId],
    });
    const error = await capturar(reclamarDealsDeCsv(db, comoGerente(), programId, [valido.dealId as string]));
    expect(error.status).toBe(403);
  });
});
