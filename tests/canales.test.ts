import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { areas as tablaAreas } from "@/lib/db/schema";
import { canales as tablaCanales, changeLog, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { areas } from "@/lib/catalogo/areas";
import { canales } from "@/lib/catalogo/canales";
import { ErrorDeApp } from "@/lib/errors";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";

let db: Db;
let cerrar: () => Promise<void>;
let userId: string;
let areaId: string;

beforeEach(async () => {
  ({ db, cerrar } = await crearBaseDePrueba());
  const [usuario] = await db.insert(users).values({ email: "canales@retia.local", rol: "gerente" }).returning();
  userId = usuario.id;
  areaId = (await areas(db).crear(userId, { nombre: "Paid" })).id;
});

afterEach(async () => cerrar());

const entrada = (utmSource: string | null = "facebook", utmMedium = "cpc") => ({
  nombre: "Meta histórico",
  utmSource: utmSource ?? "",
  utmMedium,
  areaId,
  formato: "meta_historico" as const,
});

describe("catálogo de canales (ticket 101)", () => {
  it("crear normaliza vacíos y escribe change_log", async () => {
    const creado = await canales(db).crear(userId, entrada(null, " paid_social "));
    const log = await db.select().from(changeLog).where(eq(changeLog.registroId, creado.id));
    expect(creado.utmSource).toBeNull();
    expect(creado.utmMedium).toBe("paid_social");
    expect(log.map((fila) => fila.campo).sort()).toEqual([
      "areaId", "formato", "nombre", "utmMedium", "utmSource",
    ].sort());
  });

  it.each([
    ["par con caso y espacios", " FACEBOOK ", " CPC "],
    ["dos comodines del mismo medium", null, " PAID_SOCIAL "],
  ])("rechaza %s como duplicado con 409", async (_caso, source, medium) => {
    const cat = canales(db);
    await cat.crear(userId, entrada(source === null ? null : source.trim().toLowerCase(), medium.trim().toLowerCase()));
    const error = await cat.crear(userId, entrada(source, medium)).catch((e) => e);
    expect(error).toBeInstanceOf(ErrorDeApp);
    expect((error as ErrorDeApp).status).toBe(409);
    expect((error as ErrorDeApp).message).toBe("Ya existe un canal con ese par de source y medium.");
  });

  it("rechaza macros en source y medium", async () => {
    await expect(canales(db).crear(userId, entrada("{{site_source_name}}"))).rejects.toThrow(/macro/i);
    await expect(canales(db).crear(userId, entrada("facebook", "{{medium}}"))).rejects.toThrow(/macro/i);
  });

  it("un área usada por un canal no se borra y reporta una referencia", async () => {
    await canales(db).crear(userId, entrada());
    expect(await areas(db).borrarSiNoSeUso(userId, areaId)).toEqual({ borrado: false, referencias: 1 });
    expect(await db.select().from(tablaAreas).where(eq(tablaAreas.id, areaId))).toHaveLength(1);
    expect(await db.select().from(tablaCanales)).toHaveLength(1);
  });
});
