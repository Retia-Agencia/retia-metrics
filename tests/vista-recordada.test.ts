import { describe, expect, it } from "vitest";
import { vistaParaRecordar } from "@/lib/deals/vista-recordada";

/** Ticket 296 (ADR 0103): el proxy recuerda la vista solo desde la URL del tablero. */
describe("vistaParaRecordar", () => {
  const con = (query: string) => new URLSearchParams(query);

  it("recuerda la vista del Kanban de cualquier programa", () => {
    expect(vistaParaRecordar("/p/comunicarte/deals", con("vista=llamada"))).toBe("llamada");
    expect(vistaParaRecordar("/p/tactical/deals/", con("vista=setteo&owner=x"))).toBe("setteo");
  });

  it("no recuerda fuera del tablero, sin vista ni con un valor raro", () => {
    expect(vistaParaRecordar("/p/comunicarte/deals/abc", con("vista=llamada"))).toBeNull();
    expect(vistaParaRecordar("/p/comunicarte/leads", con("vista=llamada"))).toBeNull();
    expect(vistaParaRecordar("/p/comunicarte/deals", con(""))).toBeNull();
    expect(vistaParaRecordar("/p/comunicarte/deals", con("vista=%3Cscript%3E"))).toBeNull();
  });
});
