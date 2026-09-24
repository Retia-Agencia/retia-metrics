---
id: 085
etapa: E1b
serves: "plan v2 §12.10.3 · ADR 0045 puntos 5 y 6"
depends: [084]
status: todo
---

# 085 — El emparejador de patrones, determinista, y su guardian

## Objetivo

Que un envio resuelva **a lo sumo una** campana, un usuario o un area, y que esa resolucion sea la
misma siempre.

## 🩸 Por que esto es un modulo y no una consulta suelta

**Si un envio casa con dos patrones de campanas distintas, ese lead se cuenta en las dos y el CPL de
ambas sale mal. Sin un solo error.**

No es hipotetico. El **ADR 0031** documenta que colgar una corrida de sync de `fuentes[0]` —una
consulta **sin `ORDER BY`**— atribuia cada corrida a uno de los dos formularios de forma **no
determinista**: corridas identicas quedaban registradas distinto. Es la misma trampa, un nivel mas
arriba y con dinero encima.

## Las tres reglas

1. **Un envio resuelve a lo sumo UNA campana.** No "la primera que aparezca".
2. **Gana el patron mas especifico**, medido en campos UTM no nulos. Uno de tres le gana a uno de dos
   **siempre**, sin importar el orden de la consulta.
3. **Un empate es un ERROR que la app muestra**, no una eleccion silenciosa. La garantia de que no
   pueda existir vive en el indice unico del ticket 084, no aca.

## Alcance

- **Dentro:** `lib/atribucion/emparejar.ts`, modulo puro: recibe un envio y devuelve el destino con
  su area derivada, o una de las dos categorias de huerfano.
- **Dentro:** el **guardian**, mismo molde que `vigente`, `rolDeVista` e `identidad de closer`:
  recorre `lib/`, `app/`, `components/` y `scripts/` y **falla si alguien lee `utm_patron` sin pasar
  por este modulo**.
- **Dentro:** las **DOS** categorias de huerfano, que **no se funden**:
  **`sin UTM`** (el envio llego sin origen: problema de captacion, irrecuperable) y
  **`(sin clasificar)`** (trae UTM pero no casa: problema de configuracion, se arregla con una fila y
  repara hacia atras). Un cubo unico escondaria cual de los dos problemas tiene el negocio.
- **Fuera:** escribir el area en ninguna tabla.

## Done cuando

- [ ] Cada regla tiene su test **en los dos sentidos**: la que debe casar casa, la que no, no.
- [ ] El test de especificidad corre **con los patrones en distinto orden** y da el mismo resultado.
- [ ] El guardian esta **mordido**: se le inyecta una lectura clandestina de `utm_patron` y falla.
- [ ] Un envio **sin UTM** devuelve `sin UTM`; uno **con UTM que no casa** devuelve `(sin clasificar)`.
      **Son dos salidas distintas**, con test de las dos, y **nunca** `null` silencioso.
- [ ] Cero UI: este modulo se prueba sin navegador.

## Kiro

Si, con revision cercana. La especificidad es donde un bug es silencioso.

---

## Enmienda 2026-09-24 (ADR 0051)

El emparejador resuelve en dos pasos: el par `utm_source + utm_medium` a un **Canal** (y de ahí el
área) y `utm_campaign` a una **Campaña**. Es también **el único módulo que lee `utm_content`**, y solo
cuando el canal es Closer, para convertir el código en el usuario que trajo el lead. El guardián se
amplía: falla si alguien lee `utm_content` por fuera de este módulo.
