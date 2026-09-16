# spec — Retia CRM: llamadas, ventas, métricas y recursos, sin WhatsApp

> Un closer necesita registrar su llamada, su venta y cada abono apenas pasa, y encontrar el
> brochure o el link de pago correcto sin preguntar en un grupo; gerencia necesita ver el embudo
> de cada cohorte en vivo; y el negocio necesita agregar programas, closers y productos sin
> esperar a un desarrollador.

Última revisión: 16-sep-2026 (ADR 0012 a 0017). La versión anterior, centrada solo en el
registro de llamadas, está en el historial de git.

## 1. Qué hace

CRM interno de Retia con cuatro pilares, construidos en este orden:

0. **Contrato de extensión (la base).** Programas, cohortes, closers, productos, plataformas de
   pago, motivos, orígenes del lead, fuentes y recursos son **instancias** que se crean y editan
   desde la app. El código solo conoce **tipos** (ADR 0012). Un gerente agrega un programa
   nuevo, con su hoja de Sheets, su Calendly, su web y sus recursos, sin tocar código; un closer
   nuevo empieza a contar en las métricas apenas se le da de alta.
1. **Llamadas y ventas de los closers.** El closer registra cada llamada contra un lead ya
   sincronizado, con un único resultado (agendada, show, no_show, cancelada, reagendada,
   compromiso_pago, cerrada, perdida; ADR 0015), una nota, el origen del lead y, según el
   resultado, fecha de seguimiento o motivo. Si cerró, en la misma pantalla registra la venta
   (producto, precio del contrato, plataforma) y su primer **abono**. Los pagos posteriores de
   una venta se registran como abonos nuevos (ADR 0013). El comprobante es un link opcional
   (ADR 0017).
2. **Métricas para gerentes.** Un dashboard por programa, visible para cualquier closer o
   gerente ("todos ven todo", ADR 0009), muestra por día, semana, cohorte y mes: agendas,
   llamadas realizadas, % de show, ventas, % de cierre, caja recaudada, meta y meta dinámica,
   por closer y por origen del lead. Se puede entrar al historial de cualquier persona. Se puede
   descargar un snapshot de lo que se ve en pantalla.
3. **Recursos centralizados.** Una pantalla con los links que el equipo usa a diario (brochures,
   web del programa, guiones, formulario del RUT) y los enlaces de pago por monto y plataforma,
   filtrables por programa, con marca de vigente e historial.
4. **Nerd Stats para developers.** Un rol developer que ve todo y una vista de salud de la
   herramienta: corridas de sync y sus errores, cambios recientes de configuración, versión
   desplegada y estado del cron.

Reemplaza WhatsApp, el calendario compartido y el second brain personal de Mike como el lugar
donde vive esta información.

## 2. Qué NO hace

- No reemplaza el sync de leads desde Google Sheets: los leads siguen entrando por ahí
  (ADR 0004 y 0008).
- No genera el PDF narrativo de Mike. El dashboard es el reporte; lo único exportable es un
  **snapshot** de lo que ya se ve en pantalla (decidido el 15-sep).
- No permite crear un comprador que no exista ya como lead sincronizado.
- No sube archivos: recursos y comprobantes son links (ADR 0017).
- No convierte monedas: cada monto va con su moneda y la caja se suma por moneda.
- No incluye el lead magnet de Juan Pablo ni el newsletter de SendGrid.
- No migra el historial completo como parte del MVP (ver supuestos).
- No conecta Calendly, Kapso, Typeform ni Addi todavía. El alta de un closer sí guarda su correo
  de Calendly para que esa integración futura no requiera código.
- No expone una API propia para herramientas externas (ADR 0006).
- No envía recordatorios de seguimiento. Sí guarda la fecha de seguimiento, que es el dato que
  esa función futura va a necesitar.
- No incluye vista kanban ni calendario.
- No gestiona el onboarding posterior a la venta (el Excel de Daniel Rincón).

## 3. Usuario

- **Closer** (Andrea, Maru, Jero, y quien se sume): su momento de mayor tensión es al colgar una
  llamada. Hoy sale de ese momento a mandar un screenshot al grupo o a pedir un link de PayPal.
- **Gerente** (Alejandro Carvajal, Daniel Tovar, Michael): su momento de mayor tensión es
  preguntar en el grupo "¿cuántas calls, cuántos no-show, cuántas ventas hoy?" y depender de que
  Mike arme el PDF.
