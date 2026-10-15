---
id: 268
etapa: hub
serves: "ADR 0089 (las horas viven en el CRM) · pedido de Dani Tovar del 15-oct (8, 11, 14, 17 y 20 h) · Mani, 15-oct: un solo grupo para todos los programas"
depends: [265, 267]
status: todo
---

# 268 — Las horas del reporte se eligen libres y el grupo es uno solo

## Objetivo

Que el reporte por WhatsApp salga a las horas que pida Gerencia (hoy 8, 11, 14 y 17 h, con el resumen de cierre
a las 20 h) sin que una lista fija en el código lo impida, y que el grupo deje de configurarse por programa.

## Por qué

Las horas ya viven en el CRM (265) y la base acepta de 0 a 23 (`reportes_whatsapp_horas_chk`), pero hay
**cuatro listas fijas de 6 a 19** que tienen que coincidir y nadie lo vigila:

1. `HORAS` en `components/pauta/reporte-whatsapp.tsx` (lo que ofrece la pantalla).
2. `.min(6).max(19)` en `lib/catalogo/reportes-whatsapp.ts` (lo que acepta el servidor).
3. `trayectoriaDelDia` en `lib/semaforo/semaforo.ts` (`Math.min(hora, 19)`, `< 6`, desde las 6).
4. El cron de Juanito `0 6-19 * * 1-5` (`src/scheduler/semaforo-retia.js`): una hora que el CRM acepte y el cron
   no cubra **no se manda, sin ningún error**. Las 20 h hoy caen ahí.

## Decisiones (Mani, 15-oct)

1. **Una sola lista: la del CRM.** Juanito pregunta **cada hora en punto** (`0 * * * 1-5`) y el CRM decide si a esa
   hora toca algo (`queTocaAhora` ya lo hace). Así una hora nueva no exige tocar Juanito.
2. **Las horas válidas son las del día (0 a 23)**, el dominio de la columna, no una lista de negocio. El zod
   acepta 0 a 23, igual que el CHECK.
3. **Selector más compacto:** las horas elegidas se ven como chips que se quitan, y se agrega una con un solo
   control (un select de 00:00 a 23:00 sin las ya elegidas). El resumen de cierre sigue siendo un select de
   0 a 23 o "Sin resumen". Sistema "Tinta" (`docs/structure.md` §9).
4. **La trayectoria del cierre sale de las horas configuradas** del reporte (más la del cierre), no de 6 a 19.
5. **Un solo grupo para todos los programas:** el id del grupo vive en el `.env` de Juanito
   (`RETIA_SEMAFORO_GRUPO`, más su línea en `environment:` del `docker-compose.yml`, gotcha §12) y el CRM deja de
   pedirlo: se quita el campo de la pantalla, la columna `destino` (migración, ADR 0077: lo que no se usa se quita)
   y `destino` del contrato del 259 (`lib/reporte-whatsapp/contrato.ts`, la lista blanca de
   `tests/semaforo-endpoint.test.ts`). El CHECK `reportes_whatsapp_activo_completo_chk` deja de exigir destino.
   El aviso de "el CRM no respondió" de Juanito va al mismo grupo.
6. **Mismo orden de despliegue que el 267, al revés por el contrato:** primero Juanito acepta un envío sin
   `destino` (usa el del `.env`), después el CRM lo quita. Así ningún momento queda sin grupo.

## Done cuando

- [ ] `tests/reportes-whatsapp*.test.ts`: se guardan las 8, 11, 14 y 17 con cierre a las 20; 24 y -1 se rechazan.
- [ ] `tests/reporte-whatsapp-que-toca*` (o el que exista): a las 20 h toca el cierre; a las 17 h el del día.
- [ ] La trayectoria del cierre de las 20 h tiene los puntos de las horas configuradas.
- [ ] El contrato ya no tiene `destino` y la lista blanca muerde con él.
- [ ] Juanito: cron cada hora, `RETIA_SEMAFORO_GRUPO` en `.env.example`, `.env` local y VPS (respaldo
      `.env.bak-<fecha>`) y compose; tests; suite en Linux con la línea base; deploy `alcance: todo` mirando antes
      los pushes de closers agendados (`calendly_pushes`, ver el handoff del CRM del 15-oct).
- [ ] Recorrido local: cargar 8, 11, 14, 17 y cierre 20; la vista previa del cierre dice 20:00.
- [ ] En producción, con el ok de Mani: el reporte de los tres programas con esas horas, encendido.

## Fuera

- El **presupuesto del día** en el mensaje (Michael, 15-oct: "presupuesto para ese día, no se mueve en todo el
  día"): espera la respuesta de Pauta sobre de dónde sale (ver las preguntas del 15-oct en el handoff).
- Cambiar qué métricas lleva el mensaje.
