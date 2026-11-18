---
id: 420
etapa: pauta
serves: "docs/diseno-cifra-y-pauta.md §3 a §6 (norte: docs/bocetos/una-forma-de-metrica.html, tal cual) · DM-3, DM-5, DM-6, DM-7 · docs/paid-media-excels-2026-11-10.md §5.3 y §9.4 · ADR 0091 · ADR 0106"
depends: [419]
status: en curso
---

# 420 — Hub › Pauta en dos vistas, con la forma aprobada

## Por qué

Hoy Pauta pinta nueve bloques en una pantalla (`app/(app)/p/[programa]/hub/page.tsx:675-694`). Mani aprobó partirla en
**Resultados** (lo que reemplaza al Excel) y **Origen y calidad**, con filtros flexibles y gráficas interactivas.

## Alcance

1. **Dos vistas** con `?vista=resultados|calidad` y el componente de pestañas existente; mismos filtros.
2. **Barra de filtros** (§3): programa, cohorte, periodo con "Elegir fechas", comparar con, y **Ver solo** (cuenta, canal,
   campaña, conjunto, anuncio). Línea de resumen en palabras. Cuenta llega con el 416; si conjunto no es dimensión, se agrega.
3. **Resultados** (§4): cumplimiento con Cupos | Plata y la fila de ritmo (agendas por día real, necesarias, inversión por día
   necesaria al objetivo y al promedio); "¿Cómo va el costo por agenda hoy?" en Cifras con "otras campañas"; la tabla con leyenda
   del cambio, Total del periodo resaltado, "en curso" y "Parcial"; la gráfica; el ROAS a hoy y el proyectado.
4. **Gráfica interactiva** (§4.4) sobre `components/graficas/` (nunca echarts directo): tres interruptores en la URL, tooltip,
   **clic en un punto abre la explicación del 419** (ampliar el contrato del ADR 0091 si no admite clic), leyenda, zoom, línea
   punteada del periodo anterior, tabla alternativa, meta como número junto al título.
5. **Origen y calidad** (§5): "¿Qué trae ventas?" con Ver por Cuenta | Canal | Campaña | Anuncio y "Revisar"; "¿Qué llega sin
   origen?" con las dos cifras y la lista por anuncio; el embudo con el detalle por pregunta dentro.
6. Retirar lo que queda duplicado (N7): el bloque Origen suelto y el embudo por pregunta separado.

**Archivos:** `app/(app)/p/[programa]/hub/page.tsx` (sección Pauta), `components/pauta/*`, `components/semaforo/*`,
`components/graficas/*`, `lib/metas/cumplimiento-de-cohorte.ts` (ritmo).

**Migración:** Ninguna.

## Fuera

Rótulos y fórmulas en D-A, D-B, D-C, D-E (403 F1): se construye la forma y se usa el rótulo vigente hasta que Mani decida.

## Done cuando

- [x] Las dos vistas iguales al boceto en claro, oscuro y 375 px, lado a lado con el HTML. Toda cifra es la Cifra del 419 (la pieza del boceto); recorridas en claro, oscuro y 375 px sin scroll horizontal (11-nov).
- [ ] Todo filtro en la URL y toda cifra recalculada con él; el cumplimiento solo sigue la cohorte; "hoy" siempre es hoy. **Hecho para los filtros que existen** (`vista`, `ver_por`, `cumpl`, `g_pauta-diaria`, cohorte, periodo, closer, comparar). **Falta «Ver solo»** (cuenta, canal, campaña, conjunto, anuncio): ninguna consulta de Pauta acepta todavía la dimensión, Cuenta espera al 416 y Conjunto no es dimensión. Tampoco existen los atajos «Últimos 7 · 14 · 28 días» (el periodo es de todo el Hub; agregarlos enmienda el ADR 0067/0106).
- [x] Agendas por día real e inversión por día necesaria con su ficha en `metricas.md` (§3.4; también inversión y costo por agenda por origen en §3.2).
- [x] Gráfica con clic a la explicación, tooltip, leyenda, zoom y tabla alternativa; ninguna pantalla importa echarts (`components/pauta/movimiento-diario.tsx`, `components/graficas/grafica-con-explicacion.tsx`, enmienda del ADR 0091).
- [x] Ninguna cifra de los nueve bloques se perdió (tabla del §6 verificada una por una, abajo).
- [x] Recorrido del paid trafficker y del gerente; `test:humo`, build y consola limpia (11-nov: humo escritorio 5/5 y celular 5/5).

