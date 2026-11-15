---
id: 437
etapa: rendimiento
serves: "docs/estudio-rendimiento-y-conexion.md §13.3 (consultas idénticas) · contrato de rendimiento"
depends: [436]
status: en curso
---

# 437 — Una lectura se hace una vez por solicitud: fuera las consultas idénticas

## Qué
Un helper único que memoiza una lectura **dentro de un mismo render** y su aplicación a las lecturas que hoy se
repiten con los mismos parámetros. Meta: `identicas = 0` en toda ruta.

## Por qué (medido el 14-nov, estudio §13.3)
| Ruta | Consultas | Idénticas |
|---|---:|---:|
| `/p/[programa]/hub?seccion=pauta` | 846 | **515** |
| `/hub` | 286 | 139 |
| `/hub?seccion=comercial` | 278 | 107 |
| `/p/[programa]/hub?seccion=comercial` | 234 | 84 |
| `/p/[programa]/hub?seccion=dinero` | 172 | 83 |
| `/mi-espacio` (closer) | 47 | 19 |

Las que más se repiten: `tasasDelRango` (`lib/trm/consultar.ts:7`) ×74, `coberturaDeGasto`
(`lib/pauta/cobertura-de-gasto.ts:18`, dos consultas) ×67, `diasParaMadurarDe` (`lib/queries/tasas-del-grupo.ts:49`)
×57, la cohorte del programa ×14, `ventas_de_la_cohorte` ×14, `programasActivos` ×2 a ×3 en casi toda ruta.
Cada función las pide por su cuenta porque no sabe que otra ya las pidió: es correcto por módulo (N1) y caro por render.

## Archivos
`lib/db/por-solicitud.ts` (nuevo) · `lib/auth/solicitud.ts` (ya usa `cache` de React: mueve aquí su regla de "una
escritura nunca lee de la memoria" y que la importe) · las funciones de la tabla de abajo ·
`tests/por-solicitud.test.ts` · `tests/presupuesto-de-consultas.test.ts` (436: bajar topes).

## Cómo

`lib/db/por-solicitud.ts` (boceto):

```ts
import { cache } from "react";
import { db as dbDeLaApp } from "@/lib/db";
import type { Db } from "./tipos";
import { esEscrituraOFueraDeRequest } from "@/lib/auth/solicitud"; // o muévela aquí y que auth la importe

/** Un mapa por solicitud. `cache` de React da uno nuevo por request en el servidor; en tests es passthrough. */
const memoriaDeLaSolicitud = cache(() => new Map<string, Promise<unknown>>());

/**
 * Lee una vez por solicitud. `clave` nombra la pregunta Y sus argumentos ("diasParaMadurar:<programId>").
 *
 * Reglas (las vigila tests/por-solicitud.test.ts):
 * 1. Solo memoiza con la base de la app. Dentro de una transacción (`tx`) o con una base de prueba, lee directo:
 *    una transacción tiene que ver lo que ella misma escribió.
 * 2. Una server action nunca lee de la memoria (misma regla que lib/auth/solicitud.ts).
 * 3. Una promesa rechazada se quita del mapa: un error no se queda pegado.
 */
export async function unaVezPorSolicitud<T>(db: Db, clave: string, leer: () => Promise<T>): Promise<T> {
  if (db !== dbDeLaApp || (await esEscrituraOFueraDeRequest())) return leer();
  const memoria = memoriaDeLaSolicitud();
  const previa = memoria.get(clave) as Promise<T> | undefined;
  if (previa) return previa;
  const promesa = leer().catch((error) => { memoria.delete(clave); throw error; });
  memoria.set(clave, promesa);
  return promesa;
}
```

⚠️ `db` es un `Proxy`: comprueba que `db !== dbDeLaApp` compara la misma referencia que reciben las funciones (todas
usan `db: Db = dbDeLaApp`). Si no, exporta de `lib/db` un `esLaBaseDeLaApp(db)`.

Aplicación, sin cambiar firmas ni llamadores (la memoización va **dentro** de la función dueña del concepto):

```ts
// lib/queries/tasas-del-grupo.ts
export function diasParaMadurarDe(db: Db, programId: string): Promise<number> {
  return unaVezPorSolicitud(db, `diasParaMadurar:${programId}`, async () => {
    const [fila] = await db.select({ dias: programs.diasParaMadurar }).from(programs).where(eq(programs.id, programId));
    return fila?.dias ?? DIAS_PARA_MADURAR;
  });
}
```

| Función | Clave |
|---|---|
| `diasParaMadurarDe` | `diasParaMadurar:<programId>` |
| `tasasDelRango` (`lib/trm/consultar.ts`) | `tasas:<desde>:<hasta>` |
| `coberturaDeGasto` (`lib/pauta/cobertura-de-gasto.ts`) | `coberturaDeGasto:<programId>:<desde>:<hasta>` |
| `programasActivos` | `programasActivos` |
| la lectura de cohortes del programa y `ventasDeLaCohorte` | `<nombre>:<programId>:<cohortId>` |
| `arbolDePauta` (`lib/pauta/arbol.ts`) | `arbolDePauta:<programId>` |
| las demás que el medidor del 436 liste con `identicas > 0` | — |

El valor devuelto se comparte entre llamadores: **no lo mutes**. Si una función devuelve un `Map` o arreglo que algún
llamador modifica, devuelve una copia o congélalo. Búscalo antes de memoizar.

Método de trabajo: corre el medidor del 436 sobre cada ruta de la tabla, toma la lista de sentencias idénticas, y
memoiza la función dueña de cada una. No memoices en la página ni en el componente.

## Guardián
- `tests/presupuesto-de-consultas.test.ts` ya exige `identicas === 0` por función de página (436).
- `tests/por-solicitud.test.ts`: dos llamadas en la misma solicitud hacen una consulta; dentro de `db.transaction` son
  dos; en una server action son dos; tras un error se reintenta.

## Done cuando
- [ ] `identicas = 0` en las rutas del estudio §13.3, medido con el 436 en `dev:local` (pegar la tabla nueva aquí).
- [x] Hub › Pauta de un programa baja de 846 a ≤ 331 (medido 15-nov en dev:local: 837 → 323, 1 idéntica) consultas (846 − 515) solo con este ticket.
- [ ] `lib/auth/solicitud.ts` usa el helper o comparte su regla (una sola copia de "¿es escritura?").
- [ ] Recorrido en `dev:local`: registrar un abono y ver el saldo nuevo sin recargar (una escritura no lee de la memoria).
- [ ] Typecheck, lint, tests del cambio, build; tracker y `status:` iguales.

## Medición del 15-nov (dev:local, consultas totales / idénticas; antes → después)
| Ruta | Antes | Después |
|---|---|---|
| Hub › Pauta (programa) | 837 / 506 | 323 / 1 |
| `/hub` | 286 / 147 | 163 / 24 |
| `/hub?seccion=comercial` | 278 / 121 | 201 / 44 |
| Hub › Comercial (programa) | 234 / 94 | 152 / 12 |
| `/hub?seccion=pauta` | 202 / 56 | 152 / 6 |
| Hub › Dinero (programa) | 172 / 86 | 89 / 5 |
| `/hub?seccion=dinero` | 154 / 45 | 115 / 6 |
| Hub (programa, Hoy) | 138 / 60 | 87 / 9 |

Pendiente: idénticas restantes (sobre todo la lectura de closers por métrica en `/hub` y Comercial), prueba del abono en el navegador, tests de los módulos tocados y el topes de `presupuesto-de-consultas` (no baja: usa PGlite, el helper lee directo).
