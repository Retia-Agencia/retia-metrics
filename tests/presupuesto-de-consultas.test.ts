import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { leads, programs, sources } from "@/lib/db/schema";
import { medir, type ResumenDeCosto } from "@/lib/db/medidor";
import type { Db } from "@/lib/db/tipos";
import { alertasDelPrograma } from "@/lib/queries/alertas";
import { dineroDelRango, type Rango } from "@/lib/queries/dashboard";
import { cargarEmbudoComercial } from "@/lib/queries/embudo-comercial";
import {
  conteosPorOrigen,
  conteosPorPrograma,
  fuentesConSalud,
  usuariosActivosPorRol,
} from "@/lib/queries/nerd-stats";
import { origenDelPrograma } from "@/lib/queries/origen";
import { cargarRoasDePauta } from "@/lib/queries/roas-de-pauta";
import { leerSeriesDeDinero } from "@/lib/queries/series-dinero";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const HOY = "2026-11-15";
const AHORA = new Date("2026-11-15T12:00:00-05:00");
const RANGO: Rango = { desde: "2026-11-01", hasta: HOY };

interface Sembrado {
  programaId: string;
}

interface Presupuesto {
  tope: number;
  identicas: number;
  llamar: (db: Db, sembrado: Sembrado) => Promise<unknown>;
}

// Funciones de datos del Hub elegidas desde app/(app)/p/[programa]/hub/page.tsx:
// alertasDelPrograma, dineroDelRango, cargarEmbudoComercial, leerSeriesDeDinero,
// origenDelPrograma y cargarRoasDePauta. Todas aceptan una base inyectada y solo
// necesitan programa y/o periodo; así el presupuesto no depende de sembrar deals,
// cohortes, pauta o configuración completa de una pantalla.
const PRESUPUESTOS = {
  "nerd-stats/conteos-por-programa": {
    tope: 6,
    identicas: 0,
    llamar: (db) => conteosPorPrograma(db),
  },
  "nerd-stats/conteos-por-origen": {
    tope: 1,
    identicas: 0,
    llamar: (db) => conteosPorOrigen(db),
  },
  "nerd-stats/usuarios-activos-por-rol": {
    tope: 1,
    identicas: 0,
    llamar: (db) => usuariosActivosPorRol(db),
  },
  "nerd-stats/fuentes-con-salud": {
    tope: 8,
    identicas: 0,
    llamar: (db) => fuentesConSalud(db, AHORA),
  },
  "hub/alertas-del-programa": {
    tope: 1,
    identicas: 0,
    llamar: (db, s) => alertasDelPrograma(s.programaId, HOY, db),
  },
  "hub/dinero-del-rango": {
    tope: 1,
    identicas: 0,
    llamar: (db, s) => dineroDelRango({ programId: s.programaId, rango: RANGO, claveCloser: null, cohorteId: null }, db),
  },
  "hub/embudo-comercial": {
    tope: 6,
    identicas: 0,
    llamar: (db, s) => cargarEmbudoComercial(db, { programId: s.programaId, rango: RANGO, claveCloser: null, cohorteId: null }),
  },
  "hub/series-de-dinero": {
    tope: 6,
    identicas: 0,
    llamar: (db, s) => leerSeriesDeDinero({
      programId: s.programaId,
      a: { rango: RANGO, cohorteId: null },
      b: null,
      claveCloser: null,
      hoy: HOY,
    }, db),
  },
  "hub/origen-del-programa": {
    tope: 7,
    identicas: 0,
    llamar: (db, s) => origenDelPrograma(db, { programId: s.programaId, rango: RANGO, hoy: HOY }),
  },
  "hub/roas-de-pauta": {
    tope: 16,
    identicas: 4,
    llamar: (db, s) => cargarRoasDePauta(db, s.programaId, RANGO, HOY, AHORA),
  },
} satisfies Record<string, Presupuesto>;

let base: Awaited<ReturnType<typeof crearBaseReutilizable>>;

async function sembrar(db: Db, cantidadDeProgramas: number): Promise<Sembrado> {
  const programasInsertados = await db.insert(programs).values(
    Array.from({ length: cantidadDeProgramas }, (_, indice) => ({
      ...PROGRAMA_DE_PRUEBA,
      slug: `presupuesto-${indice + 1}`,
      nombre: `Presupuesto ${indice + 1}`,
      ticketUsd: "1000.00",
    })),
  ).returning();
  const programasSembrados = programasInsertados.map(({ id, slug }) => ({ id, slug }));

  await db.insert(sources).values(programasSembrados.flatMap((programa, programaIndice) =>
    Array.from({ length: 3 }, (_, fuenteIndice) => ({
      programId: programa.id,
      nombre: `Fuente ${programaIndice + 1}-${fuenteIndice + 1}`,
    })),
  ));

  await db.insert(leads).values(programasSembrados.flatMap((programa, programaIndice) =>
    Array.from({ length: 2 }, (_, leadIndice) => ({
      programId: programa.id,
      emailNormalizado: `persona-${programaIndice + 1}-${leadIndice + 1}@presupuesto.test`,
      fechaPrimeraAplicacion: new Date(`2026-11-0${leadIndice + 1}T12:00:00-05:00`),
    })),
  ));

  return {
    programaId: programasSembrados[0]!.id,
  };
}

async function medirConProgramas(nombre: string, presupuesto: Presupuesto, cantidad: number): Promise<ResumenDeCosto> {
  await base.vaciar();
  const sembrado = await sembrar(base.db, cantidad);
  return (await medir(nombre, () => presupuesto.llamar(base.db, sembrado))).costo;
}

describe("presupuesto de consultas", () => {
  beforeAll(async () => {
    base = await crearBaseReutilizable();
  });

  beforeEach(async () => {
    await base.vaciar();
  });

  afterAll(async () => {
    await base.cerrar();
  });

  it.each(Object.entries(PRESUPUESTOS))("%s respeta el trinquete con 3 y 6 programas", async (nombre, presupuesto) => {
    const conTres = await medirConProgramas(nombre, presupuesto, 3);
    const conSeis = await medirConProgramas(nombre, presupuesto, 6);

    expect(conTres.consultas).toBeLessThanOrEqual(presupuesto.tope);
    expect(conTres.identicas).toBeLessThanOrEqual(presupuesto.identicas);
    expect(conSeis.identicas).toBeLessThanOrEqual(presupuesto.identicas);
    expect(conSeis.consultas).toBeLessThanOrEqual(conTres.consultas);
  });
});