- **Developer** (Mani y quien mantenga la herramienta): necesita saber si el sync corrió, qué
  falló y qué cambió en la configuración sin abrir la base a mano.

## 4. Flujo (5 pasos)

1. El closer termina una llamada y entra al CRM con su cuenta de Google.
2. Busca al lead entre los ya sincronizados. La cohorte se asigna sola (la activa del programa).
3. Registra resultado, origen y nota. Según el resultado aparece fecha de seguimiento, motivo, o
   los campos de venta (producto, precio, plataforma, primer abono, link del comprobante). Si
   falta un producto o una plataforma, la crea ahí mismo (productos) o se la pide a un gerente
   (plataformas).
4. El registro aparece de inmediato en el dashboard, atribuido al closer de la sesión.
5. Cualquier closer o gerente abre el dashboard del programa, filtra por fecha y closer, y ve la
   operación del día, la semana, la cohorte y el mes.

## 5. Criterios de aceptación

1. Dado un closer autenticado, cuando registra una llamada cerrada con su venta y su primer
   abono, entonces quedan guardados con su closer, cohorte, programa y producto correctos, y
   aparecen en el dashboard sin usar WhatsApp.
2. Dado un cierre registrado por cualquier closer, cuando otro closer o un gerente abre el
   dashboard, entonces ambos ven el mismo dato (ADR 0009).
3. Dado un gerente que filtra por programa y rango de fechas, entonces ve agendas, show, ventas,
   % de cierre y caja recaudada calculados desde los registros, con la caja sumando los abonos
   de ese rango (aunque la venta sea de antes).
4. Dado un gerente que crea un programa nuevo con su cohorte, su fuente y sus recursos desde
   `/ajustes`, entonces el programa aparece en la navegación, su dashboard funciona y sus leads
   sincronizan, sin ningún cambio de código.
5. Dado un gerente que da de alta un closer nuevo y lo asigna a un programa, entonces ese closer
   puede registrar llamadas y aparece en las métricas del programa.
6. Dado un closer que necesita un brochure o un link de pago, cuando entra a Recursos y filtra
   por programa, entonces encuentra la versión vigente y la copia en un clic.

## 6. Datos

- **Identidad del lead**: nombre, correo y teléfono, capturados por el sync de Sheets.
- **Datos de la llamada**: resultado, nota, origen, fecha de seguimiento, motivo. Son
  observación del equipo comercial.
- **Datos de la venta y abonos**: producto, precio del contrato, plataforma, monto, moneda, fecha
  y link del comprobante. Son datos financieros operativos de la empresa. No se pide número de
  tarjeta, cuenta bancaria ni ningún dato que identifique un instrumento de pago.
- **Configuración**: programas, cohortes, metas, productos, catálogos, fuentes, recursos,
  enlaces de pago. Toda alta o cambio queda en `change_log`.
- **Marco regulatorio**: no validado si registrar montos de compra requiere tratamiento
  particular bajo habeas data (Ley 1581 de 2012). Va a supuestos.

## 7. Supuestos por validar

- [x] "Todos ven todo" (caja incluida): **confirmado por Mani el 16-sep** (ADR 0009 queda firme).
- [ ] Import histórico: **sí se importa el histórico de C2 (confirmado por Mani el 16-sep).** Los
      dos consolidados de Michael (`docs/insumos/historico-c2/`) tienen discrepancias
      documentadas: qué se reconcilia y qué se descarta se define al abrir el ticket.
- [x] Los leads se sincronizan desde Sheets (**confirmado por Michael el 16-sep**, ADR 0004 queda
      firme). Cada fuente declara sus columnas; no se exige que las hojas tengan la misma forma.
- [ ] Qué pasa si el closer no encuentra al lead (llegó por WhatsApp directo o por masivos sin
      aplicar). Hoy el spec asume que siempre existe.
- [ ] Formato del snapshot (PDF, PNG o CSV) y quién puede tomarlo.
- [ ] Si los closers pueden agregar recursos o solo verlos. Por defecto: solo gerentes editan.
- [ ] Si las plataformas de pago las puede crear un closer (como los productos) o solo un
      gerente. Por defecto: solo gerente.
- [ ] Moneda de los abonos: los reportes hablan en USD, pero hay pagos por Bancolombia y
      MercadoPago que podrían entrar en COP. Por defecto: se guarda la moneda real del abono.
- [ ] Calendly individual por closer o cuenta compartida (afecta la integración futura).
- [ ] Marco regulatorio de datos financieros, sin validar con nadie de Retia.
