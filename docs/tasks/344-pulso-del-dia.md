---
id: 344
etapa: avisos
serves: "ADR 0114 punto 6"
depends: [340, 343]
status: todo
---

# 344 — El pulso del día en el grupo de ventas

## Por qué

Responde lo que gerencia pregunta a mano en los grupos: agenda del día, confirmadas, ventas contra los cupos del día y
show (lectura de los cuatro grupos de ventas, 25-sep a 29-oct).

## Alcance

- Por programa, al grupo de ventas configurado (340):
  - **8 a. m.:** llamadas de hoy por closer (nombres de closers, ningún lead).
  - **1 p. m. y 5 p. m.:** ventas de hoy contra la meta del día (la meta dinámica que ya calcula el Hub), confirmadas y
    sin confirmar.
  - **Cierre:** ventas del día, show del día y llamadas que quedaron sin resultado.
- Toda cifra sale del diccionario de métricas (`docs/metricas.md`); una cifra que no esté ahí se agrega ahí primero.
- El mensaje dice cuándo un dato está incompleto (molde del ADR 0089 punto 6).

## Done cuando

- Test: cada cifra del pulso es igual a la del Hub para el mismo programa y día; un programa nunca suma el de otro.
