import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  abonos,
  areas,
  changeLog,
  cohorts,
  dealEtapaHistorial,
  deals,
  leads,
  plataformasPago,
  programs,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { EtapaDeal } from "@/lib/deals/etapas";
import { anularAbono, registrarAbono } from "@/lib/deals/abonos";
import { ErrorDeApp } from "@/lib/errors";
import { saldosDeDeals } from "@/lib/queries/saldo";
import * as moduloSaldo from "@/lib/queries/saldo";
import { incluyendoAnulados } from "@/lib/queries/vigente";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 060: el dinero entra por el deal y la etapa la mueve el SISTEMA.
 *
 * Cohorte con ticket de 1.000 USD. Cubre: el primer abono lleva a Abonado, el que salda a Completo
 * (por el motor, dejando historial), la reja del sobrepago con la misma cifra que ve el
 * closer, las rejas de quien puede y de en que etapa, y anular: Completo vuelve a Abonado
 * (A2) y, si era el unico abono, a donde estaba antes de pagar (A1).
 */

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let cohortId: string;
let areaId: string;
let leadN = 0;
let closer: string;
let otroCloser: string;
let gerente: string;
let developer: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" })
    .returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({
      programId,
      codigo: "C1",
      metaCupos: 10,
      precioUsd: "1000",
      fechaInicioClases: "2026-10-01",
      fechaInicioVentas: "2026-09-01",
      fechaCierreVentas: "2026-09-30",
      estado: "activo",
    })
    .returning();
  cohortId = c.id;
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  areaId = area.id;
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  const [u2] = await db.insert(users).values({ email: "jero@retiagrowth.com", rol: "closer", closerId: "Jero" }).returning();
  otroCloser = u2.id;
  const [g] = await db.insert(users).values({ email: "gerente@retiagrowth.com", rol: "gerente" }).returning();
  gerente = g.id;
  const [d] = await db.insert(users).values({ email: "dev@retiagrowth.com", rol: "developer" }).returning();
  developer = d.id;
});

afterEach(async () => {
  vi.restoreAllMocks();
  await cerrar();
});

const comoCloser = () => ({ userId: closer, rol: "closer" as const });

async function nuevoDeal(etapa: EtapaDeal, extra: Partial<typeof deals.$inferInsert> = {}) {
  const [l] = await db
    .insert(leads)
    .values({ programId, emailNormalizado: `lead${++leadN}@correo.co`, nombre: `Lead ${leadN}` })
    .returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId, etapa, ownerUserId: closer,valorVendidoUsd: "1000", areaDeclaradaId: areaId, ...extra })
    .returning();
  return d.id;
}

const abono = (dealId: string, monto: string, extra: Record<string, unknown> = {}) => ({
  dealId,
  fecha: "2026-09-28",
  monto,
  comprobanteUrl: "https://drive.google.com/comprobante",
  ...extra,
});

async function etapaDe(dealId: string) {
  const [d] = await db.select({ etapa: deals.etapa }).from(deals).where(and(eq(deals.id, dealId), incluyendoAnulados(deals)));
  return d.etapa;
}

async function abonosDe(dealId: string) {
  return db.select().from(abonos).where(and(eq(abonos.dealId, dealId), incluyendoAnulados(abonos)));
}

async function historial(dealId: string) {
  return db.select().from(dealEtapaHistorial).where(eq(dealEtapaHistorial.dealId, dealId));
}

async function capturar(p: Promise<unknown>): Promise<ErrorDeApp> {
  try {
    await p;
  } catch (e) {
    return e as ErrorDeApp;
  }
  throw new Error("se esperaba un error");
}

