import { describe, expect, it } from "vitest";
import { csvDeDeals, type FilaCsvDeal } from "@/lib/deals/csv-deals";

const base: FilaCsvDeal = {
  nombre: "Ana", telefono: "573001112233", correo: "ana@x.co", etapa: "Potencial", pendiente: null,
  dueno: "Jerónimo", cohorte: null, calidad: null, valor: null,
  origen: null, creado: null, linkCrm: "https://crm/p/x/deals/1",
};

describe("csvDeDeals", () => {
  it("trae BOM, encabezado con teléfono y una fila por deal", () => {
    const [encabezado, fila, ...resto] = csvDeDeals([base]).replace("﻿", "").split("\r\n");
    expect(encabezado).toContain('"Teléfono"');
    expect(fila).toContain('"573001112233"');
    expect(resto).toEqual([]);
  });
  it("neutraliza fórmulas y escapa comillas", () => {
    const csv = csvDeDeals([{ ...base, nombre: '=HYPERLINK("x")', dueno: 'Cali "Valle"' }]);
    expect(csv).toContain(`"'=HYPERLINK(""x"")"`);
    expect(csv).toContain('"Cali ""Valle"""');
  });
});
