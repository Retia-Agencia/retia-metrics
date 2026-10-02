import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import {
  abonos,
  areas,
  calls,
  changeLog,
  cohorts,
  dealActividades,
  dealEtapaHistorial,
  deals,
  leads,
  motivos,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { MovimientoRechazado, abrirDeal, moverEtapa, revisarMovimiento, type Actor } from "@/lib/deals/mover-etapa";
import { crearConRastro } from "@/lib/crm/rastro";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { embudoDelRango } from "@/lib/queries/dashboard";
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
let areaId: string;
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
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
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
  const [d] = await db.insert(deals).values({ leadId, programId, etapa, valorVendidoUsd: "1000", areaDeclaradaId: areaId, ...extra }).returning();
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
  it("lo que falta se nombra, y el deal no se mueve ni deja historial", async () => {
    // Lo mueve un administrador para llegar a la revision de requisitos: un closer no
    // dueño chocaria antes con la reja del dueño (punto 3). El requisito `dueno` sigue
    // faltando porque el deal no tiene dueño.
    const dealId = await nuevoDeal("registrado");

    const e = await rechazo(moverEtapa(db, { dealId, a: "en_gestion", actor: sistema }));

    expect(e).toBeInstanceOf(MovimientoRechazado);
    expect(e.status).toBe(422);
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["dueno", "actividad"]);
    expect(e.message).toContain("no tiene dueño");
    expect(await etapaDe(dealId)).toBe("registrado");
    expect(await historial(dealId)).toEqual([]);
  });

  it("una flecha que no existe se rechaza con las etapas por su nombre", async () => {
    const dealId = await nuevoDeal("registrado");
    const e = await rechazo(moverEtapa(db, { dealId, a: "ganado_completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    expect(e.message).toBe("Un deal no puede pasar de Registrado a Ganado Pagado Completo.");
  });

  it("si el historial no se puede escribir, la etapa tampoco cambia", async () => {
    // Un administrador (pasa la reja del dueño) con un id que no existe hace fallar la FK
    // del historial DESPUES del update de la etapa: la transaccion deshace las dos cosas.
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    await db.insert(dealActividades).values({ dealId, tipo: "contacto", canal: "whatsapp", userId: closer });

    await expect(
      moverEtapa(db, {
        dealId,
        a: "calificado",
        actor: { tipo: "usuario", userId: "00000000-0000-0000-0000-000000000000", rol: "gerente" },
      }),
    ).rejects.toThrow();

    expect(await etapaDe(dealId)).toBe("contactado");
    expect(await historial(dealId)).toEqual([]);
  });

  it("un deal anulado no se mueve", async () => {
    const dealId = await nuevoDeal("registrado", { anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" });
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.status).toBe(409);
  });

  it("un deal que no existe es 404", async () => {
    const e = await rechazo(
      moverEtapa(db, { dealId: "00000000-0000-0000-0000-000000000000", a: "contactado", actor: sistema }),
    );
    expect(e.status).toBe(404);
  });
});

describe("quien puede tomar cada flecha", () => {
  it("el dueño mueve Agendado a Atendido sin Grain y la llamada queda como show con rastro", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const fechaAgenda = new Date("2026-09-20T12:00:00-05:00");
    const [call] = await db.insert(calls).values({
      dealId,
      programId,
      emailLead: "ana@correo.co",
      fechaAgenda,
      resultado: "agendada",
      origen: "app",
    }).returning();

    await moverEtapa(db, { dealId, a: "atendido", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("atendido");
    const [guardada] = await db.select().from(calls).where(eq(calls.id, call.id));
    expect(guardada).toMatchObject({ resultado: "show", linkGrain: null });
    expect(guardada.fechaLlamada?.getTime()).toBe(fechaAgenda.getTime());
    expect(await db.select().from(changeLog).where(eq(changeLog.registroId, call.id)))
      .toEqual(expect.arrayContaining([expect.objectContaining({ campo: "resultado" })]));
    expect((await historial(dealId))[0].userId).toBe(closer);
    expect((await embudoDelRango({
      programId,
      rango: { desde: "2026-09-20", hasta: "2026-09-20" },
    }, db)).llamadasConShow).toBe(1);
  });

  it("el dueño mueve Pendiente Re-agenda a Atendido y convierte el ultimo no_show en show", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer, pendiente: "reagenda" });
    const [call] = await db.insert(calls).values({
      dealId,
      programId,
      fechaAgenda: new Date("2026-09-21T12:00:00-05:00"),
      resultado: "no_show",
      origen: "app",
    }).returning();
    await moverEtapa(db, { dealId, a: "atendido", actor: comoCloser() });
    expect(await etapaDe(dealId)).toBe("atendido");
    expect((await db.select().from(calls).where(eq(calls.id, call.id)))[0].resultado).toBe("show");
  });

  it("rechaza si la unica llamada esta anulada y deshace todo", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    const [call] = await db.insert(calls).values({
      dealId,
      programId,
      fechaAgenda: new Date("2026-09-21T12:00:00-05:00"),
      resultado: "agendada",
      origen: "app",
      anuladoEn: new Date("2026-09-21T13:00:00-05:00"),
      anuladoPor: closer,
      motivoAnulacion: "duplicada",
    }).returning();
    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser() }));
    expect(e.status).toBe(422);
    expect(e.message).toBe("No hay una llamada con fecha que dar por atendida. Crea o agenda la llamada primero.");
    expect(await etapaDe(dealId)).toBe("agendado");
    expect((await db.select().from(calls).where(eq(calls.id, call.id)))[0].resultado).toBe("agendada");
  });

  it("un closer que no es dueño no mueve Agendado a Atendido", async () => {
    const dealId = await nuevoDeal("agendado", { ownerUserId: closer });
    await db.insert(calls).values({
      dealId,
      programId,
      fechaAgenda: new Date("2026-09-21T12:00:00-05:00"),
      resultado: "agendada",
      origen: "app",
    });
    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoOtroCloser() }));
    expect(e.status).toBe(403);
    expect(await etapaDe(dealId)).toBe("agendado");
  });

  it("el sistema no decide por el closer que un lead se perdio", async () => {
    const dealId = await nuevoDeal("contactado");
    const e = await rechazo(moverEtapa(db, { dealId, a: "cierre_perdido", actor: sistema, motivoId: motivoActivo }));
    expect(e.status).toBe(403);
  });
});

