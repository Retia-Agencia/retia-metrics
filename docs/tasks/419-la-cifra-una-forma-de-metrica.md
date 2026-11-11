---
id: 419
etapa: hub
serves: "docs/diseno-cifra-y-pauta.md §1, §2, §10 (norte aprobado por Mani el 10-nov: el boceto docs/bocetos/una-forma-de-metrica.html, tal cual) · DM-1, DM-2, DM-9 · anotaciones A-186 a A-190 · structure.md §9 contrato de entendimiento · ADR 0067 · ADR 0115 N3 y N5"
depends: []
status: todo  # en curso desde el 10-nov: Alejandro, carril P (el tracker lo pone Mani en el checkpoint)
---

# 419 — La Cifra: una forma de métrica y su explicación, en todo el Hub

## Por qué

Mani aprobó el 10-nov una sola forma de mostrar una métrica: la tarjeta lleva solo lo necesario y **toda cifra se explica al
abrirla** (qué mide, fórmula en bloque con variables, qué es cada número y etiqueta, filtros, evidencia), sin una sola referencia
técnica, porque la leen Gerencia y Pauta. Hoy cada bloque resuelve la cifra, el vacío, la variación y "Cómo se calcula" a su
manera, con texto libre y con dos vocabularios de estado.

## Alcance

1. **Contrato `CifraDeMetrica`** (`docs/diseno-cifra-y-pauta.md` §10), armado en el servidor. Un solo módulo en `lib/` (no en
   `components/`) lo construye a partir de la ficha del concepto y de la consulta.
2. **Ficha con la explicación.** Campos nuevos en `FichaDeMetrica` (`lib/metricas/registro.ts`): `que` (una frase de negocio),
   `formula` (forma: razón, suma, conteo, resta o producto, con sus términos en palabras y `por1000`), `variables` (nombre y
   explicación) y `aliasExcel?`. **Un solo commit toca `registro.ts` y solo agrega los campos** (archivo caliente del 403: avisar
   a esa sesión). El texto de cada concepto está en el diseño §2.1; los de Pauta se llenan aquí, el resto lo completa el 403 F4.
3. **La pieza.** Evolucionar `components/cifra-con-lista.tsx`, `components/como-se-calcula.tsx` (hoy diálogo con texto libre),
   `components/variacion.tsx` y `components/hub/barra-de-avance.tsx`; no crear una segunda versión. Tres tamaños: tarjeta, barra,
   celda (§1.2). Barra con lleno, rayado de atraso y marca rotulada "a hoy N" (§1.1).
4. **La explicación** en un panel lateral (pantalla completa en celular) con las cinco secciones del §2, en ese orden, incluida la
   fórmula como fracción apilada y "Con los números de esta cifra".
5. **Los ocho casos raros** del §1.3, cada uno con su frase.
6. **DM-1:** el semáforo pasa a En meta / En seguimiento / Rezagado (cambia el rótulo, no el cálculo; WhatsApp no cambia).
7. **Guardián** (test): ningún texto de una explicación lleva rutas, `lib/`, `§`, "ADR", "ticket", ids `M\d`, `D-`, `I-`,
   `utm_`, "macro", "periodo A/B". Mordido en los dos sentidos.
8. **structure.md §9:** el contrato de la Cifra y la regla DM-9 escritos con la pieza (ya anotados el 10-nov; ajustar a lo construido).

**Archivos calientes:** `lib/metricas/registro.ts` (del 403), `components/cifra-con-lista.tsx` (14 llamadores),
`components/semaforo/semaforo-del-programa.tsx`.

**Migración:** Ninguna.

## Fuera

Reacomodar Pauta (420), las filas nuevas (414 a 416), los rótulos que dependen de D-C y las fórmulas de D-A/D-B/D-E (403).

## Done cuando

- [ ] `CifraDeMetrica` armada en el servidor; la pantalla no calcula nada.
- [ ] Ficha con `que`, `formula`, `variables`, `aliasExcel?`; todas las cifras de Pauta con su texto (§2.1).
- [ ] Tarjeta, barra y celda iguales al boceto en claro, oscuro y 375 px (comparar lado a lado con `docs/bocetos/una-forma-de-metrica.html`).
- [ ] Panel con las cinco secciones; foco, Escape y vuelta del foco; la lista completa sabe volver.
- [ ] Los ocho casos raros, cada uno con test de su frase.
- [ ] Semáforo con el vocabulario único.
- [ ] Guardián de texto técnico en verde y mordido.
- [ ] `quick_review` de Rams, `npm run build`, `test:humo` y la pantalla abierta con la consola limpia.

## Avance

