import { describe, expect, it } from "vitest";
import { armarMensajeDeLaHora } from "@/lib/reporte-whatsapp/mensaje";
import { NOTA_SIN_ERRORES, type MetricaSemaforo } from "@/lib/semaforo/semaforo";

const ORIGEN = "https://crm.test";
const METRICA: MetricaSemaforo = {
  metrica: "costo_por_agenda",
  color: "peligro",
  motivo: null,
  moneda: "COP",
  gasto: 609860,
  agendas: 2,
  costo: 304930,
  umbral: { meta: 200000, aceptable: 250000 },
  porcentajeDelUmbral: 152.5,
  ayerALaMismaHora: { dia: "2026-07-13", gasto: 300000, agendas: 3, costo: 100000 },
  trayectoria: [
    { hora: "09:00", gasto: 0, agendas: 0, costo: null },
    { hora: "11:00", gasto: 120000, agendas: 1, costo: 120000 },
  ],
  diasSeguidosEnRojo: 3,
  agendasMeta: 4,
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
      "🚦 Semáforo de pauta · 09:00",
      "",
      "*Alpha*",
      "🔴 Costo por agenda: $304.930 COP",
      "Meta $200.000 COP · aceptable $250.000 COP",
      "Gasto $609.860 COP · 2 agendas · ayer $100.000 COP (3)",
      "🔴 3 días seguidos en rojo",
      "⚠️ Creativo agotado",
      "",
      "CRM: https://crm.test",
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

    expect(mensaje).toMatch(/^🚦 Cierre del día · 18:00/);
    expect(mensaje).toMatch(/Trayectoria: 09:00 \$0 COP · 0 ag \| 11:00 \$120\.000 COP · 1 ag/);
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
    expect(mensaje).toMatch(/CRM: https:\/\/crm\.test$/);
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

    expect(mensaje.match(/🚦 Semáforo de pauta · 09:00/g)).toHaveLength(1);
    expect(mensaje.match(/━━━━━━━━━━/g)).toHaveLength(1);
    expect(mensaje).toContain("*Alpha*\n🔴 Costo por agenda");
    expect(mensaje).toContain("\n━━━━━━━━━━\n*Beta*\n");
    expect(mensaje.match(new RegExp(textoHQ4, "g"))).toHaveLength(1);
    expect(mensaje).toContain(`ℹ️ ${textoHQ4}\n✅ Sin errores en esta corrida`);
    expect(mensaje).toMatch(/CRM: https:\/\/crm\.test$/);
  });

  it("marca solo el bloque de cierre cuando mezcla tipos", () => {
    const mensaje = armarMensajeDeLaHora([
      bloque(),
      { ...bloque(), programa: "Beta", tipo: "cierre" },
    ], "18:00", null, ORIGEN);

    expect(mensaje).toMatch(/^🚦 Semáforo de pauta · 18:00/);
    expect(mensaje).toContain("*Alpha*\n");
    expect(mensaje).toContain("*Beta* (cierre)\n");
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