describe("solo el dueño o un administrador mueven un deal (punto 3, Mani 27-sep)", () => {
  it("un closer que NO es dueño recibe 403 y el deal no se mueve", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoOtroCloser(), motivoId: motivoActivo }),
    );
    expect(e.status).toBe(403);
    expect(e.message).toContain("dueño");
    expect(await etapaDe(dealId)).toBe("contactado");
    expect(await historial(dealId)).toEqual([]);
  });

  it("el dueño sí puede moverlo", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });

  it("un administrador (gerente o developer) mueve cualquier deal, aunque no sea el dueño", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });

  it("un deal SIN dueño no lo mueve una persona que no administra: 403", async () => {
    const dealId = await nuevoDeal("contactado");
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo }),
    );
    expect(e.status).toBe(403);
    expect(e.message).toContain("no tiene dueño");
    expect(await etapaDe(dealId)).toBe("contactado");

    // Pero el administrador sí, y el sistema para las flechas del sistema.
    await moverEtapa(db, { dealId, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    expect(await etapaDe(dealId)).toBe("cierre_perdido");
  });
});

describe("la llamada 'sucedio' mira la MAS RECIENTE, no cualquiera (punto 4, Mani 27-sep)", () => {
  it("un show viejo NO lleva a Atendido si la ultima llamada (una agenda nueva) no ocurrio", async () => {
    // El deal vuelve a Agendado y hay dos llamadas: la primera fue 'show', la segunda
    // 'agendada' y aun no ocurre. Con `some()` sobre todas, el show viejo colaria el
    // deal a Atendido (E8) sin que la nueva llamada haya pasado. Mirando SOLO la ultima
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

    // E8 la mueve el sistema; el requisito es que la ultima llamada haya sucedido.
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
  it("Compromiso Verbal rechaza un deal sin área declarada", async () => {
    const compromiso = await nuevoDeal("contactado", { ownerUserId: closer, areaDeclaradaId: null });
    const e = await rechazo(moverEtapa(db, {
      dealId: compromiso,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: {fechaLimitePago: "2026-10-30" },
    }));
    expect(e.status).toBe(422);
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["area_declarada"]);
    expect(await etapaDe(compromiso)).toBe("contactado");

  });

  it("Abonado rechaza un deal sin área declarada", async () => {
    const abonado = await nuevoDeal("atendido", {areaDeclaradaId: null });
    await db.insert(abonos).values({
      dealId: abonado,
      programId,
      fecha: "2026-09-28",
      monto: "300",
      comprobanteUrl: "https://x/abono.png",
    });
    const e = await rechazo(moverEtapa(db, { dealId: abonado, a: "ganado_parcial", actor: sistema }));
    expect(e.status).toBe(422);
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["area_declarada"]);
    expect(await etapaDe(abonado)).toBe("atendido");
  });

  it("un movimiento rechazado deja el deal intacto y sin change_log (rollback atomico)", async () => {
    // Se escribe el área pero falta la fecha; el rechazo debe deshacer ambos cambios.
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer, areaDeclaradaId: null });
    await db.delete(changeLog);

    const e = await rechazo(
      moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser(), datos: { areaDeclaradaId: areaId } }),
    );
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);

    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.etapa).toBe("contactado");
    expect(d.areaDeclaradaId).toBeNull();
    expect(await db.select().from(changeLog)).toEqual([]);
    expect(await historial(dealId)).toEqual([]);
  });

  it("un movimiento aceptado escribe los datos por change_log y mueve, todo junto", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer, areaDeclaradaId: null });
    await db.delete(changeLog);

    await moverEtapa(db, {
      dealId,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: {areaDeclaradaId: areaId, fechaLimitePago: "2026-10-30", acuerdoPago: "50% ahora, 50% en octubre" },
    });

    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(log.map((l) => l.campo).sort()).toEqual(["acuerdoPago", "areaDeclaradaId", "fechaLimitePago"]);
    expect(log.every((l) => l.userId === closer)).toBe(true);
  });

  it("un área inactiva se rechaza y no mueve el deal", async () => {
    const [inactiva] = await db.insert(areas).values({ nombre: "Vieja", activo: false }).returning();
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer, areaDeclaradaId: null });
    const e = await rechazo(moverEtapa(db, {
      dealId,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: {fechaLimitePago: "2026-10-30", areaDeclaradaId: inactiva.id },
    }));
    expect(e.status).toBe(422);
    expect(await etapaDe(dealId)).toBe("contactado");
  });

  it("una prueba de hecho (abono) NUNCA entra por datos: no hay campo para colarla", async () => {
    // El tipo de `DatosMovimiento` no admite abonos, contactos ni llamadas: se leen de la
    // base. Esta prueba fija que el saldo —y por tanto el abono— sale de la base incluso
    // pasando datos: sin abono real, no se puede ir a Abonado por mas datos que se manden.
    const dealId = await nuevoDeal("atendido", { ownerUserId: closer });
    const e = await rechazo(
      moverEtapa(db, { dealId, a: "ganado_parcial", actor: sistema }),
    );
    expect(e.faltantes.map((f) => f.codigo)).toContain("abono");
  });
});

