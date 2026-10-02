---
id: 147
etapa: NC2
serves: "comercial.md GC-39, GC-40"
depends: [136, QD-6, QM-11]
status: bloqueado
---

# 147 — Alertas por días hábiles seguidos bajo el umbral

**Bloqueado por:** QD-6 (de qué métricas son los umbrales y cuántos días seguidos disparan la alerta).

> **1-oct (Mani, `comercial.md` §7.0):** QD-6, **5 días hábiles** seguidos por debajo, **configurable**. Falta qué métricas llevan umbral (QM-11; recomendación: las del semáforo de la meta, DP-24). Carril de Alejo en NC2.

## Objetivo

Una métrica caída un día no es alerta; caída N días hábiles seguidos sí (*"5 días seguidos, paila"*). Los
umbrales son filas (DP-23) que Dani carga mientras lo usa en el daily. Se calcula al leer.
