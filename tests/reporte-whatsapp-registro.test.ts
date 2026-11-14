import { describe, expect, it } from "vitest";
import { CONCEPTO_DE_METRICA_DEL_REPORTE } from "@/lib/reporte-whatsapp/conceptos";
import { CONCEPTO_DE_OBJETIVO } from "@/lib/metricas/pendientes";
import { REGISTRO } from "@/lib/metricas/registro";

/** Ticket 358 (enmienda 13-nov): lo que el reporte de WhatsApp enciende apunta a un concepto registrado. */
export function conceptosSinRegistrar(mapa: Readonly<Record<string, string>>, registro: Readonly<Record<string, unknown>>): string[] {
  return Object.entries(mapa).filter(([, clave]) => !(clave in registro)).map(([metrica, clave]) => `${metrica}: ${clave}`);
}

describe("el reporte de WhatsApp apunta al registro de métricas", () => {
  it("cada métrica del reporte tiene un concepto registrado", () => {
    expect(Object.keys(CONCEPTO_DE_METRICA_DEL_REPORTE).length).toBeGreaterThan(0);
    expect(conceptosSinRegistrar(CONCEPTO_DE_METRICA_DEL_REPORTE, REGISTRO)).toEqual([]);
  });

  it("el costo por agenda del reporte es el mismo concepto que el objetivo del semáforo", () => {
    expect(CONCEPTO_DE_METRICA_DEL_REPORTE.costo_por_agenda).toBe(CONCEPTO_DE_OBJETIVO.costo_por_agenda);
  });

  it("muerde: caza un concepto que no existe y deja pasar uno registrado", () => {
    expect(conceptosSinRegistrar({ costo_por_agenda: "no_existe" }, REGISTRO)).toEqual(["costo_por_agenda: no_existe"]);
    expect(conceptosSinRegistrar({ costo_por_agenda: "ventas" }, REGISTRO)).toEqual([]);
  });
});
