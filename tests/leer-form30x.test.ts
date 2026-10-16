import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import { leerRespuestas } from "@/lib/form30x/api";
import { payloadForm30xSchema } from "@/lib/ingesta/adaptador-form30x";
import { cuerpoDeWebhookDesdeRespuesta, leerForm30x } from "@/lib/ingesta/leer-form30x";
import { crearBaseReutilizable } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import paginaReal from "./fixtures/form30x-api-respuestas-parcial.json";

let db: Db;
let cerrar: () => Promise<void>;
let vaciar: () => Promise<void>;
let programId: string;
const apiKeyAnterior = process.env.FORM_30X_API_KEY;

beforeAll(async () => {
  ({ db, cerrar, vaciar } = await crearBaseReutilizable());
});

beforeEach(async () => {
  await vaciar();
  const [programa] = await db
    .insert(programs)
    .values({ ...PROGRAMA_DE_PRUEBA, slug: "programa-form30x", nombre: "Programa Form30x", ticketUsd: "1000" })
    .returning();
  programId = programa.id;
});

afterEach(() => {
  vi.restoreAllMocks();
  if (apiKeyAnterior === undefined) delete process.env.FORM_30X_API_KEY;
  else process.env.FORM_30X_API_KEY = apiKeyAnterior;
});

afterAll(async () => {
  await cerrar();
});

async function crearFuente(datos: {
  nombre?: string;
  proveedor?: "form30x" | "typeform";
  activo?: boolean;
  form30xFormId?: string | null;
} = {}) {
  const [fuente] = await db
    .insert(sources)
    .values({
      programId,
      nombre: datos.nombre ?? "Form SBJ",
      tipo: "webhook",
      proveedor: datos.proveedor ?? "form30x",
      activo: datos.activo ?? true,
      form30xFormId: datos.form30xFormId === undefined ? "form-sbj" : datos.form30xFormId,
    })
    .returning();
  return fuente;
}

function paginaCon(respuesta: Record<string, unknown>, nextCursor: string | null = null) {
  return { data: [respuesta], nextCursor };
}

describe("traduccion de la API de Form30x", () => {
  it("acepta el fixture real y no copia los datos de entry", () => {
    const cuerpo = cuerpoDeWebhookDesdeRespuesta(paginaReal.data[0], "form-sbj");
    const payload = payloadForm30xSchema.parse(JSON.parse(cuerpo));

    expect(payload).toMatchObject({
      event: "response.partial",
      tags: ["High", "VALOR MEDIO"],
      score: 10,
      hidden: {},
    });
    expect(cuerpo).not.toContain("entry");
    expect(cuerpo).not.toContain("203.0.113.10");
    expect(cuerpo).not.toContain("userAgent");
  });
});

