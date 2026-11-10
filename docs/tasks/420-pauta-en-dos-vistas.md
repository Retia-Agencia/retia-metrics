---
id: 420
etapa: pauta
serves: "docs/diseno-cifra-y-pauta.md §3 a §6 (norte: docs/bocetos/una-forma-de-metrica.html, tal cual) · DM-3, DM-5, DM-6, DM-7 · docs/paid-media-excels-2026-11-10.md §5.3 y §9.4 · ADR 0091 · ADR 0106"
depends: [419]
status: todo
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

- [ ] Las dos vistas iguales al boceto en claro, oscuro y 375 px, lado a lado con el HTML.
- [ ] Todo filtro en la URL y toda cifra recalculada con él; el cumplimiento solo sigue la cohorte; "hoy" siempre es hoy.
- [ ] Agendas por día real e inversión por día necesaria con su ficha en `metricas.md`.
- [ ] Gráfica con clic a la explicación, tooltip, leyenda, zoom y tabla alternativa; ninguna pantalla importa echarts.
- [ ] Ninguna cifra de los nueve bloques se perdió (tabla del §6 verificada una por una).
- [ ] Recorrido del paid trafficker y del gerente; `test:humo`, build y consola limpia.
