import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  productos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { MovimientoRechazado, abrirDeal, moverEtapa, type Actor } from "@/lib/deals/mover-etapa";
import { crearConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 045 — `moverEtapa()`, el unico camino para cambiar `deals.etapa`.
 *
 * Los requisitos flecha por flecha ya estan probados en memoria (044). Aqui se
 * prueba lo que solo existe con base: que los hechos se LEEN de la base y no los da
 * quien llama, que la etapa y su historial van juntos o no van, quien puede tomar
 * cada flecha, y la vuelta de A1 que decide el historial.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let leadId: string;
let closer: string;
let otroCloser: string;
let gerente: string;
let productoId: string;
let motivoActivo: string;
let motivoInactivo: string;
let motivoReagenda: string;
let motivoRetroceso: string;
let motivoRecuperacion: string;

const sistema: Actor = { tipo: "sistema" };
const comoCloser = (): Actor => ({ tipo: "usuario", userId: closer, rol: "closer" });
const comoOtroCloser = (): Actor => ({ tipo: "usuario", userId: otroCloser, rol: "closer" });
const comoGerente = (): Actor => ({ tipo: "usuario", userId: gerente, rol: "gerente" });

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co" }).returning();
  leadId = l.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [prod] = await db
    .insert(productos)
    .values({ programId, nombre: "Programa completo", precioLista: "1000" })
    .returning();
  productoId = prod.id;
  const [m1] = await db.insert(motivos).values({ nombre: "No contesta", tipo: "perdida" }).returning();
  const [m2] = await db.insert(motivos).values({ nombre: "Viejo", tipo: "perdida", activo: false }).returning();
  const [m3] = await db.insert(motivos).values({ nombre: "Cita fallida", tipo: "reagenda" }).returning();
  const [m4] = await db.insert(motivos).values({ nombre: "Se lo pensó", tipo: "retroceso" }).returning();
  const [m5] = await db.insert(motivos).values({ nombre: "Volvió a escribir", tipo: "recuperacion" }).returning();
  motivoActivo = m1.id;
  motivoInactivo = m2.id;
  motivoReagenda = m3.id;
  motivoRetroceso = m4.id;
  motivoRecuperacion = m5.id;
});

afterEach(async () => {
  await cerrar();
});

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [d] = await db.insert(deals).values({ leadId, programId, etapa, ...extra }).returning();
  return d.id;
}

async function etapaDe(dealId: string) {
  const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(eq(deals.id, dealId));
  return d.etapa;
}

const historial = (dealId: string) =>
  db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));

async function rechazo(p: Promise<unknown>) {
  try {
    await p;
  } catch (e) {
    return e as MovimientoRechazado;
  }
  throw new Error("se esperaba un rechazo");
}

describe("mover y dejar historial", () => {
  it("T1: con dueño y contacto registrado, el deal pasa a En Contacto y queda la fila de historial", async () => {
    const dealId = await nuevoDeal("pendiente_setteo", { ownerUserId: closer });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: closer });

    const hecho = await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() });

    expect(hecho).toMatchObject({ de: "pendiente_setteo", a: "en_contacto", transicion: { id: "T1" } });
    expect(await etapaDe(dealId)).toBe("en_contacto");
    expect(await historial(dealId)).toMatchObject([
      { de: "pendiente_setteo", a: "en_contacto", userId: closer, motivoId: null },
    ]);
  });

  it("lo que falta se nombra, y el deal no se mueve ni deja historial", async () => {
    // Lo mueve un administrador para llegar a la revision de requisitos: un closer no
    // dueño chocaria antes con la reja del dueño (punto 3). El requisito `dueno` sigue
    // faltando porque el deal no tiene dueño.
    const dealId = await nuevoDeal("pendiente_setteo");

    const e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoGerente() }));

    expect(e).toBeInstanceOf(MovimientoRechazado);
    expect(e.status).toBe(422);
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["dueno", "contacto"]);
    expect(e.message).toContain("no tiene dueño");
    expect(await etapaDe(dealId)).toBe("pendiente_setteo");
    expect(await historial(dealId)).toEqual([]);
  });

  it("una flecha que no existe se rechaza con las etapas por su nombre", async () => {
    const dealId = await nuevoDeal("pendiente_setteo");
    const e = await rechazo(moverEtapa(db, { dealId, a: "completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    expect(e.message).toBe("Un deal no puede pasar de Pendiente Setteo a Completo.");
  });

  it("si el historial no se puede escribir, la etapa tampoco cambia", async () => {
    // Un administrador (pasa la reja del dueño) con un id que no existe hace fallar la FK
    // del historial DESPUES del update de la etapa: la transaccion deshace las dos cosas.
    const dealId = await nuevoDeal("pendiente_setteo", { ownerUserId: closer });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: closer });

    await expect(
      moverEtapa(db, {
        dealId,
        a: "en_contacto",
        actor: { tipo: "usuario", userId: "00000000-0000-0000-0000-000000000000", rol: "gerente" },
      }),
    ).rejects.toThrow();

    expect(await etapaDe(dealId)).toBe("pendiente_setteo");
    expect(await historial(dealId)).toEqual([]);
  });

  it("un deal anulado no se mueve", async () => {
    const dealId = await nuevoDeal("pendiente_setteo", { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.status).toBe(409);
  });

  it("un deal que no existe es 404", async () => {
    const e = await rechazo(
      moverEtapa(db, { dealId: "00000000-0000-0000-0000-000000000000", a: "en_contacto", actor: sistema }),
    );
    expect(e.status).toBe(404);
  });
});

