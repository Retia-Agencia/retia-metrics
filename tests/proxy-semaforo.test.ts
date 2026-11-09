import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Cada ruta de maquina de /api/semaforo se autentica con su secreto en el handler, pero el proxy
// redirige a login todo lo que no este en su lista publica. Una ruta nueva sin su linea responde
// "Necesitas iniciar sesion" a Juanito para siempre, sin un error en el codigo (ticket 408).
function rutas(dir: string, base: string): string[] {
  const salida: string[] = [];
  for (const nombre of readdirSync(dir)) {
    const ruta = join(dir, nombre);
    if (statSync(ruta).isDirectory()) salida.push(...rutas(ruta, `${base}/${nombre}`));
    else if (nombre === "route.ts") salida.push(base);
  }
  return salida;
}

describe("proxy: rutas de maquina del semaforo", () => {
  it("toda route.ts bajo /api/semaforo esta en la lista publica del proxy", () => {
    const proxy = readFileSync(join(process.cwd(), "proxy.ts"), "utf8");
    const encontradas = rutas(join(process.cwd(), "app/api/semaforo"), "/api/semaforo");
    expect(encontradas.length).toBeGreaterThanOrEqual(4);
    for (const ruta of encontradas) expect(proxy).toContain(`pathname === "${ruta}"`);
  });
});
