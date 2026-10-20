import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { programs, sources, users } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { crearFuente } from "@/lib/catalogo/fuentes";
import { embudoPorPregunta, vaciarCacheDeInsights } from "@/lib/queries/embudo-por-pregunta";
import { formIdDeTypeform, leerInsights, type FetchLike } from "@/lib/typeform/insights";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import { sembrarIntegracion } from "./helpers/integracion-de-prueba";

vi.mock("@/lib/sheets/leer", () => ({ leerPestana: vi.fn(async () => []) }));

const TOKEN = "tfp_token-de-prueba";
const URL_FORM = "https://postulacioness.typeform.com/to/GmPGBOf9?utm_source=x";
const SUMMARY = {
  form: { summary: { unique_visits: 10, responses_count: 7, completion_rate: 70 } },
  fields: [{ id: "a", title: "Nombre", type: "short_text", views: 10, dropoffs: 3 }],
};
const fetchQueResponde = (status = 200) => vi.fn<FetchLike>(async () => ({
  ok: status >= 200 && status < 300, status, json: async () => SUMMARY,
}));

describe("Typeform Insights", () => {
  it("extrae el id del formulario y autentica la consulta", async () => {
    expect(formIdDeTypeform(URL_FORM)).toBe("GmPGBOf9");
    const f = fetchQueResponde();
    expect(await leerInsights({ token: TOKEN, formId: "GmPGBOf9", fetch: f })).toMatchObject({ respuestas: 7 });
    expect(f.mock.calls[0][1]?.headers?.Authorization).toBe(`Bearer ${TOKEN}`);
  });

  describe("token por programa", () => {
    let db: Db;
    let cerrar: () => Promise<void>;
    let vaciar: () => Promise<void>;
    let programId: string;
    let actorId: string;

    beforeAll(async () => {
      ({ db, cerrar, vaciar } = await crearBaseReutilizable());
    });
    beforeEach(async () => {
      await vaciar();
      vaciarCacheDeInsights();
      const [actor] = await db.insert(users).values({ email: "typeform@retia.test", rol: "gerente" }).returning();
      actorId = actor.id;
      const [programa] = await db.insert(programs).values({ ...PROGRAMA_DE_PRUEBA, slug: "typeform", nombre: "Typeform", ticketUsd: "1000" }).returning();
      programId = programa.id;
    });
    afterAll(async () => cerrar());

    async function crearFormulario(nombre: string) {
      const fuente = await crearFuente(db, { id: actorId, rol: "gerente" }, {
        programId, nombre, tipo: "webhook", proveedor: "typeform", urlPublica: URL_FORM,
      });
      await db.update(sources).set({ activo: true }).where(eq(sources.id, fuente.id));
      return fuente;
    }

    it("un solo token sirve a todas las fuentes Typeform del programa y nunca sale", async () => {
      await crearFormulario("Formulario A");
      await crearFormulario("Formulario B");
      expect((await embudoPorPregunta(db, programId, { fetch: fetchQueResponde() })).map((fila) => fila.estado)).toEqual(["sin_token", "sin_token"]);
      await sembrarIntegracion(db, programId, "typeform", { token: TOKEN }, { alias: "retia" });
      const resultado = await embudoPorPregunta(db, programId, { fetch: fetchQueResponde() });
      expect(resultado.map((fila) => fila.estado)).toEqual(["ok", "ok"]);
      expect(JSON.stringify(resultado)).not.toContain(TOKEN);
    });
  });
});
