import { describe, expect, it } from "vitest";
import { MapeoInvalidoError } from "@/lib/sheets/mapeo";
import {
  csvDeNoReclamados,
  marcarDuplicados,
  parsearCsvDeReclamo,
  type ResultadoFilaReclamo,
} from "@/lib/deals/csv-reclamo";

/**
 * Falla si el CSV vuelve a adivinar columnas, pierde filas/comillas o permite que una
 * celda descargada se ejecute como fórmula en Excel.
 */
describe("CSV para reclamar deals", () => {
  it("reconoce encabezados sin tildes ni mayúsculas y los dos separadores", () => {
    expect(parsearCsvDeReclamo("CORREO ELECTRÓNICO;MÓVIL\n ANA@CORREO.CO ;+57 300 123 4567").filas[0]).toMatchObject({
      fila: 2,
      correo: "ana@correo.co",
      telefono: "573001234567",
    });
    expect(parsearCsvDeReclamo("mail,phone\nluis@correo.co,3001234567").filas[0]).toMatchObject({
      correo: "luis@correo.co",
      telefono: "3001234567",
    });
  });

  it("quita BOM, respeta comillas escapadas y conserva la línea real al ignorar vacías", () => {
    const resultado = parsearCsvDeReclamo('﻿nombre,correo,celular\r\n"Ana ""A""",ana@correo.co,"300\r\n1234567"\r\n,,\r\nluis,luis@correo.co,');
    expect(resultado.filas).toHaveLength(2);
    expect(resultado.filas.map((fila) => fila.fila)).toEqual([2, 5]);
    expect(resultado.filas[0].telefono).toBe("3001234567");
  });

  it("rechaza un archivo sin ninguna columna de identidad", () => {
    expect(() => parsearCsvDeReclamo("nombre,ciudad\nAna,Bogotá")).toThrow(MapeoInvalidoError);
  });

  it("solo deja reclamable la primera aparición de cada deal", () => {
    const base: ResultadoFilaReclamo[] = [3, 2].map((fila) => ({
      fila,
      correoOriginal: `fila${fila}@correo.co`,
      telefonoOriginal: "",
      categoria: "reclamable",
      dealId: "deal-1",
      detalle: "Lista para reclamar.",
    }));
    expect(marcarDuplicados(base).map((fila) => fila.categoria)).toEqual(["duplicada", "reclamable"]);
  });

  it("descarga solo no reclamados y neutraliza fórmulas", () => {
    const csv = csvDeNoReclamados([{
      fila: 2,
      correoOriginal: "=HIPERVINCULO(\"https://ejemplo.co\")",
      telefonoOriginal: "+1234567",
      categoria: "invalida",
      dealId: null,
      detalle: "No válido",
    }]);
    expect(csv).toContain('"\'=HIPERVINCULO(""https://ejemplo.co"")"');
    expect(csv).toContain('"\'+1234567"');
    expect(csv.startsWith("﻿")).toBe(true);
  });
});
