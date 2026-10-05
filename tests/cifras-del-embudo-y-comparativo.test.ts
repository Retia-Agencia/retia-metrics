import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { abonos, calls, deals, dealEtapaHistorial, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { embudoPorCloser } from "@/lib/queries/dashboard";
import { embudoPorEtapas } from "@/lib/queries/embudo-etapas";
import { TAMANO_PAGINA, type Metrica } from "@/lib/queries/metricas-con-filas";
import {
  claveDeAbiertos,
  codigoDeCloser,
  detallesDelComparativo,
  detallesDelEmbudo,
  vistaDeLista,
  type DetalleDeCifra,
} from "@/lib/queries/vista-metrica";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 188: cada cifra del embudo por etapas y cada celda del comparativo abre su lista, y la
 * lista tiene exactamente las filas que dice la cifra, recorriendo TODAS sus páginas. En la base
 * hay anulados y otro programa: ninguno puede colarse.
 */

let db: Db;
let cerrar: () => Promise<void>;
let programaA: string;
let programaB: string;
let ana: string;
let lucia: string;
let ajena: string;
const rango = { desde: "2026-09-01", hasta: "2026-09-30" };
const hoy = "2026-10-02";
const ahora = new Date("2026-10-02T12:00:00-05:00");
const periodo = { preset: "custom" as const, a: rango, b: null };
const anulados = new Set<string>();
const delOtroPrograma = new Set<string>();

const instante = (dia: string, hora = "10:00") => new Date(`${dia}T${hora}:00-05:00`);

beforeAll(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  [programaA, programaB] = (await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "e188-a", nombre: "A" },
    { ...PROGRAMA_DE_PRUEBA, ticketUsd: "100", slug: "e188-b", nombre: "B" },
  ]).returning()).map((p) => p.id);
  // Lucía no tiene `closer_id`: se lee por su nombre en el comparativo Y en sus listas.
  [ana, lucia, ajena] = (await db.insert(users).values([
    { email: "ana@e188.test", rol: "closer", closerId: "Ana" },
    { email: "lucia@e188.test", rol: "closer", closerId: null, nombre: "Lucía" },
    { email: "ajena@e188.test", rol: "closer", closerId: "Ajena" },
  ]).returning()).map((u) => u.id);

  // 60 deals en A (más de una página), repartidos entre Ana, Lucía y sin dueño, que avanzan por
  // el embudo hasta distintos pasos; uno anulado. 5 en B, de la closer ajena.
  const recorridos = [
    ["en_gestion"],
    ["en_gestion", "contactado"],
    ["en_gestion", "contactado", "calificado", "agendado"],
    ["en_gestion", "contactado", "calificado", "agendado", "atendido", "ganado_parcial"],
  ] as const;
  const crear = async (programId: string, i: number, owner: string | null, anulado: boolean) => {
    const recorrido = recorridos[i % recorridos.length];
    const dia = `2026-09-${String(1 + (i % 28)).padStart(2, "0")}`;
    const [lead] = await db.insert(leads).values({ programId, emailNormalizado: `l${i}-${programId}@e188.test` }).returning();
    const [deal] = await db.insert(deals).values({
      programId,
      leadId: lead.id,
      ownerUserId: owner,
      etapa: recorrido[recorrido.length - 1],
      createdAt: instante(dia),
      anuladoEn: anulado ? ahora : null,
      anuladoPor: anulado ? ana : null,
      motivoAnulacion: anulado ? "Prueba" : null,
    }).returning();
    await db.insert(dealEtapaHistorial).values(recorrido.map((etapa, paso) => ({
      dealId: deal.id,
      de: paso === 0 ? null : recorrido[paso - 1],
      a: etapa,
      fecha: instante(dia, `1${paso}:00`),
    })));
    if (anulado) anulados.add(deal.id);
    if (programId === programaB) delOtroPrograma.add(deal.id);
    return deal.id;
  };
  const dealsDeA: { id: string; owner: string | null }[] = [];
  for (let i = 0; i < 60; i += 1) {
    const owner = [ana, lucia, null][i % 3];
    dealsDeA.push({ id: await crear(programaA, i, owner, i === 7), owner });
  }
  for (let i = 0; i < 5; i += 1) await crear(programaB, 100 + i, ajena, false);

  // Llamadas y abonos para el comparativo. Una llamada histórica de Ana va SIN FK, solo con su
  // texto: el comparativo la junta bajo su cuenta y su lista tiene que traerla.
  const conDueno = dealsDeA.filter((d) => d.owner !== null && !anulados.has(d.id)).slice(0, 12);
  for (const [n, d] of conDueno.entries()) {
    const sinFk = n === 0;
    await db.insert(calls).values({
      programId: programaA,
      dealId: d.id,
      closerUserId: sinFk ? null : d.owner,
      closerId: sinFk ? "  ana " : null,
      fechaAgenda: instante(`2026-09-${String(10 + n).padStart(2, "0")}`),
      resultado: n % 3 === 0 ? "no_show" : "show",
    });
    if (n % 2 === 0) {
      await db.insert(abonos).values({
        programId: programaA, dealId: d.id, registradoPorUserId: d.owner, fecha: `2026-09-${String(10 + n).padStart(2, "0")}`,
        monto: "100", moneda: "USD",
      });
    }
  }
}, 120_000);
afterAll(async () => cerrar());

