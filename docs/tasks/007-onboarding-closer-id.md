---
id: 007
fase: F1
serves: "spec §5 criterio 5; precondición de ADR 0011"
depends: [015]
status: en curso
---

# 007 — Dar de alta a los closers reales

## Objetivo
Andrea, Maru y Jero (y cualquier closer activo) tienen cuenta con `closerId`, correo de Calendly
y sus programas asignados, cargados desde la pantalla del ticket 015.

## Alcance
- Dentro: confirmar con Michael la lista de closers activos, sus correos de Google y el texto
  exacto de su nombre en la BBDD; cargarlos desde `/ajustes/usuarios`.
- Dentro: dar de alta a los gerentes (`administrativa@retiagrowth.com`) y developers.
- Fuera: auto-registro (no existe, por regla).

## Done cuando
- [ ] Cada closer activo tiene `rol="closer"`, `closerId` no nulo y al menos un programa.
      *18-sep: Maru lista (`Maru`, los 2 programas). Falta Andrea: su `closer_id` ya se sabe,
      falta su correo de Google.*
- [ ] `registrarLlamada` probado con una cuenta real de closer. *18-sep: desbloqueado, ya hay
      closer y productos en `production`. Nadie ha registrado todavia una llamada real alla.*

## De donde sale el `closer_id` (18-sep)

**No se inventa ni se le pregunta a la persona: esta en la columna "Closer" de la pestana
"Registro de llamadas" de cada hoja.** Valores reales y su volumen:

| closer_id | Tactical | Comunicarte |
|---|---|---|
| `Andrea` | 125 | 192 |
| `Maru` | 1 | 10 |
| `Dana` | 25 | 17 |
| `Alejo` | 18 | 19 |
| `juanse` (minuscula) | 9 | — |
| `Sebastian` | 8 | — |

**DECIDIDO por Mani el 18-sep: Dana, Alejo, `juanse` y Sebastian NO se dan de alta.** Quedan
solo como `closer_id` historico en los registros que ya existen: siguen apareciendo como closer
asignado en las metricas y en el comparativo, pero no tienen cuenta y no entran al dashboard
porque ya no estan activos. **No hace falta volver a preguntarlo.** La cadena es literal y
distingue mayusculas, asi que `juanse` en minuscula se conserva tal cual.

## Notas
**Michael, 16-sep:** los closers activos son Andrea y Maru. Jerónimo aparece como responsable de
leads en otra respuesta: confirmar si sigue activo. Los correos de Google faltan.
**Mani, 16-sep:** la lista final de usuarios (closers y managers) y sus correos se cargan desde
la pantalla del 015 justo antes de salir a producción. Este ticket se hace en ese momento.

Operación, no código. Juanito tiene su propio mapeo de closers de Calendly; cuando exista la
integración, lo leerá de aquí.
