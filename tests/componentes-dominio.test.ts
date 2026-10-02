import { describe, expect, it } from "vitest";
import { agruparEnlaces } from "@/components/resources/helpers";
import { aMapeo, aPares } from "@/components/admin/mapeo-fuentes";

describe("helpers de componentes por dominio", () => {
  it("agrupa enlaces por programa, conservando el orden", () => {
    const enlaces = [
      {
        id: "1",
        url: "https://uno",
        monto: "10",
        moneda: "USD",
        programId: "p-comunicarte",
        programaNombre: "Comunicarte",
        plataformaNombre: null,
      },
      {
        id: "2",
        url: "https://dos",
        monto: "20",
        moneda: "USD",
        programId: "p-comunicarte",
        programaNombre: "Comunicarte",
        plataformaNombre: null,
      },
      {
        id: "3",
        url: "https://tres",
        monto: "30",
        moneda: "USD",
        programId: "p-sin",
        programaNombre: null,
        plataformaNombre: null,
      },
    ];

    expect(agruparEnlaces(enlaces)).toEqual([
      {
        programa: "Comunicarte",
        enlaces: [enlaces[0], enlaces[1]],
      },
      {
        programa: "Sin programa",
        enlaces: [enlaces[2]],
      },
    ]);
  });

  it("convierte mapeos a pares y vuelve a separar alternativas", () => {
    const mapeo = { correo: ["Email", "Correo"], nombre: "Nombre" };
    const pares = aPares(mapeo);

    expect(pares).toEqual([
      { campo: "correo", patron: "Email | Correo" },
      { campo: "nombre", patron: "Nombre" },
    ]);
    expect(aMapeo([...pares, { campo: " ", patron: "ignorado" }])).toEqual(mapeo);
  });
});
