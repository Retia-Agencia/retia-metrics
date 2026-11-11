import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { embudoDelRango } from "@/lib/queries/dashboard";
import * as agenda from "@/lib/queries/hechos/agenda";
import * as cita from "@/lib/queries/hechos/cita";
import { listaDeMetrica } from "@/lib/queries/metricas-con-filas";
import { grupoDeCitas } from "@/lib/queries/tasas-del-grupo";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { FECHA_LEAD_DE_PRUEBA } from "./helpers/crear-lead-de-prueba";
import { duenoDePrueba } from "./helpers/dueno-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Una llamada vigente sobre un deal ANULADO no cuenta en ninguna métrica (ADR 0038, ADR 0115 N1, 11-nov). Unir el
 * deal con `vigente` la volvía una llamada suelta (que sí cuenta) y unirlo con `incluyendoAnulados` la dejaba
 * pasar: la barra de cumplimiento y la lista daban 4 contra 3. La llamada de verdad suelta (sin deal) sigue contando.
 */
const RANGO = { desde: "2026-11-02", hasta: "2026-11-08" };
const AHORA = new Date("2026-11-10T12:00:00-05:00");

describe("una llamada sobre un deal anulado no cuenta, en ninguna lectura", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;
  let fuenteId: string;
  let dueno: string;
  let n = 0;

  beforeAll(async () => ({ db, cerrar, vaciar } = await crearBaseReutilizable()));
  afterAll(async () => cerrar());
  beforeEach(async () => {
    await vaciar();
    const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "anulado", nombre: "Anulado", ticketUsd: "1000" }).returning();
    programId = p.id;
    [{ id: fuenteId }] = await db.insert(sources).values({ programId, nombre: "Fuente" }).returning();
    dueno = await duenoDePrueba(db, programId);
  });

  async function dealConCita(opciones: { medium: string; anulado?: boolean; resultado?: "show" | null }) {
    const token = `t${++n}`;
    const [lead] = await db.insert(leads).values({ programId, fechaPrimeraAplicacion: FECHA_LEAD_DE_PRUEBA, emailNormalizado: `${token}@t.co` }).returning();
    const [envio] = await db.insert(submissions).values({
      sourceId: fuenteId, leadId: lead.id, token, utmSource: "facebook", utmMedium: opciones.medium,
      fechaEnvio: new Date("2026-10-20T09:00:00-05:00"),
    }).returning();
    const [deal] = await db.insert(deals).values({
      programId, leadId: lead.id, submissionOrigenId: envio.id, ownerUserId: dueno, etapa: "agendado",
      ...(opciones.anulado ? { anuladoEn: new Date(), anuladoPor: dueno, motivoAnulacion: "error" } : {}),
    }).returning();
    await db.insert(calls).values({
      programId, dealId: deal.id, closerUserId: dueno, createdAt: new Date("2026-11-04T11:00:00-05:00"),
      fechaAgenda: new Date("2026-11-04T15:00:00-05:00"), ...(opciones.resultado ? { resultado: opciones.resultado } : {}),
    });
    return deal.id;
  }

  async function sembrar() {
    await dealConCita({ medium: "paid_social", resultado: "show" });
    await dealConCita({ medium: "organic" });
    await dealConCita({ medium: "paid_social", anulado: true, resultado: "show" }); // la que no debe contar
    await db.insert(calls).values({ programId, dealId: null, createdAt: new Date("2026-11-04T12:00:00-05:00"), fechaAgenda: new Date("2026-11-04T16:00:00-05:00") }); // suelta: sí cuenta
  }

  const filtros = () => ({ programId, rango: RANGO, hoy: "2026-11-10", ahora: AHORA });

  it("hechos de agenda y de cita: 3 y no 4 (la suelta cuenta, la del deal anulado no)", async () => {
    await sembrar();
    const [{ agendas }] = await agenda.agrupar(db, { programId, rango: RANGO, agruparPor: [], filtros: {} });
    expect(agendas).toBe(3);
    expect((await agenda.listar(db, { programId, rango: RANGO, filtros: {}, pagina: { numero: 1, tamano: 50 } as never })).total).toBe(3);
    const [{ citas, shows }] = await cita.agrupar(db, { programId, rango: RANGO, agruparPor: [], filtros: {} });
    expect(citas).toBe(3);
    expect(shows).toBe(1);
    expect((await agenda.agrupar(db, { programId, rango: RANGO, agruparPor: [], filtros: { area: ["paid"] } }))[0]?.agendas ?? 0).toBe(1);
  });

  it("el embudo y las listas de llamadas cuentan lo mismo que los hechos", async () => {
    await sembrar();
    const embudo = await embudoDelRango({ programId, rango: RANGO }, db, AHORA);
    expect(embudo.agendas).toBe(3);
    expect(embudo.llamadasConShow).toBe(1);
    for (const metrica of ["agendas_creadas", "agendas"] as const) {
      const [lista] = await listaDeMetrica(metrica, filtros(), 1, db);
      expect(lista.subtotal.cantidad, metrica).toBe(3);
    }
    const [shows] = await listaDeMetrica("shows", filtros(), 1, db);
    expect(shows.subtotal.cantidad).toBe(1);
  });

  it("Asistencia de Paid: la lista del grupo con área Paid cuenta lo mismo que la cifra y no mezcla el orgánico", async () => {
    await sembrar();
    await dealConCita({ medium: "organic", resultado: "show" }); // un show orgánico: el área Paid no lo cuenta
    const grupo = await grupoDeCitas(db, { programId, rango: RANGO, ahora: AHORA, area: "paid" });
    expect(grupo.miembros.length).toBe(1);
    expect(grupo.miembros.filter((m) => m.conShow).length).toBe(1);
    const [citas] = await listaDeMetrica("grupo_citas", { ...filtros(), area: "paid" }, 1, db);
    const [shows] = await listaDeMetrica("grupo_shows", { ...filtros(), area: "paid" }, 1, db);
    expect(citas.subtotal.cantidad).toBe(grupo.miembros.length);
    expect(shows.subtotal.cantidad).toBe(grupo.miembros.filter((m) => m.conShow).length);
    // Mordido: sin el área, el grupo incluye también el deal orgánico.
    expect((await listaDeMetrica("grupo_citas", filtros(), 1, db))[0].subtotal.cantidad).toBe(2);
  });
});