describe("quien puede tomar cada flecha", () => {
  it("una persona no mueve a Atendido: la mueve el sistema cuando la llamada ocurrio", async () => {
    const dealId = await nuevoDeal("agendado");
    await db.insert(calls).values({ dealId, programId, resultado: "show", origen: "app" });

    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser() }));
    expect(e.status).toBe(403);

    await moverEtapa(db, { dealId, a: "atendido", actor: sistema });
    expect(await etapaDe(dealId)).toBe("atendido");
    expect((await historial(dealId))[0].userId).toBeNull();
  });

  it("el sistema no decide por el closer que un lead se perdio", async () => {
    const dealId = await nuevoDeal("en_contacto");
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: sistema, motivoId: motivoActivo }));
    expect(e.status).toBe(403);
  });
});

describe("solo el dueño o un administrador mueven un deal (punto 3, Mani 27-sep)", () => {
  it("un closer que NO es dueño recibe 403 y el deal no se mueve", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoOtroCloser(), motivoId: motivoActivo }),
    );
    expect(e.status).toBe(403);
    expect(e.message).toContain("dueño");
    expect(await etapaDe(dealId)).toBe("en_contacto");
    expect(await historial(dealId)).toEqual([]);
  });

  it("el dueño sí puede moverlo", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });

  it("un administrador (gerente o developer) mueve cualquier deal, aunque no sea el dueño", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });

  it("un deal SIN dueño no lo mueve una persona que no administra: 403", async () => {
    const dealId = await nuevoDeal("en_contacto");
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo }),
    );
    expect(e.status).toBe(403);
    expect(e.message).toContain("no tiene dueño");
    expect(await etapaDe(dealId)).toBe("en_contacto");

    // Pero el administrador sí, y el sistema para las flechas del sistema.
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });
});

describe("la llamada 'sucedio' mira la MAS RECIENTE, no cualquiera (punto 4, Mani 27-sep)", () => {
  it("un show viejo NO lleva a Atendido si la ultima llamada (una agenda nueva) no ocurrio", async () => {
    // El deal vuelve a Agendado y hay dos llamadas: la primera fue 'show', la segunda
    // 'agendada' y aun no ocurre. Con `some()` sobre todas, el show viejo colaria el
    // deal a Atendido (T10) sin que la nueva llamada haya pasado. Mirando SOLO la ultima
    // (mas reciente por createdAt), se rechaza.
    const dealId = await nuevoDeal("agendado");
    await db
      .insert(calls)
      .values({ dealId, programId, resultado: "show", origen: "app", createdAt: new Date("2026-09-10T12:00:00-05:00") });
    await db
      .insert(calls)
      .values({
        dealId,
        programId,
        resultado: "agendada",
        fechaAgenda: new Date("2026-09-20T12:00:00-05:00"),
        origen: "app",
        createdAt: new Date("2026-09-15T12:00:00-05:00"),
      });

    // T10 la mueve el sistema; el requisito es que la ultima llamada haya sucedido.
    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["llamada_sucedio"]);
    expect(await etapaDe(dealId)).toBe("agendado");

    // Cuando la mas reciente sí sucede (un 'show' nuevo), pasa.
    await db
      .insert(calls)
      .values({ dealId, programId, resultado: "show", origen: "app", createdAt: new Date("2026-09-25T12:00:00-05:00") });
    await moverEtapa(db, { dealId, a: "atendido", actor: sistema });
    expect(await etapaDe(dealId)).toBe("atendido");
  });
});

