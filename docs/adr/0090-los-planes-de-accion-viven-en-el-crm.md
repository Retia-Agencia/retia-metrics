# 0090: Los planes de acción viven en el CRM, y un rojo del semáforo se cierra con una acción

- **Estado:** aceptado, 14-oct-2026 (Mani, audit del Hub, `docs/hub.md` H-7). Se construye en los tickets 257 y
  261.
- **Confirma:** ADR 0042 (todo movimiento del CRM deja rastro), ADR 0043 (el programa es frontera), ADR 0082 (el
  closer no entra al Hub), ADR 0023 (no hay metas individuales: una acción tiene dueño, no una meta).

## Contexto

Cada reporte diario de septiembre cerraba con "Planes de acción: estado de ejecución": qué se decidió, cuándo, en
qué estado va y la evidencia del día (*"Cuenta de Addi: por crear; el dinero es la objeción de 48 respuestas"*).
Esa sección es lo que convierte cifras en decisiones, y hoy vive solo en un PDF.

La lección de 30X, medida: su semáforo detecta perfecto y nadie atiende los rojos, hasta diez días seguidos con un
bloque de gasto sin agendas. **Detectar no es actuar.** Lo que falta es que un rojo no se pueda cerrar en silencio.

## Decisión

1. **La Acción es un objeto del CRM, de un programa:** qué se va a hacer, un dueño (usuario), un estado (abierta,
   en curso, hecha, descartada), una fecha límite opcional, **la cifra que la justifica** (texto y el enlace a la
   cifra del Hub), su origen (a mano o un rojo del semáforo) y notas de evidencia. Crearla y editarla deja rastro.
2. **La crean y la editan quienes entran al Hub del programa:** gerente, developer y paid trafficker. El closer no
   (ADR 0082). La pregunta vive en `lib/auth/roles.ts`, nunca un `rol === "..."` a mano.
3. **En Hoy van las acciones abiertas** de los programas a la vista, con su estado y su cifra: es la sección de
   planes de acción del reporte diario.
4. **Un rojo de cierre del semáforo queda "sin atender" hasta que tenga una acción ligada.** A las 48 h sin acción
   escala a quien se defina (`plan.md` §7 E, HQ-2). El Hub mide el **cierre del ciclo**: qué parte de los rojos
   tuvo una acción y en cuántas horas.
5. **Después, no ahora:** responder un rojo desde WhatsApp por Juanito (crear la acción con una respuesta).

## Consecuencias

- Una acción descartada se queda, con su razón: se ve qué se decidió no hacer.
- El cierre del ciclo es la métrica que dice si el semáforo sirve, no el costo por agenda.

## Alternativas descartadas

| Alternativa | Por qué no |
|---|---|
| Llevarlas en Notion y enlazarlas | se pierde el cruce entre la acción y la cifra que la justificó, y el rojo no se puede cerrar con ella |
| Solo acuses del semáforo (pausé, subí, lo dejo) | deja fuera los planes que no salen de la pauta (Addi, el guion corporativo), que eran la mitad del reporte |
| Tareas dentro del deal | una acción es del programa, no de una persona que compra |
