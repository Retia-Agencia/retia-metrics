import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  changeLog, cohorts, dealLineas, deals, leads, miembrosPrograma, plataformasPago, plataformasPrograma,
  programs, skus, users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { emitirTokenPersonal } from "@/lib/mcp/token";
import { abonoDePrueba } from "./helpers/catalogo-de-prueba";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const estado = vi.hoisted(() => ({ db: null as Db | null }));
vi.mock("@/lib/db", () => ({ get db() { return estado.db; } }));

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let cohorteId: string;
let skuBaseId: string;
let skuExtraId: string;
let skuAjenoId: string;
let plataformaId: string;
let closerId: string;
let closerOtroProgramaId: string;
const tokens = {} as Record<"gerente" | "developer" | "closer" | "closerAjeno" | "closerOtroPrograma" | "paid", string>;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  estado.db = db;
});
afterAll(async () => {
  estado.db = null;
  await cerrar();
});

beforeEach(async () => {
  await vaciar();
  const [programa, otro] = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "skus-a", nombre: "SKUs A", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "skus-b", nombre: "SKUs B", ticketUsd: "1000" },
  ]).returning();
  programId = programa.id;
  otroProgramId = otro.id;
  const usuarios = await db.insert(users).values([
    { email: "gerente-skus@retia.test", nombre: "Gerente", rol: "gerente" },
    { email: "developer-skus@retia.test", nombre: "Developer", rol: "developer" },
    { email: "closer-skus@retia.test", nombre: "Closer dueño", rol: "closer", closerId: "closer-skus" },
    { email: "ajeno-skus@retia.test", nombre: "Closer ajeno", rol: "closer", closerId: "ajeno-skus" },
    { email: "otro-skus@retia.test", nombre: "Closer otro programa", rol: "closer", closerId: "otro-skus" },
    { email: "paid-skus@retia.test", nombre: "Paid", rol: "paid_trafficker" },
  ]).returning();
  const [gerente, developer, closer, ajeno, otroPrograma, paid] = usuarios;
  closerId = closer.id;
  closerOtroProgramaId = otroPrograma.id;
  await db.insert(miembrosPrograma).values([
    { userId: closer.id, programId },
    { userId: ajeno.id, programId },
    { userId: otroPrograma.id, programId: otroProgramId },
    { userId: paid.id, programId },
  ]);
  const emitir = async (usuario: { id: string }, nombre: string) =>
    (await emitirTokenPersonal(db, { userId: usuario.id, actorId: usuario.id, nombre, scope: "escritura" })).valor;
  tokens.gerente = await emitir(gerente, "Gerente");
  tokens.developer = await emitir(developer, "Developer");
  tokens.closer = await emitir(closer, "Closer");
  tokens.closerAjeno = await emitir(ajeno, "Ajeno");
  tokens.closerOtroPrograma = await emitir(otroPrograma, "Otro");
  tokens.paid = await emitir(paid, "Paid");

  cohorteId = (await db.insert(cohorts).values({
    programId, codigo: "C1", metaCupos: 10, precioUsd: "797",
    fechaInicioVentas: "2026-01-01", fechaCierreVentas: "2026-12-31",
  }).returning())[0].id;
  const otraCohorte = (await db.insert(cohorts).values({
    programId: otroProgramId, codigo: "C1", metaCupos: 10, precioUsd: "500",
    fechaInicioVentas: "2026-01-01", fechaCierreVentas: "2026-12-31",
  }).returning())[0].id;
  [skuBaseId, skuExtraId, skuAjenoId] = (await db.insert(skus).values([
    { programId, nombre: "Base", slug: "base", cohortId: cohorteId, codigo: "skus_a_base_c1", precioListaUsd: "797", cuentaComoCupo: true, comisionPorcentaje: "10" },
    { programId, nombre: "Extra", slug: "extra", cohortId: cohorteId, codigo: "skus_a_extra_c1", precioListaUsd: "100", cuentaComoCupo: false, comisionPorcentaje: "5" },
    { programId: otroProgramId, nombre: "Ajeno", slug: "ajeno", cohortId: otraCohorte, codigo: "skus_b_ajeno_c1", precioListaUsd: "500", cuentaComoCupo: true, comisionPorcentaje: "0" },
  ]).returning()).map((fila) => fila.id);
  plataformaId = (await db.insert(plataformasPago).values({ nombre: "Wompi skus" }).returning())[0].id;
  await db.insert(plataformasPrograma).values({ programId, plataformaId });
});

