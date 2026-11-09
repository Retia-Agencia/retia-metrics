import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { agregarWhatsappDeUsuario } from "@/lib/catalogo/usuarios";
import { confirmarEstudiantesNuevos, estudiantesNuevosPendientes } from "@/lib/avisos-cs/pendientes";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import {
  abonos,
  avisosEstudianteNuevo,
  avisosEstudianteNuevoEnvios,
  cohorts,
  deals,
  leads,
  miembrosPrograma,
  programs,
  users,
  usuariosWhatsapp,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { hoyEnBogota } from "@/lib/format";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programaA: string;
let programaB: string;
let cohorteA: string;
let gerente: string;
let csA: string;
let csB: string;
let closer: string;
let secuencia = 0;
const sistema = { tipo: "sistema" } as const;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [a] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-a", nombre: "Programa A", ticketUsd: "1000" }).returning();
  const [b] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-b", nombre: "Programa B", ticketUsd: "1000" }).returning();
  programaA = a.id;
  programaB = b.id;
  const [cohorte] = await db.insert(cohorts).values({
    programId: programaA,
    codigo: "C-2026",
    metaCupos: 10,
    precioUsd: "1000",
    fechaInicioVentas: "2026-10-01",
    fechaCierreVentas: "2026-10-31",
    fechaInicioClases: "2026-11-01",
    estado: "cerrado",
  }).returning();
  cohorteA = cohorte.id;
  const insertados = await db.insert(users).values([
    { email: "gerente@retia.test", rol: "gerente" },
    { email: "cs-a@retia.test", rol: "customer_success" },
    { email: "cs-b@retia.test", rol: "customer_success" },
    { email: "cs-inactiva@retia.test", rol: "customer_success", activo: false },
    { email: "closer@retia.test", rol: "closer", closerId: "Closer" },
  ]).returning();
  gerente = insertados[0].id;
  csA = insertados[1].id;
  csB = insertados[2].id;
  closer = insertados[4].id;
  await db.insert(miembrosPrograma).values([
    { userId: csA, programId: programaA, activo: true },
    { userId: csB, programId: programaB, activo: true },
    { userId: insertados[3].id, programId: programaA, activo: true },
    { userId: insertados[4].id, programId: programaA, activo: true },
  ]);
  await db.insert(usuariosWhatsapp).values([
    { userId: csA, telefono: "573001111111" },
    { userId: csA, telefono: "573002222222" },
    { userId: csB, telefono: "573003333333" },
    { userId: insertados[3].id, telefono: "573004444444" },
    { userId: insertados[4].id, telefono: "573005555555" },
  ]);
  const [csSinNumero] = await db.insert(users).values({ email: "cs-sin-numero@retia.test", rol: "customer_success" }).returning();
  await db.insert(miembrosPrograma).values({ userId: csSinNumero.id, programId: programaA, activo: true });
});

afterAll(async () => cerrar());

async function crearDeal(programId = programaA, conCohorte = true) {
  const [lead] = await db.insert(leads).values({
    programId,
    emailNormalizado: `persona-${++secuencia}@correo.test`,
    nombre: `Persona ${secuencia}`,
    telefono: null,
    entrada: "crm",
  }).returning();
  const [deal] = await db.insert(deals).values({
    programId,
    leadId: lead.id,
    cohortId: conCohorte && programId === programaA ? cohorteA : null,
    etapa: "atendido",
    ownerUserId: closer,
    valorVendidoUsd: "1000",
  }).returning();
  return deal.id;
}

async function abonar(dealId: string, monto: string) {
  await db.insert(abonos).values({
    dealId,
    programId: programaA,
    fecha: hoyEnBogota(),
    monto,
    moneda: "USD",
    comprobanteUrl: `https://example.test/${crypto.randomUUID()}`,
  });
}