describe("el motivo", () => {
  it("Cierre Perdido sin motivo, o con uno desactivado, se rechaza; con uno activo pasa y queda en el historial", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });

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
    const perdido = await dealEnLeadNuevo("contactado", "p1@correo.co");
    let e = await rechazo(moverEtapa(db, { dealId: perdido, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoReagenda }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: perdido, a: "cierre_perdido", actor: comoCloser(), motivoId: motivoActivo });
    expect(await etapaDe(perdido)).toBe("cierre_perdido");

    // PR2 (Atendido + Re-agenda) pide 'reagenda'; el de 'perdida' no sirve.
    const reagenda = await dealEnLeadNuevo("atendido", "p2@correo.co");
    e = await rechazo(moverEtapa(db, { dealId: reagenda, a: "atendido", pendiente: "reagenda", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: reagenda, a: "atendido", pendiente: "reagenda", actor: comoCloser(), motivoId: motivoReagenda });
    expect((await db.select().from(deals).where(eq(deals.id, reagenda)))[0].pendiente).toBe("reagenda");

    // RETRO (Compromiso Verbal → etapa previa + Seguimiento) pide 'retroceso'.
    const retroceso = await dealEnLeadNuevo("compromiso_verbal", "p3@correo.co");
    await db.insert(dealEtapaHistorial).values({ dealId: retroceso, de: "atendido", a: "compromiso_verbal" });
    e = await rechazo(moverEtapa(db, { dealId: retroceso, a: "atendido", actor: comoCloser(), motivoId: motivoActivo, datos: { fechaSeguimiento: "2026-10-30" } }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: retroceso, a: "atendido", actor: comoCloser(), motivoId: motivoRetroceso, datos: { fechaSeguimiento: "2026-10-30" } });
    expect(await etapaDe(retroceso)).toBe("atendido");

    // R (recuperar un perdido) pide 'recuperacion'.
    const recuperar = await dealEnLeadNuevo("cierre_perdido", "p4@correo.co");
    e = await rechazo(moverEtapa(db, { dealId: recuperar, a: "en_gestion", actor: comoCloser(), motivoId: motivoActivo }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);
    await moverEtapa(db, { dealId: recuperar, a: "en_gestion", actor: comoCloser(), motivoId: motivoRecuperacion });
    expect(await etapaDe(recuperar)).toBe("en_gestion");
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
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer, cohortId: origen.id });
    const e = await rechazo(moverEtapa(db, { dealId, a: "contactado", pendiente: "proxima_cohorte", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["cohorte_destino"]);

    // Se pasa la cohorte destino en el mismo movimiento (punto 6). cohort_id NO cambia.
    await moverEtapa(db, {
      dealId,
      a: "contactado",
      pendiente: "proxima_cohorte",
      actor: comoCloser(),
      datos: { cohorteDestinoId: destino.id },
    });
    expect(await etapaDe(dealId)).toBe("contactado");
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

    const dealId = await nuevoDeal("contactado", { ownerUserId: closer, cohortId: origen.id });

    // De otro programa: 422, y nada escrito (rollback).
    let e = await rechazo(
      moverEtapa(db, { dealId, a: "contactado", pendiente: "proxima_cohorte", actor: comoCloser(), datos: { cohorteDestinoId: ajena.id } }),
    );
    expect(e.status).toBe(422);
    expect(await etapaDe(dealId)).toBe("contactado");
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].cohorteDestinoId).toBeNull();

    // La misma cohorte de origen: 422.
    e = await rechazo(
      moverEtapa(db, { dealId, a: "contactado", pendiente: "proxima_cohorte", actor: comoCloser(), datos: { cohorteDestinoId: origen.id } }),
    );
    expect(e.status).toBe(422);
  });

  it("RET: el contacto tiene que ser desde la apertura de ventas de la cohorte destino", async () => {
    const base = { programId, metaCupos: 30, precioUsd: "1000", fechaInicioClases: "2026-11-01", fechaCierreVentas: "2026-10-25" };
    const [origen, destino] = await db.insert(cohorts).values([
      { ...base, codigo: "RET-O", estado: "activo", fechaInicioVentas: "2026-09-01" },
      { ...base, codigo: "RET-D", estado: "futuro", fechaInicioVentas: "2026-10-01" },
    ]).returning();
    const dealId = await nuevoDeal("calificado", {
      ownerUserId: closer,
      pendiente: "proxima_cohorte",
      cohortId: origen.id,
      cohorteDestinoId: destino.id,
    });
    await db.insert(dealActividades).values({
      dealId,
      tipo: "contacto",
      canal: "whatsapp",
      userId: closer,
      fecha: new Date("2026-09-10T12:00:00-05:00"),
    });
    const e = await rechazo(moverEtapa(db, { dealId, a: "calificado", pendiente: null, actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["contacto"]);

    await db.insert(dealActividades).values({
      dealId,
      tipo: "contacto",
      canal: "llamada",
      userId: closer,
      fecha: new Date("2026-10-01T00:00:00-05:00"),
    });
    await moverEtapa(db, { dealId, a: "calificado", pendiente: null, actor: sistema });
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0]).toMatchObject({
      etapa: "calificado",
      pendiente: null,
      cohortId: destino.id,
    });
  });

  it("el dinero mueve el deal: Abonado con saldo, Completo sin saldo, y A1 vuelve a la etapa de donde vino", async () => {
    const dealId = await nuevoDeal("atendido");
    await db.insert(dealEtapaHistorial).values({ dealId, de: "agendado", a: "atendido" });
    const [primero] = await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-27", monto: "300", comprobanteUrl: "https://x/1.png" })
      .returning();

    // Con 700 de saldo no es Completo.
    let e = await rechazo(moverEtapa(db, { dealId, a: "ganado_completo", actor: sistema }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["saldo_en_cero"]);
    await moverEtapa(db, { dealId, a: "ganado_parcial", actor: sistema });

    // Se anula el unico abono: vuelve a Atendido, que es de donde vino, y a ningun otro lado.
    await db
      .update(abonos)
      .set({ anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "tecleo" })
      .where(eq(abonos.id, primero.id));
    e = await rechazo(moverEtapa(db, { dealId, a: "contactado", actor: sistema }));
    expect(e.status).toBe(409);
    expect(e.message).toContain("vuelve a Atendido");
    await moverEtapa(db, { dealId, a: "atendido", actor: sistema });
    expect(await etapaDe(dealId)).toBe("atendido");

    // Paga todo de una vez: E11 directo a Ganado Pagado Completo.
    await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-28", monto: "1000", comprobanteUrl: "https://x/2.png" });
    await moverEtapa(db, { dealId, a: "ganado_completo", actor: sistema });
    expect((await historial(dealId)).map((h) => h.a)).toEqual(["atendido", "ganado_parcial", "atendido", "ganado_completo"]);
  });

  it("un deal histórico pasa de Abonado a Completo sin área declarada", async () => {
    const dealId = await nuevoDeal("ganado_parcial", {areaDeclaradaId: null, huellaMigracion: "sheets:p:ventas:1" });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-28", monto: "1000", comprobanteUrl: "https://x/1.png" });
    await moverEtapa(db, { dealId, a: "ganado_completo", actor: sistema });
    expect(await etapaDe(dealId)).toBe("ganado_completo");
  });

  it.each([
    { destino: "ganado_parcial" as const, monto: "500" },
    { destino: "ganado_completo" as const, monto: "1000" },
  ])("para mover a $destino exige valor vendido y pasa cuando se escribe", async ({ destino, monto }) => {
    const [cohorte] = await db
      .insert(cohorts)
      .values({
        programId,
        codigo: "Activa",
        metaCupos: 10,
        precioUsd: "1000",
        fechaInicioClases: "2026-11-01",
        fechaInicioVentas: "2026-09-01",
        fechaCierreVentas: "2026-10-31",
        estado: "activo",
      })
      .returning();
    const dealId = await nuevoDeal("atendido", { cohortId: cohorte.id, valorVendidoUsd: null });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-28", monto, comprobanteUrl: "https://x/valor.png" });

    const e = await rechazo(moverEtapa(db, { dealId, a: destino, actor: sistema }));
    expect(e.message).toContain("Falta el valor vendido.");

    await moverEtapa(db, { dealId, a: destino, actor: sistema, datos: { descuentoUsd: 0 } });
    expect(await etapaDe(dealId)).toBe(destino);
  });
});

