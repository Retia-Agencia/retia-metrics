---
id: 419
etapa: hub
serves: "docs/diseno-cifra-y-pauta.md §1, §2, §10 (norte aprobado por Mani el 10-nov: el boceto docs/bocetos/una-forma-de-metrica.html, tal cual) · DM-1, DM-2, DM-9 · anotaciones A-186 a A-190 · structure.md §9 contrato de entendimiento · ADR 0067 · ADR 0115 N3 y N5"
depends: []
status: en curso (Alejandro, carril P, 10-nov)
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