/** Recorre TODAS las páginas de la lista que abre un detalle, por la URL, como el navegador. */
async function todasLasPaginas(detalle: DetalleDeCifra, programId = programaA) {
  const busqueda = Object.fromEntries(new URL(detalle.href, "https://e188.test").searchParams);
  const filas = [];
  for (let pagina = 1; ; pagina += 1) {
    const vista = await vistaDeLista({
      programId,
      metrica: busqueda.metrica as Metrica,
      busqueda,
      hoy,
      codigoCloser: busqueda.closer,
      etapa: busqueda.etapa,
      antiguedad: busqueda.antiguedad,
      pagina,
      ahora,
    }, db);
    if (!vista) return null;
    filas.push(...vista.lista.filas);
    expect(vista.lista.subtotal.cantidad).toBe(detalle.resumen.subtotal.cantidad);
    if (pagina * TAMANO_PAGINA >= vista.lista.subtotal.cantidad) break;
  }
  return filas;
}

describe("ticket 188: el embudo por etapas abre su lista", () => {
  it("cada cifra es su resumen y todas las páginas de su lista, sin anulados ni otro programa", async () => {
    const embudo = await embudoPorEtapas(db, { programId: programaA, rango }, ahora);
    const detalles = await detallesDelEmbudo({ programId: programaA, slug: "e188-a", hoy, periodo }, db, ahora);

    const casos: [string, number, DetalleDeCifra][] = [
      ["entraron", embudo.conversion.todas.entraron, detalles.entraron],
      ...embudo.conversion.todas.pasos.map((p) => [`paso ${p.paso}`, p.llegaron, detalles.pasos[p.paso]] as [string, number, DetalleDeCifra]),
      ...embudo.tiempoEnEtapa.map((t) => [`tiempo ${t.etapa}`, t.deals, detalles.tiempo[t.etapa]] as [string, number, DetalleDeCifra]),
      ...embudo.abiertos.map((a) => [`abiertos ${a.etapa}/${a.ownerNombre}`, a.deals, detalles.abiertos[claveDeAbiertos(a.etapa, a.ownerUserId)]] as [string, number, DetalleDeCifra]),
      ...embudo.sinDuenoPorAntiguedad.map((s) => [`sin dueño ${s.bucket}`, s.deals, detalles.sinDueno[s.bucket]] as [string, number, DetalleDeCifra]),
    ];
    // La prueba no es trivial: hay cifras en varias páginas y en cada familia.
    expect(embudo.conversion.todas.entraron).toBeGreaterThan(TAMANO_PAGINA);
    expect(embudo.abiertos.some((a) => a.ownerUserId === null)).toBe(true);
    expect(embudo.sinDuenoPorAntiguedad.some((s) => s.deals > 0)).toBe(true);

    for (const [nombre, cifra, detalle] of casos) {
      expect(detalle.resumen.subtotal.cantidad, nombre).toBe(cifra);
      const filas = await todasLasPaginas(detalle);
      expect(filas, nombre).not.toBeNull();
      expect(filas!.length, nombre).toBe(cifra);
      expect(new Set(filas!.map((f) => f.dealId)).size, nombre).toBe(cifra);
      expect(filas!.some((f) => anulados.has(f.dealId!) || delOtroPrograma.has(f.dealId!)), nombre).toBe(false);
    }
    // El tramo de "sin dueño" y la antigüedad de su lista miden lo mismo: días de calendario de Bogotá.
    for (const s of embudo.sinDuenoPorAntiguedad.filter((s) => s.deals > 0)) {
      expect(detalles.sinDueno[s.bucket].desgloses.porAntiguedad.map((l) => l.etiqueta)).toEqual([s.bucket]);
    }
  });

  it("la celda de abiertos por owner trae solo los deals de ese dueño", async () => {
    const embudo = await embudoPorEtapas(db, { programId: programaA, rango }, ahora);
    const detalles = await detallesDelEmbudo({ programId: programaA, slug: "e188-a", hoy, periodo }, db, ahora);
    const deLucia = embudo.abiertos.find((a) => a.ownerUserId === lucia)!;
    const filas = await todasLasPaginas(detalles.abiertos[claveDeAbiertos(deLucia.etapa, lucia)]);
    expect(filas!.map((f) => f.dealId).sort()).toEqual([...deLucia.dealIds].sort());
    // Una sola etiqueta de closer (punto 4): la tabla y la lista dicen "Lucía", no "Sin closer".
    expect(deLucia.ownerNombre).toBe("Lucía");
    expect(new Set(filas!.map((f) => f.closer))).toEqual(new Set(["Lucía"]));
  });

  it("una lista del embudo con un paso inventado no trae el embudo entero", async () => {
    const vista = await vistaDeLista({
      programId: programaA, metrica: "etapa_paso", etapa: "no_existe", hoy, pagina: 1,
      busqueda: { periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta },
    }, db);
    expect(vista?.lista.subtotal.cantidad).toBe(0);
  });
});

