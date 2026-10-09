import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import {
  changeLog,
  deals,
  leads,
  miembrosPrograma,
  programs,
  sources,
  users,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { ingerirEntradas } from "@/lib/ingesta/ingerir";
import type { EntradaEnvio } from "@/lib/ingesta/envio";
import { marcarSetterPorDefecto } from "@/lib/deals/setter-por-defecto";
import { reclamarDealsPorSettear } from "@/lib/deals/reclamar";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let sourceId: string;
let secuencia = 0;

function entrada(
  correo: string,
  opciones: { agenda?: boolean; parcial?: boolean; calidad?: string | null } = {},
): EntradaEnvio {
  return {
    sourceId,
    zona: "UTC",
    posicion: null,
    esParcial: opciones.parcial ?? false,
    leadQuality: opciones.calidad ?? null,
    columnas: {
      Token: `setter-${++secuencia}`,
      Correo: correo,
      "Submitted At": "2026-10-09T15:00:00Z",
      Estado: opciones.agenda ? "con_calendly" : "",
    },
    campos: {
      token: "Token",
      correo: "Correo",
      fechaEnvio: "Submitted At",
      estadoHoja: "Estado",
    },
  };
}

async function usuario(email: string, rol: "gerente" | "closer" | "developer" = "closer") {
  return (await db.insert(users).values({ email, rol }).returning())[0];
}

async function dealDe(correo: string) {
  const [fila] = await db
    .select({ deal: deals })
    .from(deals)
    .innerJoin(leads, eq(leads.id, deals.leadId))
    .where(and(eq(leads.programId, programId), eq(leads.emailNormalizado, correo)));
  return fila.deal;
}

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: `setter-${++secuencia}`, nombre: "Programa Setter", ticketUsd: "797" })
    .returning();
  programId = programa.id;
  sourceId = (await db.insert(sources).values({ programId, nombre: "Formulario", tipo: "google_sheet" }).returning())[0].id;
});

afterEach(async () => cerrar());

describe("setter por defecto al abrir deals del sistema", () => {
  it("un envío sin agenda nace con owner y setter_user_id del setter por defecto", async () => {
    const setter = await usuario("setter@retia.test");
    await db.insert(miembrosPrograma).values({
      userId: setter.id,
      programId,
      setterPorDefecto: true,
    });

    await ingerirEntradas(db, programId, [entrada("sin-agenda@lead.test", { calidad: "High" })], {
      aplicarReglaDeDeals: true,
    });

    expect(await dealDe("sin-agenda@lead.test")).toMatchObject({
      etapa: "calificado",
      ownerUserId: setter.id,
      setterUserId: setter.id,
    });
  });

  it("sin setter configurado el deal sigue naciendo sin dueño", async () => {
    await ingerirEntradas(db, programId, [entrada("sin-setter@lead.test", { parcial: true })], {
      aplicarReglaDeDeals: true,
    });
    expect(await dealDe("sin-setter@lead.test")).toMatchObject({ ownerUserId: null, setterUserId: null });
  });

  it("con agenda manda la host de Calendly y no el setter", async () => {
    const setter = await usuario("setter-agenda@retia.test");
    const host = await usuario("host@retia.test");
    await db.insert(miembrosPrograma).values([
      { userId: setter.id, programId, setterPorDefecto: true },
      { userId: host.id, programId, calendlyEmail: "host@calendly.test" },
    ]);

    await ingerirEntradas(db, programId, [entrada("con-agenda@lead.test", { agenda: true, calidad: "High" })], {
      aplicarReglaDeDeals: true,
      citasPorCorreo: new Map([["con-agenda@lead.test", {
        estado: "vigente" as const,
        inicio: new Date("2026-10-10T15:00:00Z"),
        uuidInvitado: "setter-cita-1",
        correoHost: "host@calendly.test",
      }]]),
    });

    expect(await dealDe("con-agenda@lead.test")).toMatchObject({
      etapa: "agendado",
      ownerUserId: host.id,
      setterUserId: null,
    });
  });

  it("ignora una membresía inactiva marcada como setter", async () => {
    const setter = await usuario("setter-inactivo@retia.test");
    await db.insert(miembrosPrograma).values({
      userId: setter.id,
      programId,
      activo: false,
      setterPorDefecto: true,
    });

    await ingerirEntradas(db, programId, [entrada("setter-inactivo@lead.test", { calidad: "Low" })], {
      aplicarReglaDeDeals: true,
    });
    expect(await dealDe("setter-inactivo@lead.test")).toMatchObject({ ownerUserId: null, setterUserId: null });
  });
});