describe("los datos van en el mismo movimiento, o no van (punto 6, Mani 27-sep)", () => {
  it("un movimiento rechazado deja el deal intacto y sin change_log (rollback atomico)", async () => {
    // El deal quiere ir a Compromiso Verbal (T4): pide producto + fecha limite. Se pasa
    // el producto por `datos` pero NO la fecha, asi que el requisito falla DESPUES de
    // escribir el producto. La transaccion tiene que deshacer tambien la escritura de los
    // datos: el deal queda sin producto y sin una sola fila de change_log.
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    await db.delete(changeLog);

    const e = await rechazo(
      moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser(), datos: { productoId } }),
    );
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);

    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.etapa).toBe("en_contacto");
    expect(d.productoId).toBeNull();
    expect(await db.select().from(changeLog)).toEqual([]);
    expect(await historial(dealId)).toEqual([]);
  });

  it("un movimiento aceptado escribe los datos por change_log y mueve, todo junto", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    await db.delete(changeLog);

    await moverEtapa(db, {
      dealId,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: { productoId, fechaLimitePago: "2026-10-30", acuerdoPago: "50% ahora, 50% en octubre" },
    });

    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(log.map((l) => l.campo).sort()).toEqual(["acuerdoPago", "fechaLimitePago", "productoId"]);
    expect(log.every((l) => l.userId === closer)).toBe(true);
  });

  it("un producto de otro programa se rechaza (frontera, ADR 0043) y no escribe nada", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const [ajeno] = await db
      .insert(productos)
      .values({ programId: otro.id, nombre: "Otro", precioLista: "500" })
      .returning();
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    await db.delete(changeLog);

    const e = await rechazo(
      moverEtapa(db, {
        dealId,
        a: "compromiso_verbal",
        actor: comoCloser(),
        datos: { productoId: ajeno.id, fechaLimitePago: "2026-10-30" },
      }),
    );
    expect(e.status).toBe(422);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.productoId).toBeNull();
    expect(await db.select().from(changeLog)).toEqual([]);
  });

  it("un producto inactivo se rechaza", async () => {
    const [inactivo] = await db
      .insert(productos)
      .values({ programId, nombre: "Retirado", precioLista: "500", activo: false })
      .returning();
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });

    const e = await rechazo(
      moverEtapa(db, {
        dealId,
        a: "compromiso_verbal",
        actor: comoCloser(),
        datos: { productoId: inactivo.id, fechaLimitePago: "2026-10-30" },
      }),
    );
    expect(e.status).toBe(422);
  });

  it("una prueba de hecho (abono) NUNCA entra por datos: no hay campo para colarla", async () => {
    // El tipo de `DatosMovimiento` no admite abonos, contactos ni llamadas: se leen de la
    // base. Esta prueba fija que el saldo —y por tanto el abono— sale de la base incluso
    // pasando datos: sin abono real, no se puede ir a Abonado por mas datos que se manden.
    const dealId = await nuevoDeal("atendido", { ownerUserId: closer });
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "abonado", actor: sistema, datos: { productoId } }),
    );
    expect(e.faltantes.map((f) => f.codigo)).toContain("abono");
  });
});