- **10-nov · Alejandro (carril P).** Commit 1: `FichaDeMetrica` gana `que`, `formula` (`forma` razón/suma/conteo/resta/producto,
  `terminos`, `por1000?`), `variables` y `aliasExcel?`, todos opcionales; no se tocó ninguna ficha. **Costura con el carril D:**
  Pauta no tiene claves en `ClaveDeMetrica` ni fichas en `REGISTRO` (solo `VOCABULARIO_PAUTA_SEMANAL`). Mientras D las registra,
  los textos de §2.1 de Pauta viven en el módulo de la Cifra ligados a su clave, y pasan a la ficha en un commit propio cuando
  existan.
- **10-nov · Alejandro.** Contrato y pieza:
  - `lib/metricas/cifra.ts`: `armarCifra` arma `CifraDeMetrica` en el servidor, todo ya escrito (valor, los ocho casos raros,
    estado DM-1, barra, comparación en gris, fórmula con "Con los números de esta cifra", cómo leer la tarjeta, filtros,
    evidencia). La escala de estado vive ahí y `cumplimiento-de-cohorte.ts` la importa.
  - Piezas evolucionadas: `cifra-con-lista.tsx` (`Cifra`, tamaños tarjeta y celda), `como-se-calcula.tsx`
    (`ExplicacionDeCifra`, las cinco secciones), `barra-de-avance.tsx` (forma con marca: lleno, rayado y "a hoy N"),
    `variacion.tsx` (`CambioDeCifra`). Nuevo `components/ui/sheet.tsx` (panel lateral; foco en Cerrar, Escape y vuelta del
    foco, verificados).
  - Primer uso: "¿Vamos a llegar a la meta de la cohorte?" en Hub › Pauta, con cuatro barras. Agendadas va con "todas las
    áreas" porque eso es lo que cuenta hoy la consulta (`agendasDeLaCohorte`), no "de pauta" como el boceto.
  - Semáforo con En meta / En seguimiento / Rezagado.
  - Verificado con `dev:local` en claro y oscuro, a 1280 y 375 px; consola limpia; `npm run build` en verde.
  - **Falta:** la evidencia (cinco filas y el botón a la lista) en el cumplimiento, que necesita una lista que cuente lo
    mismo que la cifra, con test; la celda en la tabla semanal; migrar el resto de los bloques; `test:humo`; ajustar
    `structure.md` §9.
  - Nota: `npm run db:local` falla al sembrar (el programa de prueba no tiene % de comisión, `mover-etapa.ts:338`). La base
    queda con datos parciales y sirve para mirar. No es de este carril.

- **11-nov · Mani (desbloqueo).** Decidido por el ADR 0038 (enmienda 11-nov): la llamada de un deal anulado no cuenta. Ya está en
  `main`: la barra de agendas del cumplimiento y la lista `agendas_creadas` cuadran (el `it.fails` pasó a test normal), así que
  **la evidencia de agendas ya se puede conectar**. El enlace de Asistencia de la tabla semanal ya no da 404: `show` abre
  `grupo_shows` y `cierre_ventas` abre `grupo_vendidos`, con área Paid (misma lectura que la cifra). Las dos notas de "Para
  retomar" sobre esto quedan resueltas.

## Para retomar (10-nov noche, Alejandro)

Lo nuevo desde las notas de abajo (commits `31554eea`, `5496e2d7`, `205d23f7`, sin push):
- **Textos del puente** al día con D-A, D-B y D-E (tasas por deal sobre el grupo de citas de Paid, ROAS y Profit por la
  semana del registro, inversión sin gasto en —). El tipo del puente es `ClaveDeExplicacionDePauta`; `ClaveDePauta` es
  el de Mani en `lib/vocabulario-metricas.ts` (403 F2, con fichas sin texto). Pasar los textos a la ficha cuando él avise.
- **Paso 1 hecho para ventas.** `dealsDelArea` (`lib/queries/metricas-filtros.ts`) da a la lista de ventas
  (`cierres`, `contratado`) el filtro de área con la misma regla que la cifra; `combinacionDeFiltrosValida` lo admite.
  Las barras "Ventas · de pauta" y "Ventas totales" traen evidencia (`leerEvidenciaDeVentas`, desde
  `cohorte.desdeLista`), solo para quien abre la lista de ventas. Lista vacía: "Todavía no hay …", sin botón.
  Test: `tests/cumplimiento-evidencia.test.ts`.
- **Agendadas sin evidencia, esperando a Mani** (mensaje enviado el 10-nov): `agendasDeLaCohorte` cuenta agendas de
  deals anulados (`incluyendoAnulados(deals)` en `hechos/agenda.ts`) y `agendas_creadas` no. El test es `it.fails`:
  cuando se ponga rojo, conectar la evidencia de agendas.
