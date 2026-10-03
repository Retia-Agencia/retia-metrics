---
id: 143
etapa: NC2
serves: "comercial.md GC-02, GC-32, §9.2"
depends: [142, QD-4, QD-10]
status: in_progress
---

> **2-oct (Mani, sesión del 142):** el área declarada al entrar a Atendido (ADR 0072 punto 6) se construye AQUÍ, no
> en el 142. Hay que resolver el choque: Agendado → Atendido lo hace el sistema al pegar el Grain y ahí no hay a
> quién preguntar (propuesta a decidir: pedirla al contestar "¿Cómo terminó?"). Hasta entonces el motor la sigue
> pidiendo en Compromiso Verbal y ganado.

> **2-oct (noche, Mani): decidido el alcance.** (1) El área declarada se pide **al contestar "¿Cómo terminó?"**:
> toda respuesta desde Atendido la exige; la venta por chat la sigue pidiendo en su flecha; las flechas a Compromiso
> Verbal y ganado la conservan (si pasó por Atendido ya viene llena). (2) Las propiedades son **acumuladas**, con dos
> excepciones que exige la realidad de los caminos: el contacto registrado solo en Contactado (quien agendó en el
> formulario llega a Atendido sin contacto, y está bien) y la llamada solo en Agendado y Atendido (la venta por chat
> no tiene llamada). (3) Los **históricos salen en rojo como cualquiera**: sin exención (el equipo va a completar el
> histórico a mano y el rojo es la lista de lo que falta). La exención del MOTOR (ADR 0059, 0065) no cambia. (4) El
> 143 llega a la **ficha y la tarjeta**; la cifra "sin valor" con su lista en el dashboard es del 148.
>
> | Etapa | Le falta (rojo) si no tiene |
> |---|---|
> | Potencial, Registrado, Calificado | cohorte |
> | En gestión | cohorte · dueño |
> | Contactado | cohorte · dueño · contacto registrado |
> | Agendado | cohorte · dueño · llamada vigente con fecha |
> | Atendido | cohorte · dueño · llamada que ocurrió (Grain) · área declarada |
> | Compromiso Verbal | cohorte · dueño · área declarada · fecha límite de pago |
> | Ganado Pago Parcial | cohorte · dueño · área · valor vendido > 0 · abono vigente · fecha límite de pago |
> | Ganado Pagado Completo | cohorte · dueño · área · valor vendido > 0 · abono vigente · saldo en cero |
> | Cierre perdido | motivo |
>
> El comprobante no está en la tabla porque ya es su propia alerta (ADR 0075). Lead Quality, Lead Value y el envío
> de origen tampoco: los manda el formulario y nadie los puede llenar desde el CRM (un deal creado a mano no tiene
> envío, y eso es correcto).

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
