---
id: 436
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §8.2, §9.1, §9.3 y §13.8 · contrato de rendimiento"
depends: [435]
status: en curso  # 17-nov: en producción con línea por petición y tabla §13.8; falta la casilla del presupuesto de 15 rutas, que cubre el guardián del 447
---

# 436 — Cada petición dice cuánto costó: consultas y milisegundos, en producción y en un test

## Qué
Un medidor único por petición (consultas, consultas idénticas, milisegundos en base y total) que: (1) escribe una
línea estructurada en los logs de Vercel, (2) alimenta un test de presupuesto por ruta, y (3) reemplaza al contador
suelto del MCP. Con él se llena la tabla de tiempos reales que hoy falta (estudio §13.8).

## Por qué
- Los logs de Vercel no traen duración; hoy no se puede saber cuánto tarda una página en producción.
- El inventario del 14-nov (estudio §13.3) se hizo con un parche temporal. Sin medidor permanente no hay presupuesto
  ni guardián: Hub › Pauta llegó a 846 consultas con la suite en verde.

## Archivos
`lib/db/medidor.ts` (nuevo; absorbe `lib/mcp/contador-de-consultas.ts`) · `lib/db/index.ts` (logger) ·
`instrumentation.ts` (nuevo, raíz) o el layout y los handlers, según lo que diga
`node_modules/next/dist/docs/01-app/02-guides/instrumentation.md` · `lib/mcp/` (usa el medidor nuevo) ·
`tests/presupuesto-de-consultas.test.ts` (nuevo) · `tests/helpers/` · `docs/estudio-rendimiento-y-conexion.md` §13.

## Cómo

`lib/db/medidor.ts` (boceto):

```ts
import { AsyncLocalStorage } from "node:async_hooks";

export interface CostoDeSolicitud {
  ruta: string;
  consultas: number;
  /** Misma sentencia con los mismos parámetros, repetida en esta solicitud. */
  identicas: number;
  /** Sentencia → veces. Solo las que pasan de 1, para el log. */
  repetidas: Map<string, number>;
  vistas: Set<string>;
  inicio: number;
}

const contexto = new AsyncLocalStorage<CostoDeSolicitud>();

/** Logger único de drizzle (N1: un concepto, un módulo). Fuera de una solicitud medida no hace nada. */
export const loggerDeCosto = {
  logQuery(sentencia: string, parametros: unknown[]): void {
    const costo = contexto.getStore();
    if (!costo) return;
    costo.consultas += 1;
    const llave = sentencia + "\u0000" + JSON.stringify(parametros);
    if (costo.vistas.has(llave)) costo.identicas += 1; else costo.vistas.add(llave);
    costo.repetidas.set(sentencia, (costo.repetidas.get(sentencia) ?? 0) + 1);
  },
};

export function medir<T>(ruta: string, ejecutar: () => Promise<T>): Promise<{ valor: T; costo: ResumenDeCosto }> { … }

/** Lo que va al log y al test. Nunca lleva parámetros ni texto de datos: solo conteos y la forma de la consulta. */
export interface ResumenDeCosto { ruta: string; consultas: number; identicas: number; nMasUno: number; ms: number }
```

- **Privacidad:** el log lleva la ruta como patrón (`/p/[programa]/hub`), nunca el path con ids, y nunca parámetros
  (AGENTS.md: identificadores opacos, nada personal en logs).
- **Log en producción:** una línea JSON por petición, `{"costo":{…}}`, solo si `consultas > 0`. Se busca con
  `vercel logs --query '"costo"'`.
- **Dónde se abre la medición de una página:** `AsyncLocalStorage.run` necesita envolver el render. Lee primero
  `node_modules/next/dist/docs/01-app/02-guides/instrumentation.md` y `open-telemetry.md` (AGENTS.md: este Next no es
  el de tu memoria). Si Next 16 no da un punto que envuelva el render, la alternativa es abrir el contexto en
  `paginaConRol`/`requireRole` con `enterWith` y cerrar con `after()`; decide con la documentación y deja escrito cuál.
- **Tiempo en base:** con `pg`, envolver `pool.query` da los milisegundos por consulta; suma `msEnBase` al resumen.

Test de presupuesto, `tests/presupuesto-de-consultas.test.ts` (PGlite, base por archivo):

```ts
// Una fila por función de página: lo que hoy cuesta y su tope. El tope solo baja (trinquete).
const PRESUPUESTOS: Record<string, { tope: number; llamar: (db: Db, ctx: Sembrado) => Promise<unknown> }> = {
  "hub-pauta-programa": { tope: 60, llamar: (db, s) => vistaPautaDelPrograma(db, s.programa.id, s.periodo) },
  "nerd-stats":         { tope: 12, llamar: (db) => Promise.all([conteosPorPrograma(db), fuentesConSalud(db), …]) },
  …
};

it.each(Object.entries(PRESUPUESTOS))("%s no pasa de su tope y no repite consultas", async (nombre, p) => {
  const { costo } = await medir(nombre, () => p.llamar(db, sembrado));
  expect(costo.consultas).toBeLessThanOrEqual(p.tope);
  expect(costo.identicas).toBe(0);
});
```

- La siembra del test usa **3 programas y 3 fuentes por programa**, y el test corre cada función con 3 y con 6
  programas: si las consultas crecen con el número de programas o fuentes, es N+1 y falla (salvo excepción nombrada).
- Los topes iniciales son los medidos hoy (trinquete, como `lib/metricas/registro.ts`); los tickets 437 a 439 los bajan.

## Done cuando
- [x] `conContadorDeConsultas` del MCP usa el medidor nuevo y `lib/mcp/contador-de-consultas.ts` se borra (N7); los
      tests del MCP siguen verdes.
- [x] En producción (17-nov: 199 líneas en 24 h), `vercel logs --query costo` muestra una línea por petición con ruta, consultas, idénticas y ms.
- [x] (17-nov, §13.8) El estudio §13 gana la tabla **"Tiempos en Vercel"**: p50 y p95 de ms y consultas por ruta, de 24 h de logs
      reales (la llena la sesión principal). Con eso se cierra §13.8.
- [ ] (parcial: 10 funciones cubiertas, faltan las de las demás rutas del §13.3; el trinquete ya muerde) `tests/presupuesto-de-consultas.test.ts` cubre las funciones de página de las 15 rutas más caras del estudio
      §13.3, con su tope y la prueba de 3 contra 6 programas.
- [x] Ningún parámetro ni dato personal en el log (test que lo afirma sobre la línea emitida).
- [x] Typecheck, lint, tests del cambio, build; tracker y `status:` iguales.
