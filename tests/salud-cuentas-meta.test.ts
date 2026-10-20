import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { cuentasPublicitarias, programs } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { diagnosticoDeCuenta, saludDeCuentasMeta } from "@/lib/pauta/salud-cuentas";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
});

afterAll(async () => cerrar());

const estado = (accountStatus: number, disableReason = 0, amountSpent = 0, spendCap = 0) => ({
  accountStatus,
  disableReason,
  amountSpent,
  spendCap,
});

describe("diagnostico de una cuenta de Meta", () => {
  it("reconoce una cuenta sana", () => {
    expect(diagnosticoDeCuenta(estado(1))).toEqual({ estado: "al_dia", detalle: null });
  });

  it("explica pago pendiente con razon", () => {
    expect(diagnosticoDeCuenta(estado(3, 12))).toEqual({
      estado: "problema",
      detalle: "pago pendiente (razón 12)",
    });
  });

  it("explica una cuenta cerrada", () => {
    expect(diagnosticoDeCuenta(estado(101))).toEqual({ estado: "problema", detalle: "cerrada" });
  });

  it("conserva un codigo desconocido", () => {
    expect(diagnosticoDeCuenta(estado(44))).toEqual({
      estado: "problema",
      detalle: "estado 44 de Meta",
    });
  });

  it("detecta el tope de gasto alcanzado", () => {
    expect(diagnosticoDeCuenta(estado(1, 0, 500, 500))).toEqual({
      estado: "problema",
      detalle: "llegó al tope de gasto",
    });
  });
});

describe("salud de cuentas de Meta", () => {
  it("lee solo cuentas activas de los programas pedidos, agrupa y conserva fallos", async () => {
    const [pedido, otro] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "pedido", nombre: "Pedido", ticketUsd: "1000.00" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000.00" },
    ]).returning();
    await db.insert(cuentasPublicitarias).values([
      { idMeta: "sana", programId: pedido.id, nombre: "Sana", moneda: "COP", zonaHoraria: "America/Bogota" },
      { idMeta: "falla", programId: pedido.id, nombre: "Falla", moneda: "COP", zonaHoraria: "America/Bogota" },
      { idMeta: "inactiva", programId: pedido.id, nombre: "Inactiva", moneda: "COP", zonaHoraria: "America/Bogota", activo: false },
      { idMeta: "ajena", programId: otro.id, nombre: "Ajena", moneda: "COP", zonaHoraria: "America/Bogota" },
    ]);
    const f = vi.fn(async (entrada: string | URL | Request) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      if (url.pathname.endsWith("act_falla")) throw new Error("sin red");
      return Response.json({ account_status: 1, disable_reason: 0, amount_spent: "120", spend_cap: "0" });
    }) as typeof globalThis.fetch;

    const resultado = await saludDeCuentasMeta(db, {
      tokens: new Map([[pedido.id, "secreto"]]), programIds: [pedido.id], f,
    });

    expect(resultado.get(pedido.id)).toEqual(expect.arrayContaining([
      { nombre: "Sana", estado: "al_dia", detalle: null },
      { nombre: "Falla", estado: "problema", detalle: "no se pudo leer en Meta" },
    ]));
    expect(f).toHaveBeenCalledTimes(2);
    expect(vi.mocked(f).mock.calls.map(([entrada]) => String(entrada))).toEqual(expect.arrayContaining([
      expect.stringContaining("/act_sana?fields="),
      expect.stringContaining("/act_falla?fields="),
    ]));
  });
});
