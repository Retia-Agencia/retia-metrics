---
id: 076
etapa: E6
serves: "plan v2 §6 etapa 6 · tarea E6-7 · ADR 0042 (D6)"
depends: [068, 041]
status: done
---

# 076 — La bitacora en Nerd Stats: la PANTALLA de un rastro que ya lleva meses escribiendose

## Objetivo

Ver toda escritura del CRM, filtrable por usuario, tabla y rango.

🎯 **Esto es lo unico de D6 que va de ultimo.** El **rastro** se escribe desde la etapa 1 (ticket
041), por la razon del ADR 0029: si se retrofitea al final, **todo lo escrito antes no tiene
historia y no hay manera honesta de fabricarla**. Mirar el historial no urge; tenerlo si.

## Alcance

- **Dentro:** la vista sobre `change_log` extendido (deals, calls, abonos, actividades) **y**
  sobre `deal_etapa_historial`, presentados juntos aunque vivan en dos tablas: son dos rastros con
  dos formas porque contestan dos preguntas (ADR 0042).
- **Dentro:** filtros por usuario, tabla y rango de fechas.
- **Dentro:** guarda por rol, sin escribir `"developer"` a mano (ADR 0025).
- **Fuera:** exportar. Si hace falta, es otro ticket.

## Done cuando

- [ ] Toda escritura hecha desde la app aparece aqui, con quien y cuando.
- [ ] Los movimientos de etapa se ven junto al resto, sin estar duplicados en los dos rastros.
- [ ] La pantalla es exclusiva por guarda de servidor, **probada forjando la peticion**.

## Kiro

Si.

---

## Cierre 2026-10-02 (sesión O1-g, rama `o1g-lecturas`)

**Hecho.** Falta el recorrido visual, que hace la sesión principal.

- **Consulta:** `lib/queries/bitacora.ts` (`paginaDeBitacora`, `opcionesDeBitacora`, `filtroDeLaUrl`). Lee
  `change_log` y `deal_etapa_historial` por separado, ordenados de lo más nuevo a lo más viejo, y los mezcla
  en memoria; paginada de a 50 (A-06). Filtros por usuario (o "sistema": sin usuario), tabla (o "Movimientos
  de etapa") y rango de días **de Bogotá** (día en texto, ningún `Date` en la plantilla). Los filtros salen de
  la URL validados con zod: lo inválido se descarta, no se adivina.
- **Sin duplicar el movimiento:** el motor mueve la etapa sin `change_log`, pero `abrirDeal` (vía
  `crearConRastro`) sí deja `deals.etapa` y `deals.pendiente` en `change_log` al nacer el deal, además de la
  primera fila del historial. La bitácora no lee esos dos campos de `deals` en `change_log`: el movimiento sale
  una vez, del historial. Probado sobre el `abrirDeal` real.
- **Sin datos personales**, como el resto de Nerd Stats: no se proyectan `etiqueta` ni los valores (guardan
  nombres y correos de leads). De un cambio se ve tabla, campo, registro (id opaco; si es un deal, enlace a su
  ficha), quién, cuándo y origen; de un movimiento, las etapas y el pendiente.
- **Pantalla:** `/nerd-stats/bitacora`, enlazada desde la tarjeta "Últimos cambios desde la app" de Nerd Stats.
- **Guarda:** `paginaDeAccesoTotal()` (068), antes de leer un filtro. **Probada forjando la petición** en
  `tests/paginas.test.ts`: la página real con filtros en la URL, como gerente, closer, developer en vista
  gerente y sin sesión → rebotados y **la consulta no se llama**; el developer entra y la consulta recibe los
  filtros validados. Mordido en el otro sentido: quitando la guarda caen 4 de esos tests.
- **Tests:** `tests/bitacora.test.ts` (8) y `tests/paginas.test.ts` (5 nuevos).

**Para Mani:** la bitácora muestra **qué campo** cambió, no **el valor**. Si para auditar hace falta ver los
valores de las tablas operativas (deals, calls, abonos), es una decisión de privacidad: hoy la regla de Nerd
Stats es "ningún dato personal", y `change_log` mezcla valores de leads.
