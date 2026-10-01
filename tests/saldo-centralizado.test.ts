import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { abonos, areas, cohorts, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { registrarAbono } from "@/lib/deals/abonos";
import { saldosDeDeals } from "@/lib/queries/saldo";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

/**
 * ADR 0024: el saldo de un deal tiene UNA definicion, `lib/queries/saldo.ts`. La reja que
 * bloquea un sobrepago y lo que el closer ve tienen que dar la misma cifra; si dos lugares
 * la calcularan por separado, una pantalla y una reja discreparian sobre el mismo numero
 * sin lanzar ningun error. (El modulo y este test salieron con `sales` en el corte 0020 y
 * vuelven con el ticket 060.)
 */

let db: Db;
let cerrar: () => Promise<void>;
let dealId: string;
let closer: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [p] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" }).returning();
  const [c] = await db
    .insert(cohorts)
    .values({ programId: p.id, codigo: "C1", metaCupos: 10, precioUsd: "1000", fechaInicioClases: "2026-10-01", fechaCierreVentas: "2026-09-30" })
    .returning();
  const [area] = await db.insert(areas).values({ nombre: "Referidos" }).returning();
  const [u] = await db.insert(users).values({ email: "maru@retiagrowth.com", rol: "closer", closerId: "Maru" }).returning();
  closer = u.id;
  const [l] = await db.insert(leads).values({ programId: p.id, emailNormalizado: "ana@correo.co" }).returning();
  const [d] = await db
    .insert(deals)
    .values({ leadId: l.id, programId: p.id, cohortId: c.id, etapa: "atendido", ownerUserId: closer, valorVendidoUsd: "797", areaDeclaradaId: area.id })
    .returning();
  dealId = d.id;
});

afterEach(async () => {
  await cerrar();
});

const abono = (monto: string) => ({ dealId, fecha: "2026-09-28", monto, comprobanteUrl: "https://drive.google.com/c" });

describe("la reja del sobrepago y el saldo que ve el closer son la misma cifra", () => {
  it("lo máximo que la reja acepta es exactamente el saldo del módulo; un centavo más se rechaza", async () => {
    await registrarAbono(db, { userId: closer, rol: "closer" }, abono("500"));

    const visto = (await saldosDeDeals(db, [dealId])).get(dealId)!.saldo!;
    expect(visto).toBe(297);

    await expect(registrarAbono(db, { userId: closer, rol: "closer" }, abono((visto + 0.01).toFixed(2)))).rejects.toMatchObject({ status: 422 });
    const r = await registrarAbono(db, { userId: closer, rol: "closer" }, abono(visto.toFixed(2)));
    expect(r.saldo).toBe(0);
    expect((await saldosDeDeals(db, [dealId])).get(dealId)!.saldo).toBe(0);
  });

  it("un abono anulado no cuenta ni para la reja ni para el saldo", async () => {
    const [a] = await db
      .insert(abonos)
      .values({ dealId, programId: (await db.select().from(deals))[0].programId, fecha: "2026-09-01", monto: "900", anuladoEn: new Date(), anuladoPor: closer, motivoAnulacion: "error" })
      .returning();
    expect(a.anuladoEn).not.toBeNull();
    expect((await saldosDeDeals(db, [dealId])).get(dealId)!.saldo).toBe(797);
    expect((await registrarAbono(db, { userId: closer, rol: "closer" }, abono("797"))).etapa).toBe("completo");
  });
});

describe("guardián: nadie suma abonos a mano para decidir un saldo", () => {
  it("lib/deals no contiene sum() sobre abonos: importa saldosDeDeals", () => {
    const dir = path.join(process.cwd(), "lib", "deals");
    for (const f of readdirSync(dir).filter((n) => n.endsWith(".ts"))) {
      const texto = readFileSync(path.join(dir, f), "utf8");
      expect(texto, `${f} suma abonos a mano`).not.toMatch(/sum\(\s*\$\{abonos/);
    }
  });
});
