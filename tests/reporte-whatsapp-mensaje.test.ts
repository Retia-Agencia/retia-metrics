import { describe, expect, it } from "vitest";
import { armarMensajeDeLaHora } from "@/lib/reporte-whatsapp/mensaje";
import { NOTA_SIN_ERRORES, type MetricaSemaforo } from "@/lib/semaforo/semaforo";

const ORIGEN = "https://crm.test";
const METRICA: MetricaSemaforo = {
  metrica: "costo_por_agenda",
  color: "peligro",
  motivo: null,
  moneda: "COP",
  dia: "2026-10-16",
  gasto: 609860,
  agendasMeta: 2,
  agendasCrm: 4,
  costo: 304930,
  umbral: { meta: 200000, aceptable: 250000 },
  porcentajeDelUmbral: 152.5,
  comparacion: {
    dia: "2026-10-15",
    gasto: 300000,
    agendasMeta: 3,
    agendasCrm: 2,
    costo: 100000,
    etiqueta: "ayer a esta hora",
  },
  trayectoria: [
    { hora: "09:00", gasto: 0, agendasMeta: 0, agendasCrm: 0, costo: null },
    { hora: "11:00", gasto: 120000, agendasMeta: 1, agendasCrm: 2, costo: 120000 },
  ],
  diasSeguidosEnRojo: 3,
  campanas: [],
  notas: [{ tipo: "problema", texto: "Creativo agotado" }],
};

function bloque() {
  return {
    programa: "Alpha",
    tipo: "dia" as const,
    enlaceHub: "https://hub.test/alpha",
    error: null,
    metricas: [METRICA],
  };
}

