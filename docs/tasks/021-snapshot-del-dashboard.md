---
id: 021
fase: F2
serves: "spec §2 — snapshot descargable"
depends: [005]
status: todo
---

# 021 — Snapshot descargable del dashboard

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
