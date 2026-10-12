# 0084: Un gerente puede operar como closer sin dejar de ser gerente

- **Estado:** aceptado, 12-oct-2026 (Mani, con Michael). Se construye en el ticket 236.
- **Enmienda:** ADR 0003 (gerente y closer disjuntos). La disjunción sigue rigiendo las RUTAS; esta decisión solo amplía
  la pregunta de capacidad `trabajaLeads`.

## Contexto

Michael es gerente y, cuando una closer tiene un problema, toma él la llamada y cierra el deal. Pidió "facultades de
closer". Hoy un gerente pasa `puedeTrabajarDeal` (administra), pero `trabajaLeads` lo frena: no registra llamadas ni
abonos, no puede ser dueño de un deal, no reclama en el Inbox ni tiene Mi espacio de closer. Cambiarle el rol a
`closer` le quitaría la administración (`/ajustes`, usuarios). Su regla (12-oct): **"el deal es de quien lo cierre"**,
y **cobra comisión** como cualquier closer.

## Decisión

1. **Capacidad, no rol.** `users.opera_como_closer` (boolean, `false` por defecto). Se prende por usuario desde
   `/ajustes/usuarios` por el molde de catálogo (queda en `change_log`). No hay `roles[]`: varios roles por usuario
   obligarían a reescribir `puedeAcceder`, `rolDeVista` y todas las guardas, y el gerente ganaría sin pensarlo cada
   permiso nuevo del closer, que es lo que el ADR 0003 evita.
2. **`trabajaLeads` recibe el sujeto, no el rol:** `{ rol, operaComoCloser }`. Responde `true` al closer, al developer
   y a quien tenga la capacidad. El campo es obligatorio en el tipo: el typecheck señala todo llamador.
3. **La sesión lleva la capacidad**, leída de `users` en cada emisión (`revalidarToken`), igual que el rol: apagarla
   saca a la persona de inmediato.
4. **Dueño, llamadas, abonos y comisión salen de las reglas que ya existen.** Con la capacidad y una membresía activa,
   la persona es dueño posible (`duenosPosibles`); los deals que toma se los reasigna con el selector de dueño de
   siempre, las llamadas que registra quedan a su nombre y la comisión se calcula por dueño del deal. No hay reglas
   nuevas de traspaso.
5. **Lo de gerente no se pierde.** Quien administra y además trabaja leads sigue viendo lo de administrador (por
   ejemplo "Por decidir" en Mi espacio) además de las secciones de closer.

## Consecuencias

- La suma de los closers en el comparativo incluye a la persona con la capacidad cuando es dueña de deals: es
  correcto, cerró esas ventas.
- "Ver como closer" (ticket 172) sigue ofreciendo solo cuentas con rol `closer`; no se extiende aquí.
