import { describe, expect, it } from "vitest";
import { csvDeGrain, type FilaCsvGrain } from "@/lib/llamadas/csv-grain";
import { tieneGrain } from "@/lib/queries/sin-grain";

function fila(cambios: Partial<FilaCsvGrain> = {}): FilaCsvGrain {
  return {
    fechaLlamada: "16 oct 2026, 09:30",
    fechaAgendada: "10 oct 2026, 08:00",
    lead: "Ana, \"Anita\"",
    correo: "ana@example.test",
    closer: "Maru",
    resultado: "Show",
    etapaDeal: "Agendado",
    cohorte: "C1",
    linkGrain: "https://grain.com/grabacion",
    linkCrm: "https://crm.example/p/programa/deals/1",
    ...cambios,
  };
}

describe("csvDeGrain", () => {
  it("escribe BOM, CRLF, encabezados y escapa comas y comillas", () => {
    const csv = csvDeGrain([fila()]);

    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toContain(
      '"Fecha llamada","Fecha agendada","Lead","Correo","Closer","Resultado","Etapa del deal","Cohorte","Link Grain","Link CRM"\r\n',
    );
    expect(csv).toContain('"Ana, ""Anita"""');
    expect(csv.replaceAll("\r\n", "")).not.toContain("\n");
  });

  it.each(["=HYPERLINK(\"https://malicioso.test\")", "+1", "-1", "@SUM(A1)", "\tformula", "\rformula"])(
    "neutraliza una celda que empieza por %j",
    (peligrosa) => {
      expect(csvDeGrain([fila({ lead: peligrosa })])).toContain(`"'${peligrosa.replaceAll('"', '""')}"`);
    },
  );

  it("escribe las celdas nulas como vacío citado", () => {
    const csv = csvDeGrain([
      fila({
        fechaLlamada: null,
        fechaAgendada: null,
        lead: null,
        correo: null,
        closer: null,
        resultado: null,
        etapaDeal: null,
        cohorte: null,
        linkGrain: null,
        linkCrm: null,
      }),
    ]);

    expect(csv.split("\r\n")[1]).toBe('"","","","","","","","","",""');
  });
});

describe("tieneGrain", () => {
  it.each([null, "", "  "])("rechaza %j", (link) => {
    expect(tieneGrain(link)).toBe(false);
  });

  it("acepta un link real", () => {
    expect(tieneGrain("https://grain.com/grabacion")).toBe(true);
  });
});
