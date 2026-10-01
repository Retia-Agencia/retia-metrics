import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { leads, programs, sobresCrudos, sources, submissions } from "@/lib/db/schema";
import type { Db } from "@/lib/db/tipos";
import type { ProveedorFormulario } from "@/lib/catalogo/fuentes-webhook";
import { construirEnvio } from "@/lib/ingesta/envio";
import { PROVEEDORES, type OpcionesAdaptador } from "@/lib/ingesta/proveedores";
import { crearBaseDePrueba } from "./helpers/base-de-prueba";
import { PROGRAMA_DE_PRUEBA } from "./helpers/programa-de-prueba";
import typeformParcial from "./fixtures/typeform-parcial.json";
import typeformCompleto from "./fixtures/typeform-completo.json";
import daptaParcial from "./fixtures/dapta-parcial.json";
import daptaCompleto from "./fixtures/dapta-completo.json";
import typeformReal from "./fixtures/typeform-real-tactical.json";
import daptaReal from "./fixtures/dapta-real-completo-utm.json";

const holder: { db: Db | null } = { db: null };
vi.mock("@/lib/db", () => ({
  get db() {
    return holder.db;
  },
}));

interface CasoContrato {
  parcial: unknown;
  completo: unknown;
  estado: string;
  puntaje: number;
  utm: [string, string, string, string, string, string];
  sinClasificacion(payload: unknown): unknown;
  firmar(cuerpo: string, secreto: string): string;
}

const CASOS = {
  typeform: {
    parcial: typeformParcial,
    completo: typeformCompleto,
    estado: "setteo_no_calificado",
    puntaje: 0,
    utm: [
      "facebook",
      "cpc",
      "tactical-septiembre",
      "120212345678900001",
      "anuncio-a",
      "inversion",
    ],
    sinClasificacion(payload) {
      const copia = structuredClone(payload) as typeof typeformCompleto;
      copia.form_response.variables = [];
      return copia;
    },
    firmar(cuerpo, secreto) {
      return `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("base64")}`;
    },
  },
  dapta: {
    parcial: daptaParcial,
    completo: daptaCompleto,
    estado: "con_calendly_sin_agenda",
    puntaje: 17,
    utm: [
      "facebook",
      "paid_social",
      "tactical-septiembre",
      "120212345678900001",
      "anuncio-a",
      "instagram_reels",
    ],
    sinClasificacion(payload) {
      const copia = structuredClone(payload) as Record<string, unknown> & {
        submission: Record<string, unknown>;
      };
      copia.submission.outcome = null;
      delete copia.submission.score;
      return copia;
    },
    firmar(cuerpo, secreto) {
      return `sha256=${createHmac("sha256", secreto).update(cuerpo).digest("hex")}`;
    },
  },
} satisfies Record<ProveedorFormulario, CasoContrato>;

const OPCIONES: OpcionesAdaptador = {
  sourceId: "source-del-registro",
  zona: "America/Bogota",
  mapeo: {
    variablePuntaje: "score",
    variableLeadValue: "lead_value",
    variableLeadQuality: "lead_quality",
  },
};

const proveedores = Object.keys(PROVEEDORES) as ProveedorFormulario[];