describe("avisos de estudiante nuevo", () => {
  it("crea uno en el primer pago, no lo repite al completar y completo directo crea uno", async () => {
    const parcial = await crearDeal();
    await abonar(parcial, "500");
    await moverEtapa(db, { dealId: parcial, a: "ganado_parcial", actor: sistema });
    expect(await db.select().from(avisosEstudianteNuevo)).toHaveLength(1);

    await abonar(parcial, "500");
    await moverEtapa(db, { dealId: parcial, a: "ganado_completo", actor: sistema });
    expect(await db.select().from(avisosEstudianteNuevo)).toHaveLength(1);

    const completo = await crearDeal();
    await abonar(completo, "1000");
    await moverEtapa(db, { dealId: completo, a: "ganado_completo", actor: sistema });
    expect(await db.select().from(avisosEstudianteNuevo)).toHaveLength(2);
  });

  it("entrega solo a los CS activos del programa, admite dos números y arma el texto", async () => {
    const dealId = await crearDeal();
    await abonar(dealId, "500");
    await moverEtapa(db, { dealId, a: "ganado_parcial", actor: sistema });

    const respuesta = await estudiantesNuevosPendientes(db, { origen: "https://crm.retia.test" });
    expect(respuesta.entregas.map((fila) => fila.telefono)).toEqual(["573001111111", "573002222222"]);
    expect(respuesta.telefonosCs).toEqual(["573001111111", "573002222222", "573003333333"]);
    expect(respuesta.entregas[0].texto).toContain("🎓 Estudiante nuevo · Programa A");
    expect(respuesta.entregas[0].texto).toContain("Celular: —");
    expect(respuesta.entregas[0].texto).toContain("Cohorte: C-2026");
    expect(respuesta.entregas[0].texto).toContain("Monto abonado: USD 500,00");
    expect(respuesta.entregas[0].texto).toContain(`/p/programa-a/deals/${dealId}`);
  });

  it("excluye anulados, cuenta avisos sin destinatario y omite los de más de 48 horas", async () => {
    const anulado = await crearDeal();
    await abonar(anulado, "500");
    await moverEtapa(db, { dealId: anulado, a: "ganado_parcial", actor: sistema });
    await db.update(deals).set({ anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "duplicado" }).where(eq(deals.id, anulado));

    const sinDestino = await crearDeal(programaB, false);
    await db.insert(abonos).values({ dealId: sinDestino, programId: programaB, fecha: hoyEnBogota(), monto: "1000", moneda: "USD", comprobanteUrl: "https://example.test/b" });
    await moverEtapa(db, { dealId: sinDestino, a: "ganado_completo", actor: sistema });
    await db.update(miembrosPrograma).set({ activo: false }).where(eq(miembrosPrograma.userId, csB));

    let respuesta = await estudiantesNuevosPendientes(db, { origen: "https://crm.retia.test" });
    expect(respuesta.entregas).toHaveLength(0);
    expect(respuesta.sinDestinatario).toBe(1);

    const [aviso] = await db.select().from(avisosEstudianteNuevo).where(eq(avisosEstudianteNuevo.dealId, sinDestino));
    const ahora = new Date();
    await db.update(avisosEstudianteNuevo).set({ creadoEn: new Date(ahora.getTime() - 49 * 60 * 60 * 1000) }).where(eq(avisosEstudianteNuevo.id, aviso.id));
    respuesta = await estudiantesNuevosPendientes(db, { origen: "https://crm.retia.test", ahora });
    expect(respuesta.sinDestinatario).toBe(0);
  });

  it("confirmar es idempotente y quita únicamente el par confirmado", async () => {
    const dealId = await crearDeal();
    await abonar(dealId, "500");
    await moverEtapa(db, { dealId, a: "ganado_parcial", actor: sistema });
    const inicial = await estudiantesNuevosPendientes(db, { origen: "https://crm.retia.test" });
    const primera = inicial.entregas[0];

    expect(await confirmarEstudiantesNuevos(db, [primera])).toBe(1);
    expect(await confirmarEstudiantesNuevos(db, [primera])).toBe(0);
    expect(await db.select().from(avisosEstudianteNuevoEnvios)).toHaveLength(1);
    const despues = await estudiantesNuevosPendientes(db, { origen: "https://crm.retia.test" });
    expect(despues.entregas.map((fila) => fila.telefono)).toEqual(["573002222222"]);
  });

  it("rechaza un número que ya pertenece a otra persona", async () => {
    await expect(agregarWhatsappDeUsuario(
      db,
      { id: gerente, rol: "gerente" },
      csB,
      { telefono: "+57 300-111-1111" },
    )).rejects.toMatchObject({ status: 409, message: "Ese número de WhatsApp ya está asignado a otra persona." });
  });
});
