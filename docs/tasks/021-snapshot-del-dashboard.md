---
id: 021
fase: F2
serves: "spec §2 — snapshot descargable"
depends: [005]
status: todo
---

# 021 — Snapshot descargable del dashboard

> ⚠️ **21-sep: CONGELADO hasta la etapa 5 de [plan-crm-v2](../plan-crm-v2.md).** No por bloqueo,
> por desperdicio: el dashboard que este PDF fotografiaria esta por ganar conversion etapa a etapa,
> la replica de Urgencias y el ROAS en tres cubos. Hacerlo ahora es hacerlo dos veces.

## Objetivo
Quien lo necesite descarga lo que ve en el dashboard para compartirlo fuera de la app.

## Ya NO está bloqueado (19-sep)

Lo que lo bloqueaba era **quién puede tomarlo**, y Mani lo cerró el 19-sep: **los dos roles, igual
que el dashboard**. Coherente con el ADR 0009 ("todos ven todo"): si un closer ya ve la caja y el
comparativo en pantalla, impedirle bajar en PDF lo que tiene enfrente es una reja que no protege
nada, y el PDF recibe el mismo objeto que pintó la pantalla (ADR 0024), así que no expone nada
nuevo.

**Sigue siendo el último de la fila por prioridad, no por bloqueo** (Mani, 16-sep).

## ✅ Formato decidido por Mani el 18-sep: **PDF**

Descartados en el mismo momento: texto copiable (la recomendación de la sesión, por cero
dependencias), PNG y CSV.

**Lo que esta decisión arrastra, y hay que aceptarlo con los ojos abiertos:**

- **Es el único formato de los cuatro que obliga a una dependencia nueva.** El ADR 0006 dice que
  un paquete no se instala antes del código que lo usa, así que la instalación va DENTRO de este
  ticket, no antes. Nada de dejar la librería puesta "para cuando llegue".
- **Es el que más trabajo da para cumplir el primer "Done cuando"** (*refleja exactamente los
  números en pantalla, sin recalcular*). Un PDF se dibuja aparte de la pantalla, así que la
  tentación va a ser recalcular en el generador. **No se recalcula: el PDF recibe el mismo objeto
  que ya pintó el dashboard.** Si dos lugares tienen que dar la misma cifra, la cifra vive en un
  módulo y los dos la importan (ADR 0024).
- **El formato de cada número pasa por `lib/format.ts`**, igual que la pantalla. El PDF es otra
  presentación, no otra definición. Es exactamente la enfermedad que se destapó en el CIERRE 9 con
  las dos pantallas de `/ajustes` escribiendo el dinero en crudo.
- **Queda pendiente de decidir quién puede tomarlo** (`docs/spec.md` §7). Al llegar acá, recordar
  que dentro del dashboard rige "todos ven todo" (ADR 0009), así que lo más probable es que la
  respuesta sea "cualquiera que pueda ver el dashboard", pero se escribe, no se asume.

Queda una pregunta sin responder que conviene resolver ANTES de codear: **cómo es el reporte
diario de Mike que este PDF viene a reemplazar.** La sesión del 18-sep no lo pudo mirar (el
clasificador de permisos bloqueó la lectura del grupo *Ventas ComunicArte*, con razón: esos grupos
tienen credenciales). Sin ese formato a la vista, el PDF se va a inventar una estructura y el
equipo va a seguir mandando el de Mike.

## Done cuando
- [ ] Refleja exactamente los números en pantalla, sin recalcular.
- [ ] Lleva fecha, programa y rango en el nombre y en el contenido.

---

## ✅ El reporte de Mike YA SE PUEDE MIRAR (20-sep)

La pregunta que este ticket marcaba como "conviene resolver ANTES de codear" esta resuelta.
Mani entrego **seis reportes diarios reales** (1, 4, 8, 9, 14 y 15 de septiembre de 2026),
guardados en su second brain en
`02 Projects/retia/notebook/reportes-diarios-mike/` con una nota que explica la estructura.

**No tiene que quedar igual.** Mani lo dijo explicito: es un punto de partida.

### Estructura del reporte

Encabezado: fecha, dia de la semana habil, dia del mes habil, dia del corte por programa, y la
meta proyectada a 50 cupos **recalculada cada dia** (lo que falta dividido por los dias habiles
que quedan).

1. **El dia** — meta vs real vs cumplimiento (cupos y leads por programa); narrativa de los cupos
   con nombre, monto y de donde salio cada uno; caja del dia; tabla agendas / llamadas / show /
   ventas / % cierre por programa; **la misma tabla por closer**; y el detalle agenda por agenda.
2. **Los masivos** — tandas de WhatsApp, enviados, no entregados por el limite de Meta, respuestas
   clasificadas por objecion, ventas del canal.
3. **La semana** — meta de la semana, meta a la fecha, real, cumplimiento; y "meta para llegar a
   50" con cupos que faltan, dias habiles restantes y meta diaria.
4. **El corte** — meta, vendidos, faltan, dias habiles restantes, cumplimiento contra meta lineal.
5. **El mes** — leads, cupos, cumplimiento contra meta lineal.
6. **Planes de accion** — tabla plan / estado / nota.

### 🎯 Lo que esto acota, y es el hallazgo que importa

**El CRM puede generar las secciones 1 (sin la narrativa), 3, 4 y 5.** Todas salen de consultas
que ya existen: agendas, llamadas, show, ventas, caja, dias habiles, meta dinamica (ticket 020) y
ventana de la cohorte (ADR 0022). Incluso el comparativo por closer, que ya esta en el dashboard.

**El CRM NO tiene:**
- **La seccion 2, los masivos.** Es data de WhatsApp/Kapso. Hoy esta en "Futuro" de la spec.
- **La seccion 6, planes de accion.** Es una bitacora humana; no hay tabla que la guarde.
- **La narrativa de la seccion 1** (quien cerro, de donde salio, por que no entro). El CRM tiene
  los motivos de perdida como catalogo, no el parrafo.

**Consecuencia para el alcance:** este PDF reemplaza el **esqueleto numerico** del reporte, no el
reporte entero. Quien lo mande sigue escribiendo la narrativa y los masivos aparte. Decirlo ahora
evita la trampa que el propio ticket senalaba: *"el PDF se va a inventar una estructura y el
equipo va a seguir mandando el de Mike"*. Va a seguir mandando **parte** del de Mike, y eso esta
bien siempre que se decida a proposito.
