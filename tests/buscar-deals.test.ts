import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { deals, leadContactos, leads, programs, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ColumnaKanban, TarjetaDeal } from "@/lib/queries/kanban";
import { buscarDealsDelPrograma } from "@/lib/queries/kanban";
import { columnasVisibles } from "@/components/deals/columnas-visibles";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let programId: string;
let otroProgramId: string;
let actorId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [programa, otroPrograma] = await db
    .insert(programs)
    .values([
      { ...PROGRAMA_DE_PRUEBA, slug: "principal", nombre: "Principal", ticketUsd: "1000" },
      { ...PROGRAMA_DE_PRUEBA, slug: "otro", nombre: "Otro", ticketUsd: "1500" },
    ])
    .returning();
  programId = programa.id;
  otroProgramId = otroPrograma.id;
  const [actor] = await db
    .insert(users)
    .values({ email: "gerente@retia.co", rol: "gerente", nombre: "Gerente" })
    .returning();
  actorId = actor.id;
});

afterEach(async () => {
  await cerrar();
});

async function crearDeal({
  programa = programId,
  nombre,
  email,
  telefono = null,
  anulado = false,
}: {
  programa?: string;
  nombre: string;
  email: string;
  telefono?: string | null;
  anulado?: boolean;
}) {
  const [lead] = await db
    .insert(leads)
    .values({ programId: programa, nombre, emailNormalizado: email, telefono })
    .returning();
  const [deal] = await db
    .insert(deals)
    .values({
      programId: programa,
      leadId: lead.id,
      etapa: "contactado",
      ...(anulado
        ? { anuladoEn: new Date(), anuladoPor: actorId, motivoAnulacion: "Error de digitación" }
        : {}),
    })
    .returning();
  return { deal, lead };
}

describe("buscarDealsDelPrograma", () => {
  it("encuentra por parte del nombre", async () => {
    const { deal } = await crearDeal({ nombre: "María Fernanda", email: "maria@correo.co" });
    expect(await buscarDealsDelPrograma(db, programId, "Fernan")).toEqual([deal.id]);
  });

  it("encuentra por el correo principal y escapa comodines", async () => {
    const { deal } = await crearDeal({ nombre: "Ana", email: "ana_ventas%real@correo.co" });
    expect(await buscarDealsDelPrograma(db, programId, "_ventas%real")).toEqual([deal.id]);
  });

  it("encuentra por un correo de contacto", async () => {
    const { deal, lead } = await crearDeal({ nombre: "Luis", email: "principal@correo.co" });
    await db.insert(leadContactos).values({
      leadId: lead.id,
      programId,
      tipo: "correo",
      valor: "alterno.luis@empresa.co",
    });
    expect(await buscarDealsDelPrograma(db, programId, "alterno.luis")).toEqual([deal.id]);
  });

  it("encuentra el teléfono principal con o sin +57 y espacios", async () => {
    const { deal } = await crearDeal({
      nombre: "Paula",
      email: "paula@correo.co",
      telefono: "+57 300 123 4567",
    });
    expect(await buscarDealsDelPrograma(db, programId, "+57 300 123")).toEqual([deal.id]);
    expect(await buscarDealsDelPrograma(db, programId, "300123")).toEqual([deal.id]);
  });

  it("encuentra un teléfono de contacto por sus dígitos", async () => {
    const { deal, lead } = await crearDeal({ nombre: "Sofía", email: "sofia@correo.co" });
    await db.insert(leadContactos).values({
      leadId: lead.id,
      programId,
      tipo: "telefono",
      valor: "+57 315 987 6543",
    });
    expect(await buscarDealsDelPrograma(db, programId, "315987")).toEqual([deal.id]);
  });

  it("nunca devuelve un deal de otro programa", async () => {
    await crearDeal({ programa: otroProgramId, nombre: "Nombre Único", email: "otro@correo.co" });
    expect(await buscarDealsDelPrograma(db, programId, "Nombre Único")).toEqual([]);
  });

  it("no devuelve un deal anulado", async () => {
    await crearDeal({ nombre: "Deal Anulado", email: "anulado@correo.co", anulado: true });
    expect(await buscarDealsDelPrograma(db, programId, "Deal Anulado")).toEqual([]);
  });
});

describe("columnasVisibles", () => {
  it("filtra tarjetas y recalcula potencial y confirmado sin inventar confirmado donde no aplica", () => {
    const tarjetaA = { dealId: "a", potencialUsd: 100.15, confirmadoUsd: 20.1 } as TarjetaDeal;
    const tarjetaB = { dealId: "b", potencialUsd: 50.2, confirmadoUsd: 10.2 } as TarjetaDeal;
    const columnas: ColumnaKanban[] = [
      {
        etapa: "ganado_parcial",
        tarjetas: [tarjetaA, tarjetaB],
        potencialUsd: 150.35,
        confirmadoUsd: 30.3,
      },
      {
        etapa: "contactado",
        tarjetas: [tarjetaB],
        potencialUsd: 50.2,
        confirmadoUsd: null,
      },
    ];

    expect(columnasVisibles(columnas, new Set(["b"]))).toEqual([
      { ...columnas[0], tarjetas: [tarjetaB], potencialUsd: 50.2, confirmadoUsd: 10.2 },
      { ...columnas[1], tarjetas: [tarjetaB], potencialUsd: 50.2, confirmadoUsd: null },
    ]);
  });
});