async function nuevoDeal(programa = programId, dueno = closerId) {
  const [lead] = await db.insert(leads).values({
    programId: programa, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA,
    emailNormalizado: `${crypto.randomUUID()}@retia.test`, nombre: "Lead de líneas",
  }).returning();
  return (await db.insert(deals).values({
    programId: programa, leadId: lead.id, ownerUserId: dueno, etapa: "agendado",
  }).returning())[0].id;
}

async function post(metodo: string, params: Record<string, unknown>, token: string) {
  const { POST } = await import("@/app/api/mcp/route");
  const respuesta = await POST(new Request("https://crm.retia.test/api/mcp", {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", accept: "application/json, text/event-stream" },
    body: JSON.stringify({ jsonrpc: "2.0", id: crypto.randomUUID(), method: metodo, params }),
  }));
  const bruto = await respuesta.text();
  const linea = bruto.startsWith("event:") ? bruto.split("\n").find((parte) => parte.startsWith("data: "))?.slice(6) ?? "{}" : bruto;
  return JSON.parse(linea) as Record<string, unknown>;
}
const contenido = (r: Record<string, unknown>) => (r.result as { structuredContent?: Record<string, unknown> } | undefined)?.structuredContent;
const texto = (r: Record<string, unknown>) => ((r.result as { content?: { text: string }[] } | undefined)?.content?.[0]?.text) ?? JSON.stringify(r);
type Fila = { se_puede_aplicar: boolean; razon: string | null; estado?: string };

async function preparar(accion: string, argumentos: Record<string, unknown>, token = tokens.gerente, programa = "skus-a") {
  return post("tools/call", { name: "preparar_accion", arguments: { programa, accion, argumentos } }, token);
}
async function confirmar(id: string, token = tokens.gerente) {
  return post("tools/call", { name: "confirmar_cambio", arguments: { id } }, token);
}
async function aplicar(accion: string, argumentos: Record<string, unknown>, token = tokens.gerente, programa = "skus-a") {
  const previa = contenido(await preparar(accion, argumentos, token, programa))!;
  expect((previa.filas as Fila[])[0]).toMatchObject({ se_puede_aplicar: true });
  return contenido(await confirmar(previa.id as string, token))!;
}
async function filaDePrevia(accion: string, argumentos: Record<string, unknown>, token = tokens.gerente, programa = "skus-a") {
  const previa = contenido(await preparar(accion, argumentos, token, programa))!;
  return (previa.filas as Fila[])[0];
}
async function lineasDe(dealId: string) {
  return db.select().from(dealLineas).where(eq(dealLineas.dealId, dealId));
}
async function cambiosDe(tabla: string, registroId: string) {
  return db.select().from(changeLog).where(and(eq(changeLog.tabla, tabla), eq(changeLog.registroId, registroId)));
}
const ACCIONES_DE_SKU = ["crear_sku", "editar_sku", "desactivar_sku", "reactivar_sku"];
const ACCIONES_DE_LINEA = ["asignar_sku", "editar_valor_linea", "quitar_linea", "anular_linea"];

async function clavesDescubiertas(token: string) {
  const capacidades = contenido(await post("tools/call", { name: "capacidades", arguments: {} }, token))!;
  return (capacidades.acciones as { clave: string }[]).map((accion) => accion.clave);
}