describe("registrarAbono: el dinero mueve el deal", () => {
  it("el primer abono sin área se deshace; con el área la escribe y pasa a Abonado", async () => {
    const dealId = await nuevoDeal("atendido", { areaDeclaradaId: null });
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "300")));
    expect(e.status).toBe(422);
    expect(await abonosDe(dealId)).toEqual([]);

    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300", { areaDeclaradaId: areaId }));
    expect(r.etapa).toBe("ganado_parcial");
    const [deal] = await db.select().from(deals).where(eq(deals.id, dealId));
    expect(deal).toMatchObject({ etapa: "ganado_parcial", areaDeclaradaId: areaId });
  });

  it("el primer abono con saldo lleva a Abonado, por el sistema, con su historial y su rastro", async () => {
    const dealId = await nuevoDeal("atendido");

    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));

    expect(r).toMatchObject({ etapa: "ganado_parcial", movioElDeal: true, saldo: 700 });
    expect(await etapaDe(dealId)).toBe("ganado_parcial");
    const [fila] = await abonosDe(dealId);
    // El programa sale del deal y el closer de la cuenta, no del input.
    expect(fila).toMatchObject({ programId, moneda: "USD", closerId: "Maru", origen: "app" });
    const h = await historial(dealId);
    expect(h.map((x) => [x.de, x.a, x.userId])).toEqual([["atendido", "ganado_parcial", null]]);
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.tabla, "abonos"), eq(changeLog.registroId, r.abonoId)));
    expect(rastro.length).toBeGreaterThan(0);
  });

  it("el abono que salda el deal lo lleva a Completo, aunque venga directo de Atendido", async () => {
    const dealId = await nuevoDeal("atendido");
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "1000"));
    expect(r).toMatchObject({ etapa: "ganado_completo", saldo: 0 });
    expect(await etapaDe(dealId)).toBe("ganado_completo");
  });

  it("un segundo abono en Abonado no mueve nada; el que deja saldo cero lo lleva a Completo", async () => {
    const dealId = await nuevoDeal("compromiso_verbal");
    await registrarAbono(db, comoCloser(), abono(dealId, "400"));

    const segundo = await registrarAbono(db, comoCloser(), abono(dealId, "100"));
    expect(segundo).toMatchObject({ etapa: "ganado_parcial", movioElDeal: false, saldo: 500 });

    const ultimo = await registrarAbono(db, comoCloser(), abono(dealId, "500"));
    expect(ultimo).toMatchObject({ etapa: "ganado_completo", movioElDeal: true, saldo: 0 });
    expect((await historial(dealId)).map((x) => x.a)).toEqual(["ganado_parcial", "ganado_completo"]);
  });

  it("los centavos cuentan: 999.99 deja saldo y el ultimo centavo lo cierra", async () => {
    const dealId = await nuevoDeal("atendido");
    expect(await registrarAbono(db, comoCloser(), abono(dealId, "999.99"))).toMatchObject({ etapa: "ganado_parcial", saldo: 0.01 });
    expect(await registrarAbono(db, comoCloser(), abono(dealId, "0.01"))).toMatchObject({ etapa: "ganado_completo", saldo: 0 });
  });
});