## Avance (11-nov)

**17-nov · «Ver solo» fase 2b: tabla semanal/diaria, CSV, listas y gráfica**

- **Hecho:** `cargarPautaSemanal` acepta `corte`. Inversión, CPM, CTR, llegada y frecuencia usan solo el gasto del
  objeto y sus descendientes (el gasto manual no entra); agendas, ventas, vendido, CAC, profit, registros y la serie
  diaria usan los deals que heredan un envío del corte (`lib/queries/deals-del-corte-de-pauta.ts`, que reutiliza
  `completoDelParcial` y `atribucionPorDeal`); % show, cierre y cita a venta leen el grupo de citas de esos deals
  (`leerCitasDelGrupo` con `corte`). Agendas de Meta y los dos costos por agenda siguen cuenta y campaña; con conjunto o
  anuncio dicen «No disponible para este corte: el detalle se guarda por campaña». El CSV valida `corte`/`corte_id`
  con el mismo resolver; las listas de agendas, cierres, shows y vendidos que abre la tabla llevan el corte; la gráfica
  diaria agrega «Solo · …». Se quitó el aviso «La tabla todavía muestra todo el programa…».
- **Una sola definición:** la pertenencia de un objeto al corte (`objetoPerteneceAlCorte`) y la lectura de objetos
  (`lib/queries/objetos-para-atribucion.ts`, misma clave de caché del ROAS) salen del ROAS y se comparten.
  `agendasDelCorte` pasa a sumar `agendasPorDiaDelCorte`.
- **Sin corte nada cambia:** misma rama, mismas consultas y claves; lo fija el test de paridad (las marcas de tiempo
  del reloj de pared que ya usaba una lectura existente se normalizan en la comparación).
- **Tests:** nuevo `tests/corte-de-pauta-semanal.test.ts`. Ningún test existente cambió.
- **Verificado:** typecheck; lint 0 errores; suite completa 4.611 verde; dev:local como gerente: Agenda Milena y Agenda
  Rosario suman las agendas de Meta del total (10 + 30 = 40) y su inversión excluye el gasto manual; conjunto deja
  Agendas de Meta sin dato; CSV con corte de campaña corta y con id de nivel equivocado da lo mismo que sin corte;
  consola limpia. En la semilla ninguna cita tiene ids de Meta, así que las agendas por campaña dan 0 (correcto).
- **Pendiente:** la explicación de cada celda de la tabla no lleva «Solo · …» (`cifraDeCeldaSemanal` arma sus filtros
  por dentro; ampliarlo es otra entrega). `idsDeDealsDelCorte` atribuye todos los deals del programa por lotes en cada
  solicitud con corte: revisar el tiempo con datos reales. Con corte, el costo por agenda de hoy reconoce gasto
  cargado directo a una campaña o conjunto (sin corte cae en «sin campaña» como antes). Sin `npm run build` ni
  `test:humo`. Fase 3 (Canal) espera a Mani.

**17-nov · «Ver solo» fase 2a: selector, URL, ROAS, proyección y costo de hoy**

- **Hecho:** control «Ver solo» en la barra de Pauta (`components/hub/filtros-del-hub.tsx`), con Todo el programa y los
  grupos Cuenta de Meta · Campaña · Conjunto · Anuncio; sin Canal (fase 3) ni «Sin cuenta de Meta». URL
  `?corte=<nivel>&corte_id=<uuid>`; `lib/pauta/opciones-de-corte.ts` (una lectura liviana por programa, sin datos
  personales) alimenta el selector y valida en servidor; `lib/pauta/corte-de-pauta.ts` traduce el UUID al id del árbol
  (o a la FK de la cuenta) y descarta en silencio un id de otro programa o de otro nivel. El resumen en palabras dice
  «solo Campaña · X». «¿Qué trae ventas?», el ROAS, sus listas, la paginación y el CSV de citas siguen el corte; el gasto
  es el del objeto y sus descendientes (cuenta: sus objetos), sin residuales ni gasto manual. La proyección corta los
  pendientes con las tasas del programa y lo dice; con corte no pinta el historial proyectado/real (es de todo el
  programa). Costo por agenda de hoy: cuenta y campaña filtran fotos, gasto y agendas del CRM (`agendasDelCorte` en
  `lib/queries/hechos/agenda.ts`, mismo ancla que `agendasDePauta`); conjunto y anuncio dicen «No disponible para este
  corte: el detalle de hoy se guarda por campaña». «¿Qué llega sin origen?» queda con todo el programa y su rótulo.
  Las explicaciones del semáforo, la proyección y Origen agregan «Solo · …».
