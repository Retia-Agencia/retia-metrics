---
id: 145
etapa: NC2
serves: "comercial.md R-6, GC-42, GC-43"
depends: []
status: done
---

# 145 — El rol Customer Success y el onboarding en cuatro pasos

## Enmienda del 8-oct (reunión con Michael y Jero): primero el rol con UNA marca

Se desbloquea con un alcance más chico. **Primera entrega:** el rol Customer Success, que ve Students con la
misma información que ve hoy un closer y **solo** puede marcar onboarded sí o no (la marca `onboarded_at`
que ya existe, 063/099). Nada más: no mueve deals, no ve Leads ni Deals.

Las personas: **Dani Rincón** (Tactical) y **Juanjo** (ComunicArte). Cada uno con membresía en su programa.
**Creados en producción el 28-oct** por Mani, con su membresía activa.

Los cuatro pasos de abajo quedan para la segunda parte.

## Segunda parte: los pasos del onboarding (QM-5 cerrada por Mani, 28-oct)

**Decisión:** los pasos son **filas por programa** (ADR 0012) y **los edita el Customer Success de ese programa**
(con membresía activa) además de quien administra. El código no decide nada según cuál paso es: solo cuenta si
están todos.

**Cómo se ve:**

- **Programa › Onboarding** (pestaña nueva): la lista de pasos del programa, con agregar, renombrar, reordenar y
  desactivar. Molde de `lib/catalogo/` (`activo`, zod, `change_log`, no se borra un paso ya marcado).
- **Students, columna Onboarding:** `2/4 ▾` abre las casillas de los pasos; cada marca guarda quién y cuándo.
  **"Marcar todo"** completa con un clic los pasos que faltan. El estudiante está onboarded cuando están marcados
  todos los pasos **activos**; `onboarded_at` sigue siendo la marca que leen el filtro y las métricas, y la escribe
  la misma operación que marca el último paso (una sola respuesta, ADR 0024).
- Los pasos iniciales de cada programa: mensaje de bienvenida por WhatsApp, grupo de WhatsApp, correo de
  bienvenida y Circle.

**Pide migración** (pasos por programa y marcas por deal): la genera y aplica la sesión principal. Abierto para
el ticket que la construya: qué pasa con los `onboarded_at` ya marcados (propuesta: cuentan como todos los pasos
marcados por quien los marcó) y si agregar un paso nuevo "des-onboardea" a los ya completos (propuesta: no, la
marca completa se conserva).

## Objetivo

Un rol nuevo que solo ve Students y marca el onboarding paso por paso: mensaje de bienvenida por WhatsApp,
grupo de WhatsApp, correo de bienvenida y Circle. Cada paso con quién y cuándo; completo = los cuatro.

## Lo ya decidido

La pregunta del rol va en `lib/auth/roles.ts` con el molde del ADR 0052 (nunca un `rol ===` a mano) y el
developer pasa (ADR 0025). Reemplaza la marca única `onboarded_at` (099) con su traducción.
