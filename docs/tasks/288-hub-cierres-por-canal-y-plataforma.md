---
id: 288
etapa: hub
serves: "Gerencia ve las ventas por canal y plataforma, semana a semana y por programa, con la atribución explicada y los conflictos a la vista (modelo de Daniel Tovar, artifact '30X Cierres por Programa y Plataforma', 19-oct)"
depends: [123, 250, 262]
status: todo
---

# 288 — Hub › Cierres: las ventas por canal y plataforma

## Por qué

Daniel Tovar mandó el 19-oct, para "pulir" el CRM, un tablero de 30X hecho sobre un export de HubSpot (cierres del
1-sep al 19-oct). Es el modelo de cómo quiere leer las ventas. Las piezas existen repartidas (regla de canal 246,
área declarada 121, 123, 125, 248, 284); falta la vista que las arme **como venta**.

## Lo que trae el modelo, traducido a Retia

- **Atribución de una venta:** primero el UTM del envío que abrió el deal (ADR 0060, regla de `resolverCanal`); sin
  UTM, el área que declaró el closer al cerrar (121). Si el UTM y lo declarado chocan, **gana el UTM** y el caso se
  lista como conflicto. La regla vive en un módulo y la usan la cifra y la lista.
- **Plataforma:** el canal de `resolverCanal` (primera palabra de `utm_source`: Instagram, YouTube, Substack...); los
  placements menores de Meta y las macros sin expandir se agrupan en "Meta · otros".
- **Aparte, nunca en el total:** cortesías y deals en $0.
- **Secciones:** tarjetas por plataforma (clic filtra todo), semana a semana por plataforma, programa × canal, por
  closer, por campaña, por anuncio (la fila del 125/284) y la lista de ventas con detalle (137).
- **Vistas rápidas:** todo, solo Paid, solo Orgánico, sin UTM, conflictos.
- **Filtros:** programa (frontera, ADR 0043: "todos" solo con lo sumable, ADR 0048), canal, plataforma, etapa
  (Abonado o Completo), fecha de cierre y búsqueda. Periodo con "Comparar con" (251).
- **Fuera:** los multiplicadores del modelo de 30X (no existen en Retia).

## Abierto

- Confirmar con Dani que "fecha de cierre" es la entrada a ganado (`deal_etapa_historial`), como ya cuenta el CRM.

## Done cuando

La suma por plataforma da las ventas del periodo (sin cortesías ni $0, que salen aparte), cada cifra abre su lista, y
la vista de conflictos lista los deals donde el UTM y lo declarado no coinciden.
