import { describe, expect, it } from "vitest";
import { armarMensaje } from "@/lib/reporte-whatsapp/mensaje";
import type { MetricaSemaforo } from "@/lib/semaforo/semaforo";

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

function envio() {
  return {
    programa: "Alpha",
    tipo: "dia" as const,
    hora: "09:00",
    enlaceHub: "https://hub.test/alpha",
    error: null,
    metricas: [METRICA],
  };
}

describe("mensaje del reporte por WhatsApp", () => {
  it("incluye umbral, gasto, ayer, rojo y Hub", () => {
    const mensaje = armarMensaje(envio(), null);
    expect(mensaje).toMatch(/^🚦 Semáforo de pauta · Alpha · 09:00/);
    expect(mensaje).toMatch(/🔴 Costo por agenda: \$304\.930 COP/);
    expect(mensaje).toMatch(/Meta \$200\.000 COP · aceptable \$250\.000 COP/);
    expect(mensaje).toMatch(/Gasto \$609\.860 COP · 2 agendas/);
    expect(mensaje).toMatch(/Ayer a esta hora: \$100\.000 COP \(3 agendas\)/);
    expect(mensaje).toMatch(/🔴 3 días seguidos en rojo/);
    expect(mensaje).toMatch(/• ⚠️ Creativo agotado/);
    expect(mensaje).toMatch(/Ver en el Hub: https:\/\/hub\.test\/alpha$/);
    expect(mensaje).toBe([
      "🚦 Semáforo de pauta · Alpha · 09:00",
      "🔴 Costo por agenda: $304.930 COP",
      "Meta $200.000 COP · aceptable $250.000 COP",
      "Gasto $609.860 COP · 2 agendas",
      "Ayer a esta hora: $100.000 COP (3 agendas)",
      "🔴 3 días seguidos en rojo",
      "• ⚠️ Creativo agotado",
      "Ver en el Hub: https://hub.test/alpha",
    ].join("\n"));
  });

  it("incluye la trayectoria completa al cierre", () => {
    const mensaje = armarMensaje({ ...envio(), tipo: "cierre", hora: "18:00" }, null);
    expect(mensaje).toMatch(/^🚦 Cierre del día · Alpha · 18:00/);
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
    const mensaje = armarMensaje({ ...envio(), metricas: [metrica] }, null);
    expect(mensaje).toMatch(/⚪ Costo por agenda: sin dato/);
    expect(mensaje).toMatch(/Falta cargar la meta en el CRM/);
  });

  it("muestra la hora de la ultima foto en Bogota si falla la sincronizacion", () => {
    const mensaje = armarMensaje(envio(), {
      estado: "error",
      ultimaFoto: "2026-07-14T15:27:00Z",
    });
    expect(mensaje).toMatch(/⚠️ No se pudo leer Meta; cifras de la última foto \(10:27\)/);
  });
});
