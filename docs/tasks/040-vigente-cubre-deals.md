---
id: 040
etapa: E1
serves: "plan v2 §6 etapa 1 · tarea E1-5 · ADR 0038, amplia el ADR 0026"
depends: [037]
status: done
---

# 040 — `vigente()` y su guardian cubren `deals`

> Parte de la etapa 1: **una rama, una migracion** (`0020`).

## Objetivo

Que un deal anulado no cuente en **ninguna** metrica, y que eso lo garantice un predicado y un
guardian, no la memoria de quien escriba la proxima consulta.

## Alcance

- **Dentro:** `deals` gana `anulado_por`, `anulado_en`, `anulado_motivo` (la misma terna que
  `calls`, `sales` y `abonos`, ADR 0026).
- **Dentro:** `vigente(deals)` e `incluyendoAnulados(deals)` en `lib/queries/vigente.ts`.
- **Dentro:** el guardian de `tests/vigencia-centralizada.test.ts` recorre tambien `deals` en
  `lib/`, `app/`, `components/` y `scripts/`.
- **Fuera:** la mutacion que anula un deal y la cascada hacia calls y abonos. Eso es la etapa 4.
- **Fuera:** convertir "anulado" en una etapa. **No lo es** (ADR 0038): es una marca ortogonal.

## Por que esto va en la etapa 1 y no despues

Porque el guardian tiene que existir **antes** que las consultas que va a vigilar. Si llega
despues, hay que auditar a mano todo lo escrito en el intervalo, y **una consulta olvidada no
lanza ningun error: infla una cifra que se ve creible**.

## Done cuando

- [ ] Toda lectura de `deals` en el repo decide explicitamente entre las dos funciones.
- [ ] El guardian esta **mordido en los dos sentidos**: se le inyecta una consulta sin predicado y
      falla; **y no marca la solucion correcta**. (El guardian del molde de catalogo paso en verde
      con un `DELETE` clandestino inyectado: por eso esto es un criterio y no una nota.)
- [ ] `npm test`, `typecheck` y `lint` limpios.

## Kiro

Si, incluido el mordisco, con revision.