describe("acciones MCP de SKUs", () => {
  it.each(["gerente", "developer"] as const)("%s las descubre y edita un SKU con rastro en change_log", async (rol) => {
    expect(await clavesDescubiertas(tokens[rol])).toEqual(expect.arrayContaining(ACCIONES_DE_SKU));
    const previa = contenido(await preparar("editar_sku", { sku_id: skuBaseId, precio_lista_usd: "897", comision_porcentaje: 12 }, tokens[rol]))!;
    expect((previa.filas as Fila[])[0]).toMatchObject({
      se_puede_aplicar: true,
      antes: expect.objectContaining({ precio_lista_usd: "797.00" }),
      despues: expect.objectContaining({ precio_lista_usd: "897.00", comision_porcentaje: "12.00" }),
    });
    expect((await db.select().from(skus).where(eq(skus.id, skuBaseId)))[0].precioListaUsd).toBe("797.00");
    const confirmada = contenido(await confirmar(previa.id as string, tokens[rol]))!;
    expect((confirmada.filas as Fila[])[0].estado).toBe("aplicada");
    expect((await db.select().from(skus).where(eq(skus.id, skuBaseId)))[0].precioListaUsd).toBe("897.00");
    const rastro = await cambiosDe("skus", skuBaseId);
    expect(rastro.map((c) => c.campo)).toEqual(expect.arrayContaining(["precioListaUsd", "comisionPorcentaje"]));
    expect(rastro.every((c) => c.origen === "mcp")).toBe(true);
  });

  it.each(["closer", "paid"] as const)("%s no las descubre y una petición forjada se rechaza sin tocar la base", async (rol) => {
    const claves = await clavesDescubiertas(tokens[rol]);
    for (const clave of ACCIONES_DE_SKU) expect(claves).not.toContain(clave);
    const antes = await db.select().from(skus).orderBy(skus.codigo);
    const forjadas: [string, Record<string, unknown>][] = [
      ["crear_sku", { programa_id: programId, nombre: "Forjado", cohorte: 1, precio_lista_usd: "10", comision_porcentaje: 0 }],
      ["editar_sku", { sku_id: skuBaseId, precio_lista_usd: "1" }],
      ["desactivar_sku", { sku_id: skuBaseId }],
      ["reactivar_sku", { sku_id: skuBaseId }],
    ];
    for (const [accion, argumentos] of forjadas) {
      expect(texto(await preparar(accion, argumentos, tokens[rol]))).toContain("No puedes usar esa acción");
    }
    expect(await db.select().from(skus).orderBy(skus.codigo)).toEqual(antes);
  });

  it("desactiva y reactiva con rastro, y rechaza repetir el estado", async () => {
    await aplicar("desactivar_sku", { sku_id: skuExtraId });
    expect((await db.select().from(skus).where(eq(skus.id, skuExtraId)))[0].activo).toBe(false);
    expect(await filaDePrevia("desactivar_sku", { sku_id: skuExtraId })).toMatchObject({ se_puede_aplicar: false, razon: "Ese SKU ya está inactivo." });
    await aplicar("reactivar_sku", { sku_id: skuExtraId });
    expect((await db.select().from(skus).where(eq(skus.id, skuExtraId)))[0].activo).toBe(true);
    expect((await cambiosDe("skus", skuExtraId)).filter((c) => c.campo === "activo")).toHaveLength(2);
  });

  it("crea un SKU en una cohorte existente y deja el alta en change_log", async () => {
    await aplicar("crear_sku", { programa_id: programId, nombre: "Mentoría", cohorte: 1, precio_lista_usd: "300", comision_porcentaje: 5 });
    const [creado] = await db.select().from(skus).where(and(eq(skus.programId, programId), eq(skus.nombre, "Mentoría")));
    expect(creado).toMatchObject({ cohortId: cohorteId, precioListaUsd: "300.00", cuentaComoCupo: false });
    const rastro = await cambiosDe("skus", creado.id);
    expect(rastro.length).toBeGreaterThan(0);
    expect(rastro.every((c) => c.origen === "mcp")).toBe(true);
  });

  it("una cohorte nueva exige su ventana y, con ella, nace con el SKU", async () => {
    const base = { programa_id: programId, nombre: "Nueva", cohorte: 2, precio_lista_usd: "400", comision_porcentaje: 10, cuenta_como_cupo: true };
    expect(await filaDePrevia("crear_sku", base)).toMatchObject({ se_puede_aplicar: false, razon: expect.stringContaining("es nueva") });
    expect(await db.select().from(cohorts).where(and(eq(cohorts.programId, programId), eq(cohorts.codigo, "C2")))).toHaveLength(0);
    await aplicar("crear_sku", { ...base, ventana: { inicio_ventas: "2027-02-01", cierre_ventas: "2027-03-01", meta_cupos: 50 } });
    expect(await db.select().from(cohorts).where(and(eq(cohorts.programId, programId), eq(cohorts.codigo, "C2")))).toHaveLength(1);
  });

  it("el programa es frontera: un SKU o un programa de otro programa se rechaza", async () => {
    const antes = await db.select().from(skus).orderBy(skus.codigo);
    expect(await filaDePrevia("editar_sku", { sku_id: skuAjenoId, precio_lista_usd: "1" })).toMatchObject({
      se_puede_aplicar: false, razon: "No existe ese SKU en este programa.",
    });
    expect(await filaDePrevia("desactivar_sku", { sku_id: skuAjenoId })).toMatchObject({ se_puede_aplicar: false });
    expect(await filaDePrevia("crear_sku", { programa_id: otroProgramId, nombre: "Cruzado", cohorte: 1, precio_lista_usd: "10", comision_porcentaje: 0 }))
      .toMatchObject({ se_puede_aplicar: false, razon: "No existe ese programa." });
    expect(await db.select().from(skus).orderBy(skus.codigo)).toEqual(antes);
  });

  it("confirmar falla si el SKU cambió desde la vista previa", async () => {
    const previa = contenido(await preparar("editar_sku", { sku_id: skuBaseId, nombre: "Base 2" }))!;
    await db.update(skus).set({ precioListaUsd: "1.00" }).where(eq(skus.id, skuBaseId));
    const confirmada = contenido(await confirmar(previa.id as string))!;
    expect((confirmada.filas as { estado: string }[])[0].estado).toBe("rechazada");
    expect((await db.select().from(skus).where(eq(skus.id, skuBaseId)))[0].nombre).toBe("Base");
  });
});

