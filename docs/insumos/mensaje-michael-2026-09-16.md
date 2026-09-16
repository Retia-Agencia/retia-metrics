# Mensaje para Michael — decisiones pendientes (borrador, SIN ENVIAR)

Redactado el 16-sep en la sesion de riesgos. Mani lo revisa antes de enviarlo. Cuando llegue la
respuesta, bajar cada decision al tracker (`docs/tasks/README.md`, "Decisiones pendientes") y a
los tickets que afecta.

---

Hola Michael, para seguir con el CRM necesito cerrar unas decisiones contigo:

1. **Alcance del dashboard y de dónde salen los leads:** ¿quieres que el CRM se sincronice solo con las hojas de Google Sheets de los formularios, o prefieres que los leads se manejen directamente en el CRM (cargados a mano por el equipo)? Si es con Sheets, hay que dejar las hojas de ComunicArte y Tactical Investor con la misma estructura para que el sistema las lea igual, así que quiero confirmarlo antes de hacer ese trabajo.
2. **Closers activos:** ¿quiénes están vendiendo hoy y con qué correo de Google va a entrar cada uno? Cada closer tendrá su propia cuenta para que sus llamadas y ventas queden a su nombre.
3. **Moneda de los abonos:** los pagos que entran por Bancolombia y MercadoPago, ¿se registran en COP o en USD? El sistema no va a convertir monedas por su cuenta.
4. **Leads que no llegan por formulario:** cuando alguien escribe directo por WhatsApp o sale de un masivo, ¿cómo quieres que se registre? ¿Lo crea el closer a mano en el CRM o primero lo agregan a la hoja?
5. **Reporte descargable:** el dashboard será el reporte en vivo, con la opción de bajar una foto del momento. ¿La prefieres en PDF, imagen o Excel/CSV? ¿Y quiénes deberían poder descargarla?
6. **Visibilidad:** la idea actual es que todos vean todo: cada closer ve los números de los demás, la caja y la pauta, igual que un gerente. ¿Lo confirmas, junto con Alejandro?
7. **Histórico de C2:** ¿qué quieres traer al sistema de lo que ya pasó en C2 (llamadas, ventas, abonos, nada)? ¿Hasta qué fecha?
8. **Solo si seguimos con Sheets, columna "Estado" de las hojas:** ¿qué valores usan hoy y qué significa cada uno? Hoy el sistema la ignora y sin ella el embudo queda incompleto.

Con esto puedo dejar listo el registro de llamadas y ventas. ¡Gracias!

---

| # | Ticket o deuda que desbloquea |
|---|---|
| 1 | **Alcance.** Si responde "manual", se reabre ADR 0004 (Sheets fuente de verdad de los leads) y F-01, F-04, F-06, F-07, 016 y el cron pierden sentido o cambian. Si responde "Sheets", hace falta estandarizar las dos hojas a un mismo objeto de transferencia antes de seguir con el sync. Pregunta agregada por Mani el 16-sep: no asumir el sync |
| 2 | 007 |
| 3 | 018, 019 |
| 4 | 003 (depende de la respuesta 1) |
| 5 | 021 |
| 6 | acceso real de closers (ADR 0009) |
| 7 | ticket futuro de importación |
| 8 | F-01 (solo aplica si la respuesta 1 es Sheets) |
