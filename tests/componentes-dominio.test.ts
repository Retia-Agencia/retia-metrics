import { describe, expect, it } from "vitest";
import { agruparEnlaces } from "@/components/resources/helpers";
import { aMapeo, aPares } from "@/components/admin/mapeo-fuentes";

describe("helpers de componentes por dominio", () => {
  it("agrupa enlaces por programa y producto, conservando el orden", () => {
    const enlaces = [
      {
        id: "1",
        url: "https://uno",
        monto: "10",
        moneda: "USD",
        programaNombre: "Comunicarte",
        productoNombre: "Completo",
        plataformaNombre: null,
      },
      {
        id: "2",
        url: "https://dos",
        monto: "20",
        moneda: "USD",
        programaNombre: "Comunicarte",
        productoNombre: "Completo",
        plataformaNombre: null,
      },
      {
        id: "3",
        url: "https://tres",
        monto: "30",
        moneda: "USD",
        programaNombre: null,
        productoNombre: null,
        plataformaNombre: null,
      },
    ];

    expect(agruparEnlaces(enlaces)).toEqual([
      {
        programa: "Comunicarte",
        productos: [{ producto: "Completo", enlaces: [enlaces[0], enlaces[1]] }],
      },
      {
        programa: "Sin programa",
        productos: [{ producto: "Sin producto", enlaces: [enlaces[2]] }],
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
