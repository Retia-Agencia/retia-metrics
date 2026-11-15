import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { claveDe, crearUnaVezPorSolicitud } from "@/lib/db/por-solicitud";
import type { Db } from "@/lib/db/tipos";

const dbApp = {} as Db;
const dbOtra = {} as Db;

function fabrica(opciones: { escritura?: boolean; fallaEscritura?: boolean; fallaMemoria?: boolean } = {}) {
  const memoria = new Map<string, Promise<unknown>>();
  return crearUnaVezPorSolicitud({
    obtenerMemoria: () => {
      if (opciones.fallaMemoria) throw new Error("sin solicitud");
      return memoria;
    },
    esLaBaseDeLaApp: (db) => db === dbApp,
    esEscritura: async () => {
      if (opciones.fallaEscritura) throw new Error("sin solicitud");
      return opciones.escritura ?? false;
    },
  });
}

describe("unaVezPorSolicitud", () => {
  it("comparte una lectura de la misma clave", async () => {
    const { unaVezPorSolicitud } = fabrica();
    let lecturas = 0;
    const leer = async () => ++lecturas;
    expect(await unaVezPorSolicitud(dbApp, "pregunta:1", leer)).toBe(1);
    expect(await unaVezPorSolicitud(dbApp, "pregunta:1", leer)).toBe(1);
    expect(lecturas).toBe(1);
  });

  it("separa claves distintas", async () => {
    const { unaVezPorSolicitud } = fabrica();
    let lecturas = 0;
    await unaVezPorSolicitud(dbApp, "pregunta:1", async () => ++lecturas);
    await unaVezPorSolicitud(dbApp, "pregunta:2", async () => ++lecturas);
    expect(lecturas).toBe(2);
  });

  it("lee directo con una base que no es la de la app", async () => {
    const { unaVezPorSolicitud } = fabrica();
    let lecturas = 0;
    const leer = async () => ++lecturas;
    await unaVezPorSolicitud(dbOtra, "pregunta:1", leer);
    await unaVezPorSolicitud(dbOtra, "pregunta:1", leer);
    expect(lecturas).toBe(2);
  });

  it("lee directo durante una escritura", async () => {
    const { unaVezPorSolicitud } = fabrica({ escritura: true });
    let lecturas = 0;
    const leer = async () => ++lecturas;
    await unaVezPorSolicitud(dbApp, "pregunta:1", leer);
    await unaVezPorSolicitud(dbApp, "pregunta:1", leer);
    expect(lecturas).toBe(2);
  });

  it("retira una promesa rechazada y permite reintentar", async () => {
    const { unaVezPorSolicitud } = fabrica();
    let lecturas = 0;
    const leer = async () => {
      lecturas += 1;
      if (lecturas === 1) throw new Error("temporal");
      return "ok";
    };
    await expect(unaVezPorSolicitud(dbApp, "pregunta:1", leer)).rejects.toThrow("temporal");
    await expect(unaVezPorSolicitud(dbApp, "pregunta:1", leer)).resolves.toBe("ok");
    expect(lecturas).toBe(2);
  });

  it("olvida solo las claves del prefijo", async () => {
    const { unaVezPorSolicitud, olvidarDeLaSolicitud } = fabrica();
    let a = 0;
    let b = 0;
    await unaVezPorSolicitud(dbApp, "a:1", async () => ++a);
    await unaVezPorSolicitud(dbApp, "b:1", async () => ++b);
    olvidarDeLaSolicitud("a:");
    await unaVezPorSolicitud(dbApp, "a:1", async () => ++a);
    await unaVezPorSolicitud(dbApp, "b:1", async () => ++b);
    expect({ a, b }).toEqual({ a: 2, b: 1 });
  });

  it("comparte una promesa que sigue en curso", async () => {
    const { unaVezPorSolicitud } = fabrica();
    let resolver!: (valor: number) => void;
    let lecturas = 0;
    const leer = () => {
      lecturas += 1;
      return new Promise<number>((resolve) => { resolver = resolve; });
    };
    const primera = unaVezPorSolicitud(dbApp, "pregunta:1", leer);
    const segunda = unaVezPorSolicitud(dbApp, "pregunta:1", leer);
    await Promise.resolve();
    resolver(7);
    await expect(Promise.all([primera, segunda])).resolves.toEqual([7, 7]);
    expect(lecturas).toBe(1);
  });

  it.each([
    { fallaEscritura: true },
    { fallaMemoria: true },
  ])("fuera de una solicitud lee directo sin propagar el fallo del alcance", async (opciones) => {
    const { unaVezPorSolicitud, olvidarDeLaSolicitud } = fabrica(opciones);
    let lecturas = 0;
    await unaVezPorSolicitud(dbApp, "pregunta:1", async () => ++lecturas);
    await unaVezPorSolicitud(dbApp, "pregunta:1", async () => ++lecturas);
    expect(() => olvidarDeLaSolicitud("pregunta:")).not.toThrow();
    expect(lecturas).toBe(2);
  });

  it("arma claves estables para objetos e ids", () => {
    expect(claveDe("pregunta", { b: 2, a: 1 }, ["z", "a"]))
      .toBe(claveDe("pregunta", { a: 1, b: 2 }, ["a", "z"]));
  });
});

function llamadasSinPreguntaLiteral(fuente: string): string[] {
  const sinDeclaracion = fuente.replace(/(?:async\s+)?function\s+unaVezPorSolicitud[^\{]+\{/g, "");
  return [...sinDeclaracion.matchAll(/unaVezPorSolicitud\s*\(\s*[^,]+,\s*([^,\n]+)/g)]
    .map((coincidencia) => coincidencia[1]!.trim())
    .filter((clave) => !/^(?:claveDe\(\s*)?["'][A-Za-z][A-Za-z0-9]*/.test(clave));
}

function archivosTs(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entrada) => {
    const ruta = path.join(dir, entrada.name);
    return entrada.isDirectory() ? archivosTs(ruta) : /\.tsx?$/.test(entrada.name) ? [ruta] : [];
  });
}

describe("guardian de claves", () => {
  it("exige que cada llamada nombre literalmente la pregunta", () => {
    const culpables = archivosTs(path.join(process.cwd(), "lib"))
      .flatMap((archivo) => llamadasSinPreguntaLiteral(fs.readFileSync(archivo, "utf8")).map(() => archivo));
    expect(culpables).toEqual([]);
  });

  it("muerde una llamada sin nombre literal", () => {
    expect(llamadasSinPreguntaLiteral("unaVezPorSolicitud(db, claveDinamica, leer)")).toEqual(["claveDinamica"]);
  });
});