describe("marcarSetterPorDefecto", () => {
  it("exige administrador, membresía activa y al cambiar deja exactamente uno", async () => {
    const admin = await usuario("admin@retia.test", "gerente");
    const primero = await usuario("primero@retia.test");
    const segundo = await usuario("segundo@retia.test");
    const sinMembresia = await usuario("afuera@retia.test");
    await db.insert(miembrosPrograma).values([
      { userId: primero.id, programId },
      { userId: segundo.id, programId },
    ]);

    await expect(marcarSetterPorDefecto(db, { userId: primero.id, rol: "closer" }, {
      programId,
      userId: primero.id,
    })).rejects.toMatchObject({ status: 403 });
    await expect(marcarSetterPorDefecto(db, { userId: admin.id, rol: "gerente" }, {
      programId,
      userId: sinMembresia.id,
    })).rejects.toMatchObject({ status: 422 });

    await marcarSetterPorDefecto(db, { userId: admin.id, rol: "gerente" }, { programId, userId: primero.id });
    await marcarSetterPorDefecto(db, { userId: admin.id, rol: "gerente" }, { programId, userId: segundo.id });

    const marcadas = await db
      .select({ userId: miembrosPrograma.userId })
      .from(miembrosPrograma)
      .where(and(eq(miembrosPrograma.programId, programId), eq(miembrosPrograma.setterPorDefecto, true)));
    expect(marcadas).toEqual([{ userId: segundo.id }]);
    const rastros = await db.select().from(changeLog).where(eq(changeLog.campo, "setterPorDefecto"));
    expect(rastros).toHaveLength(3);
  });
});

describe("Asignarme todos", () => {
  it("reclama solo los deals sin dueño de Por settear del programa", async () => {
    const closer = await usuario("reclama@retia.test");
    const otroDueno = await usuario("dueno@retia.test");
    await db.insert(miembrosPrograma).values({ userId: closer.id, programId });
    const otroPrograma = (await db
      .insert(programs)
      .values({ ...PROGRAMA_DE_PRUEBA, slug: `otro-${++secuencia}`, nombre: "Otro", ticketUsd: "797" })
      .returning())[0];

    async function crear(programa: string, correo: string, etapa: "potencial" | "registrado" | "agendado", ownerUserId: string | null = null) {
      const lead = (await db.insert(leads).values({ programId: programa, emailNormalizado: correo }).returning())[0];
      return (await db.insert(deals).values({ programId: programa, leadId: lead.id, etapa, ownerUserId }).returning())[0];
    }
    const reclamableA = await crear(programId, "a@lead.test", "potencial");
    const reclamableB = await crear(programId, "b@lead.test", "registrado");
    const yaAsignado = await crear(programId, "c@lead.test", "registrado", otroDueno.id);
    const agendado = await crear(programId, "d@lead.test", "agendado");
    const ajeno = await crear(otroPrograma.id, "e@lead.test", "potencial");

    expect(await reclamarDealsPorSettear(db, { userId: closer.id, rol: "closer" }, programId)).toBe(2);

    const filas = await db.select({ id: deals.id, ownerUserId: deals.ownerUserId }).from(deals);
    const porId = new Map(filas.map((fila) => [fila.id, fila.ownerUserId]));
    expect(porId.get(reclamableA.id)).toBe(closer.id);
    expect(porId.get(reclamableB.id)).toBe(closer.id);
    expect(porId.get(yaAsignado.id)).toBe(otroDueno.id);
    expect(porId.get(agendado.id)).toBeNull();
    expect(porId.get(ajeno.id)).toBeNull();
    const rastros = await db.select().from(changeLog).where(eq(changeLog.campo, "ownerUserId"));
    expect(rastros.filter((fila) => fila.userId === closer.id)).toHaveLength(2);
  });
});
