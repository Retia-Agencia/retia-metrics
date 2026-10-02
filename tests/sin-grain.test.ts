import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { calls, deals, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { moverEtapa } from "@/lib/deals/mover-etapa";
import { pegarGrain } from "@/lib/deals/llamadas";
import { embudoDelRango } from "@/lib/queries/dashboard";
import { esAtendidaSinGrain, showsSinGrain } from "@/lib/queries/sin-grain";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let closer: string;
let leadId: string;
const rango = { desde: "2026-09-01", hasta: "2026-09-30" };

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const programas = await db.insert(programs).values([
    { ...PROGRAMA_DE_PRUEBA, slug: "p", nombre: "P", ticketUsd: "1000" },
    { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1000" },
  ]).returning();
  [programId, otroProgramId] = programas.map((p) => p.id);
  [closer] = (await db.insert(users).values({ email: "closer@example.test", rol: "closer" }).returning()).map((u) => u.id);
  [leadId] = (await db.insert(leads).values({ programId, emailNormalizado: "ana@example.test" }).returning()).map((l) => l.id);
});

afterEach(async () => cerrar());

async function crearCall(datos: Partial<typeof calls.$inferInsert> = {}) {
  const [call] = await db.insert(calls).values({
    programId,
    fechaAgenda: new Date("2026-09-15T10:00:00-05:00"),
    resultado: "show",
    origen: "app",
    ...datos,
  }).returning();
  return call;
}

describe("shows sin Grain", () => {
  it("cuenta el movimiento manual y deja de contarlo al pegar Grain", async () => {
    const [deal] = await db.insert(deals).values({ programId, leadId, ownerUserId: closer, etapa: "agendado" }).returning();
    const call = await crearCall({ dealId: deal.id, resultado: "agendada", emailLead: "ana@example.test" });

    await moverEtapa(db, { dealId: deal.id, a: "atendido", actor: { tipo: "usuario", userId: closer, rol: "closer" } });
    expect(await showsSinGrain({ programId, rango }, db)).toEqual({ sinGrain: 1, shows: 1, pct: 1 });

    await pegarGrain(db, { userId: closer, rol: "closer" }, { callId: call.id, linkGrain: "https://grain.com/share/uno" });
    expect(await showsSinGrain({ programId, rango }, db)).toEqual({ sinGrain: 0, shows: 1, pct: 0 });
  });

  it("incluye todo resultado ocurrido sin enlace o con enlace en blanco y excluye anuladas y otro programa", async () => {
    const filas = await Promise.all([
      crearCall({ resultado: "show", linkGrain: null }),
      crearCall({ resultado: "perdida", linkGrain: "   " }),
      crearCall({ resultado: "show", linkGrain: "https://grain.com/ok" }),
      crearCall({ resultado: "agendada", linkGrain: null }),
      crearCall({ resultado: "show", linkGrain: null, anuladoEn: new Date("2026-09-16T10:00:00-05:00"), anuladoPor: closer, motivoAnulacion: "error" }),
      crearCall({ programId: otroProgramId, resultado: "show", linkGrain: null }),
    ]);

    const conteo = await showsSinGrain({ programId, rango }, db);
    expect(conteo).toEqual({ sinGrain: 2, shows: 3, pct: 2 / 3 });
    expect(conteo.shows).toBe((await embudoDelRango({ programId, rango }, db)).llamadasConShow);
    expect(filas.map(esAtendidaSinGrain)).toEqual([true, true, false, false, false, true]);
  });
});
