---
id: 143
etapa: NC2
serves: "comercial.md GC-02, GC-32, §9.2"
depends: [142, QD-4, QD-10]
status: bloqueado
---

> **2-oct (Mani, sesión del 142):** el área declarada al entrar a Atendido (ADR 0072 punto 6) se construye AQUÍ, no
> en el 142. Hay que resolver el choque: Agendado → Atendido lo hace el sistema al pegar el Grain y ahí no hay a
> quién preguntar (propuesta a decidir: pedirla al contestar "¿Cómo terminó?"). Hasta entonces el motor la sigue
> pidiendo en Compromiso Verbal y ganado.

# 143 — Etiquetas y propiedades por etapa, y el "sin valor" como bandera roja

**Bloqueado por:** el 142, QD-4 (qué es obligatorio en cada etapa) y QD-10 (la lista de etiquetas, qué
significa cada una y quién la pone).

> **1-oct (Mani, `comercial.md` §7.0):** QD-10, las etiquetas de 30X **no se usan**: solo Lead Value y Lead Quality, que llegan con el envío. El ticket queda en propiedades obligatorias por etapa. QD-4: toda obligatoria vacía es **alerta roja**, un solo nivel. Cuáles son obligatorias sale del manual (QD-8).

## Objetivo

Que cada etapa tenga sus etiquetas y propiedades, y que un deal sin la propiedad exigida se cuente y se liste
(el "no value" de HubSpot que Dani pidió ver).

## Lo ya decidido (`comercial.md` §9.2)

Una etiqueta que el código puede calcular (DESATENDIDO, Obsoleto) se **deriva** y no se guarda (ADR 0024);
una que es juicio del closer o del formulario es una fila de catálogo (ADR 0012). El "sin valor" de cada
propiedad exigida es una cifra con su lista (137).
