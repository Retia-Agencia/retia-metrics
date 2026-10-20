import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { changeLog, cuentasPublicitarias, integraciones, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { estadoDeIntegraciones, guardarIntegracion, probarIntegracionGuardada } from "@/lib/integraciones";
import { sincronizarPauta } from "@/lib/pauta/sincronizar";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

let db: Db;
let vaciar: () => Promise<void>;
let cerrar: () => Promise<void>;
let actorId: string;
let programId: string;

beforeAll(async () => {
  ({ db, vaciar, cerrar } = await crearBaseReutilizable());
});
beforeEach(async () => {
  await vaciar();
  const [actor] = await db.insert(users).values({ email: "integraciones@retia.test", rol: "gerente" }).returning();
  actorId = actor.id;
  const [programa] = await db.insert(programs).values({
    ...PROGRAMA_DE_PRUEBA, slug: "integraciones", nombre: "Integraciones", ticketUsd: "1000",
  }).returning();
  programId = programa.id;
});
afterAll(async () => cerrar());

function fetchTypeform(alias = "retia") {
  return vi.fn(async () => Response.json({ alias })) as typeof globalThis.fetch;
}

describe("integraciones por programa", () => {
  it("prueba antes de guardar, conserva config segura y oculta el valor en change_log", async () => {
    const secreto = "token-que-no-debe-aparecer";
    await guardarIntegracion(db, actorId, programId, "typeform", secreto, fetchTypeform("equipo-retia"));
    const [fila] = await db.select().from(integraciones);
    expect(fila).toMatchObject({ tipo: "typeform", config: { alias: "equipo-retia" } });
    expect(fila.probadaEn).toBeInstanceOf(Date);
    const rastro = await db.select().from(changeLog);
    expect(JSON.stringify(rastro)).not.toContain(secreto);
    expect(rastro[0]).toMatchObject({ campo: "secretos.token", valorNuevo: "(oculto)" });
  });

  it("un probe fallido no escribe nada", async () => {
    const f = vi.fn(async () => new Response("no", { status: 401 })) as typeof globalThis.fetch;
    await expect(guardarIntegracion(db, actorId, programId, "typeform", "invalido", f)).rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(integraciones)).toHaveLength(0);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("reemplazar el token de Calendly conserva la clave de firma", async () => {
    await sembrarIntegracion(db, programId, "calendly", { token: "anterior", claveFirma: "firma" });
    const f = vi.fn(async () => Response.json({ resource: { current_organization: "https://api.calendly.com/organizations/1" } })) as typeof globalThis.fetch;
    await guardarIntegracion(db, actorId, programId, "calendly", "nuevo", f);
    const [fila] = await db.select().from(integraciones);
    expect(fila.secretos).toEqual({ token: "nuevo", claveFirma: "firma" });
  });

  it("el estado no contiene el secreto y conserva el orden del registro", async () => {
    await sembrarIntegracion(db, programId, "dapta", { llaveApi: "ultrasecreta" }, { cuenta: "Retia" });
    const estado = await estadoDeIntegraciones(db, programId);
    expect(estado.map((fila) => fila.tipo)).toEqual(["dapta", "typeform", "calendly", "meta"]);
    expect(JSON.stringify(estado)).not.toContain("ultrasecreta");
  });

  it("probar un secreto guardado marca probada_en, actualiza config y no toca secretos ni change_log", async () => {
    await sembrarIntegracion(db, programId, "typeform", { token: "secreto-vivo" }, { alias: "viejo" });
    const config = await probarIntegracionGuardada(db, actorId, programId, "typeform", fetchTypeform("al-dia"));
    expect(config).toEqual({ alias: "al-dia" });
    const [fila] = await db.select().from(integraciones);
    expect(fila.probadaEn).toBeInstanceOf(Date);
    expect(fila.config).toEqual({ alias: "al-dia" });
    expect(fila.secretos).toEqual({ token: "secreto-vivo" });
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("si la prueba del secreto guardado falla, borra probada_en y no cambia secretos ni config", async () => {
    await sembrarIntegracion(db, programId, "typeform", { token: "secreto-muerto" }, { alias: "viejo" });
    await db.update(integraciones).set({ probadaEn: new Date() });
    const f = vi.fn(async () => new Response("no", { status: 401 })) as typeof globalThis.fetch;
    await expect(probarIntegracionGuardada(db, actorId, programId, "typeform", f)).rejects.toMatchObject({ status: 422 });
    const [fila] = await db.select().from(integraciones);
    expect(fila.probadaEn).toBeNull();
    expect(fila.secretos).toEqual({ token: "secreto-muerto" });
    expect(fila.config).toEqual({ alias: "viejo" });
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("probar sin integración guardada responde 422 y no escribe nada", async () => {
    await expect(probarIntegracionGuardada(db, actorId, programId, "typeform", fetchTypeform()))
      .rejects.toMatchObject({ status: 422 });
    expect(await db.select().from(integraciones)).toHaveLength(0);
    expect(await db.select().from(changeLog)).toHaveLength(0);
  });

  it("una cuenta sin token reporta error y las demás se siguen procesando", async () => {
    const [otro] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000",
    }).returning();
    await db.insert(cuentasPublicitarias).values([
      { idMeta: "sin-token", programId, nombre: "Cuenta A", moneda: "COP", zonaHoraria: "America/Bogota" },
      { idMeta: "con-token", programId: otro.id, nombre: "Cuenta B", moneda: "COP", zonaHoraria: "America/Bogota" },
    ]);
    const token = "meta-secreto";
    const f = vi.fn(async (entrada: string | URL | Request) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      if (url.pathname.endsWith("/campaigns") || url.pathname.endsWith("/adsets") || url.pathname.endsWith("/ads") || url.pathname.endsWith("/insights")) {
        return Response.json({ data: [] });
      }
      return Response.json({ error: { message: "inesperada" } }, { status: 404 });
    }) as typeof globalThis.fetch;
    const resultado = await sincronizarPauta(db, {
      tokens: new Map([[otro.id, token]]), hoy: "2026-10-19", disparadaPor: "manual", f,
    });
    expect(resultado).toMatchObject({ estado: "error" });
    expect(resultado.error).toContain("Cuenta A: el programa no tiene Meta conectado en Integraciones.");
    expect(f).toHaveBeenCalled();
  });
});
