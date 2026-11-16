import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { alertasActivas } from "@/lib/alertas/registro";
import { asignarCompraALead } from "@/lib/pagos/asignar";
import { emparejarComprador } from "@/lib/pagos/emparejar";
import { comprasPasarela, integraciones, leadContactos, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

describe("emparejar y asignar compras de pasarela", () => {
  let db: Db; let vaciar: () => Promise<void>; let cerrar: () => Promise<void>;
  let programId: string; let otroProgramId: string; let gerenteId: string; let integracionId: string;
  beforeAll(async () => ({ db, vaciar, cerrar } = await crearBaseReutilizable()));
  beforeEach(async () => {
    await vaciar();
    const [programa, otro] = await db.insert(programs).values([
      { ...PROGRAMA_DE_PRUEBA, slug: "pagos", nombre: "Pagos", ticketUsd: "100" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "100" },
    ]).returning();
    programId = programa.id; otroProgramId = otro.id;
    const [gerente] = await db.insert(users).values({ email: "gerente-pagos@retia.test", rol: "gerente" }).returning();
    gerenteId = gerente.id;
    // La FK solo necesita una integración del programa; el emparejamiento no lee su tipo.
    const [integracion] = await db.insert(integraciones).values({ programId, tipo: "typeform", secretos: { token: "x" } }).returning();
    integracionId = integracion.id;
  });
  afterAll(async () => cerrar());
  const lead = async (programa: string, correo: string, telefono?: string) => {
    const [fila] = await db.insert(leads).values({ programId: programa, emailNormalizado: correo, entrada: "crm", telefono }).returning();
    await db.insert(leadContactos).values({ leadId: fila.id, programId: programa, tipo: "correo", valor: correo, esPrincipal: true });
    if (telefono) await db.insert(leadContactos).values({ leadId: fila.id, programId: programa, tipo: "telefono", valor: telefono, esPrincipal: true });
    return fila;
  };
  const compra = async () => (await db.insert(comprasPasarela).values({ programId, integracionId, proveedor: "hotmart", transaccion: crypto.randomUUID(), evento: "PURCHASE_APPROVED", estado: "sin_emparejar" }).returning())[0];

  it("empareja por correo antes que por teléfono", async () => {
    const a = await lead(programId, "a@retia.test", "3001112233");
    expect(await emparejarComprador(db, programId, { correo: " A@RETIA.TEST ", telefono: "999" })).toMatchObject({ leadId: a.id, emparejadaPor: "correo" });
  });
  it("empareja por teléfono normalizado", async () => {
    const a = await lead(programId, "a@retia.test", "573001112233");
    expect(await emparejarComprador(db, programId, { correo: "nuevo@retia.test", telefono: "+57 300 111 2233" })).toMatchObject({ leadId: a.id, emparejadaPor: "telefono" });
  });
  it("no cruza el correo de otro programa", async () => {
    await lead(otroProgramId, "misma@retia.test");
    expect(await emparejarComprador(db, programId, { correo: "misma@retia.test" })).toMatchObject({ leadId: null, emparejadaPor: null });
  });
  it("gana el correo y deja nota si el teléfono pertenece a otro lead", async () => {
    const a = await lead(programId, "a@retia.test"); const b = await lead(programId, "b@retia.test", "3001112233");
    const r = await emparejarComprador(db, programId, { correo: "a@retia.test", telefono: "3001112233" });
    expect(r).toMatchObject({ leadId: a.id, emparejadaPor: "correo" }); expect(r.notaSistema).toContain(b.id);
  });
  it("una compra sin match aparece en la alerta", async () => {
    const c = await compra();
    expect(c.estado).toBe("sin_emparejar");
    expect(await alertasActivas(db, new Date())).toContainEqual(expect.objectContaining({ tipo: "pagos_sin_emparejar", clave: `pagos_sin_emparejar:${programId}` }));
  });
  it("closer recibe 403 y la fila no cambia", async () => {
    const c = await compra(); const destino = await lead(programId, "destino@retia.test");
    await expect(asignarCompraALead(db, { userId: crypto.randomUUID(), rol: "closer" }, c.id, destino.id)).rejects.toMatchObject({ status: 403 });
    expect((await db.select().from(comprasPasarela).where(eq(comprasPasarela.id, c.id)))[0]).toMatchObject({ estado: "sin_emparejar", leadId: null });
  });
  it("rechaza con 404 un lead de otro programa", async () => {
    const c = await compra(); const ajeno = await lead(otroProgramId, "ajeno@retia.test");
    await expect(asignarCompraALead(db, { userId: gerenteId, rol: "gerente" }, c.id, ajeno.id)).rejects.toMatchObject({ status: 404 });
  });
  it("gerente asigna manualmente", async () => {
    const c = await compra(); const destino = await lead(programId, "destino@retia.test");
    await asignarCompraALead(db, { userId: gerenteId, rol: "gerente" }, c.id, destino.id);
    expect((await db.select().from(comprasPasarela).where(eq(comprasPasarela.id, c.id)))[0]).toMatchObject({ estado: "emparejada", leadId: destino.id, emparejadaPor: "manual", asignadaPorUserId: gerenteId });
  });
});
