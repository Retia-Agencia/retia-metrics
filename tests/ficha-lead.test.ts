import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { cohorts, deals, leadContactos, leads, programs, sources, submissions, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import {
  camposDelEnvio,
  diferenciasEntreEnvios,
  fichaDeLead,
  ordenarEnvios,
  type CampoDelEnvio,
  type EnvioParaComparar,
  unirParcialesConSuCompleto,
} from "@/lib/queries/ficha-lead";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 073: la ficha del Lead. Lo que importa probar:
 * - los envios en el orden de la hoja (no por fecha) y el diff entre uno y el siguiente;
 * - una columna que no existia en el envio viejo sale "no habia", no vacia;
 * - los deals cerrados y anulados se ven sin buscarlos;
 * - cada contacto dice de que envio llego, y la marca de "unido por telefono";
 * - la frontera: un lead de otro programa devuelve null, igual que uno inexistente.
 */

const vacio = (): EnvioParaComparar => ({
  nombre: null,
  calificacion: null,
  estadoHoja: null,
  leadQuality: null,
  leadValue: null,
  utmSource: null,
  utmMedium: null,
  utmCampaign: null,
  utmContent: null,
  utmTerm: null,
  utmId: null,
  respuestas: null,
});

function campo(campos: CampoDelEnvio[], nombre: string) {
  return campos.find((c) => c.campo === nombre)?.valor;
}

describe("camposDelEnvio y diferenciasEntreEnvios (puras)", () => {
  it("un campo promovido sin valor es vacio; una respuesta que no viene no aparece", () => {
    const campos = camposDelEnvio({ ...vacio(), nombre: "Ana", respuestas: { "¿Cuánto ganas?": "1000", Ciudad: "" } });
    expect(campo(campos, "Nombre")).toEqual({ tipo: "valor", texto: "Ana" });
    expect(campo(campos, "Lead quality")).toEqual({ tipo: "vacio" });
    expect(campo(campos, "Ciudad")).toEqual({ tipo: "vacio" });
    expect(campo(campos, "Urgencia")).toBeUndefined();
  });

  it("las llaves utm_* de respuestas no se repiten: los UTM salen de utmsDelEnvio", () => {
    const campos = camposDelEnvio({ ...vacio(), respuestas: { utm_term: "x", " UTM_source ": "y", Pregunta: "z" } });
    expect(campos.filter((c) => c.campo.toLowerCase().includes("utm_"))).toEqual([]);
    expect(campo(campos, "UTM Term")).toEqual({ tipo: "valor", texto: "x" });
  });

  it("una columna que el envio viejo no tenia sale 'no habia', no vacia", () => {
    const viejo = camposDelEnvio({ ...vacio(), respuestas: { Ingreso: "1000" } });
    const nuevo = camposDelEnvio({ ...vacio(), respuestas: { Ingreso: "1000", Urgencia: "Ya" } });
    expect(diferenciasEntreEnvios(viejo, nuevo)).toEqual([
      { campo: "Urgencia", antes: { tipo: "no_habia" }, despues: { tipo: "valor", texto: "Ya" } },
    ]);
  });

  it("un cambio de respuesta sale con antes y despues; lo igual no sale", () => {
    const viejo = camposDelEnvio({ ...vacio(), nombre: "Ana", respuestas: { Ingreso: "1000", Cargo: "CEO" } });
    const nuevo = camposDelEnvio({ ...vacio(), nombre: "Ana", respuestas: { Ingreso: "5000", Cargo: "CEO " } });
    expect(diferenciasEntreEnvios(viejo, nuevo)).toEqual([
      { campo: "Ingreso", antes: { tipo: "valor", texto: "1000" }, despues: { tipo: "valor", texto: "5000" } },
    ]);
  });

  it("'no habia' contra 'vacio' no es un cambio; una pregunta que desaparece si", () => {
    const viejo = camposDelEnvio({ ...vacio(), respuestas: { Vieja: "algo" } });
    const nuevo = camposDelEnvio({ ...vacio(), respuestas: { Nueva: "" } });
    expect(diferenciasEntreEnvios(viejo, nuevo)).toEqual([
      { campo: "Vieja", antes: { tipo: "valor", texto: "algo" }, despues: { tipo: "no_habia" } },
    ]);
  });

  it("ordena por la posicion en la hoja, no por la fecha; lo del webhook va despues, por llegada", () => {
    const t = (iso: string) => new Date(iso);
    const orden = ordenarEnvios([
      { id: "w2", posicionEnHoja: null, createdAt: t("2026-09-30T00:00:00Z") },
      { id: "h9", posicionEnHoja: 9, createdAt: t("2026-01-01T00:00:00Z") },
      { id: "w1", posicionEnHoja: null, createdAt: t("2026-09-29T00:00:00Z") },
      { id: "h3", posicionEnHoja: 3, createdAt: t("2026-09-01T00:00:00Z") },
    ]);
    expect(orden.map((e) => e.id)).toEqual(["h3", "h9", "w1", "w2"]);
  });
});

describe("fichaDeLead (PGlite)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let programId: string;
  let otroPrograma: string;
  let leadId: string;
  let envios: string[];
  let closer: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
    programId = p.id;
    const [q] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "q", nombre: "Q", ticketUsd: "500" }).returning();
    otroPrograma = q.id;
    const [u] = await db.insert(users).values({ email: "maru@retia.co", rol: "closer", closerId: "Maru", nombre: "Maru" }).returning();
    closer = u.id;
    const [c] = await db
      .insert(cohorts)
      .values({ programId, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-10-01", fechaInicioVentas: "2026-09-01", fechaCierreVentas: "2026-09-30", estado: "activo" })
      .returning();
    const [l] = await db.insert(leads).values({ programId, emailNormalizado: "ana@correo.co", nombre: "Ana" }).returning();
    leadId = l.id;
    const [fuente] = await db.insert(sources).values({ programId, nombre: "Typeform" }).returning();

    // Tres envios. La FECHA miente a proposito (el parcial trae placeholder): el orden lo da la hoja.
    const [e1] = await db
      .insert(submissions)
      .values({
        leadId, sourceId: fuente.id, token: "t1", posicionEnHoja: 10, esParcial: true,
        fechaEnvio: new Date("2026-09-30T00:00:00Z"), respuestas: { Ingreso: "1000" },
      })
      .returning();
    const [e2] = await db
      .insert(submissions)
      .values({
        leadId, sourceId: fuente.id, token: "t2", posicionEnHoja: 20, calificacion: "calificado",
        fechaEnvio: new Date("2026-07-01T00:00:00Z"), respuestas: { Ingreso: "1000", Urgencia: "Ya" },
      })
      .returning();
    const [e3] = await db
      .insert(submissions)
      .values({ leadId, sourceId: fuente.id, token: "t3", respuestas: { Ingreso: "5000", Urgencia: "Ya" } })
      .returning();
    envios = [e1.id, e2.id, e3.id];

    await db.insert(leadContactos).values([
      { leadId, programId, tipo: "correo", valor: "ana@correo.co", submissionId: e1.id, esPrincipal: true },
      { leadId, programId, tipo: "telefono", valor: "3001234567", submissionId: e2.id },
      { leadId, programId, tipo: "correo", valor: "ana.otra@correo.co", submissionId: e3.id, confirmado: false },
      { leadId, programId, tipo: "telefono", valor: "3009999999", submissionId: null },
    ]);

    // Un deal cerrado (perdido), uno anulado y uno abierto: reaplicar abre deal nuevo (ADR 0037).
    await db.insert(deals).values([
      { leadId, programId, etapa: "cierre_perdido", submissionOrigenId: e2.id, cohortId: c.id, ownerUserId: closer, createdAt: new Date("2026-07-02T00:00:00Z") },
      {
        leadId, programId, etapa: "registrado", createdAt: new Date("2026-08-01T00:00:00Z"),
        anuladoEn: new Date("2026-08-02T00:00:00Z"), anuladoPor: closer, motivoAnulacion: "lead equivocado",
      },
      { leadId, programId, etapa: "agendado", submissionOrigenId: e3.id, ownerUserId: closer, createdAt: new Date("2026-09-30T00:00:00Z") },
    ]);
  }, 60_000);

  afterEach(async () => {
    await cerrar();
  });

  it("muestra los tres envios, del mas reciente al primero, en el orden de la hoja", async () => {
    const f = (await fichaDeLead(db, programId, leadId))!;
    expect(f.envios.map((e) => e.id)).toEqual([envios[2], envios[1], envios[0]]);
    expect(f.envios.map((e) => e.numero)).toEqual([3, 2, 1]);
    expect(f.envios[2]!.cambios).toBeNull();
  });

  it("muestra lo que cambio entre uno y otro, con 'no habia' para la columna nueva", async () => {
    const f = (await fichaDeLead(db, programId, leadId))!;
    const [tercero, segundo] = f.envios;
    expect(segundo!.cambios).toEqual(
      expect.arrayContaining([
        { campo: "Urgencia", antes: { tipo: "no_habia" }, despues: { tipo: "valor", texto: "Ya" } },
        { campo: "Estado de llegada", antes: { tipo: "vacio" }, despues: { tipo: "valor", texto: "calificado" } },
      ]),
    );
    expect(segundo!.cambios!.some((c) => c.campo === "Ingreso")).toBe(false);
    expect(tercero!.cambios).toEqual(
      expect.arrayContaining([
        { campo: "Ingreso", antes: { tipo: "valor", texto: "1000" }, despues: { tipo: "valor", texto: "5000" } },
      ]),
    );
  });

  it("los deals cerrados y anulados se ven, despues del abierto", async () => {
    const f = (await fichaDeLead(db, programId, leadId))!;
    expect(f.deals.map((d) => d.etapa)).toEqual(["agendado", "cierre_perdido", "registrado"]);
    expect(f.deals[0]).toMatchObject({ cerrado: false, anulado: null, envioNumero: 3, ownerNombre: "Maru" });
    expect(f.deals[1]).toMatchObject({ cerrado: true, anulado: null, envioNumero: 2, cohorteCodigo: "C1" });
    expect(f.deals[2]!.anulado).toMatchObject({ motivo: "lead equivocado" });
  });

  it("cada contacto dice de que envio llego, y la marca de unido por telefono", async () => {
    const f = (await fichaDeLead(db, programId, leadId))!;
    const de = (valor: string) => f.contactos.find((c) => c.valor === valor)!;
    expect(f.contactos[0]!.valor).toBe("ana@correo.co");
    expect(de("ana@correo.co").envioNumero).toBe(1);
    expect(de("3001234567").envioNumero).toBe(2);
    expect(de("ana.otra@correo.co")).toMatchObject({ envioNumero: 3, confirmado: false });
    expect(de("3009999999")).toMatchObject({ envioNumero: null, agregadoAMano: true });
    expect(f.unidoPorTelefono).toBe(true);
    expect(f.soloParciales).toBe(false);
  });

  it("un lead de otro programa o inexistente devuelve null (la ruta responde 404)", async () => {
    expect(await fichaDeLead(db, otroPrograma, leadId)).toBeNull();
    expect(await fichaDeLead(db, programId, "00000000-0000-4000-8000-000000000000")).toBeNull();
  });

  it("un lead dado de alta a mano sale sin envios ni deals", async () => {
    const [m] = await db.insert(leads).values({ programId, emailNormalizado: "manual@correo.co", entrada: "crm" }).returning();
    const f = (await fichaDeLead(db, programId, m.id))!;
    expect(f).toMatchObject({ entrada: "crm", envios: [], deals: [], contactos: [], soloParciales: false });
  });
});

describe("el parcial y su completo son el mismo envío (ADR 0073)", () => {
  const fila = (token: string, esParcial: boolean, minuto: number) => ({
    sourceId: "f1",
    token,
    esParcial,
    fechaEnvio: null,
    createdAt: new Date(Date.UTC(2026, 9, 2, 15, minuto)),
  });

  it("el completo absorbe a su parcial hermano y dice cuándo empezó", () => {
    const r = unirParcialesConSuCompleto([fila("t1", true, 0), fila("t1", false, 5)]);
    expect(r).toHaveLength(1);
    expect(r[0]).toMatchObject({ token: "t1", esParcial: false, empezoComoParcial: new Date(Date.UTC(2026, 9, 2, 15, 0)) });
  });

  it("un parcial que nunca se completó se queda solo, y otro token es otro envío", () => {
    const r = unirParcialesConSuCompleto([fila("t1", true, 0), fila("t2", false, 9)]);
    expect(r.map((e) => [e.token, e.esParcial, e.empezoComoParcial])).toEqual([
      ["t1", true, null],
      ["t2", false, null],
    ]);
  });
});
