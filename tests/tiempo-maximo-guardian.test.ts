import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { describe, expect, it } from "vitest";
import {
  MAX_SEGUNDOS_CRON,
  MAX_SEGUNDOS_MAQUINA,
  MAX_SEGUNDOS_PAGINA,
} from "@/lib/tiempos";

const RAIZ = join(process.cwd(), "app");

export type FuenteConRuta = { ruta: string; fuente: string };

function recorrer(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entrada) =>
    entrada.isDirectory() ? recorrer(join(dir, entrada.name)) : [join(dir, entrada.name)],
  );
}

function rutaPortable(ruta: string): string {
  return ruta.split(sep).join("/");
}

export function limiteDeHandler(ruta: string): number {
  if (ruta.startsWith("api/cron/")) return MAX_SEGUNDOS_CRON;
  if (ruta.startsWith("api/") || ruta.startsWith(".well-known/")) return MAX_SEGUNDOS_MAQUINA;
  return MAX_SEGUNDOS_PAGINA;
}

function maxDurationLiteral(fuente: string): number | null {
  const coincidencia = fuente.match(/^export const maxDuration = (\d+);?$/m);
  return coincidencia ? Number(coincidencia[1]) : null;
}

/** Incumplimientos de los topes estaticos que Next necesita leer al compilar. */
export function incumplimientosDeTiempoMaximo(fuentes: FuenteConRuta[]): string[] {
  const problemas: string[] = [];
  const layout = fuentes.find(({ ruta }) => rutaPortable(ruta) === "layout.tsx");
  if (!layout || maxDurationLiteral(layout.fuente) !== MAX_SEGUNDOS_PAGINA) {
    problemas.push(`layout.tsx debe declarar maxDuration = ${MAX_SEGUNDOS_PAGINA}`);
  }

  for (const { ruta, fuente } of fuentes) {
    const portable = rutaPortable(ruta);
    if (!portable.endsWith("route.ts")) continue;
    const valor = maxDurationLiteral(fuente);
    const limite = limiteDeHandler(portable);
    if (valor === null) problemas.push(`${portable}: falta maxDuration literal`);
    else if (valor > limite) problemas.push(`${portable}: maxDuration ${valor} supera ${limite}`);
  }
  return problemas;
}

describe("guardián de tiempo máximo", () => {
  it("la raíz y todos los handlers declaran un límite acorde a su clase", () => {
    const fuentes = recorrer(RAIZ)
      .filter((ruta) => ruta.endsWith("route.ts") || ruta === join(RAIZ, "layout.tsx"))
      .map((ruta) => ({ ruta: relative(RAIZ, ruta), fuente: readFileSync(ruta, "utf8") }));
    expect(incumplimientosDeTiempoMaximo(fuentes)).toEqual([]);
  });

  it("muerde: rechaza un handler sin límite o excedido y acepta uno correcto", () => {
    const layout = { ruta: "layout.tsx", fuente: `export const maxDuration = ${MAX_SEGUNDOS_PAGINA};` };
    const correcto = { ruta: "api/me/route.ts", fuente: "export const maxDuration = 60;" };
    expect(incumplimientosDeTiempoMaximo([layout, correcto])).toEqual([]);
    expect(incumplimientosDeTiempoMaximo([layout, { ...correcto, fuente: "export function GET() {}" }])).toEqual([
      "api/me/route.ts: falta maxDuration literal",
    ]);
    expect(incumplimientosDeTiempoMaximo([layout, { ...correcto, fuente: "export const maxDuration = 61;" }])).toEqual([
      "api/me/route.ts: maxDuration 61 supera 60",
    ]);
  });
});