describe("lectura periodica", () => {
  it("ingresa un parcial una sola vez por la misma puerta del webhook", async () => {
    const fuente = await crearFuente();
    const leer = vi.fn().mockResolvedValue(paginaReal);
    const ahora = new Date("2026-10-16T03:00:00.000Z");

    await expect(leerForm30x(db, { leer, ahora })).resolves.toMatchObject({ nuevas: 1, saltadas: 0 });
    const [sobre] = await db.select().from(sobresCrudos);
    const [envio] = await db.select().from(submissions);
    expect(sobre).toMatchObject({ origen: "form30x_api", sourceId: fuente.id, error: null });
    expect(envio).toMatchObject({ sourceId: fuente.id, token: paginaReal.data[0].id, esParcial: true });

    await expect(leerForm30x(db, { leer, ahora })).resolves.toMatchObject({ nuevas: 0, saltadas: 1 });
    expect(await db.select().from(sobresCrudos)).toHaveLength(1);
  });

  it("una respuesta que fallo deja un solo sobre con error y no se reescribe en cada corrida", async () => {
    await crearFuente();
    const dePrueba = {
      ...paginaReal.data[0],
      id: "de-prueba",
      completed: true,
      answers: paginaReal.data[0].answers.map((answer) =>
        answer.type === "email" ? { ...answer, value: "alguien@example.com" } : answer,
      ),
    };
    const leer = vi.fn().mockResolvedValue(paginaCon(dePrueba));
    const ahora = new Date("2026-10-16T03:00:00.000Z");

    await expect(leerForm30x(db, { leer, ahora })).resolves.toMatchObject({ conError: 1, saltadas: 0 });
    await expect(leerForm30x(db, { leer, ahora })).resolves.toMatchObject({ conError: 0, saltadas: 1 });
    const sobres = await db.select().from(sobresCrudos);
    expect(sobres).toHaveLength(1);
    expect(sobres[0].error).toMatch(/Entrega de prueba de Form30x/);
  });

  it("corta la paginacion al encontrar una respuesta anterior a 48 horas", async () => {
    await crearFuente();
    const vieja = { ...paginaReal.data[0], id: "vieja", submittedAt: "2026-10-13T01:00:00.000Z" };
    const leer = vi.fn().mockResolvedValue(paginaCon(vieja, "pagina-2"));

    const resumen = await leerForm30x(db, { leer, ahora: new Date("2026-10-16T03:00:00.000Z") });
    expect(resumen.leidas).toBe(0);
    expect(leer).toHaveBeenCalledOnce();
  });

  it("salta un parcial sin correo y no crea sobre", async () => {
    await crearFuente();
    const sinCorreo = {
      ...paginaReal.data[0],
      id: "sin-correo",
      answers: paginaReal.data[0].answers.filter((answer) => answer.type !== "email"),
    };
    const resumen = await leerForm30x(db, {
      leer: vi.fn().mockResolvedValue(paginaCon(sinCorreo)),
      ahora: new Date("2026-10-16T03:00:00.000Z"),
    });
    expect(resumen).toMatchObject({ nuevas: 0, saltadas: 1 });
    expect(await db.select().from(sobresCrudos)).toEqual([]);
  });

  it("no lee fuentes sin form id, inactivas ni de otro proveedor", async () => {
    await crearFuente({ nombre: "Sin id", form30xFormId: null });
    await crearFuente({ nombre: "Inactiva", activo: false });
    await crearFuente({ nombre: "Typeform", proveedor: "typeform" });
    const leer = vi.fn();

    await expect(leerForm30x(db, { leer })).resolves.toMatchObject({ fuentes: 0 });
    expect(leer).not.toHaveBeenCalled();
  });

  it("continua con otra fuente cuando una llamada a la API falla", async () => {
    await crearFuente({ nombre: "Rota", form30xFormId: "form-rota" });
    const buena = await crearFuente({ nombre: "Buena", form30xFormId: "form-buena" });
    const leer = vi.fn(async (formId: string) => {
      if (formId === "form-rota") throw new Error("API no disponible");
      return paginaReal;
    });

    const resumen = await leerForm30x(db, { leer, ahora: new Date("2026-10-16T03:00:00.000Z") });
    expect(resumen).toMatchObject({ fuentes: 2, nuevas: 1, fuentesConError: 1 });
    const [envio] = await db.select().from(submissions).where(eq(submissions.sourceId, buena.id));
    expect(envio).toBeDefined();
  });
});

describe("cliente de la API", () => {
  it("pagina con limit 200, cursor y autorizacion Bearer", async () => {
    process.env.FORM_30X_API_KEY = "secreto-de-prueba";
    const fetchInyectado = vi.fn().mockResolvedValue(
      new Response(JSON.stringify(paginaReal), { status: 200, headers: { "content-type": "application/json" } }),
    );

    await leerRespuestas("form con espacio", "cursor/2", { fetch: fetchInyectado });
    const [url, init] = fetchInyectado.mock.calls[0];
    expect(String(url)).toBe(
      "https://form.30x.com/api/v1/forms/form%20con%20espacio/responses?limit=200&cursor=cursor%2F2",
    );
    expect(init).toMatchObject({ headers: { Authorization: "Bearer secreto-de-prueba" } });
  });

  it("falla claramente cuando falta la variable", async () => {
    delete process.env.FORM_30X_API_KEY;
    await expect(leerRespuestas("form", undefined, { fetch: vi.fn() })).rejects.toThrow(
      "Falta FORM_30X_API_KEY.",
    );
  });

  it("un error HTTP no incluye el cuerpo de la respuesta", async () => {
    process.env.FORM_30X_API_KEY = "secreto-de-prueba";
    const fetchInyectado = vi.fn().mockResolvedValue(new Response("detalle privado", { status: 500 }));
    const promesa = leerRespuestas("form", undefined, { fetch: fetchInyectado });
    await expect(promesa).rejects.toThrow("Form30x respondió HTTP 500.");
    await expect(promesa).rejects.not.toThrow("detalle privado");
  });
});
