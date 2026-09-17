import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import type { Session } from "next-auth";
import {
  abonos,
  changeLog,
  plataformasPago,
  productos,
  programs,
  sales,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseDePrueba, type BaseDePrueba } from "./helpers/base-de-prueba";
import { saldoDeVenta } from "@/lib/queries/ventas";
import { registrarAbono } from "@/lib/mutations/abonos";

/**
 * Ticket 019 (ADR 0011, 0013): el abono que llega DESPUES de una venta ya cerrada.
 * El primer abono lo escribe `registrarLlamada` (ticket 002); este archivo cubre
 * los siguientes.
 *
 * Igual que `tests/registro-llamada.test.ts`: una sola base PGlite para todo el
 * archivo (aplicar las migraciones reales tarda segundos) y `limpiar()` entre
 * tests. Se afirma leyendo la base despues de llamar a la interfaz publica.
 */

let base: BaseDePrueba;
let db: Db;

/** Vacia en orden de llave foranea: `abonos` antes que `sales` y plataformas. */
async function limpiar(): Promise<void> {
  await db.delete(changeLog);
  await db.delete(abonos);
  await db.delete(sales);
  await db.delete(productos);
  await db.delete(programs);
  await db.delete(plataformasPago);
  await db.delete(users);
}

beforeAll(async () => {
  base = await crearBaseDePrueba();
  db = base.db;
}, 60_000);
afterAll(async () => {
  await base.cerrar();
});
beforeEach(limpiar);

/** Siembra un programa y devuelve su id. */
async function sembrarPrograma(slug = "comunicarte"): Promise<string> {
  const [prog] = await db
    .insert(programs)
    .values({ slug, nombre: slug, ticketUsd: "797" })
    .returning();
  return prog.id;
}

/**
 * Siembra una venta ya cerrada. `precioAplicadoUsd` en null imita las filas viejas
 * de Sheets, que no traen precio del contrato.
 */
async function sembrarVenta(
  programId: string,
  { precio = "797" as string | null, moneda = "USD", closerId = "Dana" } = {},
): Promise<string> {
  const [venta] = await db
    .insert(sales)
    .values({
      programId,
      closerId,
      fecha: "2026-08-31",
      precioAplicadoUsd: precio,
      moneda,
    })
    .returning();
  return venta.id;
}

/** Siembra un abono ya recibido sobre una venta. */
async function sembrarAbono(
  saleId: string,
  programId: string,
  monto: string,
  fecha = "2026-08-31",
): Promise<void> {
  await db.insert(abonos).values({ saleId, programId, fecha, monto, closerId: "Dana" });
}

/** Siembra una plataforma de pago y devuelve su id. */
async function sembrarPlataforma({ activo = true, nombre = "PayPal" } = {}): Promise<string> {
  const [plat] = await db.insert(plataformasPago).values({ nombre, activo }).returning();
  return plat.id;
}

/**
 * Siembra el usuario de la sesion y devuelve su sesion. El usuario existe de verdad
 * en la base porque `change_log.userId` es una llave foranea a `users`.
 */
async function sesionCloser(closerId: string | null, nombre = "Kevin"): Promise<Session> {
  const [usuario] = await db
    .insert(users)
    .values({ email: `${nombre.toLowerCase()}@retiagrowth.com`, nombre, rol: "closer", closerId })
    .returning();
  return {
    user: { id: usuario.id, rol: "closer", closerId },
    expires: "2099-01-01T00:00:00Z",
  } as Session;
}

describe("saldoDeVenta", () => {
  it("devuelve null si la venta no existe", async () => {
    await expect(saldoDeVenta(crypto.randomUUID(), db)).resolves.toBeNull();
  });

  it("una venta sin abonos debe el precio entero", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });

    const saldo = await saldoDeVenta(saleId, db);
    expect(saldo).toMatchObject({
      programId,
      abonado: "0",
      precioContrato: "797.00",
      saldo: "797.00",
      pagadaCompleta: false,
    });
  });

  it("suma todos los abonos de la venta y descuenta el saldo", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "400");
    await sembrarAbono(saleId, programId, "47.50");

    const saldo = await saldoDeVenta(saleId, db);
    expect(saldo).toMatchObject({
      abonado: "447.50",
      saldo: "349.50",
      pagadaCompleta: false,
    });
  });

  it("marca pagada completa cuando los abonos alcanzan el precio del contrato", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "797");

    const saldo = await saldoDeVenta(saleId, db);
    expect(saldo).toMatchObject({ saldo: "0.00", pagadaCompleta: true });
  });

  it("una venta vieja de Sheets sin precio del contrato no tiene saldo que calcular", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: null });
    await sembrarAbono(saleId, programId, "750");

    const saldo = await saldoDeVenta(saleId, db);
    expect(saldo).toMatchObject({
      precioContrato: null,
      abonado: "750.00",
      saldo: null,
      pagadaCompleta: false,
    });
  });
});

