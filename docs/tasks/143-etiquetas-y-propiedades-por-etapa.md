---
id: 143
etapa: NC2
serves: "comercial.md GC-02, GC-32, §9.2"
depends: [142, QD-4, QD-10]
status: bloqueado
---

# 143 — Etiquetas y propiedades por etapa, y el "sin valor" como bandera roja

**Bloqueado por:** el 142, QD-4 (qué es obligatorio en cada etapa) y QD-10 (la lista de etiquetas, qué
significa cada una y quién la pone).

## Objetivo

Que cada etapa tenga sus etiquetas y propiedades, y que un deal sin la propiedad exigida se cuente y se liste
(el "no value" de HubSpot que Dani pidió ver).

## Lo ya decidido (`comercial.md` §9.2)

Una etiqueta que el código puede calcular (DESATENDIDO, Obsoleto) se **deriva** y no se guarda (ADR 0024);
una que es juicio del closer o del formulario es una fila de catálogo (ADR 0012). El "sin valor" de cada
propiedad exigida es una cifra con su lista (137).