describe("el motivo", () => {
  it("Cierre Perdido sin motivo, o con uno desactivado, se rechaza; con uno activo pasa y queda en el historial", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });

    let e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoInactivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await historial(dealId)).toMatchObject([{ a: "cierre_perdido", motivoId: motivoActivo }]);
  });

  it("cada flecha exige el motivo de SU lista: uno de otra lista es 'no motivo' (punto 2)", async () => {
    // Cada deal va sobre un lead distinto: la base no deja dos deals abiertos del mismo
    // lead y programa.
    const dealEnLeadNuevo = async (etapa: EtapaDeal, correo: string) => {
      const [l] = await db.insert(leads).values({ programId, emailNormalizado: correo }).returning();
      const [d] = await db.insert(deals).values({ leadId: l.id, programId, etapa, ownerUserId: closer }).returning();
      return d.id;
    };

    // P pide 'perdida'; un motivo de 'reagenda' activo no sirve.
    const perdido = await dealEnLeadNuevo("en_contacto", "p1@correo.co");
    let e = await rechazo(moverEtapa(db, { dealId: perdido, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoReagenda }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: perdido, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await etapaDe(perdido)).toBe("cierre_perdido");

    // T29 (Atendido → Re-agenda) pide 'reagenda'; el de 'perdida' no sirve.
    const reagenda = await dealEnLeadNuevo("atendido", "p2@correo.co");
    e = await rechazo(moverEtapa(db, { dealId: reagenda, a: "pendiente_reagenda", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: reagenda, a: "pendiente_reagenda", actor: comoCloser(), motivoId: motivoReagenda });
    expect(await etapaDe(reagenda)).toBe("pendiente_reagenda");

    // T15 (Compromiso Verbal → Seguimiento) pide 'retroceso'.
    const retroceso = await dealEnLeadNuevo("compromiso_verbal", "p3@correo.co");
    e = await rechazo(moverEtapa(db, { dealId: retroceso, a: "seguimiento", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: retroceso, a: "seguimiento", actor: comoCloser(), motivoId: motivoRetroceso });
    expect(await etapaDe(retroceso)).toBe("seguimiento");

    // R (recuperar un perdido) pide 'recuperacion'.
    const recuperar = await dealEnLeadNuevo("cierre_perdido", "p4@correo.co");
    e = await rechazo(moverEtapa(db, { dealId: recuperar, a: "en_contacto", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: recuperar, a: "en_contacto", actor: comoCloser(), motivoId: motivoRecuperacion });
    expect(await etapaDe(recuperar)).toBe("en_contacto");
  });
});

describe("los hechos salen de la base", () => {
  it("Proxima Cohorte usa la cohorte DESTINO (columna aparte), no muda cohort_id (punto 1)", async () => {
    const base = { programId, metaCupos: 30, precioUsd: "1000", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-25" };
    const [origen] = await db
      .insert(cohorts)
      .values({ ...base, codigo: "C3", estado: "activo", fechaInicioVentas: "2026-09-01" })
      .returning();
    const [destino] = await db.insert(cohorts).values({ ...base, codigo: "C4", estado: "futuro" }).returning();

    // Sin cohorte destino escrita, falta el requisito.
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer, cohortId: origen.id });
    const e = await rechazo(moverEtapa(db, { dealId, a: "proxima_cohorte", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["cohorte_destino"]);

    // Se pasa la cohorte destino en el mismo movimiento (punto 6). cohort_id NO cambia.
    await moverEtapa(db, {
      dealId,
      a: "proxima_cohorte",
      actor: comoCloser(),
      datos: { cohorteDestinoId: destino.id },
    });
    expect(await etapaDe(dealId)).toBe("proxima_cohorte");
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.cohortId).toBe(origen.id);
    expect(d.cohorteDestinoId).toBe(destino.id);
  });

  it("la cohorte destino tiene que ser de OTRO estado igual, del mismo programa y distinta al origen (puntos 1 y 6)", async () => {
    const base = { programId, metaCupos: 30, precioUsd: "1000", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-25" };
    const [origen] = await db
      .insert(cohorts)
      .values({ ...base, codigo: "C3", estado: "activo", fechaInicioVentas: "2026-09-01" })
      .returning();
    // Cohorte de OTRO programa: el programa es frontera (ADR 0043).
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const [ajena] = await db
      .insert(cohorts)
      .values({ programId: otro.id, codigo: "Q1", metaCupos: 10, precioUsd: "1500", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro" })
      .returning();

    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer, cohortId: origen.id });

    // De otro programa: 422, y nada escrito (rollback).
    let e = await rechazo(
      moverEtapa(db, { dealId, a: "proxima_cohorte", actor: comoCloser(), datos: { cohorteDestinoId: ajena.id } }),
    );
    expect(e.status).toBe(422);
    expect(await etapaDe(dealId)).toBe("en_contacto");
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].cohorteDestinoId).toBeNull();

    // La misma cohorte de origen: 422.
    e = await rechazo(
      moverEtapa(db, { dealId, a: "proxima_cohorte", actor: comoCloser(), datos: { cohorteDestinoId: origen.id } }),
    );
    expect(e.status).toBe(422);
  });

  it("T22: el contacto tiene que ser NUEVO, posterior a quedar en Proxima Cohorte", async () => {
    const dealId = await nuevoDeal("proxima_cohorte", { ownerUserId: closer, createdAt: new Date("2026-09-01T12:00:00-05:00") });
    await db.insert(dealActividades).values({
      dealId,
      tipo: "contacto",
      canal: "whatsapp",
      userId: closer,
      fecha: new Date("2026-09-10T12:00:00-05:00"),
    });
    await db.insert(dealEtapaHistorial).values({
      dealId,
      de: "atendido",
      a: "proxima_cohorte",
      fecha: new Date("2026-09-15T12:00:00-05:00"),
    });

    const e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["contacto"]);

    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "llamada", userId: closer });
    await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("en_contacto");
  });

  it("el dinero mueve el deal: Abonado con saldo, Completo sin saldo, y A1 vuelve a la etapa de donde vino", async () => {
    const dealId = await nuevoDeal("atendido", { productoId });
    await db.insert(dealEtapaHistorial).values({ dealId, de: "agendado", a: "atendido" });
    const [primero] = await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-27", monto: "300", comprobanteUrl: "https://x/1.png" })
      .returning();

    // Con 700 de saldo no es Completo.
    let e = await rechazo(moverEtapa(db, { dealId, a: "completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["saldo_en_cero"]);
    await moverEtapa(db, { dealId, a: "abonado", actor: sistema });

    // Se anula el unico abono: vuelve a Atendido, que es de donde vino, y a ningun otro lado.
    await db
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "tecleo" })
      .where(eq(abonos.id, primero.id));
    e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: sistema, motivoId: motivoActivo }));
    expect(e.status).toBe(409);
    expect(e.message).toContain("vuelve a Atendido");
    await moverEtapa(db, { dealId, a: "atendido", actor: sistema, motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("atendido");

    // Paga todo de una vez: T14 directo a Completo.
    await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-28", monto: "1000", comprobanteUrl: "https://x/2.png" });
    await moverEtapa(db, { dealId, a: "completo", actor: sistema });
    expect((await historial(dealId)).map((h) => h.a)).toEqual(["atendido", "abonado", "atendido", "completo"]);
  });
});

