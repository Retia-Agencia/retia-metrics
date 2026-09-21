---
id: 089
etapa: E5
serves: "plan v2 §12.10.5 · el dashboard que no es estatico"
depends: [064]
status: todo
---

# 089 — Las consultas devuelven series con dimensiones, no escalares

## Objetivo

Que el dashboard se pueda filtrar y agrupar **sin reescribir las consultas**. Pedido de Mani: *"creo
que seria bueno si no fuese estatico sino que deja crear vistas y filtros a gusto."*

## La decision, y por que ahora

Un `{ leads: 412 }` **no se puede filtrar por nada**. Una serie con sus dimensiones pegadas —programa,
area, canal, closer, cohorte, fecha— se filtra, se agrupa y se guarda sin tocar la consulta.

⏳ **Es gratis mientras la capa de lectura se escribe (etapa 5) y es una reescritura completa despues.**
Misma clase de ventana que el origen humano del ticket 086.

## Alcance

- **Dentro:** `lib/queries/` devuelve filas con sus dimensiones; la agregacion la hace el llamador.
- **Dentro:** filtros **desde la URL**, que el ADR 0023 ya manda. Compartibles copiando el link, cero
  almacenamiento.
- **Fuera:** vistas guardadas. Se hacen cuando exista la queja de re-armar el filtro, no antes.
- **Fuera:** un constructor de consultas. **No, y probablemente nunca.**

## 🔒 La frontera que no es un filtro

El **programa** no se puede desactivar ni combinar. Ninguna vista, guardada o improvisada, cruza
ComunicArte con Tactical. **No basta con no ofrecerlo en la interfaz: el tipo de la consulta no debe
admitirlo** (ADR 0043 punto 4), igual que el comparativo entre closers del ADR 0023.

## ⚠️ Y la tension que hay que resolver con el ORDEN

Alejo dijo que lo tedioso es *"no saber que decisiones tomar"*. **Un lienzo en blanco de filtros es
exactamente lo contrario:** le entrega el trabajo de averiguar que mirar.

Se resuelve con el orden, no eligiendo uno: **el dashboard abre con la vista opinada** —las metricas
que pidieron, con su estado— y los filtros son la **salida de emergencia**. Puerta de entrada opinada,
techo abierto.

## Done cuando

- [ ] Ninguna consulta de `lib/queries/` devuelve un escalar suelto donde habia una dimension.
- [ ] Un filtro nuevo se agrega **sin tocar la consulta**, demostrado con uno.
- [ ] El link con filtros aplicados **abre igual en otra sesion**.
- [ ] Una consulta a la que se le quita el programa **no compila**, con test de tipos.

## Kiro

Si, con revision del contrato de salida.
