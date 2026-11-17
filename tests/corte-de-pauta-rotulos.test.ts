import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { SemaforoDelPrograma } from "@/components/semaforo/semaforo-del-programa";
import { semaforoDelPrograma } from "@/lib/semaforo/semaforo";

vi.mock("@/lib/db", () => ({ db: {} }));
vi.mock("@/lib/semaforo/semaforo", () => ({ semaforoDelPrograma: vi.fn() }));

describe("cortes sin detalle de hoy", () => {
  it.each(["conjunto", "anuncio"] as const)("%s explica la ausencia sin consultar el semáforo", async (nivel) => {
    const elemento = await SemaforoDelPrograma({ programId: crypto.randomUUID(), corte: {
      nivel, id: "meta", uuid: crypto.randomUUID(), nombre: "Objeto", etiqueta: "Objeto",
    } });
    const html = renderToStaticMarkup(createElement("div", null, elemento));
    expect(html).toContain("No disponible para este corte: el detalle de hoy se guarda por campaña");
    expect(semaforoDelPrograma).not.toHaveBeenCalled();
  });
});
