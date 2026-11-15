---
id: 443
etapa: rendimiento
serves: "Mani, 14-nov: revisar el lado cliente · docs/estudio-rendimiento-y-conexion.md §13.6"
depends: [436]
status: todo
---

# 443 — El navegador recibe solo lo que la pantalla usa

## Qué
Bajar el JavaScript y el HTML que recibe cada pantalla: gráficas con carga diferida, frontera servidor/cliente más
abajo, y listas largas que no mandan cientos de nodos de una vez.

## Por qué (medido el 14-nov, build de producción; estudio §13.6)
| Ruta | JS | JS comprimido | HTML | Nodos |
|---|---:|---:|---:|---:|
| `/mi-espacio` (sin gráficas) | 925 KB | 286 KB | 64 KB | 320 |
| `/p/[programa]/deals` (Kanban) | 959 KB | 301 KB | 531 KB | 2.807 |
| `/p/[programa]/hub?seccion=pauta` | 949 KB | 297 KB | 663 KB | 1.802 |
| `/login` | 508 KB | 159 KB | 4 KB | — |

- Toda ruta carga ~290 KB comprimidos, tenga o no gráficas: el JavaScript no se reparte por pantalla.
- 93 de 164 componentes son `"use client"`; un solo `next/dynamic`; 3 `<Suspense>`.
- El HTML de Deals (531 KB) y de Hub › Pauta (663 KB) lleva todo el contenido y, además, su copia serializada para
  hidratar los componentes cliente.

## Archivos
`components/graficas/` (la pieza de `echarts/core`) · los componentes cliente más grandes (los lista el paso 1) ·
el Kanban de Deals y las tablas de Pauta · `next.config.ts` · `tests/peso-de-cliente.test.ts` (nuevo).

## Cómo

**1. Medir qué pesa.** `ANALYZE=true npm run build` con el analizador que indique
`node_modules/next/dist/docs/01-app/02-guides/` (busca la guía de análisis de bundles; con Turbopack el paquete
clásico puede no aplicar). Entrega la lista de los 10 módulos más pesados del JavaScript común y a qué ruta sirven.

**2. Gráficas con carga diferida** (guía `lazy-loading.md`). El contrato de gráficas (AGENTS.md) ya obliga a pasar
por `components/graficas/`: se difiere en un solo lugar.

```tsx
// components/graficas/index.tsx — el punto de entrada que importan las pantallas
import dynamic from "next/dynamic";
import { EsqueletoDeGrafica } from "./esqueleto";

export const Grafica = dynamic(() => import("./grafica").then((m) => m.Grafica), {
  loading: () => <EsqueletoDeGrafica />,   // misma altura que la gráfica: sin salto de diseño
  // ssr: false solo si la guía lo permite desde un componente de servidor en esta versión
});
```

La tabla alternativa y el título de cada gráfica siguen saliendo del servidor (contrato de gráficas): se difiere el
dibujo, no el dato.

**3. Bajar la frontera cliente.** Regla: `"use client"` va en la hoja que tiene estado o eventos, no en el
contenedor. Por cada componente cliente de más de ~150 líneas, separa la parte que solo pinta (servidor) de la que
interactúa (cliente), y pasa datos ya proyectados por props: nunca la fila completa de la base. Los props de un
componente cliente se serializan dos veces en el HTML.

**4. Listas largas.** El Kanban manda 114 tarjetas y 2.807 nodos de una vez. Aplica el contrato que ya existe para
las listas ("pagina en el servidor"): cada columna muestra las primeras N tarjetas y un "ver más" que pide las
siguientes. N se decide mirando la pantalla con Mani (interfaz: `docs/structure.md` §9 y el boceto de referencia).
No cambia qué deals existen ni sus conteos por columna.

**5. Presupuesto.** `tests/peso-de-cliente.test.ts` lee el manifiesto del build (`.next/`) y falla si el JavaScript
de primera carga de una ruta pasa de su tope; corre en el job de build del CI.

## Done cuando
- [ ] Lista de los 10 módulos más pesados, pegada aquí, antes de cambiar nada.
- [ ] Una ruta sin gráficas (`/mi-espacio`, `/p/[programa]/leads`) carga ≤ 200 KB comprimidos de JavaScript (hoy
      ~285); las de gráficas, ≤ 300.
- [ ] HTML de Deals ≤ 250 KB (hoy 531) y de Hub › Pauta ≤ 350 KB (hoy 663).
- [ ] Ninguna gráfica salta de tamaño al cargar; comparación con el boceto en claro, oscuro y 375 px.
- [ ] `npm run build`, humo de la UI verde (abre cada pantalla y cada diálogo), `tests/frontera-cliente-guardian`
      verde; tracker y `status:` iguales.