describe("ticket 188: cada celda del comparativo abre la lista de ese closer", () => {
  it("agendas, shows, cierres, caja y los grupos de las tasas cuadran celda por celda", async () => {
    const comparativo = await embudoPorCloser({ programId: programaA, rango }, db, ahora);
    const detalles = await detallesDelComparativo(
      { programId: programaA, slug: "e188-a", hoy, periodo },
      comparativo.map((f) => f.clave),
      db,
      ahora,
    );
    expect(comparativo.length).toBeGreaterThan(1);
    for (const fila of comparativo) {
      const celdas = detalles[fila.clave];
      const esperado: [keyof typeof celdas, number][] = [
        ["agendas", fila.agendas],
        ["shows", fila.llamadasConShow],
        ["cierres", fila.cierres],
        ["grupo_citas", fila.grupo.deals],
        ["grupo_shows", fila.grupo.conShow],
      ];
      for (const [celda, cifra] of esperado) {
        expect(celdas[celda].resumen.subtotal.cantidad, `${fila.closerId} ${celda}`).toBe(cifra);
        if (cifra === 0) continue;
        const filas = await todasLasPaginas(celdas[celda]);
        expect(filas?.length, `${fila.closerId} ${celda}`).toBe(cifra);
      }
      expect(celdas.caja.resumen.subtotal.caja).toEqual(fila.caja);
      // El código opaco de la celda es el de la clave de esa fila, nunca su texto ni su id.
      const href = celdas.agendas.href;
      expect(new URL(href, "https://e188.test").searchParams.get("closer")).toBe(codigoDeCloser(fila.clave));
      expect(href).not.toContain(fila.clave);
    }
  });

  it("la agenda histórica sin FK de Ana se cuenta y se lista bajo su cuenta", async () => {
    const comparativo = await embudoPorCloser({ programId: programaA, rango }, db, ahora);
    const deAna = comparativo.find((f) => f.clave === ana)!;
    const detalles = await detallesDelComparativo({ programId: programaA, slug: "e188-a", hoy, periodo }, [ana], db, ahora);
    const filas = await todasLasPaginas(detalles[ana].agendas);
    expect(filas?.length).toBe(deAna.agendas);
    expect(filas?.some((f) => f.claveCloser.startsWith("historico:"))).toBe(true);
  });

  it("forjar el código de una closer de otro programa da lista vacía o 404, nunca filas ajenas", async () => {
    for (const metrica of ["agendas", "cierres", "caja", "etapa_abiertos"] as const) {
      const vista = await vistaDeLista({
        programId: programaA,
        metrica,
        etapa: metrica === "etapa_abiertos" ? "en_gestion" : undefined,
        busqueda: { periodo: "custom", a_desde: rango.desde, a_hasta: rango.hasta },
        hoy,
        codigoCloser: codigoDeCloser(ajena),
        pagina: 1,
      }, db);
      expect(vista === null || vista.lista.subtotal.cantidad === 0, metrica).toBe(true);
      expect(vista?.lista.filas.some((f) => delOtroPrograma.has(f.dealId ?? "")) ?? false).toBe(false);
    }
  });
});