- **Bug ajeno visto:** el enlace de Asistencia de la tabla semanal (`shows` con `area=paid`) da 404; `shows` no acepta área.
- Verificado en `dev:local` (claro, oscuro, 375 px, consola limpia); build en verde antes del último commit (no se
  repitió). Para ver filas se pasaron 3 deals de `comunicarte-local` a ganado en la base LOCAL.
- **Borrar a mano** `e2e/zz-419-evidencia.spec.ts` (desechable; `rm` está bloqueado para el agente).

**Siguiente:** paso 2 (la celda en la tabla semanal), luego 3 y 4 de abajo.

## Para retomar (10-nov, Alejandro se quedó sin créditos)

Estado: commits `241edac9` (campos de la ficha), `2b518987` (contrato y tests), `9d025099` (status coherente) y `76f75e84`
(pieza y cumplimiento) en `main`. Typecheck, lint, build y los tests del ticket en verde en local.

**Cómo está armado (lee esto antes de tocar nada):**
- `lib/metricas/cifra.ts` es puro (sin `lib/db`). `armarCifra(EntradaDeCifra)` → `CifraDeMetrica` con todo el texto ya
  escrito. Un "—" sin `motivo` lanza error a propósito. `fmtAvance` escribe lo esperado con decimal.
- `lib/metricas/explicaciones-de-pauta.ts` es un PUENTE: los textos de §2.1 por clave (`ClaveDePauta`). Cuando el carril D
  registre los conceptos de Pauta en `REGISTRO`, se pasan a `que`/`formula`/`variables`/`aliasExcel` de la ficha en un
  commit propio y este archivo se borra. Incluye `agendas_total` (Agendadas · todas las áreas), que no está en el diseño.
- Uso: un componente de servidor llama `armarCifra` y pasa el resultado a `<Cifra cifra={...} />` (cliente). Ejemplo vivo en
  `components/pauta/cumplimiento.tsx` (`cifraDeAvance`).
- `BarraDeAvance` tiene dos formas: con marca (props `lleno/atraso/marca/rotuloDeMarca/tono/etiqueta`) y la simple vieja
  (`llevamos/objetivo`), que siguen usando Hoy y "¿Vamos a llegar?" del programa.
- `ComoSeCalcula` (diálogo de texto libre) sigue vivo para `pauta-roas`, `pauta-proyeccion` y `mi-espacio`: se borra
  cuando esos bloques pasen a la Cifra.

**Siguiente, en orden:**
1. **Evidencia del cumplimiento.** Cada barra necesita `lista: { href, nombre, total, filas }`. Hay que encontrar la lista
   (`urlDeLista` en `lib/queries/vista-metrica.ts`, métricas `agendas_creadas` y `cierres`) que cuente EXACTAMENTE lo
   mismo que la cifra (cohorte desde el inicio de ventas hasta hoy) y escribir un test que compare cifra contra lista.
   Las cinco filas salen de la misma consulta paginada. Sin eso, no se inventa.
2. **La celda en la tabla semanal** (`components/pauta/tabla-semanal.tsx`, datos en `lib/queries/hechos/pauta-semanal.ts`):
   cada celda con `<Cifra tamano="celda">`, partes reales en `partes`, `comparacion` contra la columna anterior con
   `etiqueta: "La línea pequeña"` y estado por objetivo en las filas que lo tienen. Esta es la prueba de costura de la ola.
3. El semáforo como cuatro Cifras (§4.2), la proyección del ROAS (§4.5) y el resto del Hub.
4. `npm run test:humo` con `dev:local` arriba; ajustar `docs/structure.md` §9 a lo construido; marcar las casillas.

**Pendiente con Mani (carril D):** avisarle del commit `241edac9` en `registro.ts` y preguntarle quién registra las claves y
fichas de Pauta (no existen en `ClaveDeMetrica`). Si ya se le mandó el mensaje, esperar su respuesta.

**Trampas que ya costaron tiempo:**
- `tests/tracker-coherente.test.ts`: el `status:` del archivo tiene que ser igual al del tracker. El "en curso" va en un
  comentario después de `#`.
- Docker no arranca solo: `open -a Docker` antes de `npm run db:local`. La siembra falla al final (falta % de comisión
  del programa de prueba, `lib/deals/mover-etapa.ts:338`), pero la base queda usable. Para ver el cumplimiento se
  cargaron metas a mano en la base LOCAL (`objetivos`: `agendas` 60, `cupos`/`paid` 12, `inversion` 26.000.000 en
  `tactical-local`). Login local: `dev@retia.local`.
- Un contenedor flex al lado de un `float` pierde el ancho del float: por eso "Cerrar" del panel va `absolute`.
- `next build` rompe un `dev` vivo en la misma carpeta: detén el dev antes.
