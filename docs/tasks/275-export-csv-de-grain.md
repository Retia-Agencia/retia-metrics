---
id: 275
etapa: llamadas
serves: "Gerencia baja en un CSV todos los links de Grain de un programa, filtrados por closer y por fechas, sin abrir llamada por llamada (Mani, 16-oct)"
depends: [098]
status: todo
---

# 275 — Export CSV de los links de Grain

## Por qué

El link de Grain vive en `calls.link_grain` (ticket 058). Hoy, para revisar las grabaciones de un closer o de la última
semana, hay que abrir llamada por llamada en Calls. Gerencia pidió un documento con todos los links.

## Qué

Un botón **"Descargar Grain (CSV)"** en la barra de Calls (`/p/<programa>/calls`, slot `acciones` de `BarraDeLista`)
que baja un CSV con **las llamadas que la lista muestra con los filtros de la URL** (closer, resultado, desde, hasta,
búsqueda), **sin paginar**, y **solo las que tienen Grain**. "La última semana" es el filtro Desde/Hasta que ya existe:
no se agrega un preset.

### Decisiones

1. **Una sola lectura de la URL.** El armado de `FiltroLlamadas` desde los `searchParams` (hoy dentro de
   `app/(app)/p/[programa]/calls/page.tsx`) se mueve a una función `filtroDeLlamadasDesdeUrl` en
   `lib/queries/llamadas.ts`, junto con `RESULTADOS`. La usan la página y el export: si dos lugares responden la misma
   pregunta, la respuesta vive en un módulo (AGENTS.md, ADR 0024). La regla de que el filtro de closer solo aplica con
   `alcance.tipo === "todos"` va dentro.
2. **"¿Tiene Grain?" vive en `lib/queries/sin-grain.ts`**: `tieneGrain(link: string | null): boolean`, el complemento
   exacto de `sinGrabacion()` (nulo o `trim` vacío = sin Grain). El export filtra en memoria con ella sobre lo que
   devuelve `llamadasDelPrograma`.
3. **La ruta:** `app/(app)/p/[programa]/calls/grain.csv/route.ts`, `GET`. Mismas guardas que la página:
   `requireRole("gerente", "closer")` (el developer pasa por `esAccesoTotal`), `rolDeVista`, `programaVisiblePorSlug`
   (programa ajeno o inexistente → 404), `alcanceDeDeals` (un closer solo baja lo suyo, igual que en la lista). El
   programa es frontera: un CSV es de un programa.
4. **Columnas, en este orden:** `Fecha llamada` (fecha de la llamada, o de la agenda si no hay; `fechaHoraEnBogota`),
   `Lead`, `Correo`, `Closer`, `Resultado` (la etiqueta en español de `RESULTADOS`), `Etapa del deal` (`nombreDeEtapa`),
   `Link Grain`, `Link CRM` (URL absoluta al deal, con el origen de la petición). Orden de filas: el `orden` de la URL.
5. **Formato del CSV**, en una función pura `csvDeGrain(filas)` en `lib/llamadas/csv-grain.ts`: separador `,`, CRLF,
   BOM UTF-8 (Excel lee las tildes), toda celda entre comillas con `"` duplicadas, y **neutralizar inyección de
   fórmulas**: una celda que empiece con `=`, `+`, `-`, `@`, tab o CR lleva un `'` adelante.
6. **Respuesta:** `content-type: text/csv; charset=utf-8`, `content-disposition: attachment;
   filename="grain-<slug>-<AAAA-MM-DD>.csv"` (fecha de `hoyEnBogota()`), `cache-control: no-store`. Cero filas → CSV
   con solo el encabezado, 200.
7. **El botón** es un enlace (`<a href download>`, con el `Button` de Base UI vía `render`) que arma su `href` con la
   query actual sin `pagina`. Se construye en la página del servidor y llega como prop: ningún import de `lib/` con base
   en un cliente (regla del build de AGENTS.md).
8. Leer `calls` sigue pasando por `vigente` (ya lo hace `llamadasDelPrograma`): anuladas fuera.

## Done cuando

- `tests/csv-grain.test.ts`: escape de comillas y comas, BOM, CRLF, inyección (`=HYPERLINK(...)`, `+`, `-`, `@`),
  celdas nulas como vacío, `tieneGrain` en los dos sentidos (nulo, `"  "`, link real).
- Un test de la ruta (molde de `tests/paginas.test.ts` / `tests/guards.test.ts` para la sesión): sin sesión → 401;
  programa ajeno → 404; un closer no recibe llamadas de otro closer aunque pase `?closer=<id ajeno>`; las llamadas sin
  Grain y las anuladas no salen; los filtros de la URL dan las mismas llamadas que la lista menos las sin Grain.
- La página de Calls se comporta igual que antes (usa la función movida).
- `npm run typecheck`, `npm run lint`, los tests del cambio y `npm run build` (toca un componente cliente) limpios.

## Fuera de alcance

Export de varios programas a la vez, otros formatos (xlsx), un preset "última semana", columnas de dinero.
