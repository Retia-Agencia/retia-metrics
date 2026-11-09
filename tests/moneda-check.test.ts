import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { abonos, cohorts, cuentasPublicitarias, deals, gastoPauta, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { convertirGasto } from "@/lib/pauta/convertir-gasto";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 395, ADR 0124: la moneda es un conjunto cerrado EN LA BASE (migracion 0126) y una suma que
 * mezcla monedas no se calcula. Un "usd" o un "EUR" tecleado antes sumaba como otra moneda, sin error.
 */

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let dealId: string;
let ownerId: string;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "mon", nombre: "Mon", ticketUsd: "1000" }).returning();
  programId = p.id;
  const [c] = await db
    .insert(cohorts)
    .values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-10-01", fechaCierreVentas: "2026-09-30" })
    .returning();
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  ownerId = u.id;
  const [l] = await db.insert(leads).values({ fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, programId, emailNormalizado: "ana@correo.co" }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId, cohortId: c.id, etapa: "atendido", ownerUserId: ownerId, valorVendidoUsd: "797" })
    .returning();
  dealId = d.id;
});

afterAll(async () => cerrar());

describe("el CHECK de moneda rechaza lo que no es una moneda del sistema", () => {
  const abonoBase = () => ({ dealId, programId, fecha: "2026-09-28", monto: "100" });

  it("abonos: 'usd' en minuscula y 'EUR' se rechazan; COP y USD pasan", async () => {
    await expect(db.insert(abonos).values({ ...abonoBase(), moneda: "usd" })).rejects.toBeDefined();
    await expect(db.insert(abonos).values({ ...abonoBase(), moneda: "EUR" })).rejects.toBeDefined();
    await expect(db.insert(abonos).values({ ...abonoBase(), moneda: "USD" })).resolves.toBeDefined();
    await expect(db.insert(abonos).values({ ...abonoBase(), moneda: "COP" })).resolves.toBeDefined();
  });

  it("cuentas publicitarias y gasto de pauta: solo COP o USD", async () => {
    const cuenta = { idMeta: "c1", programId, nombre: "Cuenta", zonaHoraria: "America/Bogota" };
    await expect(db.insert(cuentasPublicitarias).values({ ...cuenta, moneda: "MXN" })).rejects.toBeDefined();
    await db.insert(cuentasPublicitarias).values({ ...cuenta, moneda: "COP" });

    const gasto = { programId, fecha: "2026-10-14", monto: "1", origen: "manual" as const, area: "paid" as const };
    await expect(db.insert(gastoPauta).values({ ...gasto, moneda: "cop" })).rejects.toBeDefined();
    await expect(db.insert(gastoPauta).values({ ...gasto, moneda: "COP" })).resolves.toBeDefined();
    await expect(db.insert(gastoPauta).values({ ...gasto, moneda: "USD" })).resolves.toBeDefined();
  });
});

describe("una suma que mezcla monedas no se calcula en silencio", () => {
  it("el saldo de un deal con un abono en COP es null con su razon, no una resta de pesos contra dolares", async () => {
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-28", monto: "400", moneda: "USD" });
    await db.insert(abonos).values({ dealId, programId, fecha: "2026-09-29", monto: "1500000", moneda: "COP" });

    const saldo = (await saldosDeDeals(db, [dealId])).get(dealId)!;
    expect(saldo.saldo).toBeNull();
    expect(saldo.sinSaldoPorque).toBe("moneda_distinta");
  });

  it("Comunicarte: gasto en COP y en USD el mismo dia suma convertido con la TRM, y sin TRM no suma y lo dice", () => {
    const filas = [
      { dia: "2026-10-24", monto: "400000", moneda: "COP" },
      { dia: "2026-10-24", monto: "100", moneda: "USD" },
    ];
    const conTrm = convertirGasto(filas, new Map([["2026-10-24", 4000]]), "COP");
    expect(conTrm.total).toBe(800000);
    expect(conTrm.filasSinTrm).toBe(0);

    const sinTrm = convertirGasto(filas, new Map(), "COP");
    expect(sinTrm.total).toBe(400000);
    expect(sinTrm.filasSinTrm).toBe(1);
    expect(sinTrm.diasSinTrm).toEqual(["2026-10-24"]);
  });

  it("una moneda que no es COP ni USD es error, nunca 0", () => {
    expect(() => convertirGasto([{ dia: "2026-10-24", monto: "5", moneda: "EUR" }], new Map(), "USD")).toThrow();
  });
});