describe("registrarAbono", () => {
  it("registra un abono sobre una venta existente y baja el saldo", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "400");
    const plataformaId = await sembrarPlataforma();
    const session = await sesionCloser("Kevin");

    const abono = await registrarAbono(
      session,
      { saleId, fecha: "2026-09-15", monto: "347", plataformaId },
      db,
    );

    expect(abono).toMatchObject({
      saleId,
      // El programa sale de la venta, no del llamador.
      programId,
      fecha: "2026-09-15",
      monto: "347.00",
      moneda: "USD",
      plataformaId,
      origen: "app",
    });
    await expect(saldoDeVenta(saleId, db)).resolves.toMatchObject({
      abonado: "747.00",
      saldo: "50.00",
      pagadaCompleta: false,
    });
  });

  it("un abono que alcanza el precio del contrato deja la venta pagada completa", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "400");
    const session = await sesionCloser("Kevin");

    await registrarAbono(session, { saleId, fecha: "2026-09-15", monto: "397" }, db);

    await expect(saldoDeVenta(saleId, db)).resolves.toMatchObject({
      saldo: "0.00",
      pagadaCompleta: true,
    });
  });

  it("guarda al closer que REGISTRA el abono, que puede no ser el de la venta (ADR 0011)", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797", closerId: "Dana" });
    const session = await sesionCloser("Kevin");

    const abono = await registrarAbono(
      session,
      { saleId, fecha: "2026-09-15", monto: "100" },
      db,
    );

    expect(abono.closerId).toBe("Kevin");
    const [venta] = await db.select().from(sales).where(eq(sales.id, saleId));
    expect(venta.closerId).toBe("Dana");
  });

  it("rechaza un sobrepago sin confirmar y no escribe nada", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "700");
    const session = await sesionCloser("Kevin");

    await expect(
      registrarAbono(session, { saleId, fecha: "2026-09-15", monto: "200" }, db),
    ).rejects.toThrow(/sobrepago|saldo/i);

    // El abono rechazado no dejo rastro: la caja del dia no se movio.
    await expect(saldoDeVenta(saleId, db)).resolves.toMatchObject({ abonado: "700.00" });
  });

  it("registra el sobrepago confirmado y deja la nota en la bitacora", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId, { precio: "797" });
    await sembrarAbono(saleId, programId, "700");
    const session = await sesionCloser("Kevin");

    const abono = await registrarAbono(
      session,
      { saleId, fecha: "2026-09-15", monto: "200", confirmarSobrepago: true },
      db,
    );

    expect(abono.monto).toBe("200.00");
    await expect(saldoDeVenta(saleId, db)).resolves.toMatchObject({
      abonado: "900.00",
      saldo: "-103.00",
      pagadaCompleta: true,
    });

    // La nota del sobrepago queda en `change_log`, con quien lo confirmo.
    const notas = await db
      .select()
      .from(changeLog)
      .where(eq(changeLog.registroId, abono.id));
    expect(notas).toHaveLength(1);
    expect(notas[0]).toMatchObject({
      tabla: "abonos",
      campo: "sobrepago",
      origen: "app",
      userId: session.user.id,
    });
    expect(notas[0].valorNuevo).toMatch(/103/);
  });

  it("rechaza un abono en una moneda distinta a la de la venta, sin convertir", async () => {
    const programId = await sembrarPrograma();
    // Venta vieja en COP: el abono entra en USD y nadie convierte por su cuenta.
    const saleId = await sembrarVenta(programId, { precio: "3000000", moneda: "COP" });
    const session = await sesionCloser("Kevin");

    await expect(
      registrarAbono(session, { saleId, fecha: "2026-09-15", monto: "750" }, db),
    ).rejects.toThrow(/moneda/i);

    await expect(saldoDeVenta(saleId, db)).resolves.toMatchObject({ abonado: "0" });
  });

  it("el esquema no deja escribir un abono en COP", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId);
    const session = await sesionCloser("Kevin");

    await expect(
      registrarAbono(
        session,
        { saleId, fecha: "2026-09-15", monto: "750", moneda: "COP" } as never,
        db,
      ),
    ).rejects.toThrow();
  });

  it("rechaza si la cuenta del closer no tiene closerId cargado", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId);
    const session = await sesionCloser(null, "SinOnboarding");

    await expect(
      registrarAbono(session, { saleId, fecha: "2026-09-15", monto: "100" }, db),
    ).rejects.toThrow(/identificador de closer/i);
  });

  it("rechaza una venta que no existe", async () => {
    const session = await sesionCloser("Kevin");

    await expect(
      registrarAbono(
        session,
        { saleId: crypto.randomUUID(), fecha: "2026-09-15", monto: "100" },
        db,
      ),
    ).rejects.toThrow(/venta/i);
  });

  it("rechaza una plataforma de pago desactivada", async () => {
    const programId = await sembrarPrograma();
    const saleId = await sembrarVenta(programId);
    const plataformaId = await sembrarPlataforma({ activo: false, nombre: "Zelle" });
    const session = await sesionCloser("Kevin");

    await expect(
      registrarAbono(session, { saleId, fecha: "2026-09-15", monto: "100", plataformaId }, db),
    ).rejects.toThrow(/plataforma/i);
  });
});