describe("mensaje del reporte por WhatsApp", () => {
  it("compacta umbral, gasto, ayer, rojo y problema en un bloque", () => {
    const mensaje = armarMensajeDeLaHora([bloque()], "09:00", null, ORIGEN);

    expect(mensaje).toBe([
      "🚦 Semáforo de pauta · 09:00 · 1🔴",
      "",
      "*Alpha*",
      "🔴 Costo por agenda: $304.930 COP · 53% más caro que la meta",
      "Meta $200.000 COP · aceptable $250.000 COP",
      "Gasto $609.860 COP · agendas Meta 2 · CRM 4",
      "Ayer a esta hora: $100.000 COP · agendas Meta 3 · CRM 2",
      "🔴 3 días seguidos en rojo",
      "⚠️ Creativo agotado",
      "",
      "CRM: https://crm.test",
      "ℹ️ Costo = gasto ÷ agendas Meta (pixel). CRM = citas con UTM de pauta.",
    ].join("\n"));
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });

  it("incluye la trayectoria completa al cierre", () => {
    const mensaje = armarMensajeDeLaHora(
      [{ ...bloque(), tipo: "cierre" }],
      "18:00",
      null,
      ORIGEN,
    );

    expect(mensaje).toMatch(/^🌙 Cierre del viernes 16-oct/);
    expect(mensaje).toMatch(/Trayectoria: 09:00 \$0 COP · 0 ag Meta \| 11:00 \$120\.000 COP · 1 ag Meta/);
  });

  it("dice cuánto más barato que la meta, o igual", () => {
    const conPorcentaje = (porcentajeDelUmbral: number) => armarMensajeDeLaHora(
      [{ ...bloque(), metricas: [{ ...METRICA, color: "exito", porcentajeDelUmbral }] }],
      "09:00",
      null,
      ORIGEN,
    );

    expect(conPorcentaje(72.4)).toContain("🟢 Costo por agenda: $304.930 COP · 28% más barato que la meta");
    expect(conPorcentaje(100.2)).toContain("🟢 Costo por agenda: $304.930 COP · igual a la meta");
  });

  it("con gasto y cero agendas de Meta dice sin agendas, no sin dato", () => {
    const metrica: MetricaSemaforo = {
      ...METRICA,
      gasto: 63902,
      agendasMeta: 0,
      agendasCrm: 0,
      costo: null,
      porcentajeDelUmbral: null,
    };
    const mensaje = armarMensajeDeLaHora([{ ...bloque(), metricas: [metrica] }], "11:00", null, ORIGEN);

    expect(mensaje).toContain("🔴 Costo por agenda: sin agendas\n");
    expect(mensaje).toContain("Gasto $63.902 COP · agendas Meta 0 · CRM 0");
  });

  it("explica cuando falta cargar el umbral", () => {
    const metrica: MetricaSemaforo = {
      ...METRICA,
      color: "sin_dato",
      costo: null,
      umbral: null,
      motivo: "sin_umbral",
    };
    const mensaje = armarMensajeDeLaHora(
      [{ ...bloque(), metricas: [metrica] }],
      "09:00",
      null,
      ORIGEN,
    );

    expect(mensaje).toMatch(/⚪ Costo por agenda: sin dato/);
    expect(mensaje).toMatch(/Falta cargar la meta en el CRM/);
  });

  it("muestra una sola vez la sincronizacion y termina con el CRM general", () => {
    const mensaje = armarMensajeDeLaHora([bloque(), { ...bloque(), programa: "Beta" }], "09:00", {
      estado: "error",
      ultimaFoto: "2026-07-14T15:27:00Z",
    }, ORIGEN);

    expect(mensaje.match(/⚠️ No se pudo leer Meta/g)).toHaveLength(1);
    expect(mensaje).toContain("⚠️ No se pudo leer Meta; cifras de la última foto (10:27)");
    expect(mensaje).toContain("CRM: https://crm.test");
  });

  it("une dos programas, deduplica la info y confirma una corrida limpia", () => {
    const textoHQ4 = "HQ-4: Meta entregó datos parciales";
    const metricaLimpia: MetricaSemaforo = {
      ...METRICA,
      notas: [
        { tipo: "info", texto: textoHQ4 },
        { tipo: "info", texto: NOTA_SIN_ERRORES },
      ],
    };
    const primero = { ...bloque(), metricas: [metricaLimpia] };
    const segundo = { ...primero, programa: "Beta", enlaceHub: "https://hub.test/beta" };
    const mensaje = armarMensajeDeLaHora([primero, segundo], "09:00", null, ORIGEN);

    expect(mensaje.match(/🚦 Semáforo de pauta · 09:00 · 2🔴/g)).toHaveLength(1);
    expect(mensaje.match(/━━━━━━━━━━/g)).toHaveLength(1);
    expect(mensaje).toContain("*Alpha*\n🔴 Costo por agenda");
    expect(mensaje).toContain("\n━━━━━━━━━━\n*Beta*\n");
    expect(mensaje.match(new RegExp(textoHQ4, "g"))).toHaveLength(1);
    expect(mensaje).toContain(`ℹ️ ${textoHQ4}\n✅ Sin errores en esta corrida`);
    expect(mensaje).toContain("CRM: https://crm.test");
  });

  it("marca solo el bloque de cierre cuando mezcla tipos", () => {
    const mensaje = armarMensajeDeLaHora([
      bloque(),
      { ...bloque(), programa: "Beta", tipo: "cierre" },
    ], "18:00", null, ORIGEN);

    expect(mensaje).toMatch(/^🚦 Semáforo de pauta · 18:00 · 2🔴/);
    expect(mensaje).toContain("*Alpha*\n");
    expect(mensaje).toContain("*Beta* (cierre)\n");
  });

  it("dice sin foto cuando no existe comparación", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      metricas: [{ ...METRICA, comparacion: null }],
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("Ayer a esta hora: sin foto");
    expect(mensaje).not.toContain("Ayer a esta hora: $0");
  });

  it("un error reemplaza las metricas del programa y elimina la confirmacion", () => {
    const mensaje = armarMensajeDeLaHora([{
      ...bloque(),
      error: "No se pudo calcular el semáforo de este programa.",
    }], "09:00", null, ORIGEN);

    expect(mensaje).toContain("*Alpha*\n⚠️ No se pudo calcular el semáforo de este programa.");
    expect(mensaje).not.toContain("Costo por agenda");
    expect(mensaje).not.toContain("✅ Sin errores en esta corrida");
  });
});
