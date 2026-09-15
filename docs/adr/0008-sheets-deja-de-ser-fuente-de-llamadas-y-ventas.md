# 0008 — Sheets deja de ser la fuente de verdad para llamadas y ventas; sigue siendolo para leads

**Fecha:** 2026-09-15

ADR 0004 establecio que Sheets es la fuente de verdad completa porque "una app que exige abandonar
Sheets no se adopta". En la reunion de Tech Retia del 14 de septiembre de 2026, el mismo equipo
(Michael Castellanos, Alejandro Carvajal, Alejandro Davila) decidio lo contrario para las llamadas
y las ventas: los closers dejan de registrarlas en la pestana `Registro de llamadas` y en
WhatsApp, y pasan a registrarlas directo en el CRM.

**Decidimos acotar ADR 0004, no revertirlo.** Los leads (formulario de aplicacion) siguen entrando
por Sheets exactamente como hoy; el sync existente no cambia. Las llamadas y las ventas dejan de
tener a Sheets como fuente: el CRM es su dueno nativo desde el momento en que un closer las
registra ahi. La razon del cambio de opinion es concreta, no caprichosa: la pestana de llamadas
nunca se uso de forma consistente en la practica (filas sin fecha, sin closer, sin resultado, ver
los consolidados de Michael del 14 de sep), y las ventas viven hoy repartidas entre WhatsApp, un
calendario compartido y el second brain personal de Mike, con discrepancias documentadas entre esas
fuentes para el mismo corte.

**Consecuencia:** las tablas `calls` y `sales` pasan a recibir escritura de dos origenes (Sheets y
app) al mismo tiempo. Ver ADR 0010.
