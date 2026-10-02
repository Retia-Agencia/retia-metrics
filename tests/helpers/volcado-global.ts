import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { TestProject } from "vitest/node";
import { volcarBaseMigrada } from "./volcar-base-migrada";

declare module "vitest" {
  export interface ProvidedContext {
    rutaVolcadoMigrado: string;
  }
}

export default async function setup(project: TestProject): Promise<() => Promise<void>> {
  // Primero el volcado: si una migracion trae SQL invalido, revienta aca y la corrida
  // entera falla con ese error, sin dejar una carpeta temporal huerfana.
  const volcado = await volcarBaseMigrada();
  const directorio = await mkdtemp(join(tmpdir(), "retia-volcado-"));
  const rutaVolcado = join(directorio, "base-migrada.tar");
  await writeFile(rutaVolcado, new Uint8Array(await volcado.arrayBuffer()));
  project.provide("rutaVolcadoMigrado", rutaVolcado);

  return () => rm(directorio, { recursive: true, force: true });
}