- **Una sola definición:** el emparejamiento parcial → completo pasa a `completoDelParcial`
  (`lib/queries/atribucion-de-pauta.ts`); lo usan el ROAS (mismo SQL) y `agendasDelCorte` (lo pidió el guardián N1).
- **Sin corte nada cambia:** las cifras corren por la misma rama y claves de caché; el corte usa claves propias
  (`cargarRoasDePautaConCorte`). La única lectura nueva sin corte es la de las opciones del selector.
- **Tests:** nuevos `tests/corte-de-pauta.test.ts` y `tests/corte-de-pauta-rotulos.test.ts`. En `tests/paginas.test.ts`
  se agregó solo el mock de `opcionesDeCorteDePauta` (la página lee una base que ese test simula); ninguna expectativa
  cambió.
- **Verificado:** typecheck; lint 0 errores (7 advertencias ajenas); suite completa 4.605 verde; dev:local como gerente:
  selector, corte por campaña en las dos vistas, conjunto con el «No disponible», id de nivel equivocado ignorado,
  375 px sin scroll horizontal, consola limpia.
- **Pendiente (2b y después):** la tabla semanal y la gráfica diaria todavía muestran todo el programa (dicen «La
  tabla todavía muestra todo el programa…»). El detalle por campaña de «¿Qué trae ventas?» (`CifraDeRazon`) no lleva
  «Solo» en su explicación. Dos objetos con el mismo nombre no se distinguen en el selector (en la semilla, dos
  «Conjunto»); el selector lista todos los objetos del programa, también archivados: revisar con datos reales (escala).
  Sin `npm run build` ni `test:humo`.

**16-nov · «Ver solo» fase 1: atribución compartida**

- **Hecho:** `lib/queries/atribucion-de-pauta.ts` recibe exclusivamente los envíos, las parejas parcial/completo, los
  objetos y el árbol que ya lee el ROAS. Centraliza el canónico y sus alias, la jerarquía anuncio → conjunto → campaña →
  cuenta de Meta y la resolución de deal a envío, heredada por citas y ventas. Sigue llamando a `emparejar`; no copia sus
  reglas. Exporta `AtribucionDePauta`, `CortePauta` y `perteneceAlCorte` (pura, todavía sin uso para filtrar).
  Las identidades internas conservan los ids del árbol de Meta y la FK de cuenta; la fase 2 resolverá la URL con UUID
  contra el programa en el servidor antes de construir el corte.
- **ROAS:** consume esa atribución; conserva todas las lecturas SQL, sus claves de caché, sumas, presentación, orden y
  residuales «Anuncio sin identificar», «Sin campaña de Meta» y `SIN_CUENTA`. `NIVELES_PAUTA`, `SIN_CUENTA` y el export
  de `diaDelEnvio` siguen disponibles en el mismo módulo para sus llamadores, incluido el MCP. No se agregaron consultas.
- **Tests nuevos:** `tests/atribucion-de-pauta.test.ts`, con PGlite reutilizable: anuncio, conjunto, campaña por id y por
  nombre, ambigüedad, sin anuncio, parcial + completo canónico, deal por alias, gasto manual sin cuenta y pertenencia
  exacta en los cuatro niveles, sin repartir residuales. No se editaron tests existentes ni sus expectativas.
- **No tocado:** interfaz ni filtros, hechos ni su dimensión `campana` (sigue siendo `utmCampaign` literal), registro de
  métricas y `lib/metricas/*`, esquema, ADRs, vocabulario, handoff y tracker. Sin lectura de `.env*`, servicios externos,
  bases reales, migraciones, commit ni push.