describe("el saldo (ADR 0024)", () => {
  it("precio del producto menos abonos vigentes; sin producto no hay saldo", async () => {
    const conProducto = await nuevoDeal("atendido", { productoId });
    // Otro lead: la base no deja dos deals abiertos del mismo lead y programa.
    const [otro] = await db.insert(leads).values({ programId, emailNormalizado: "beto@correo.co" }).returning();
    const [sp] = await db.insert(deals).values({ leadId: otro.id, programId, etapa: "atendido" }).returning();
    const sinProducto = sp.id;
    await db.insert(abonos).values({ dealId: conProducto, programId, fecha: "2026-09-27", monto: "250.50" });
    await db
      .insert(abonos)
      .values({
        dealId: conProducto,
        programId,
        fecha: "2026-09-27",
        monto: "100",
        anuladoEn: new Date(),
        anuladoPor: closer,
        motivoAnulacion: "tecleo",
      });

    const saldos = await saldosDeDeals(db, [conProducto, sinProducto]);
    expect(saldos.get(conProducto)).toMatchObject({ precio: 1000, abonado: 250.5, abonosVigentes: 1, saldo: 749.5 });
    expect(saldos.get(sinProducto)).toMatchObject({ precio: null, saldo: null, sinSaldoPorque: "sin_producto" });
  });

  it("nunca convierte moneda en silencio: un abono en otra moneda deja el saldo sin calcular", async () => {
    const dealId = await nuevoDeal("atendido", { productoId });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-27", monto: "400000", moneda: "COP" });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({
      saldo: null,
      sinSaldoPorque: "moneda_distinta",
    });
  });
});

