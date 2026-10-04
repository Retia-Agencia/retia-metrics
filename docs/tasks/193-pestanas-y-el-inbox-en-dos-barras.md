---
id: 193
etapa: O6
serves: "docs/anotaciones.md A-97; A-06, A-86; ticket 185"
depends: [185]
status: todo
---

# 193 — Las pestañas son una pieza del CRM, y el Inbox se parte en Llamadas y Deals

Sesión **P1**, frente de pantallas de la ola O6. Sin migración. **Va primero:** 194, 195 y 197 usan la pieza que sale
de aquí.

## Por qué existe

- **A-97 (Mani, 4-oct).** El Inbox mezcla llamadas y deals en una sola barra y los nombres no dicen qué hay adentro
  ("Sueltas", "Atención"). La barra le gusta como se ve; lo que falla es qué agrupa y cómo se llama. Y todavía no se
  comporta como pantalla fija: algo crece con los registros.
- La barra de pestañas está **copiada a mano** en `inbox/page.tsx` y `leads/page.tsx` (las mismas clases). Programa,
  Recursos y Dashboard la van a usar (194, 195, 197): si no es una pieza, quedan cinco copias que se desalinean.

## Alcance

1. **La pieza `components/layout/pestanas.tsx`.** Sale de la barra que ya existe, sin cambiarle el aspecto. Contrato:
   - Pestañas por **URL** (`?seccion=<id>`, el parámetro se puede nombrar), que conservan el resto del query. Así
     "Volver" (174) regresa a la pestaña y un enlace la puede abrir directo.
   - Cada pestaña: `id`, `etiqueta`, `total` opcional (en `cifra`) y una **descripción de una línea**.
   - Puede ir en **grupos con título** (lo que pide el Inbox: dos barras, una sola pestaña activa entre las dos).
   - Una función pura `pestanaActiva(pedida, pestanas, porDefecto)` decide la activa: la pedida si existe, si no la
     primera con algo (o la que diga la pantalla), si no la primera. Test de esa función.
   - Debajo de la barra, la descripción de la pestaña activa, en `text-sm text-muted-foreground`. Tinta (§9): sin
     colores a mano.
   - Server component: los enlaces se arman en el servidor (la lección del 185 con la paginación de Calls).
2. **Leads usa la pieza** para "Leads / Posibles duplicados" (solo cambia la barra; la conducta queda igual).
3. **El Inbox en dos barras** (decidido con Mani el 4-oct; los textos los puede afinar al revisar):

   | Barra | Pestaña (`id`) | Antes | Qué muestra (la línea descriptiva) |
   |---|---|---|---|
   | Llamadas | `por-registrar` | Sin resultado | Llamadas que ya pasaron y nadie registró qué pasó. Registra si hubo show, si se reagendó o si se cayó. |
   | Llamadas | `sin-deal` | Sueltas | Citas de Calendly que no se pudieron unir a un deal solas. Elige a qué deal pertenecen. |
   | Deals | `agendados-sin-dueno` | Sin dueño (la mitad urgente) | Deals con una cita ya agendada y sin closer. Lo más viejo primero. |
   | Deals | `por-settear` | Sin dueño (la otra mitad) | Deals sin closer que todavía no agendan. Reclámalos, del puntaje más alto al más bajo. |
   | Deals | `no-agendaron` | Perdidos en Calendly | Leads calificados que abrieron Calendly y no terminaron de agendar hace más de 5 minutos. |
   | Deals | `necesitan-accion` | Atención | Deals con un pago o un compromiso vencido, sin actividad o con los intentos agotados. |

   - "Sin dueño" hoy apila dos listas en una pestaña; se parte en dos porque cada una tiene su orden y su urgencia (la
     regla de §9: una segunda lista con acciones propias es otra pestaña). `InboxSinDueno` se usa con una sola de las
     dos listas, o se parte en dos componentes; lo que sea más chico.
   - Orden para abrir por defecto: la primera con algo en el orden de la tabla.
   - Los `id` viejos (`sin-resultado`, `sin-dueno`, `perdidos`, `sueltas`, `atencion`) se traducen a los nuevos, para
     que un "Volver" o un enlace guardado no caiga en la pestaña equivocada (`sin-dueno` → `agendados-sin-dueno`).
     Buscar con `grep` quién arma `?seccion=` hacia el Inbox (Mi espacio, avisos) y actualizarlo.
   - "Hosts sin cuenta" sigue como franja de aviso arriba (decisión del 185), con una línea que diga qué hacer.
4. **Pantalla fija de verdad.** Medir primero en `dev:local` qué crece (la franja de hosts, una pestaña con dos
   tarjetas, una tarjeta sin tope). Con lo de arriba, el alto de la página es el de la ventana desde `md` y el scroll
   vive en la lista de la pestaña activa. A 375 px vuelve el scroll de página (regla del 185).
5. **La regla en `docs/structure.md` §9:** cuándo pestañas, la pieza que se usa y que toda pestaña lleva su línea.

## Archivos

`components/layout/pestanas.tsx` (nuevo) y su test, `app/(app)/p/[programa]/inbox/page.tsx`,
`app/(app)/p/[programa]/leads/page.tsx` (solo la barra), `components/deals/inbox-*.tsx` solo donde el corte lo pida,
quien enlace a `?seccion=` del Inbox, `docs/structure.md` §9.

## Done cuando

- Una sola barra de pestañas en el código (`grep "rounded-full border bg-muted p-0.5"` solo la encuentra en la pieza y
  en los toggles que no son pestañas, como Tarjetas/Tabla).
- Inbox con las dos barras, los nombres y las líneas de la tabla; cada pestaña muestra su conteo; los `id` viejos
  abren la pestaña nueva que corresponde; "Volver" desde un deal regresa a la pestaña.
- El Inbox no crece con los registros desde `md`; el scroll vive en la lista.
- Test de `pestanaActiva`; typecheck, lint, `npm run build` (la pieza la importan páginas de servidor y no debe meter
  `lib/db` al cliente).
- Recorrido en `dev:local` como closer y gerente, escritorio y 375 px, consola abierta, abriendo cada pestaña y lo que
  se abre adentro (registrar resultado, asignar suelta, reclamar, "Asignar a").