describe("acciones MCP de líneas de un deal", () => {
  it("el closer dueño las descubre, asigna un SKU, edita su valor y la anula con rastro", async () => {
    expect(await clavesDescubiertas(tokens.closer)).toEqual(expect.arrayContaining(ACCIONES_DE_LINEA));
    const dealId = await nuevoDeal();
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuExtraId }, tokens.closer);
    const [linea] = await lineasDe(dealId);
    expect(linea).toMatchObject({ skuId: skuExtraId, valorVendidoUsd: "100.00", asignadaPor: closerId });
    expect((await cambiosDe("deal_lineas", linea.id))[0].userId).toBe(closerId);

    await aplicar("editar_valor_linea", { deal_id: dealId, linea_id: linea.id, valor_vendido_usd: 80 }, tokens.closer);
    expect((await lineasDe(dealId))[0].valorVendidoUsd).toBe("80.00");

    await aplicar("quitar_linea", { deal_id: dealId, linea_id: linea.id }, tokens.closer);
    expect((await lineasDe(dealId))[0].anuladaEn).not.toBeNull();
    expect((await cambiosDe("deal_lineas", linea.id)).map((c) => c.campo)).toEqual(expect.arrayContaining(["valorVendidoUsd", "anuladaEn"]));
  });

  it("gerente y developer también operan las líneas de cualquier deal", async () => {
    const dealId = await nuevoDeal();
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuBaseId, valor_vendido_usd: 700 }, tokens.gerente);
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuExtraId }, tokens.developer);
    expect(await lineasDe(dealId)).toHaveLength(2);
  });

  it("un closer ajeno al deal, uno de otro programa y un rol sin capacidad se rechazan y la base no se mueve", async () => {
    const dealId = await nuevoDeal();
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuExtraId }, tokens.closer);
    const [linea] = await lineasDe(dealId);
    const pedidos: [string, Record<string, unknown>][] = [
      ["asignar_sku", { deal_id: dealId, sku_id: skuBaseId }],
      ["editar_valor_linea", { deal_id: dealId, linea_id: linea.id, valor_vendido_usd: 1 }],
      ["quitar_linea", { deal_id: dealId, linea_id: linea.id }],
      ["anular_linea", { deal_id: dealId, linea_id: linea.id }],
    ];
    const antes = await lineasDe(dealId);
    for (const [accion, argumentos] of pedidos) {
      expect(await filaDePrevia(accion, argumentos, tokens.closerAjeno)).toMatchObject({
        se_puede_aplicar: false, razon: "Solo el dueño o quien administra puede editar los SKUs del deal.",
      });
      expect(texto(await preparar(accion, argumentos, tokens.closerOtroPrograma))).not.toContain("se puede aplicar");
      expect(texto(await preparar(accion, argumentos, tokens.paid))).toContain("No puedes usar esa acción");
    }
    expect(await lineasDe(dealId)).toEqual(antes);
    // Confirmar una vista previa rechazada tampoco escribe.
    const rechazada = contenido(await preparar("quitar_linea", { deal_id: dealId, linea_id: linea.id }, tokens.closerAjeno))!;
    expect((contenido(await confirmar(rechazada.id as string, tokens.closerAjeno))!.filas as Fila[])[0].estado).toBe("rechazada");
    expect(await lineasDe(dealId)).toEqual(antes);
  });

  it("el programa es frontera: un deal de otro programa o un SKU de otro programa se rechaza", async () => {
    const dealAjeno = await nuevoDeal(otroProgramId, closerOtroProgramaId);
    expect(await filaDePrevia("asignar_sku", { deal_id: dealAjeno, sku_id: skuAjenoId }, tokens.gerente))
      .toMatchObject({ se_puede_aplicar: false, razon: "No existe ese deal" });
    const dealId = await nuevoDeal();
    expect(await filaDePrevia("asignar_sku", { deal_id: dealId, sku_id: skuAjenoId }, tokens.closer))
      .toMatchObject({ se_puede_aplicar: false, razon: "El SKU no existe, está inactivo o pertenece a otro programa." });
    expect(await lineasDe(dealAjeno)).toHaveLength(0);
    expect(await lineasDe(dealId)).toHaveLength(0);
  });

  it("una línea anulada no se edita ni se quita", async () => {
    const dealId = await nuevoDeal();
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuExtraId }, tokens.closer);
    const [linea] = await lineasDe(dealId);
    await aplicar("anular_linea", { deal_id: dealId, linea_id: linea.id }, tokens.closer);
    for (const [accion, argumentos] of [
      ["editar_valor_linea", { deal_id: dealId, linea_id: linea.id, valor_vendido_usd: 5 }],
      ["quitar_linea", { deal_id: dealId, linea_id: linea.id }],
      ["anular_linea", { deal_id: dealId, linea_id: linea.id }],
    ] as const) {
      expect(await filaDePrevia(accion, argumentos, tokens.closer)).toMatchObject({
        se_puede_aplicar: false, razon: "La línea no existe, está anulada o no pertenece a este deal.",
      });
    }
    expect((await lineasDe(dealId))[0].valorVendidoUsd).toBe("100.00");
  });

  it("quitar rechaza una línea con abonos y anular sí la anula", async () => {
    const dealId = await nuevoDeal();
    await aplicar("asignar_sku", { deal_id: dealId, sku_id: skuBaseId }, tokens.closer);
    const [linea] = await lineasDe(dealId);
    await abonoDePrueba(db, {
      dealId, programId, lineaId: linea.id, fecha: "2026-11-13", monto: "200", moneda: "USD",
      concepto: "ticket", plataformaId, registradoPorUserId: closerId,
    });
    expect(await filaDePrevia("quitar_linea", { deal_id: dealId, linea_id: linea.id }, tokens.closer))
      .toMatchObject({ se_puede_aplicar: false, razon: "Una línea con abonos no se puede quitar; anúlala." });
    expect((await lineasDe(dealId))[0].anuladaEn).toBeNull();
    const confirmada = await aplicar("anular_linea", { deal_id: dealId, linea_id: linea.id }, tokens.closer);
    expect((confirmada.filas as Fila[])[0].estado).toBe("aplicada");
    expect((await lineasDe(dealId))[0].anuladaEn).not.toBeNull();
  });

  it("la vista previa muestra las líneas antes y después sin escribir", async () => {
    const dealId = await nuevoDeal();
    const previa = contenido(await preparar("asignar_sku", { deal_id: dealId, sku_id: skuExtraId }, tokens.closer))!;
    expect((previa.filas as { antes: { lineas: unknown[] }; despues: { lineas: { sku: string }[] } }[])[0]).toMatchObject({
      antes: { lineas: [] },
      despues: { lineas: [expect.objectContaining({ sku: "skus_a_extra_c1", valor_vendido_usd: "100.00" })] },
    });
    expect(await lineasDe(dealId)).toHaveLength(0);
  });
});

