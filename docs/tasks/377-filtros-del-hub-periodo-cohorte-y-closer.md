---
id: 377
etapa: hub
serves: "Weekly con Daniel Tovar del 3-nov (docs/hub.md §0, G-1, G-2) · ADR 0067, 0106 · absorbe lo que le faltaba al 251 y la parte del Hub del 360"
depends: [352]
status: todo
---

# 377 — Los filtros del Hub: periodo, cohorte y closer, cada uno por su lado

Entrega del Hub a Gerencia, fase 1 (`docs/hub.md` §0). Sin este ticket ninguna gráfica del Hub sirve: todo lo demás
lee estos filtros.

## Por qué

Daniel Tovar, weekly del 3-nov, mirando el filtro de periodo de Tactical:

> "Estás mezclando filtros en uno solo. Porque me estás poniendo periodo y SKU en un solo filtro. (...) O es el periodo
> o es el SKU, o son ambas cosas pero separadas."

> "Yo no sé cuándo comenzó ese cohort. Entonces, ahí debería salirme como abajito un texto que diga como: 'Cohort
> actual, se empezó a vender tal fecha'. O: 'La primera venta de ese SKU es tal fecha'."

> "Lo que veo es que la data está metida de alguna manera, pero todavía no es útil por los filtros que tiene."

Hoy (medido en el código, 3-nov): "Cohorte actual" y "Cohorte anterior" son **atajos del periodo**
(`lib/periodo.ts:15-16`, `preset: cohorte_actual`), que resuelven a la ventana de venta de la cohorte como rango de
fechas. No existe un filtro "solo las ventas de la cohorte C3" independiente de la fecha, y no se puede pedir "las
ventas de C2 que entraron en octubre" ni "todo el histórico".

**SKU, hoy, es la cohorte.** Un SKU es *producto × cohorte* ("Programa virtual C3"); mientras exista un solo producto
por programa (hasta el 376), el filtro Cohorte ES el filtro de SKU. Cuando entre el 376 se agrega el filtro Producto al
lado, sin tocar este: los dos componen y el URL que se guardó hoy sigue sirviendo. Por eso el parámetro se llama
`cohorte`, no `sku`.

## Alcance