describe("saltos, retrocesos y recuperacion (ticket 047)", () => {
  it("T4: el cierre por chat salta de En Contacto a Compromiso Verbal con producto y fecha limite", async () => {
    const dealId = await nuevoDeal("en_contacto", { ownerUserId: closer });
    const e = await rechazo(moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["producto", "fecha_limite_pago"]);

    // Los datos que la flecha pide van en el MISMO movimiento (punto 6): producto activo
    // del programa y fecha limite, escritos por el motor, no antes.
    await moverEtapa(db, {
      dealId,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: { productoId, fechaLimitePago: "2026-10-30" },
    });
    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d).toMatchObject({ productoId, fechaLimitePago: "2026-10-30" });
  });

  it("un retroceso (T29, Atendido → Re-agenda) sin motivo se rechaza; con motivo de re-agenda pasa y queda en el historial", async () => {
    const dealId = await nuevoDeal("atendido", { ownerUserId: closer });
    const e = await rechazo(moverEtapa(db, { dealId, a: "pendiente_reagenda", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "pendiente_reagenda", actor: comoCloser(), motivoId: motivoReagenda });
    expect(await historial(dealId)).toMatchObject([{ de: "atendido", a: "pendiente_reagenda", motivoId: motivoReagenda }]);
  });

  it("un perdido se recupera con motivo de recuperacion, y solo hacia En Contacto, Agendado o Proxima Cohorte", async () => {
    const dealId = await nuevoDeal("cierre_perdido", { ownerUserId: closer });

    let e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser(), motivoId: motivoRecuperacion }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    e = await rechazo(moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "en_contacto", actor: comoCloser(), motivoId: motivoRecuperacion });
    expect(await historial(dealId)).toMatchObject([{ de: "cierre_perdido", a: "en_contacto", motivoId: motivoRecuperacion }]);
  });
});

describe("abrirDeal: donde nace un deal (ticket 047)", () => {
  it("a mano nace en En Contacto con quien lo crea de dueño, con su primera fila de historial y su rastro", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "en_contacto", actor: comoCloser() });

    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d).toMatchObject({ etapa: "en_contacto", ownerUserId: closer, creadoPor: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "en_contacto", userId: closer }]);
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(log.map((l) => l.campo)).toContain("etapa");
  });

  it("a mano no nace en Agendado ni despues de la llamada; el sistema no nace en En Contacto", async () => {
    for (const etapa of ["agendado", "atendido", "abonado", "completo"] as const) {
      const e = await rechazo(abrirDeal(db, { leadId, programId, etapa, actor: comoCloser() }));
      expect(e.status, etapa).toBe(422);
    }
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "en_contacto", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("el sistema abre en Agendado con el dueño que le dio Calendly", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "agendado", actor: sistema, ownerUserId: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "agendado", userId: null }]);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.ownerUserId).toBe(closer);
  });

  it("nacer en Compromiso Verbal exige producto y fecha limite", async () => {
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "compromiso_verbal", actor: comoCloser(), productoId }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);

    await abrirDeal(db, {
      leadId,
      programId,
      etapa: "compromiso_verbal",
      actor: comoCloser(),
      productoId,
      fechaLimitePago: "2026-10-30",
    });
  });

  it("el programa es frontera: no se abre un deal sobre un lead de otro programa", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const e = await rechazo(abrirDeal(db, { leadId, programId: otro.id, etapa: "pendiente_setteo", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("un deal abierto por lead: el segundo es 409; reaplicar tras un Cierre Perdido abre uno NUEVO", async () => {
    const primero = await abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema });
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema }));
    expect(e.status).toBe(409);
    expect(await historial(primero)).toHaveLength(1);

    await moverEtapa(db, { dealId: primero, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    const segundo = await abrirDeal(db, { leadId, programId, etapa: "pendiente_setteo", actor: sistema });
    expect(segundo).not.toBe(primero);
    expect(await etapaDe(primero)).toBe("cierre_perdido");
  });

  it("nadie mas crea un deal diciendo su etapa: crearConRastro lo rechaza sin la llave del motor", async () => {
    await expect(
      crearConRastro(
        { db, tabla: deals, nombreTabla: "deals", actorId: closer, etiqueta: "x" },
        { leadId, programId, etapa: "abonado" },
      ),
    ).rejects.toThrow(/abrirDeal\(\)/);
    expect(await db.select().from(deals)).toEqual([]);
  });
});