describe("el saldo (ADR 0024)", () => {
  it("valor vendido menos abonos vigentes; sin valor vendido no hay saldo", async () => {
    const conValor = await nuevoDeal("atendido", { valorVendidoUsd: "1000" });
    // Otro lead: la base no deja dos deals abiertos del mismo lead y programa.
    const [otro] = await db.insert(leads).values({ programId, emailNormalizado: "beto@correo.co" }).returning();
    const [sp] = await db.insert(deals).values({ leadId: otro.id, programId, etapa: "atendido" }).returning();
    const sinValor = sp.id;
    await db.insert(abonos).values({ dealId: conValor, programId, fecha: "2026-09-27", monto: "250.50" });
    await db
      .insert(abonos)
      .values({
        dealId: conValor,
        programId,
        fecha: "2026-09-27",
        monto: "100",
        anuladoEn: new Date(),
        anuladoPor: closer,
        motivoAnulacion: "tecleo",
      });

    const saldos = await saldosDeDeals(db, [conValor, sinValor]);
    expect(saldos.get(conValor)).toMatchObject({ precio: 1000, moneda: "USD", abonado: 250.5, abonosVigentes: 1, saldo: 749.5 });
    expect(saldos.get(sinValor)).toMatchObject({ precio: null, moneda: "USD", saldo: null, sinSaldoPorque: "sin_valor_vendido" });
  });

  it("nunca convierte moneda en silencio: un abono en otra moneda deja el saldo sin calcular", async () => {
    const dealId = await nuevoDeal("atendido");
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-27", monto: "400000", moneda: "COP" });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({
      saldo: null,
      sinSaldoPorque: "moneda_distinta",
    });
  });
});

