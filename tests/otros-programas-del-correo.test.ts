import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import path from "node:path";
import { deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { otrosProgramasDelCorreo } from "@/lib/queries/otros-programas-del-correo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * Ticket 091 (ADR 0043 punto 6): la unica visibilidad cruzada de un lead. Se prueba el hecho
 * (que otro programa tiene el correo y en que etapa esta su deal) y, sobre todo, la regla: la
 * llama SOLO la ficha del Lead. Ninguna metrica, ningun modulo del dashboard.
 */

describe("otrosProgramasDelCorreo (PGlite)", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let a: string;
  let b: string;
  let c: string;
  let closer: string;

  beforeEach(async () => {
    ({ db, cerrar } = await crearBaseDePrueba());
    const programa = (slug: string) => ({ ...PROGRAMA_DE_PRUEBA, slug, nombre: slug.toUpperCase(), ticketUsd: "1000" });
    [{ id: a }, { id: b }, { id: c }] = await db.insert(programs).values([programa("a"), programa("b"), programa("c")]).returning();
    const [u] = await db.insert(users).values({ email: "maru@retia.co", rol: "closer", closerId: "Maru" }).returning();
    closer = u.id;
  }, 60_000);

  afterEach(async () => {
    await cerrar();
  });

  it("un correo que solo esta en su programa no avisa nada", async () => {
    await db.insert(leads).values({ programId: a, emailNormalizado: "solo@correo.co" });
    expect(await otrosProgramasDelCorreo(db, "solo@correo.co", a)).toEqual([]);
  });

  it("dice en que otros programas esta, con la etapa del deal abierto (o del ultimo)", async () => {
    await db.insert(leads).values({ programId: a, emailNormalizado: "ana@correo.co" });
    const [lb] = await db.insert(leads).values({ programId: b, emailNormalizado: "ana@correo.co" }).returning();
    const [lc] = await db.insert(leads).values({ programId: c, emailNormalizado: "ana@correo.co" }).returning();
    await db.insert(deals).values([
      { leadId: lb.id, programId: b, etapa: "cierre_perdido", createdAt: new Date("2026-09-01T00:00:00Z") },
      { leadId: lb.id, programId: b, etapa: "agendado", createdAt: new Date("2026-08-01T00:00:00Z") },
      // Un deal anulado no es un estado del negocio: no se avisa con su etapa.
      {
        leadId: lc.id, programId: c, etapa: "calificado",
        anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "lead equivocado",
      },
    ]);

    const otros = await otrosProgramasDelCorreo(db, "ana@correo.co", a);
    expect(otros).toEqual([
      { programId: b, programaNombre: "B", programaSlug: "b", leadId: lb.id, deal: { etapa: "agendado", cerrado: false } },
      { programId: c, programaNombre: "C", programaSlug: "c", leadId: lc.id, deal: null },
    ]);
  });

  it("no une ni fusiona: los dos leads siguen siendo dos", async () => {
    await db.insert(leads).values({ programId: a, emailNormalizado: "dos@correo.co" });
    await db.insert(leads).values({ programId: b, emailNormalizado: "dos@correo.co" });
    await otrosProgramasDelCorreo(db, "dos@correo.co", a);
    expect(await db.select().from(leads)).toHaveLength(2);
  });
});

// ─────────────────────────────────────────────────────────── el guardián

/**
 * Los UNICOS archivos que pueden nombrar la funcion: su definicion y la ficha del Lead. Una
 * metrica (o el dashboard) que la importe podria sumar dos programas, que es justo lo que el
 * ADR 0043 prohibe; el aviso es de pantalla, no de numero.
 */
const PERMITIDOS = new Set([
  path.join("lib", "queries", "otros-programas-del-correo.ts"),
  path.join("app", "(app)", "p", "[programa]", "leads", "[id]", "page.tsx"),
  // Solo importa el TIPO para pintar el aviso; no puede llamar a la funcion.
  path.join("components", "leads", "ficha-lead.tsx"),
]);

export function usaOtrosProgramas(codigo: string): boolean {
  const limpio = codigo.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/.*$/gm, "");
  return /\botrosProgramasDelCorreo\b|otros-programas-del-correo/.test(limpio);
}

describe("guardián: otrosProgramasDelCorreo solo la usa la ficha del Lead (091)", () => {
  const RAIZ = fileURLToPath(new URL("../", import.meta.url));
  const DIRECTORIOS = ["lib", "app", "components", "scripts"];

  function archivos(dir: string): string[] {
    const abs = path.join(RAIZ, dir);
    if (!fs.existsSync(abs)) return [];
    return fs.readdirSync(abs, { withFileTypes: true }).flatMap((e) => {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) return archivos(rel);
      return /\.tsx?$/.test(e.name) ? [rel] : [];
    });
  }

  it("ningun otro modulo la nombra (ni dashboard.ts ni una consulta de metrica)", () => {
    const hallazgos = DIRECTORIOS.flatMap(archivos).filter(
      (rel) => !PERMITIDOS.has(rel) && usaOtrosProgramas(fs.readFileSync(path.join(RAIZ, rel), "utf8")),
    );
    expect(hallazgos).toEqual([]);
  });

  it("los modulos de metricas existen y no la nombran", () => {
    for (const rel of ["lib/queries/dashboard.ts", "lib/queries/metricas-filtros.ts", "lib/queries/metricas-con-filas.ts"]) {
      const codigo = fs.readFileSync(path.join(RAIZ, rel), "utf8");
      expect(usaOtrosProgramas(codigo), rel).toBe(false);
    }
  });

  it("el detector muerde la llamada y el import, y no castiga un comentario", () => {
    expect(usaOtrosProgramas("const x = await otrosProgramasDelCorreo(db, e, p);")).toBe(true);
    expect(usaOtrosProgramas('import { y } from "@/lib/queries/otros-programas-del-correo";')).toBe(true);
    expect(usaOtrosProgramas("// otrosProgramasDelCorreo no se usa aqui")).toBe(false);
    expect(usaOtrosProgramas("const otrosProgramas = 1;")).toBe(false);
  });
});