for (const nombre of proveedores) {
  const proveedor = PROVEEDORES[nombre];
  const caso = CASOS[nombre];

  describe(`contrato de ${nombre}`, () => {
    it("usa la fuente de las opciones y conserva token y parcialidad entre versiones", () => {
      const entradaParcial = proveedor.adaptar(JSON.stringify(caso.parcial), OPCIONES);
      const entradaCompleta = proveedor.adaptar(JSON.stringify(caso.completo), OPCIONES);
      const parcial = construirEnvio(entradaParcial);
      const completa = construirEnvio(entradaCompleta);
      expect(entradaParcial.sourceId).toBe("source-del-registro");
      expect(entradaCompleta.sourceId).toBe("source-del-registro");
      expect(entradaParcial).not.toHaveProperty("programId");
      expect(entradaCompleta).not.toHaveProperty("programId");
      expect(parcial.ok && completa.ok).toBe(true);
      if (!parcial.ok || !completa.ok) return;
      expect(parcial.envio.token).toBe(completa.envio.token);
      expect(parcial.envio.esParcial).toBe(true);
      expect(completa.envio.esParcial).toBe(false);
    });

    it("resuelve las seis UTM con sus valores", () => {
      const entrada = proveedor.adaptar(JSON.stringify(caso.completo), OPCIONES);
      const campos = ["utmSource", "utmMedium", "utmCampaign", "utmId", "utmContent", "utmTerm"] as const;
      expect(campos.map((campo) => entrada.columnas[entrada.campos[campo]!])).toEqual(caso.utm);
    });

    it("copia estado, valor, calidad y puntaje; si faltan quedan nulos", () => {
      const entrada = proveedor.adaptar(JSON.stringify(caso.completo), OPCIONES);
      expect(entrada.columnas[entrada.campos.estadoHoja!]).toBe(caso.estado);
      expect(entrada.leadValue).toBe("MUY ALTO VALOR");
      expect(entrada.leadQuality).toBe("High");
      expect(entrada.puntaje).toBe(caso.puntaje);

      const vacia = proveedor.adaptar(
        JSON.stringify(caso.sinClasificacion(caso.completo)),
        OPCIONES,
      );
      const envioVacio = construirEnvio(vacia);
      expect(envioVacio.ok).toBe(true);
      if (!envioVacio.ok) return;
      expect(envioVacio.envio.estadoHoja).toBeNull();
      expect(vacia.leadValue).toBeNull();
      expect(vacia.leadQuality).toBeNull();
      expect(vacia.puntaje).toBeNull();
    });

    it("acepta campos desconocidos sin romper la adaptacion", () => {
      const payload = { ...(caso.completo as Record<string, unknown>), campo_nuevo: { valor: 1 } };
      expect(() => proveedor.adaptar(JSON.stringify(payload), OPCIONES)).not.toThrow();
    });

    it("acepta la firma correcta y rechaza una incorrecta", () => {
      const cuerpo = JSON.stringify(caso.completo);
      const secreto = "secreto-del-contrato";
      expect(proveedor.verificarFirma(cuerpo, caso.firmar(cuerpo, secreto), secreto)).toBe(true);
      expect(proveedor.verificarFirma(cuerpo, "sha256=00", secreto)).toBe(false);
    });
  });
}

it("Dapta aplana una respuesta de objeto", () => {
  const entrada = PROVEEDORES.dapta.adaptar(JSON.stringify(daptaCompleto), OPCIONES);
  expect(entrada.columnas.nombre_dividido).toBe("Ana Pérez");
});

it.each(proveedores)("una firma mala de %s no cambia ninguna tabla por la ruta real", async (nombre) => {
  const { db, cerrar } = await crearBaseDePrueba();
  holder.db = db;
  try {
    const [programa] = await db
      .insert(programs)
      .values({
        ...PROGRAMA_DE_PRUEBA,
        slug: `contrato-${nombre}`,
        nombre: `Contrato ${nombre}`,
        ticketUsd: "1500",
      })
      .returning();
    const [fuente] = await db
      .insert(sources)
      .values({
        programId: programa.id,
        nombre: `Fuente ${nombre}`,
        tipo: "webhook",
        proveedor: nombre,
        secretoWebhook: "secreto-del-contrato",
        activo: true,
      })
      .returning();
    const cuerpo = JSON.stringify(CASOS[nombre].completo);
    const peticion = new Request("https://app.retia.co/api/webhooks/formularios/x", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        [PROVEEDORES[nombre].headerFirma]: "sha256=00",
      },
      body: cuerpo,
    });
    const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
    const respuesta = await POST(peticion, { params: Promise.resolve({ fuente: fuente.id }) });
    expect(respuesta.status).toBe(401);
    expect(await db.select().from(submissions)).toHaveLength(0);
    expect(await db.select().from(leads)).toHaveLength(0);
    expect(await db.select().from(sobresCrudos)).toHaveLength(0);
  } finally {
    holder.db = null;
    await cerrar();
  }
});