describe("saltos, retrocesos y recuperacion (ticket 047)", () => {
  it("E5: el cierre por chat salta de Contactado a Compromiso Verbal con fecha límite", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    const e = await rechazo(moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);

    // Los datos que la flecha pide van en el MISMO movimiento (punto 6): la fecha limite,
    // escrita por el motor, no antes.
    await moverEtapa(db, {
      dealId,
      a: "compromiso_verbal",
      actor: comoCloser(),
      datos: { fechaLimitePago: "2026-10-30" },
    });
    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d).toMatchObject({ fechaLimitePago: "2026-10-30" });
  });

  it("PR2: poner Re-agenda en Atendido exige motivo y lo deja en el historial", async () => {
    const dealId = await nuevoDeal("atendido", { ownerUserId: closer });
    const e = await rechazo(moverEtapa(db, { dealId, a: "atendido", pendiente: "reagenda", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "atendido", pendiente: "reagenda", actor: comoCloser(), motivoId: motivoReagenda });
    expect(await historial(dealId)).toMatchObject([{ de: "atendido", a: "atendido", pendienteA: "reagenda", motivoId: motivoReagenda }]);
  });

  it("un perdido se recupera con motivo de recuperacion, y solo hacia En gestión o Agendado", async () => {
    const dealId = await nuevoDeal("cierre_perdido", { ownerUserId: closer });

    let e = await rechazo(moverEtapa(db, { dealId, a: "atendido", actor: comoCloser(), motivoId: motivoRecuperacion }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["transicion_no_permitida"]);
    e = await rechazo(moverEtapa(db, { dealId, a: "en_gestion", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["motivo"]);

    await moverEtapa(db, { dealId, a: "en_gestion", actor: comoCloser(), motivoId: motivoRecuperacion });
    expect(await historial(dealId)).toMatchObject([{ de: "cierre_perdido", a: "en_gestion", motivoId: motivoRecuperacion }]);
  });
});

describe("revisarMovimiento: la vista previa es un ensayo del motor (ADR 0072 punto 2)", () => {
  it("lo que marca en rojo es lo que el motor rechaza, y no mueve nada", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    const r = await revisarMovimiento(db, { dealId, a: "compromiso_verbal", actor: comoCloser() });
    expect(r.bloqueo).toBeNull();
    expect(r.requisitos.filter((q) => !q.cumple).map((q) => q.codigo)).toEqual(["fecha_limite_pago"]);
    expect(r.requisitos.filter((q) => q.cumple).map((q) => q.codigo)).toContain("area_declarada");
    const e = await rechazo(moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser() }));
    expect(e.faltantes.map((f) => f.codigo)).toEqual(["fecha_limite_pago"]);
    expect(await etapaDe(dealId)).toBe("contactado");
    expect(await historial(dealId)).toEqual([]);
  });

  it("con los datos que pide, todo sale en verde, se deshace, y el motor sí mueve", async () => {
    const dealId = await nuevoDeal("contactado", { ownerUserId: closer });
    const datos = { fechaLimitePago: "2026-10-30" };
    const r = await revisarMovimiento(db, { dealId, a: "compromiso_verbal", actor: comoCloser(), datos });
    expect(r.requisitos.every((q) => q.cumple)).toBe(true);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.fechaLimitePago).toBeNull();
    expect(await etapaDe(dealId)).toBe("contactado");
    await moverEtapa(db, { dealId, a: "compromiso_verbal", actor: comoCloser(), datos });
    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
  });

  it("lo que no se arregla llenando campos sale como bloqueo: sin flecha, o un deal ajeno", async () => {
    const dealId = await nuevoDeal("potencial", { ownerUserId: closer });
    expect((await revisarMovimiento(db, { dealId, a: "atendido", actor: comoCloser() })).bloqueo).toMatch(/no puede pasar/);
    const ajeno = await nuevoDeal("contactado", { ownerUserId: closer, leadId: (await db.insert(leads).values({ programId, emailNormalizado: "beto@correo.co" }).returning())[0].id });
    const r = await revisarMovimiento(db, { dealId: ajeno, a: "calificado", actor: comoOtroCloser() });
    expect(r.bloqueo).not.toBeNull();
    expect(await etapaDe(ajeno)).toBe("contactado");
  });

  it("el retroceso toma el destino del historial, no de quien llama", async () => {
    const dealId = await nuevoDeal("compromiso_verbal", { ownerUserId: closer });
    await db.insert(dealEtapaHistorial).values({ dealId, de: "calificado", a: "compromiso_verbal" });
    const r = await revisarMovimiento(db, { dealId, a: "retroceso", actor: comoCloser() });
    expect(r.destinoRetro).toBe("calificado");
    expect(r.requisitos.filter((q) => !q.cumple).map((q) => q.codigo).sort()).toEqual(["fecha_seguimiento", "motivo"]);
    expect(await etapaDe(dealId)).toBe("compromiso_verbal");
  });
});