- **Verificado:** `npm run typecheck` pasó; `npm run lint` terminó con 0 errores y 7 advertencias en archivos no tocados.
  Revisión del diff: ninguna consulta SQL modificada.
- **No verificado:** los tests nuevos y los existentes de ROAS, proyección, `atribucion-*`, pauta por cuenta y `mcp-*`.
  Se intentaron juntos por `npm test -- …`; el lanzador se detuvo antes de Vitest con `spawnSync ps EPERM`
  (`scripts/test.mjs:98`, sandbox). No se eludió el lanzador. Sin suite completa (CI) ni recorrido visual; no se abrió
  la app para evitar acceso a servicios reales. No se declara paridad de resultados ejecutada.

**Decisiones de Alejandro (16-nov)** para las fases siguientes:

- Canal (plataforma o canal compuesto actual) lo decide Mani; va en la fase 3, no bloquea la 2.
- Costo por agenda de hoy sigue el corte por cuenta y campaña; con conjunto o anuncio dice «No disponible para este corte:
  el detalle de hoy se guarda por campaña».
- «¿Qué llega sin origen?» se queda con todo el programa, rotulado «Todo el programa en el periodo: este diagnóstico no sigue
  «Ver solo».».
- Conjunto cuenta solo atribución exacta y sus anuncios identificados; no se reparten residuales.
- «Sin cuenta de Meta» no es opción del selector.
- El ROAS proyectado corta los pendientes con las tasas históricas del programa y la explicación lo dice.
- URL: `?corte=<nivel>&corte_id=<uuid de pauta_objetos>`, validado contra el programa en el servidor.


Commits: `1818d66c` (dos vistas), `4e4f7f39` (Cupos | Plata y ritmo), `738da751` (Origen y calidad), `cc3769f1` (gráfica
diaria), `41695ecd` (resumen de filtros y «Elegir fechas…»).

**Tabla del §6, una por una:**

| Bloque de antes | Dónde quedó |
|---|---|
| Semáforo del programa | Resultados, 2.º, en Cifras (419) |
| Cumplimiento de la cohorte | Resultados, 1.º, con Cupos · Plata y la fila del ritmo |
| Tabla semanal de pauta | Resultados, 3.º; sus dos gráficas sueltas pasan a «¿Cómo se mueve día a día?» (4.º) |
| ROAS de pauta | Origen y calidad, «¿Qué trae ventas?»: Ver por Campaña (con el detalle de conjuntos y anuncios) y Anuncio (el ranking); el «Cómo se calcula» pasa a notas del ROAS del Total; el CSV de citas sigue ahí. El todos-los-programas lo sigue usando en solo conteos (422) |
| Origen | Ver por Canal: los canales de pauta en Cifras y, debajo, la tabla de todos los orígenes con la regla de cada enlace; la precisión N3/N2/N1 pasa a notas de «Registros de pauta sin anuncio» y el contenido con código desconocido a «¿Qué llega sin origen?» |
| Traza de pauta | «¿Qué llega sin origen?»: sin anuncio, ventas sin anuncio, registros sin origen y la lista de anuncios sin id |
| Proyección del ROAS | Resultados, al final (no se pinta sin citas pendientes ni historial, como antes) |
| Embudo del formulario | «¿Dónde se va la gente del formulario?»: los cuatro pasos en Cifras; no agendaron, sin calidad y por canal, plegados |
| Embudo por pregunta | Dentro del embudo: «La pregunta que más pierde» y el detalle por pregunta, plegado |

**Decisiones para Mani:**
- «Agendas por día necesarias» quedó como la calcula el código (proyección: ventas por día necesarias ÷ cierre × asistencia),
  no como meta − agendadas del diseño; el texto de la explicación lo dice.
- El costo por agenda de hoy sigue dividiendo entre agendas según Meta (DM-1 abierta: no se tocó).
- Ver por Canal muestra en Cifras solo los canales de pauta (no hay ventas por canal para orgánico); la tabla de todos los
  orígenes va debajo, sin Cifras.
- Ver por Cuenta y Ver solo › Cuenta esperan al 416. El Programa no se repite en la barra: ya es el selector del menú.
- `ComoSeCalcula` (`components/como-se-calcula.tsx`) ya solo lo usa Mi espacio (`components/mi-espacio/tab-metricas.tsx`).