1. **Cuatro controles en la barra del Hub, siempre en este orden y con su etiqueta escrita:**
   **Cohorte** · **Periodo** · **Closer** · **Comparar con**.
   - **Cohorte:** "Todas" y cada cohorte del programa por código, la activa marcada "(activa)". Por defecto, la activa.
     Parámetro `?cohorte=<id>` o `?cohorte=todas`; un id ajeno al programa se ignora (no filtra), como el de closer.
   - **Periodo:** Hoy, Ayer, Esta semana, Semana pasada, Este mes, Mes pasado, **Desde el inicio**, Rango. Se quitan
     "Cohorte actual" y "Cohorte anterior" de aquí. "Desde el inicio" = desde la primera venta de la cohorte elegida
     (o, con "Todas", desde el primer hecho del programa) hasta hoy. Por defecto: Desde el inicio (DH-1, decidido por
   Mani el 3-nov: se abre en la cohorte activa y desde el inicio).
   - **Closer:** el de hoy, con el parámetro `closer` (nombre único de la 360). Solo para quien `veEquipoComercial`.
   - **Comparar con:** lo del 251 que ya está en `main` ("mismo punto del periodo anterior", "cohorte anterior al mismo
     día hábil", "un rango", "no comparar"). Con una cohorte elegida y "Desde el inicio", "cohorte anterior" compara C3
     contra C2 al mismo día hábil de su venta.
2. **Qué hace cada filtro (una regla, escrita en `docs/metricas.md` §0 y en "Cómo se calcula"):** el Periodo filtra
   cada hecho por SU ancla de fecha (envío, agenda, cita, venta, abono: las que ya usa la capa de hechos del 262); la Cohorte filtra por la cohorte
   del deal (`deals.cohort_id`), en todos los hechos; los dos se cruzan con Y. "Todas" + "Desde el inicio" es el
   histórico de toda la vida del programa. Ninguna consulta nueva: los hechos del 262 ya tienen la dimensión cohorte
   (`hechosDelEmbudo`); el filtro se pasa a la consulta, nunca se filtra en memoria (C-2).
3. **El texto debajo del filtro Cohorte**, en una línea, siempre visible:
   "C3 · se vende del 1-oct al 30-nov · primera venta: 3-oct · última: 2-nov · 32 vendidos de 50".
   Las fechas salen de la cohorte (`fecha_inicio_ventas`, `fecha_cierre_ventas`) y de la primera y última venta
   reales (la función de venta del 352). Sin ventas: "aún sin ventas". Con "Todas": "Todas las cohortes · primera venta
   del programa: 12-may". Si una venta es anterior al inicio de ventas (los 5 de ComunicArte C3, C-08), la línea lo dice.
4. **Cruce vacío, dicho y no en ceros.** Periodo y cohorte que no se tocan (Mes pasado con una cohorte que empezó a
   vender este mes) muestran "C3 no tuvo actividad en octubre", no una pantalla de ceros (regla del vacío, N5).
5. **Enlaces viejos siguen sirviendo:** `?rango=cohorte` y `preset=cohorte_actual` se traducen a `cohorte=<activa>` +
   Desde el inicio; `cohorte_anterior`, a la anterior. Con test.
6. **Las listas detrás de cada cifra** (`urlDeLista`) reciben `cohorte` igual que hoy reciben `closer`: la cifra y su
   lista cuadran con el filtro puesto (contrato "Que toda cifra abra su lista").
7. **Pestaña Hoy:** ninguno de estos filtros aplica. Hoy es el reporte diario (373), del día elegido y de la cohorte
   activa, con su propio selector de día. La barra de filtros no se dibuja en Hoy.
8. **Lo que faltaba del 251:** el tooltip de la variación dice "contra el mismo punto de septiembre: 12 → 15, +3,
   +25 %"; recorrido visual y `test:humo`.

## Fuera

- El filtro Producto: 376.
- Los filtros de las listas (Leads, Deals, Calls, Students): siguen en el 360, fase 2.

## Done cuando

- [x] Test: con cohorte C2 y periodo Este mes, Vendido cuenta solo ventas de deals de C2 con fecha de venta en el mes;
  la misma venta con cohorte C3 no cuenta. Cifra y lista dan lo mismo en todas sus páginas.
- [x] Test: "Todas" + "Desde el inicio" da el total histórico del programa y no cruza programas.
- [x] Test: la línea de la cohorte muestra la primera venta real aunque sea anterior al inicio de ventas.
- [x] Test: un enlace viejo con `preset=cohorte_actual` abre con la cohorte activa y Desde el inicio.
- [x] Test: un `cohorte=<id>` de otro programa se ignora (el programa es frontera).
- [ ] Recorrido en `dev:local`, escritorio y 375 px: cada combinación de los cuatro filtros en Comercial y Dinero, clic
  en cada cifra hasta su lista; consola limpia. `npm run test:humo` en verde.
- [x] El 251 queda `reemplazado` por este ticket en su archivo y en el tracker.
- [x] Regla N8 (ADR 0115): `docs/metricas.md` §0 (la regla de los filtros), `overview.md` §11 (Cohorte, SKU) y el
  contrato de periodo de `docs/structure.md` §9 reescritos en el mismo commit.

## Notas de la entrega (4-nov)

- **Deuda previa, no del 377:** `test:humo` falla con closer, paid_trafficker y media por dos errores de consola en `/login · descubrir programas` (un 404 de recurso y la advertencia «script tag while rendering React component»). Reproducido idéntico en un worktree limpio de `main` (`a24320cb`), solo con el rol media. Con gerente y developer el humo pasa en escritorio y celular.
- Recorrido a 375 px hecho en Comercial y Dinero con cohorte (todas y una) × periodo × comparar: sin desborde ni errores.
- Pendiente de Mani: las decisiones de «Desde el inicio» (arranca en lo más temprano entre el inicio de ventas y la primera venta; termina en hoy) y las casillas del recorrido y del humo, que quedan sin marcar mientras el humo no esté en verde.