describe("abrirDeal: donde nace un deal (ticket 047)", () => {
  it("a mano nace en En gestión con quien lo crea de dueño, con su primera fila de historial y su rastro", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: comoCloser() });

    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d).toMatchObject({ etapa: "en_gestion", ownerUserId: closer, creadoPor: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "en_gestion", userId: closer }]);
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, dealId));
    expect(log.map((l) => l.campo)).toContain("etapa");
  });

  it("a mano no nace en Agendado ni despues de la llamada; el sistema no nace en En gestión", async () => {
    for (const etapa of ["agendado", "atendido", "ganado_parcial", "ganado_completo"] as const) {
      const e = await rechazo(abrirDeal(db, { leadId, programId, etapa, actor: comoCloser() }));
      expect(e.status, etapa).toBe(422);
    }
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "en_gestion", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("el sistema abre en Agendado con el dueño que le dio Calendly", async () => {
    const dealId = await abrirDeal(db, { leadId, programId, etapa: "agendado", actor: sistema, ownerUserId: closer });
    expect(await historial(dealId)).toMatchObject([{ de: null, a: "agendado", userId: null }]);
    const [d] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(d.ownerUserId).toBe(closer);
  });

  it("el programa es frontera: no se abre un deal sobre un lead de otro programa", async () => {
    const [otro] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "1500" }).returning();
    const e = await rechazo(abrirDeal(db, { leadId, programId: otro.id, etapa: "registrado", actor: sistema }));
    expect(e.status).toBe(422);
    expect(await db.select().from(deals)).toEqual([]);
  });

  it("un deal abierto por lead: el segundo es 409; reaplicar tras un Cierre Perdido abre uno NUEVO", async () => {
    const primero = await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: sistema });
    const e = await rechazo(abrirDeal(db, { leadId, programId, etapa: "registrado", actor: sistema }));
    expect(e.status).toBe(409);
    expect(await historial(primero)).toHaveLength(1);

    await moverEtapa(db, { dealId: primero, a: "cierre_perdido", actor: comoGerente(), motivoId: motivoActivo });
    const segundo = await abrirDeal(db, { leadId, programId, etapa: "registrado", actor: sistema });
    expect(segundo).not.toBe(primero);
    expect(await etapaDe(primero)).toBe("cierre_perdido");
  });

  it("nadie mas crea un deal diciendo su etapa: crearConRastro lo rechaza sin la llave del motor", async () => {
    await expect(
      crearConRastro(
        { db, tabla: deals, nombreTabla: "deals", actorId: closer, etiqueta: "x" },
        { leadId, programId, etapa: "ganado_parcial" },
      ),
    ).rejects.toThrow(/abrirDeal\(\)/);
    expect(await db.select().from(deals)).toEqual([]);
  });
});

import "./142-nuevas-mover-etapa";
