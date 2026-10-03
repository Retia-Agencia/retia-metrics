# 0077 — Cada dato vive en la pantalla de su objeto, y lo que no se usa se quita

- **Estado:** aceptado · 3-oct-2026 (Mani). Se construye en la ola O3 (`docs/plan-reparto.md` §4), tickets 168 a 175.
- **Enmienda:** ADR 0012 (las instancias viven en la base: sigue, pero un catálogo nuevo ya no es la respuesta por
  defecto), ADR 0034 (las plataformas de pago se administran desde el programa, no desde Catálogos), ADR 0074 (la
  cuenta de Calendly se elige en el perfil y en el Equipo del programa, de las cuentas libres), ADR 0070 (el pendiente
  Seguimiento pide **Próximo contacto**, prellenado), ADR 0028 ("Ver como closer" elige a qué closer ver, en solo
  lectura).
- **Confirma:** ADR 0043 (el programa es frontera), ADR 0071 (las once etapas de 30X y sus tres pendientes), ADR 0075
  (el closer ve solo sus deals; ahora también solo sus llamadas).

## Contexto

Mani recorrió el CRM como gerente y como closer (3-oct, `docs/anotaciones.md` A-52 a A-76) y lo que más pesa no es
un bug: es que **la información que va junta está repartida**. Lo de un programa vive en cuatro lugares (tab
Programa, Ajustes → Programas, Ajustes → Fuentes, Catálogos → Plataformas y Recursos → Enlaces de pago). Lo de un
usuario en tres (`/perfil`, `/ajustes/usuarios`, `/mi-dia`). Hay pantallas que nadie usa (Personas, Orígenes del
lead, Urgencias sin navegación, rutas que solo redirigen) y campos que se piden en dos sitios (fecha de seguimiento
en Editar y en la transición). Cada uno se construyó con una razón, ticket por ticket; juntos hacen que operar el CRM
cueste más de lo que debería. Quienes lo usan no son técnicos.

## Decisión

1. **Cada dato vive en la pantalla de su objeto.** Los objetos son **Programa, Perfil (Mi espacio), Deal y Lead**.
   Ajustes solo guarda lo que no es de ningún objeto: usuarios y roles, Canales, Webhook Health, Motivos y Áreas.

   | Objeto | Guarda |
   |---|---|
   | Perfil / Mi espacio | quién soy, mis programas, mi Calendly por programa, mis deals, llamadas, students y pendientes |
   | Programa | datos y ticket, cohortes, formularios (fuentes), Calendly (token y webhook), Equipo (quién vende y su cuenta), plataformas con sus links de pago, comisión |
   | Deal | Transición, Alertas, Urgente, llamadas, facturación (con el descuento), log |
   | Lead | ficha y envíos; la lista en tarjetas o en tabla |
   | Recursos | archivos libres del equipo, sin catálogo de categorías |

2. **Antes de agregar una pantalla, un campo o un catálogo, se busca qué quitar.** Un catálogo nuevo necesita que el
   código decida con su valor o que una métrica lo agrupe; si no, es texto o no existe. Lo que ninguna métrica ni
   regla lee se retira (ADR 0026: se borra lo que nunca se usó; lo usado se desactiva y se dice).

3. **Se quita:** `/personas` (lo reemplaza Leads), `/mi-dia` vacío (lo reemplaza Mi espacio), el catálogo de Orígenes
   del lead, las categorías de recurso, `/p/<programa>/urgencias`, las rutas que solo redirigen (`/programas/[slug]`,
   `/documentos`), `closer_id` en el perfil, "Otra ruta" en las alertas y la fecha de seguimiento en Editar.

4. **Se queda aunque parezca complejo**, porque decide dinero o métricas: las once etapas y sus tres pendientes,
   Motivos, Áreas y el catálogo de Canales. **Los canales no se crean solos**: un error de tecleo (`fb`) o una macro
   de Meta sin expandir serían canales nuevos, "sin clasificar" dejaría de existir (AGENTS.md exige mostrarlo aparte)
   y el área no se puede adivinar. Los crea quien `manejaPauta` (ADR 0052), con un clic desde el par sin canal.

5. **Una llamada siempre tiene closer.** El closer de una llamada de Calendly es el host de la cita, emparejado con
   la cuenta de Calendly de su membresía. Si el host no tiene cuenta en el CRM, la llamada sale en rojo en el Inbox
   ("host sin cuenta en el CRM"): ese es el único caso de llamada sin closer, y es una falla de configuración que se
   arregla en el Equipo del programa.

6. **Las tres franjas de una ficha de deal:** **Urgente** (rojo, se resuelve hoy), **Alertas** (amarillo, solo las
   alertas de verdad) y **Transición** (verde: a dónde puede ir y qué le falta). Tonos de Tinta, nunca fondos a mano.

## Consecuencias

- Las sesiones de la ola O3 tienen, cada una, la lista de qué entra a su objeto y qué se borra.
- `AGENTS.md` lleva la regla del punto 1 y 2 en "Arquitectura".
- Lo que se borre con referencias reales se mide antes en producción (solo lectura) y se cuenta en el cierre.