/**
 * Guardián: todo archivo de `lib/queries/` que une `deals` con `calls` por `calls.dealId` decide qué pasa con la
 * llamada de un deal anulado. O aplica `llamadaSinDealAnulado` (o el filtro que lo contiene), o está nombrado aquí
 * con su razón. Una lectura nueva que se olvide no lanza ningún error: cuenta de más.
 */
const APLICAN_EL_PREDICADO_POR_SU_FILTRO = [
  "lib/queries/dashboard.ts", // filtroLlamadas
  "lib/queries/metricas-con-filas.ts", // filtroLlamadas, filtroAgendasCreadas y la rama de agendas futuras
];
const EXCEPCIONES = new Map<string, string>([
  ["lib/queries/inbox.ts", "innerJoin vigente(deals): una llamada de un deal anulado no es del Inbox"],
  ["lib/queries/tasas-del-grupo.ts", "innerJoin vigente(deals): el grupo de citas excluye el deal anulado por construcción"],
  ["lib/queries/proyeccion-roas.ts", "innerJoin vigente(deals)"],
  ["lib/calendly/eventos-de-cita.ts", "innerJoin vigente(deals): cuelga la cita de Calendly de un deal vivo"],
  ["lib/queries/detalle-llamada.ts", "ficha de UNA llamada: muestra lo anulado a propósito (ADR 0026 punto 4)"],
  ["lib/queries/llamadas.ts", "lista operativa de llamadas (no es una métrica); exige deal con isNotNull(calls.dealId)"],
]);

function archivos(dir: string): string[] {
  return readdirSync(dir).flatMap((nombre) => {
    const ruta = join(dir, nombre);
    return statSync(ruta).isDirectory() ? archivos(ruta) : ruta.endsWith(".ts") ? [ruta] : [];
  });
}

describe("guardián: las lecturas de llamadas que unen deals deciden sobre el deal anulado", () => {
  const raiz = process.cwd();
  const cualquiera = [...archivos(join(raiz, "lib/queries")), ...archivos(join(raiz, "lib/calendly"))]
    .map((ruta) => ({ ruta: ruta.slice(raiz.length + 1), fuente: readFileSync(ruta, "utf8") }))
    .filter(({ fuente }) => /eq\(deals\.id,\s*calls\.dealId\)/.test(fuente));

  it("cada archivo aplica el predicado, usa un filtro que lo contiene o está nombrado como excepción", () => {
    const sinDecidir = cualquiera.filter(({ ruta, fuente }) =>
      !fuente.includes("llamadaSinDealAnulado") && !APLICAN_EL_PREDICADO_POR_SU_FILTRO.includes(ruta) && !EXCEPCIONES.has(ruta)
      && !ruta.endsWith("llamada-sin-deal-anulado.ts"));
    expect(sinDecidir.map((f) => f.ruta)).toEqual([]);
  });

  it("los archivos que dicen aplicarlo por su filtro de verdad llaman a filtroLlamadas o a filtroAgendasCreadas", () => {
    for (const ruta of APLICAN_EL_PREDICADO_POR_SU_FILTRO) {
      const fuente = readFileSync(join(raiz, ruta), "utf8");
      expect(/filtroLlamadas\(|filtroAgendasCreadas\(/.test(fuente), ruta).toBe(true);
    }
  });

  it("mordido: el filtro compartido sí contiene el predicado", () => {
    const filtros = readFileSync(join(raiz, "lib/queries/metricas-filtros.ts"), "utf8");
    expect(filtros.match(/llamadaSinDealAnulado\(db\)/g)?.length).toBeGreaterThanOrEqual(2);
  });
});