describe("registrarAbono: las rejas", () => {
  it("un abono sobre un deal ya Completo se rechaza como cerrado y no se escribe", async () => {
    const dealId = await nuevoDeal("atendido");
    await registrarAbono(db, comoCloser(), abono(dealId, "400"));
    await registrarAbono(db, comoCloser(), abono(dealId, "600"));
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "600")));
    expect(e.status).toBe(409);
    expect(e.message).toContain("El deal está cerrado");
    expect(await abonosDe(dealId)).toHaveLength(2);
    expect((await saldosDeDeals(db, [dealId])).get(dealId)?.saldo).toBe(0);
  });

  it("un saldo no calculable despues del insert deshace el abono con un error claro", async () => {
    const dealId = await nuevoDeal("ganado_parcial");
    const antes = await saldosDeDeals(db, [dealId]);
    vi.spyOn(moduloSaldo, "saldosDeDeals")
      .mockResolvedValueOnce(antes)
      .mockResolvedValueOnce(new Map([[dealId, { ...antes.get(dealId)!, saldo: null, sinSaldoPorque: "moneda_distinta" }]]));
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "400")));
    expect(e).toMatchObject({ status: 409, message: "No se puede calcular el saldo del deal después del abono: se deshace el registro." });
    expect(await abonosDe(dealId)).toHaveLength(0);
    expect(await etapaDe(dealId)).toBe("ganado_parcial");
  });

  it("el ultimo abono sin comprobante no cierra el deal ni queda escrito", async () => {
    const dealId = await nuevoDeal("atendido");
    await registrarAbono(db, comoCloser(), abono(dealId, "400"));
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "600", { comprobanteUrl: undefined })));
    expect(e.message).toContain("comprobante");
    expect(await etapaDe(dealId)).toBe("ganado_parcial");
    const filas = await abonosDe(dealId);
    expect(filas).toHaveLength(1);
    expect(filas[0].anuladoEn).toBeNull();
    expect((await saldosDeDeals(db, [dealId])).get(dealId)?.saldo).toBe(600);
  });

  it("un sobrepago se rechaza y no escribe nada", async () => {
    const dealId = await nuevoDeal("atendido");
    await registrarAbono(db, comoCloser(), abono(dealId, "600"));

    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "400.01")));

    expect(e.status).toBe(422);
    // A-24: con el formato del contrato (`usd` de lib/format.ts), coma decimal.
    expect(e.message).toContain("(USD 400,00)");
    expect(e.message).toContain("(USD 400,01)");
    expect(await abonosDe(dealId)).toHaveLength(1);
    expect(await etapaDe(dealId)).toBe("ganado_parcial");
  });

  it("sin valor vendido congela el ticket de la cohorte antes de recibir el abono", async () => {
    const dealId = await nuevoDeal("atendido", { valorVendidoUsd: null });
    await registrarAbono(db, comoCloser(), abono(dealId, "100"));
    expect(await abonosDe(dealId)).toHaveLength(1);
    expect((await db.select().from(deals).where(eq(deals.id, dealId)))[0].valorVendidoUsd).toBe("1000.00");
    expect(await etapaDe(dealId)).toBe("ganado_parcial");
  });

  it("solo USD: otra moneda es un 400 y no toca la base", async () => {
    const dealId = await nuevoDeal("atendido");
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "400000", { moneda: "COP" })));
    expect(e.status).toBe(400);
    expect(await abonosDe(dealId)).toHaveLength(0);
  });

  it("el abono que movería el deal sin comprobante se rechaza entero: ni abono ni movimiento", async () => {
    const dealId = await nuevoDeal("atendido");
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "300", { comprobanteUrl: undefined })));
    expect(e.message).toContain("comprobante");
    expect(await abonosDe(dealId)).toHaveLength(0);
    expect(await etapaDe(dealId)).toBe("atendido");
    expect(await historial(dealId)).toHaveLength(0);
  });

  it.each([
    { nombre: "Registrado", etapa: "registrado" as const, pendiente: null },
    { nombre: "Agendado", etapa: "agendado" as const, pendiente: null },
    { nombre: "Agendado + Re-agenda", etapa: "agendado" as const, pendiente: "reagenda" as const },
  ])(
    "desde $nombre no hay flecha a pagar: se rechaza y el abono se deshace",
    async ({ etapa, pendiente }) => {
      const dealId = await nuevoDeal(etapa, { pendiente });
      const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "300")));
      expect(e.status).toBe(409);
      expect(await abonosDe(dealId)).toHaveLength(0);
      expect(await etapaDe(dealId)).toBe(etapa);
    },
  );

  it("un deal cerrado o anulado no recibe abonos", async () => {
    for (const etapa of ["ganado_completo", "cierre_perdido"] as const) {
      const id = await nuevoDeal(etapa);
      expect((await capturar(registrarAbono(db, comoCloser(), abono(id, "10")))).status).toBe(409);
    }
    const anulado = await nuevoDeal("atendido", { anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    expect((await capturar(registrarAbono(db, comoCloser(), abono(anulado, "10")))).status).toBe(409);
  });

  it("solo el dueño registra; el gerente no; el developer si", async () => {
    const dealId = await nuevoDeal("atendido");
    expect((await capturar(registrarAbono(db, { userId: otroCloser, rol: "closer" }, abono(dealId, "10")))).status).toBe(403);
    expect((await capturar(registrarAbono(db, { userId: gerente, rol: "gerente" }, abono(dealId, "10")))).status).toBe(403);
    const sinDueno = await nuevoDeal("atendido", { ownerUserId: null });
    expect((await capturar(registrarAbono(db, comoCloser(), abono(sinDueno, "10")))).status).toBe(409);
    await registrarAbono(db, { userId: developer, rol: "developer" }, abono(dealId, "10"));
    expect(await abonosDe(dealId)).toHaveLength(1);
  });

  it("una plataforma inactiva se rechaza antes de escribir", async () => {
    const [pl] = await db.insert(plataformasPago).values({ nombre: "Vieja", activo: false }).returning();
    const dealId = await nuevoDeal("atendido");
    const e = await capturar(registrarAbono(db, comoCloser(), abono(dealId, "10", { plataformaId: pl.id })));
    expect(e.status).toBe(400);
    expect(await abonosDe(dealId)).toHaveLength(0);
  });

  it("dos abonos simultaneos que saldan el deal: solo uno entra", async () => {
    const dealId = await nuevoDeal("atendido");
    const resultados = await Promise.allSettled([
      registrarAbono(db, comoCloser(), abono(dealId, "1000")),
      registrarAbono(db, comoCloser(), abono(dealId, "1000")),
    ]);
    expect(resultados.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    expect(await abonosDe(dealId)).toHaveLength(1);
  });
});

describe("anularAbono: la etapa se recalcula", () => {
  it("relee el abono despues del bloqueo y conserva la primera anulacion ante una lectura obsoleta", async () => {
    const dealId = await nuevoDeal("atendido");
    const a = await registrarAbono(db, comoCloser(), abono(dealId, "400"));
    const [obsoleto] = await abonosDe(dealId);
    await anularAbono(db, comoCloser(), { abonoId: a.abonoId, motivo: "Primera anulacion" });
    const [primera] = await abonosDe(dealId);
    const orden: string[] = [];

    // PGlite serializa transacciones: solo la primera lectura se sustituye por la fila
    // anterior. El bloqueo y las lecturas posteriores usan la base real del test.
    const conLecturaObsoleta = {
      transaction: (fn: (tx: Db) => Promise<unknown>) => db.transaction(async (tx) => {
        const select = tx.select.bind(tx);
        vi.spyOn(tx, "select").mockImplementation((...args) => {
          const consulta = select(...args);
          const from = consulta.from.bind(consulta);
          consulta.from = ((tabla: Parameters<typeof from>[0]) => {
            const q = from(tabla);
            if (tabla === abonos && orden.length === 0) {
              const where = q.where.bind(q);
              q.where = ((...condiciones: Parameters<typeof where>) => {
                const resultado = where(...condiciones);
                orden.push("lectura obsoleta");
                vi.spyOn(resultado, "execute").mockResolvedValue([obsoleto]);
                return resultado;
              }) as typeof q.where;
            } else if (tabla === abonos) {
              orden.push("lectura fresca");
            }
            if (tabla === deals) {
              const bloquear = q.for.bind(q);
              q.for = ((...opciones: Parameters<typeof bloquear>) => {
                orden.push("bloqueo");
                return bloquear(...opciones);
              }) as typeof q.for;
            }
            return q;
          }) as typeof consulta.from;
          return consulta;
        });
        return fn(tx as unknown as Db);
      }),
    } as unknown as Db;

    const e = await capturar(anularAbono(conLecturaObsoleta, { userId: gerente, rol: "gerente" }, { abonoId: a.abonoId, motivo: "Segunda anulacion" }));
    expect(e).toMatchObject({ status: 409, message: "El abono ya está anulado." });
    expect(orden.slice(0, 3)).toEqual(["lectura obsoleta", "bloqueo", "lectura fresca"]);
    expect((await abonosDe(dealId))[0]).toMatchObject({
      anuladoPor: closer, motivoAnulacion: "Primera anulacion", anuladoEn: primera.anuladoEn,
    });
  });

  it("anular el abono que cerró el deal lo saca de Completo, con su historial", async () => {
    const dealId = await nuevoDeal("compromiso_verbal");
    await registrarAbono(db, comoCloser(), abono(dealId, "400"));
    const cierre = await registrarAbono(db, comoCloser(), abono(dealId, "600"));
    expect(await etapaDe(dealId)).toBe("ganado_completo");

    const r = await anularAbono(db, comoCloser(), { abonoId: cierre.abonoId, motivo: "Monto mal tecleado" });

    expect(r).toMatchObject({ etapa: "ganado_parcial", movioElDeal: true });
    expect((await historial(dealId)).map((x) => [x.de, x.a])).toEqual([
      ["compromiso_verbal", "ganado_parcial"],
      ["ganado_parcial", "ganado_completo"],
      ["ganado_completo", "ganado_parcial"],
    ]);
    const saldo = (await saldosDeDeals(db, [dealId])).get(dealId)!;
    expect(saldo).toMatchObject({ abonado: 400, saldo: 600 });
    const [anulado] = await db.select().from(abonos).where(eq(abonos.id, cierre.abonoId));
    expect(anulado).toMatchObject({ anuladoPor: closer, motivoAnulacion: "Monto mal tecleado" });
    expect(anulado.anuladoEn).not.toBeNull();
  });

  it("si el deal estaba en Completo por UN solo abono, vuelve a la etapa de donde venía", async () => {
    const dealId = await nuevoDeal("contactado");
    const unico = await registrarAbono(db, comoCloser(), abono(dealId, "1000"));
    expect(await etapaDe(dealId)).toBe("ganado_completo");

    const r = await anularAbono(db, comoCloser(), { abonoId: unico.abonoId, motivo: "Era otro cliente" });

    expect(r).toMatchObject({ etapa: "contactado", movioElDeal: true });
    expect(await etapaDe(dealId)).toBe("contactado");
  });

  it("anular el único abono de un Abonado lo devuelve a Atendido, no a otra etapa", async () => {
    const dealId = await nuevoDeal("atendido");
    const primero = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    const r = await anularAbono(db, comoCloser(), { abonoId: primero.abonoId, motivo: "Duplicado" });
    expect(r.etapa).toBe("atendido");
    // Y puede volver a pagar: el deal quedó en una etapa desde donde hay flecha a pagar.
    expect((await registrarAbono(db, comoCloser(), abono(dealId, "300"))).etapa).toBe("ganado_parcial");
  });

  it("sin historial de pago (deal migrado) vuelve a Compromiso Verbal", async () => {
    const dealId = await nuevoDeal("ganado_parcial");
    const [a] = await db
      .insert(abonos)
      .values({ dealId, programId, fecha: "2026-09-01", monto: "300", closerId: "Maru" })
      .returning();
    const r = await anularAbono(db, comoCloser(), { abonoId: a.id, motivo: "No entró la plata" });
    expect(r.etapa).toBe("compromiso_verbal");
  });

  it("anular un abono que no era el último no mueve el deal", async () => {
    const dealId = await nuevoDeal("atendido");
    const a1 = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    await registrarAbono(db, comoCloser(), abono(dealId, "200"));
    const r = await anularAbono(db, comoCloser(), { abonoId: a1.abonoId, motivo: "Error de tecleo" });
    expect(r).toMatchObject({ etapa: "ganado_parcial", movioElDeal: false });
    expect((await saldosDeDeals(db, [dealId])).get(dealId)).toMatchObject({ abonado: 200, saldo: 800 });
  });

  it("el motivo es obligatorio y un abono anulado no se anula dos veces", async () => {
    const dealId = await nuevoDeal("atendido");
    const a = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    expect((await capturar(anularAbono(db, comoCloser(), { abonoId: a.abonoId, motivo: "  " }))).status).toBe(400);
    await anularAbono(db, comoCloser(), { abonoId: a.abonoId, motivo: "Error" });
    expect((await capturar(anularAbono(db, comoCloser(), { abonoId: a.abonoId, motivo: "Otra vez" }))).status).toBe(409);
  });

  it("un closer solo anula lo que registró él, y mientras la cohorte esté activa; el administrador siempre", async () => {
    const dealId = await nuevoDeal("atendido");
    const a = await registrarAbono(db, comoCloser(), abono(dealId, "300"));

    expect((await capturar(anularAbono(db, { userId: otroCloser, rol: "closer" }, { abonoId: a.abonoId, motivo: "x" }))).status).toBe(403);

    await db.update(cohorts).set({ estado: "cerrado" }).where(eq(cohorts.id, cohortId));
    expect((await capturar(anularAbono(db, comoCloser(), { abonoId: a.abonoId, motivo: "x" }))).status).toBe(403);

    const r = await anularAbono(db, { userId: gerente, rol: "gerente" }, { abonoId: a.abonoId, motivo: "Corrección del gerente" });
    expect(r.etapa).toBe("atendido");
  });

  it("anular el abono de un Completo cuando el lead ya tiene otro deal abierto se bloquea con un 409 claro (D3)", async () => {
    const dealId = await nuevoDeal("atendido");
    const cierre = await registrarAbono(db, comoCloser(), abono(dealId, "1000"));
    expect(await etapaDe(dealId)).toBe("ganado_completo");
    // El lead vuelve a aplicar y abre un segundo deal: el cupo estaba libre porque el primero es Completo.
    const [d] = await db.select({ leadId: deals.leadId }).from(deals).where(eq(deals.id, dealId));
    await db.insert(deals).values({ leadId: d.leadId, programId, cohortId, etapa: "contactado", ownerUserId: closer });

    const e = await capturar(anularAbono(db, comoCloser(), { abonoId: cierre.abonoId, motivo: "Error" }));

    expect(e.status).toBe(409);
    expect(e.message).toContain("otro deal abierto");
    // No se escribio nada: el abono sigue vigente y el deal sigue Completo.
    const [fila] = await db.select().from(abonos).where(eq(abonos.id, cierre.abonoId));
    expect(fila.anuladoEn).toBeNull();
    expect(await etapaDe(dealId)).toBe("ganado_completo");
  });

  it("y si el otro deal ya se cerró o se anuló, la anulación sí procede", async () => {
    const dealId = await nuevoDeal("atendido");
    const cierre = await registrarAbono(db, comoCloser(), abono(dealId, "1000"));
    const [d] = await db.select({ leadId: deals.leadId }).from(deals).where(eq(deals.id, dealId));
    await db.insert(deals).values({ leadId: d.leadId, programId, cohortId, etapa: "cierre_perdido", ownerUserId: closer });
    await db.insert(deals).values({ leadId: d.leadId, programId, cohortId, etapa: "contactado", ownerUserId: closer, anuladoEn: new Date(), anuladoPor: gerente, motivoAnulacion: "error" });
    const r = await anularAbono(db, comoCloser(), { abonoId: cierre.abonoId, motivo: "Error" });
    expect(r.etapa).toBe("atendido");
  });

  it("anular en un deal perdido escribe la anulación y no mueve la etapa", async () => {
    const dealId = await nuevoDeal("cierre_perdido");
    const [a] = await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-01", monto: "100", closerId: "Maru" }).returning();
    const r = await anularAbono(db, { userId: gerente, rol: "gerente" }, { abonoId: a.id, motivo: "Devuelto" });
    expect(r).toMatchObject({ etapa: "cierre_perdido", movioElDeal: false });
  });
});

describe("registrarAbono: la cohorte se asigna sola la primera vez que el deal recibe plata (063)", () => {
  it("un deal sin cohorte queda en la activa del programa, con su rastro", async () => {
    const dealId = await nuevoDeal("atendido", { cohortId: null, valorVendidoUsd: null });
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    expect(r.cohorteAsignada).toBe(cohortId);
    const [d] = await db.select({ cohortId: deals.cohortId }).from(deals).where(eq(deals.id, dealId));
    expect(d.cohortId).toBe(cohortId);
    const rastro = await db.select().from(changeLog).where(and(eq(changeLog.registroId, dealId), eq(changeLog.campo, "cohortId")));
    expect(rastro).toHaveLength(1);
  });

  it("un deal que ya tiene cohorte no se toca", async () => {
    const [otra] = await db
      .insert(cohorts)
      .values({ programId, codigo: "C2", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-12-01", fechaCierreVentas: "2026-11-25", estado: "futuro" })
      .returning();
    const dealId = await nuevoDeal("atendido", { cohortId: otra.id });
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    expect(r.cohorteAsignada).toBeNull();
    const [d] = await db.select({ cohortId: deals.cohortId }).from(deals).where(eq(deals.id, dealId));
    expect(d.cohortId).toBe(otra.id);
  });

  it("sin cohorte activa el cobro entra igual y el deal sigue sin cohorte (no se bloquea plata real)", async () => {
    await db.update(cohorts).set({ estado: "cerrado" }).where(eq(cohorts.id, cohortId));
    const dealId = await nuevoDeal("atendido", { cohortId: null });
    const r = await registrarAbono(db, comoCloser(), abono(dealId, "300"));
    expect(r).toMatchObject({ etapa: "ganado_parcial", cohorteAsignada: null });
    const [d] = await db.select({ cohortId: deals.cohortId }).from(deals).where(eq(deals.id, dealId));
    expect(d.cohortId).toBeNull();
  });
});

import "./142-nuevas-abonos-del-deal";
