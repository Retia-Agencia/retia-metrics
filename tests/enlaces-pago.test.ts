import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { changeLog, enlacesPago, plataformasPago, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ErrorDeApp } from "@/lib/errors";
import {
  crearEnlacePago,
  desactivarEnlacePago,
  esquemaEnlacePago,
  reactivarEnlacePago,
  reemplazarEnlacePago,
} from "@/lib/catalogo/enlaces-pago";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

/**
 * Ticket 022 — enlaces de pago como links (ADR 0017, ADR 0012).
 *
 * Un enlace de pago tiene monto + moneda (nunca se convierte en silencio), url
 * https://, y las mismas dos marcas que un recurso: `vigente` (version de hoy con
 * historial) y `activo` (borrado suave del molde). La operacion `reemplazar` crea
 * la fila nueva vigente y baja la anterior sin borrarla.
 */

let db: Db;
let cerrar: () => Promise<void>;
let gerenteId: string;
let programaA: string;
let plataformaPaypal: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());

  gerenteId = crypto.randomUUID();

  const [u] = await db
    .insert(users)
    .values({ email: "gerente@retiagrowth.com", rol: "gerente", nombre: "Gerencia" })
    .returning();
  gerenteId = u.id;

  const [a] = await db
    .insert(programs)
    .values({ slug: "programa-a", nombre: "Programa A", ticketUsd: "797.00" })
    .returning();
  programaA = a.id;

  const [p] = await db.insert(plataformasPago).values({ nombre: "PayPal Test 022" }).returning();
  plataformaPaypal = p.id;
});

afterEach(async () => {
  await cerrar();
});

async function logDe(registroId: string) {
  return db.select().from(changeLog).where(eq(changeLog.registroId, registroId));
}

const enlaceValido = (over: Partial<Record<string, unknown>> = {}) => ({
  programId: programaA,
  plataformaId: plataformaPaypal,
  monto: "797.00",
  moneda: "USD" as const,
  url: "https://paypal.com/checkout/797",
  ...over,
});

// ─────────────────────────────────────────────────────────── esquema

describe("esquema de enlace de pago", () => {
  it("acepta un enlace valido con https y monto de dos decimales", () => {
    const datos = esquemaEnlacePago.parse(enlaceValido());
    expect(datos.monto).toBe("797.00");
    expect(datos.moneda).toBe("USD");
  });

  it("productoId es opcional (nulo permitido)", () => {
    const datos = esquemaEnlacePago.parse(enlaceValido({ productoId: undefined }));
    expect(datos.productoId).toBeUndefined();
  });

  it("rechaza una URL http://", () => {
    expect(esquemaEnlacePago.safeParse(enlaceValido({ url: "http://paypal.com/x" })).success).toBe(
      false,
    );
  });

  it("rechaza un monto con mas de dos decimales", () => {
    expect(esquemaEnlacePago.safeParse(enlaceValido({ monto: "10.999" })).success).toBe(false);
  });

  it("rechaza un monto de cero o negativo", () => {
    expect(esquemaEnlacePago.safeParse(enlaceValido({ monto: "0" })).success).toBe(false);
    expect(esquemaEnlacePago.safeParse(enlaceValido({ monto: "-5" })).success).toBe(false);
  });
});

// ─────────────────────────────────────────────────────────── crear

describe("crear enlace de pago", () => {
  it("crea un enlace vigente y lo deja en change_log", async () => {
    const creado = await crearEnlacePago(db, gerenteId, enlaceValido());
    expect(creado.vigente).toBe(true);
    expect(creado.activo).toBe(true);
    expect(String(creado.monto)).toBe("797.00");

    const log = await logDe(creado.id);
    expect(log.length).toBeGreaterThan(0);
    expect(log.every((l) => l.origen === "app")).toBe(true);
    expect(log[0].tabla).toBe("enlaces_pago");
  });

  it("una URL http:// al crear es un 400", async () => {
    const error = await crearEnlacePago(db, gerenteId, enlaceValido({ url: "http://x.com/y" })).catch(
      (e) => e,
    );
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });
});

// ─────────────────────────────────────────────────────────── reemplazar

describe("reemplazar enlace de pago", () => {
  it("reemplazar deja UNA sola version vigente y encadena el historial", async () => {
    const v1 = await crearEnlacePago(db, gerenteId, enlaceValido());
    const v2 = await reemplazarEnlacePago(db, gerenteId, v1.id, "https://paypal.com/checkout/v2");
    const v3 = await reemplazarEnlacePago(db, gerenteId, v2.id, "https://paypal.com/checkout/v3");

    const vigentes = await db
      .select()
      .from(enlacesPago)
      .where(and(eq(enlacesPago.programId, programaA), eq(enlacesPago.vigente, true)));
    expect(vigentes.length).toBe(1);
    expect(vigentes[0].id).toBe(v3.id);

    expect(v3.reemplazaA).toBe(v2.id);
    expect(v2.reemplazaA).toBe(v1.id);

    const todas = await db
      .select()
      .from(enlacesPago)
      .where(eq(enlacesPago.programId, programaA));
    expect(todas.length).toBe(3);
    expect(todas.find((r) => r.id === v1.id)!.vigente).toBe(false);
  });

  it("una URL http:// al reemplazar es un 400", async () => {
    const v1 = await crearEnlacePago(db, gerenteId, enlaceValido());
    const error = await reemplazarEnlacePago(db, gerenteId, v1.id, "http://x.com/y").catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(400);
  });

  it("reemplazar un id inexistente es un 404", async () => {
    const error = await reemplazarEnlacePago(
      db,
      gerenteId,
      crypto.randomUUID(),
      "https://x.com/y",
    ).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(404);
  });
});

// ─────────────────────────────────────────────────────────── desactivar / reactivar

describe("desactivar y reactivar enlace de pago (nunca DELETE)", () => {
  it("desactivar no borra la fila y queda en change_log", async () => {
    const creado = await crearEnlacePago(db, gerenteId, enlaceValido());
    await desactivarEnlacePago(db, gerenteId, creado.id);

    const [fila] = await db.select().from(enlacesPago).where(eq(enlacesPago.id, creado.id));
    expect(fila).toBeDefined();
    expect(fila.activo).toBe(false);

    const log = await logDe(creado.id);
    expect(log.some((l) => l.campo === "activo" && l.valorNuevo === "false")).toBe(true);
  });

  it("reactivar vuelve a dejar el enlace activo", async () => {
    const creado = await crearEnlacePago(db, gerenteId, enlaceValido());
    await desactivarEnlacePago(db, gerenteId, creado.id);
    const react = await reactivarEnlacePago(db, gerenteId, creado.id);
    expect(react.activo).toBe(true);
  });
});
