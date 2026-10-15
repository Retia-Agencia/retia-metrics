---
id: 265
etapa: hub
serves: "ADR 0089 (enmienda 15-oct) · contrato C-1 de docs/hub.md §8 · HQ-2 y HQ-3 de docs/plan.md §7"
depends: [258]
status: done
---

# 265 — El reporte por WhatsApp se configura por programa

## Objetivo

Que quien administra decida, desde el CRM y sin tocar a Juanito, si un programa recibe el reporte de pauta por
WhatsApp, a qué grupo, a qué horas y con qué métricas.

## Alcance

- **Dentro: migración (sesión principal).** Una configuración por programa por el molde de catálogo (ADR 0012, con
  `change_log`): encendido, el id del grupo de WhatsApp (texto, como lo da `/grupos` de Juanito), los horarios del
  día (lista de horas hábiles, más la hora del resumen de cierre) y las métricas incluidas. Una por programa, garantizado
  por un índice único.
- **Dentro: las métricas son un tipo del código** (las que tienen semáforo implementado; hoy `costo_por_agenda`, 258),
  y la configuración guarda cuáles están encendidas. **Encender una métrica exige umbral cargado** en la cohorte activa
  (122/264); si no lo hay, el interruptor queda deshabilitado y dice por qué.
- **Dentro: la regla "¿qué toca ahora?"** en un módulo puro con tests: dado el instante en Bogotá y las
  configuraciones, qué programas tienen envío y si es de día o de cierre. Solo días hábiles (regla de Retia: sábado y
  domingo fuera, festivos dentro).
- **Dentro: la pantalla**, en Programa › General junto a las cuentas de Meta (ADR 0077: es dato del programa): la sección "Reporte por WhatsApp" con
  el encendido, el grupo, los horarios y un interruptor por métrica; la edita quien administra (`esAdministrador`), la
  ve quien `manejaPauta`.
- **Fuera:** el endpoint que la usa (259), el mensaje (260), los dueños de los rojos y el escalamiento (261).

## Done cuando

- [ ] "¿Qué toca a las 11:00 de un martes?" devuelve los programas con ese horario y nada un sábado, con test.
- [ ] Encender una métrica sin umbral se rechaza en el servidor (no solo en la pantalla), forjando la acción.
- [ ] Dos programas con el mismo grupo son dos reportes separados: nunca un mensaje que mezcle programas, con test.
- [ ] Cada cambio queda en `change_log`; recorrido con clic de la sección.

## Notas

El id del grupo no es un secreto ni un dato personal (es el identificador de un grupo de trabajo), pero no se
muestra fuera de esta sección.