/**
 * 🩸 Mani (1-oct): las UTM y los campos del formulario llegan SIEMPRE, de cualquier proveedor.
 * El contrato de arriba corria contra fixtures inventados y paso con un adaptador de Dapta que
 * perdia todas las UTM. Este corre contra un cuerpo REAL capturado de cada proveedor, por la ruta
 * real con firma buena, y mira lo que quedo en la base. Un proveedor nuevo no entra sin el suyo.
 */
const REALES = {
  typeform: {
    cuerpo: typeformReal,
    utm: (c: typeof typeformReal) => c.form_response.hidden as Record<string, string>,
    valores: (c: typeof typeformReal) =>
      c.form_response.answers.map((a: Record<string, unknown>) => {
        const v = a[a.type as string] as unknown;
        return typeof v === "object" && v !== null ? (v as { label?: string }).label ?? v : v;
      }),
  },
  dapta: {
    cuerpo: daptaReal,
    utm: (c: typeof daptaReal) => c.utm as Record<string, string>,
    valores: (c: typeof daptaReal) =>
      Object.entries(c.data).filter(([k]) => k !== "utm").map(([, v]) => v),
  },
} satisfies Record<ProveedorFormulario, { cuerpo: unknown; utm(c: never): Record<string, string>; valores(c: never): unknown[] }>;

it.each(proveedores)(
  "un cuerpo REAL de %s deja en la base todas sus UTM y todos sus campos intactos",
  async (nombre) => {
    const { db, cerrar } = await crearBaseDePrueba();
    holder.db = db;
    try {
      const [programa] = await db
        .insert(programs)
        .values({ ...PROGRAMA_DE_PRUEBA, slug: `real-${nombre}`, nombre: `Real ${nombre}`, ticketUsd: "1500" })
        .returning();
      const [fuente] = await db
        .insert(sources)
        .values({
          programId: programa.id,
          nombre: `Fuente ${nombre}`,
          tipo: "webhook",
          proveedor: nombre,
          secretoWebhook: "secreto-del-contrato",
          activo: true,
        })
        .returning();
      const real = REALES[nombre];
      const cuerpo = JSON.stringify(real.cuerpo);
      const { POST } = await import("@/app/api/webhooks/formularios/[fuente]/route");
      const respuesta = await POST(
        new Request("https://app.retia.co/api/webhooks/formularios/x", {
          method: "POST",
          headers: {
            "content-type": "application/json",
            [PROVEEDORES[nombre].headerFirma]: CASOS[nombre].firmar(cuerpo, "secreto-del-contrato"),
          },
          body: cuerpo,
        }),
        { params: Promise.resolve({ fuente: fuente.id }) },
      );
      expect(respuesta.status).toBe(200);
      const [envio] = await db.select().from(submissions);
      expect(envio, "el cuerpo real no produjo envio").toBeDefined();

      const utm = (real.utm as (c: unknown) => Record<string, string>)(real.cuerpo);
      expect(Object.keys(utm).length).toBeGreaterThanOrEqual(3);
      const columna = {
        utm_source: envio.utmSource,
        utm_medium: envio.utmMedium,
        utm_campaign: envio.utmCampaign,
        utm_content: envio.utmContent,
        utm_term: envio.utmTerm,
        utm_id: envio.utmId,
      } as Record<string, string | null>;
      for (const [llave, valor] of Object.entries(utm)) expect(columna[llave], llave).toBe(valor);

      // Intacto: cada valor respondido esta, tal cual, en una columna o en `respuestas`.
      const guardado = new Set(
        [...Object.values((envio.respuestas ?? {}) as Record<string, unknown>), ...Object.values(envio)]
          .filter((v) => v !== null && typeof v !== "object")
          .map(String),
      );
      const [lead] = await db.select().from(leads);
      for (const v of [lead?.emailNormalizado, lead?.telefono]) if (v) guardado.add(String(v));
      const valores = (real.valores as (c: unknown) => unknown[])(real.cuerpo);
      const faltan = valores
        .map(String)
        .filter((v) => !guardado.has(v) && !guardado.has(v.toLowerCase()) && ![...guardado].some((g) => g.includes(v)));
      expect(faltan, "campos del formulario que no llegaron intactos").toEqual([]);
    } finally {
      holder.db = null;
      await cerrar();
    }
  },
);
