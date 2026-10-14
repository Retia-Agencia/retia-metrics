import { afterEach, describe, expect, it } from "vitest";

import { esFirmaLocalValida, esRutaLocalValida, firmaDeUrlLocal } from "@/lib/archivos/disco";

const RUTA = "550e8400-e29b-41d4-a716-446655440000/2026-10/550e8400-e29b-41d4-a716-446655440001.pdf";
const SECRETO = "secreto-de-prueba";
const DATABASE_URL_PREVIA = process.env.DATABASE_URL;

afterEach(() => {
  if (DATABASE_URL_PREVIA === undefined) delete process.env.DATABASE_URL;
  else process.env.DATABASE_URL = DATABASE_URL_PREVIA;
});

describe("firmas del almacén local", () => {
  it("acepta una firma vigente", () => {
    const exp = 2_000;
    const firma = firmaDeUrlLocal("GET", RUTA, exp, SECRETO);
    expect(esFirmaLocalValida("GET", RUTA, exp, firma, { secreto: SECRETO, ahora: 1_000 })).toBe(true);
  });

  it("rechaza una firma expirada o alterada", () => {
    const exp = 2_000;
    const firma = firmaDeUrlLocal("GET", RUTA, exp, SECRETO);
    expect(esFirmaLocalValida("GET", RUTA, exp, firma, { secreto: SECRETO, ahora: 2_001 })).toBe(false);
    expect(esFirmaLocalValida("PUT", RUTA, exp, firma, { secreto: SECRETO, ahora: 1_000 })).toBe(false);
    expect(esFirmaLocalValida("GET", RUTA, exp, `${firma.slice(0, -1)}0`, { secreto: SECRETO, ahora: 1_000 })).toBe(false);
  });

  it("rechaza traversal y rutas fuera del formato", () => {
    expect(esRutaLocalValida(`../${RUTA}`)).toBe(false);
    expect(esRutaLocalValida(RUTA.replace("2026-10", "cualquier-cosa"))).toBe(false);
  });
});

it("la ruta local no existe cuando DATABASE_URL no es local", async () => {
  process.env.DATABASE_URL = "postgresql://usuario:clave@db.example.com/base";
  const { GET } = await import("@/app/api/archivos-locales/[...ruta]/route");
  const respuesta = await GET(
    new Request(`http://localhost/api/archivos-locales/${RUTA}`),
    { params: Promise.resolve({ ruta: RUTA.split("/") }) },
  );
  expect(respuesta.status).toBe(404);
});
