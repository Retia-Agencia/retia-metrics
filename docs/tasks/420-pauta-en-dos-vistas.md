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
