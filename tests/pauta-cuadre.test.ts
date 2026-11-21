import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  cuadresPauta,
  cuentasPublicitarias,
  gastoPauta,
  pautaObjetos,
  programs,
} from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { cuadrarPauta } from "@/lib/pauta/cuadre";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";

const TOKEN = "token-cuadre";

describe("cuadre diario de pauta", () => {
  let db: Db;
  let cerrar: () => Promise<void>;
  let vaciar: () => Promise<void>;
  let programId: string;

  beforeAll(async () => {
    ({ db, cerrar, vaciar } = await crearBaseReutilizable());
  });

  beforeEach(async () => {
    await vaciar();
    const [programa] = await db.insert(programs).values({
      ...PROGRAMA_DE_PRUEBA,
      slug: "cuadre-pauta",
      nombre: "Cuadre pauta",
    }).returning();
    programId = programa.id;
  });

  afterAll(async () => cerrar());

  it("guarda todos los días, toma como cero el ausente en Meta y aísla una cuenta fallida", async () => {
    const [cuentaOk, cuentaFallida] = await db.insert(cuentasPublicitarias).values([
      { programId, idMeta: "cuenta-ok", nombre: "Cuenta OK", moneda: "COP", zonaHoraria: "America/Bogota" },
      { programId, idMeta: "cuenta-falla", nombre: "Cuenta falla", moneda: "COP", zonaHoraria: "America/Bogota" },
    ]).returning();
    const [anuncio] = await db.insert(pautaObjetos).values({
      cuentaId: cuentaOk.id,
      programId,
      idMeta: "anuncio-cuadre",
      nivel: "anuncio",
      padreIdMeta: "conjunto-cuadre",
      nombre: "Anuncio",
      estado: "ACTIVE",
    }).returning();
    await db.insert(gastoPauta).values({
      programId,
      fecha: "2026-10-09",
      monto: "5",
      moneda: "COP",
      origen: "meta_api",
      pautaObjetoId: anuncio.id,
    });
    const f = vi.fn(async (entrada: string | URL | Request) => {
      const url = new URL(entrada instanceof Request ? entrada.url : String(entrada));
      if (url.pathname.includes(cuentaFallida.idMeta)) {
        return Response.json({ error: { message: "falla simulada" } }, { status: 500 });
      }
      expect(url.searchParams.get("level")).toBe("account");
      expect(url.searchParams.get("time_increment")).toBe("1");
      expect(url.searchParams.get("fields")).toBe("spend,date_start");
      return Response.json({ data: [{ date_start: "2026-10-08", spend: "10" }] });
    }) as typeof globalThis.fetch;

    const resumen = await cuadrarPauta(db, {
      tokens: new Map([[programId, TOKEN]]),
      hoy: "2026-10-11",
      f,
    });

    expect(resumen).toMatchObject({ cuentas: 2, dias: 3, descuadres: 2 });
    expect(resumen.errores).toHaveLength(1);
    const filas = await db.select().from(cuadresPauta);
    expect(filas).toHaveLength(3);
    expect(filas.find((fila) => fila.fecha === "2026-10-09")).toMatchObject({
      gastoMeta: "0.00",
      gastoCrm: "5.00",
    });
  });
});
