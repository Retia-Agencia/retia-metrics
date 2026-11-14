import type { ACCIONES } from "@/lib/mcp/acciones";
import type { ClaveRegistrada } from "@/lib/metricas/registro";
import type { ClaveDeConcepto } from "@/lib/vocabulario-metricas";

type ClaveDeAccionMcp = (typeof ACCIONES)[number]["clave"];

export type CoberturaDeServerAction =
  | { clase: "expuesta"; accion: ClaveDeAccionMcp }
  | { clase: "pendiente"; grupo: "operacion" | "configuracion"; capacidad: string }
  | { clase: "fuera"; razon: string }
  | { clase: "lectura"; herramienta: string | null; razon?: string };

type ClaveDeServerAction = `${string}#${string}`;

/**
 * Inventario exhaustivo de la frontera de escritura/lectura de la app frente al MCP.
 * La clave conserva archivo y exportación porque hay nombres repetidos en pantallas distintas.
 */
export const COBERTURA_MCP = {
  "app/oauth/autorizar/acciones.ts#permitirConexion": { clase: "fuera", razon: "El consentimiento OAuth siempre queda fuera del MCP." },
  "app/oauth/autorizar/acciones.ts#cancelarConexion": { clase: "fuera", razon: "El consentimiento OAuth siempre queda fuera del MCP." },

  "app/(app)/media/acciones.ts#crearCreadorAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una persona creadora de contenido." },
  "app/(app)/media/acciones.ts#editarCreadorAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Editar una persona creadora de contenido." },
  "app/(app)/media/acciones.ts#crearTipoDePiezaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear un tipo de pieza de contenido." },
  "app/(app)/media/acciones.ts#crearPiezaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una pieza de contenido." },
  "app/(app)/media/acciones.ts#crearLinkFijoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear un enlace fijo de una persona creadora." },
  "app/(app)/media/acciones.ts#editarPiezaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Editar una pieza de contenido." },
  "app/(app)/media/acciones.ts#marcarPublicadaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Marcar una pieza de contenido como publicada." },
  "app/(app)/media/acciones.ts#descartarPiezaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Descartar una pieza de contenido." },

  "app/(app)/p/[programa]/hub/acciones-graficas.ts#detalleDePuntoAccion": { clase: "lectura", herramienta: "consultar_metrica" },
  "app/(app)/p/[programa]/proxima-cohorte/acciones.ts#asignarProximaCohorteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Asignar varios estudiantes a la próxima cohorte." },

  "app/(app)/p/[programa]/recursos/acciones.ts#crearRecursoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear un recurso del programa." },
  "app/(app)/p/[programa]/recursos/acciones.ts#reemplazarRecursoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Reemplazar un recurso del programa." },
  "app/(app)/p/[programa]/recursos/acciones.ts#desactivarRecursoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar un recurso del programa." },
  "app/(app)/p/[programa]/recursos/acciones.ts#borrarRecursoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Borrar un recurso del programa que no se ha usado." },

  "app/(app)/p/[programa]/programa/acciones-reporte-whatsapp.ts#guardarReporteWhatsappAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el reporte por WhatsApp de un programa." },
  "app/(app)/p/[programa]/programa/acciones.ts#crearOVincularPlataformaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear o vincular una plataforma de pago." },
  "app/(app)/p/[programa]/programa/acciones.ts#asociarPlataformaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Vincular una plataforma de pago al programa." },
  "app/(app)/p/[programa]/programa/acciones.ts#desasociarPlataformaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desvincular una plataforma de pago del programa." },
  "app/(app)/p/[programa]/programa/acciones.ts#crearEnlacePagoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear un enlace de pago." },
  "app/(app)/p/[programa]/programa/acciones.ts#reemplazarEnlacePagoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Reemplazar un enlace de pago." },
  "app/(app)/p/[programa]/programa/acciones.ts#desactivarEnlacePagoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar un enlace de pago." },

  "app/(app)/acciones-vista.ts#cambiarVista": { clase: "fuera", razon: "La suplantación de identidad siempre queda fuera del MCP." },
  "app/(app)/acciones-vista.ts#verComoUsuario": { clase: "fuera", razon: "La suplantación de identidad siempre queda fuera del MCP." },

  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#guardarIntegracionAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar una integración del programa." },
  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#configurarMetaCapiAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el envío de conversiones a Meta." },
  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#mandarPruebaMetaCapiAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Enviar una prueba de la integración con Meta." },
  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#guardarRoundRobinAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar la asignación rotativa de citas." },
  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#probarIntegracionAccion": { clase: "lectura", herramienta: null, razon: "Las pruebas de integraciones todavía solo se consultan en la app." },
  "app/(app)/p/[programa]/programa/acciones-integraciones.ts#sincronizarMetaDelProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Sincronizar manualmente los datos de Meta de un programa." },

  "app/(app)/perfil/acciones.ts#guardarCloserIdPropioAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el identificador comercial del perfil propio." },
  "app/(app)/perfil/acciones.ts#asignarMiCalendlyAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el Calendly del perfil propio." },
  "app/(app)/acciones-calendly.ts#eventosDeMembresiaAccion": { clase: "lectura", herramienta: null, razon: "Los tipos de evento de Calendly todavía solo se consultan en la app." },
  "app/(app)/acciones-calendly.ts#asignarEventoDeMembresiaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Asignar un tipo de evento de Calendly a una membresía." },
  "app/(app)/p/[programa]/programa/acciones-umbrales.ts#guardarUmbralAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar un umbral del programa." },

  "app/(app)/p/[programa]/programa/acciones-meta.ts#vincularCuentaMetaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Vincular una cuenta publicitaria de Meta." },
  "app/(app)/p/[programa]/programa/acciones-meta.ts#activarCuentaMetaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Activar una cuenta publicitaria de Meta." },
  "app/(app)/p/[programa]/programa/acciones-meta.ts#desactivarCuentaMetaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar una cuenta publicitaria de Meta." },

  "app/(app)/p/[programa]/deals/acciones.ts#moverDeal": { clase: "expuesta", accion: "mover_etapa" },
  "app/(app)/p/[programa]/deals/acciones.ts#revisarMovimientoAccion": { clase: "lectura", herramienta: "preparar_accion" },
  "app/(app)/p/[programa]/deals/acciones.ts#crearDeal": { clase: "pendiente", grupo: "operacion", capacidad: "Crear un deal manualmente." },

  "app/(app)/p/[programa]/programa/acciones-objetivos.ts#guardarObjetivoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Guardar un objetivo del programa." },
  "app/(app)/p/[programa]/programa/acciones-objetivos.ts#quitarObjetivoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Quitar un objetivo del programa." },
  "app/(app)/p/[programa]/programa/acciones-objetivos.ts#copiarObjetivosAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Copiar los objetivos de otro periodo." },

  "app/(app)/p/[programa]/programa/acciones-programa.ts#crearProgramaInactivoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear un programa inactivo." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#editarProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Editar la configuración de un programa." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#desactivarProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar un programa." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#reactivarProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Reactivar un programa." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#activarProgramaDesdeFichaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Activar un programa después de validar su configuración." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#agregarAlProgramaAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#quitarDelProgramaAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#marcarSetterPorDefectoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Elegir quién recibe por defecto los deals nuevos del programa." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#conectarCalendlyAccion": { clase: "fuera", razon: "Los tokens y secretos de integraciones siempre quedan fuera del MCP." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#crearCohorteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una cohorte." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#editarCohorteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Editar una cohorte." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#activarCohorteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Activar una cohorte." },
  "app/(app)/p/[programa]/programa/acciones-programa.ts#desactivarCohorteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar una cohorte." },

  "app/(app)/p/[programa]/deals/[id]/acciones.ts#moverConHechoAccion": { clase: "expuesta", accion: "mover_etapa" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#deshacerEventoAccion": { clase: "expuesta", accion: "deshacer_evento" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#editarDealAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Editar los datos comerciales de un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#anularDealAccion": { clase: "expuesta", accion: "anular_deal" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#confirmarCorreoDesdeDealAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Confirmar que dos contactos corresponden a la misma persona desde un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#separarCorreoDesdeDealAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Separar contactos que no corresponden a la misma persona desde un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#marcarLinkEnviadoAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Marcar que se envió el enlace de pago." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#editarAcuerdoAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Editar el acuerdo de pago de un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#anotarAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Agregar una nota al historial de un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#proximaCohorteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Asignar un estudiante a la próxima cohorte." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#registrarActividadAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Registrar una actividad comercial en un deal." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#registrarAbonoAccion": { clase: "expuesta", accion: "registrar_abono" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#pedirSubidaParaAbonoAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Preparar la carga de un comprobante para un abono nuevo." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#cambiarPlataformaDeAbonoAccion": { clase: "expuesta", accion: "cambiar_plataforma_de_abono" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#crearPlataformaParaAbonoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una plataforma de pago al registrar un abono." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#pegarComprobanteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Adjuntar el enlace de un comprobante a un abono." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#pedirSubidaComprobanteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Preparar la carga de un comprobante existente." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#confirmarComprobanteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Confirmar la revisión de un comprobante." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#anularAbonoAccion": { clase: "expuesta", accion: "anular_abono" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#marcarOnboardedAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Marcar el onboarding de un estudiante como completado." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#marcarCortesiaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Marcar una venta como cortesía." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#desmarcarOnboardedAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Quitar la marca de onboarding completado." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#cambiarCohorteAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Cambiar la cohorte de un estudiante." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#completarAgendadaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Completar los datos de una cita agendada." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#pegarGrainAccion": { clase: "expuesta", accion: "pegar_grain" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#marcarShowAccion": { clase: "expuesta", accion: "marcar_show" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#reagendarLlamadaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Reagendar una llamada en Calendly." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#marcarFallidaAccion": { clase: "expuesta", accion: "marcar_fallida" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#corregirResultadoAccion": { clase: "expuesta", accion: "corregir_resultado" },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#horasDisponiblesAccion": { clase: "lectura", herramienta: null, razon: "La disponibilidad de Calendly todavía solo se consulta en la app." },
  "app/(app)/p/[programa]/deals/[id]/acciones.ts#agendarLlamadaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Agendar una llamada en Calendly." },

  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#crearFuenteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una fuente de registros." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#editarFuenteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Editar una fuente de registros." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#probarFuenteAccion": { clase: "lectura", herramienta: null, razon: "Las pruebas de fuentes todavía solo se consultan en la app." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#activarFuenteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Activar una fuente de registros." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#rotarSecretoFuenteAccion": { clase: "fuera", razon: "Los tokens y secretos de integraciones siempre quedan fuera del MCP." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#guardarSecretoFuenteAccion": { clase: "fuera", razon: "Los tokens y secretos de integraciones siempre quedan fuera del MCP." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#desactivarFuenteAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar una fuente de registros." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#marcarFuentePrincipalAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Elegir la fuente principal de un programa." },
  "app/(app)/p/[programa]/programa/acciones-fuentes.ts#editarPlantillaLeadAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el mapeo de campos de una fuente." },

  "app/(app)/ajustes/catalogos/acciones.ts#agregarAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Agregar un valor a un catálogo." },
  "app/(app)/ajustes/catalogos/acciones.ts#editarBooleanoAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Cambiar una propiedad de un valor de catálogo." },
  "app/(app)/ajustes/catalogos/acciones.ts#renombrarAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Renombrar un valor de catálogo." },
  "app/(app)/ajustes/catalogos/acciones.ts#desactivarAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desactivar un valor de catálogo." },
  "app/(app)/ajustes/catalogos/acciones.ts#reactivarAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Reactivar un valor de catálogo." },
  "app/(app)/ajustes/catalogos/acciones.ts#borrarAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Borrar un valor de catálogo que no se ha usado." },
  "app/(app)/ajustes/catalogos/acciones.ts#crearPlataformaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Crear una plataforma de pago global." },
  "app/(app)/ajustes/catalogos/acciones.ts#asociarProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Vincular una plataforma de pago a un programa." },
  "app/(app)/ajustes/catalogos/acciones.ts#desasociarProgramaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Desvincular una plataforma de pago de un programa." },

  "app/(app)/ajustes/usuarios/acciones.ts#crearUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#editarUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#desactivarUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#reactivarUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#agregarWhatsappDeUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#quitarWhatsappDeUsuarioAccion": { clase: "fuera", razon: "Los usuarios, roles y alcances siempre quedan fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#revocarConexionDeIa": { clase: "fuera", razon: "Emitir o revocar credenciales siempre queda fuera del MCP." },
  "app/(app)/ajustes/usuarios/acciones.ts#asignarCalendlyDeMembresiaAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el Calendly de una membresía." },
  "app/(app)/ajustes/usuarios/acciones.ts#gestionarCalendlyExtraAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar una dirección adicional de Calendly." },

  "app/(app)/p/[programa]/leads/acciones.ts#buscarLeadsAccion": { clase: "lectura", herramienta: "buscar_leads" },
  "app/(app)/p/[programa]/leads/acciones.ts#confirmarCorreoAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Confirmar que dos contactos corresponden a la misma persona." },
  "app/(app)/p/[programa]/leads/acciones.ts#separarCorreoAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Separar contactos que no corresponden a la misma persona." },

  "app/(app)/ajustes/salud/acciones.ts#reprocesarSobreAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Reprocesar una entrega fallida de una integración." },
  "app/(app)/ajustes/salud/acciones.ts#cargarMasEntregasAccion": { clase: "lectura", herramienta: null, razon: "El historial técnico de entregas todavía solo se consulta en la app." },
  "app/(app)/mi-dia/acciones.ts#crearPersonaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Crear una persona y su primer deal manualmente." },

  "app/(app)/p/[programa]/inbox/acciones.ts#reclamarDealAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Reclamar un deal sin responsable." },
  "app/(app)/p/[programa]/inbox/acciones.ts#reclamarTodosPorSettearAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Reclamar todos los deals pendientes de contacto." },
  "app/(app)/p/[programa]/inbox/acciones.ts#reasignarDealAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Reasignar un deal a otra persona responsable." },
  "app/(app)/p/[programa]/inbox/acciones.ts#completarAgendadaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Completar los datos de una cita agendada desde la bandeja." },
  "app/(app)/p/[programa]/inbox/acciones.ts#asignarLlamadaSueltaAccion": { clase: "expuesta", accion: "asignar_llamada_suelta" },
  "app/(app)/p/[programa]/inbox/acciones.ts#descartarLlamadaSueltaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Descartar una llamada suelta que no corresponde a ningún deal." },
  "app/(app)/p/[programa]/inbox/acciones.ts#crearDealDesdeSueltaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Crear un deal desde una llamada sin asignar." },
  "app/(app)/p/[programa]/inbox/acciones.ts#buscarDealsAbiertosAccion": { clase: "lectura", herramienta: "tablero_de_deals" },
  "app/(app)/p/[programa]/calls/acciones.ts#detalleDeLlamadaAccion": { clase: "lectura", herramienta: "ficha_de_deal" },

  "app/(app)/mi-espacio/acciones.ts#emitirMiTokenAccion": { clase: "fuera", razon: "Emitir o revocar credenciales siempre queda fuera del MCP." },
  "app/(app)/mi-espacio/acciones.ts#revocarMiTokenAccion": { clase: "fuera", razon: "Emitir o revocar credenciales siempre queda fuera del MCP." },
  "app/(app)/mi-espacio/acciones.ts#desconectarMiConexionAccion": { clase: "fuera", razon: "Emitir o revocar credenciales siempre queda fuera del MCP." },
  "app/(app)/mi-espacio/acciones.ts#asignarMiCalendlyAccion": { clase: "pendiente", grupo: "configuracion", capacidad: "Configurar el Calendly del espacio propio." },
  "app/(app)/mi-espacio/acciones.ts#marcarNovedadCalendlyVistaAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Marcar una novedad de Calendly como vista." },
  "app/(app)/mi-espacio/acciones.ts#abrirNovedadCalendlyAccion": { clase: "pendiente", grupo: "operacion", capacidad: "Abrir una novedad de Calendly y marcarla como vista." },
} as const satisfies Record<ClaveDeServerAction, CoberturaDeServerAction>;

/**
 * Acciones del MCP sin server action propia en la app, cada una con su razón. Hallazgo del 13-nov: la app no tiene
 * botón para anular una llamada; solo la anula al deshacer su registro (`lib/deshacer/deshacer.ts`). El MCP sí la expone.
 */
export const ACCIONES_SIN_PAR_EN_LA_APP = {
  anular_llamada: "La app solo anula una llamada al deshacer su registro; no tiene server action propia.",
} as const;

/** Solo baja cuando una capacidad pendiente entra al MCP o sale justificadamente de su alcance. */
export const TOPE_DE_PENDIENTES_DEL_MCP = 96;

type RazonSinLista = `Se pide por consultar_hechos: ${string}` | `Cifra de resumen_del_hub: ${string}`;

/** Conceptos que no abren filas propias, con la ruta de consulta que conserva su definición canónica. */
export const CONCEPTOS_SIN_LISTA_EN_EL_MCP = {
  cupos_vendidos: "Se pide por consultar_hechos: son las ventas del día agrupadas por fecha.",
  llevamos: "Cifra de resumen_del_hub: es el acumulado del periodo, no otro conjunto de filas.",
  recaudado: "Cifra de resumen_del_hub: acompaña a las ventas elegidas y no tiene filas distintas.",
  por_cobrar: "Cifra de resumen_del_hub: es vendido menos recaudado para las mismas ventas.",
  comision: "Cifra de resumen_del_hub: es un porcentaje sobre lo vendido, no una población aparte.",
  citas_del_dia: "Se pide por consultar_hechos: son las citas agrupadas por el día de la cita.",
  show_por_cita: "Cifra de resumen_del_hub: es una razón entre citas, no una lista adicional.",
  cita_a_venta: "Cifra de resumen_del_hub: es una tasa del grupo de citas y comparte sus filas.",
  nacio_agenda_del_dia: "Se pide por consultar_hechos: es una clasificación de las ventas según sus llamadas.",
  nacio_seguimiento: "Se pide por consultar_hechos: es una clasificación de las ventas según sus llamadas.",
  nacio_sin_llamada: "Se pide por consultar_hechos: es una clasificación de las ventas según sus llamadas.",
  meta: "Cifra de resumen_del_hub: es el objetivo declarado de la cohorte, no filas operativas.",
  objetivo_cohorte: "Cifra de resumen_del_hub: es el objetivo declarado de la cohorte, no filas operativas.",
  objetivo_de_leads: "Cifra de resumen_del_hub: es un objetivo declarado por día, no filas operativas.",
  dias_del_ritmo: "Cifra de resumen_del_hub: es el parámetro de la ventana del ritmo.",
  citas_minimas: "Cifra de resumen_del_hub: es el mínimo configurado para confiar en una tasa.",
  objetivo_mes: "Cifra de resumen_del_hub: reparte el objetivo de las cohortes sobre el mes.",
  objetivo_semana: "Cifra de resumen_del_hub: reparte el objetivo mensual sobre la semana.",
  esperado_a_hoy: "Cifra de resumen_del_hub: es el objetivo proporcional a los días transcurridos.",
  faltan: "Cifra de resumen_del_hub: es objetivo menos ventas de la cohorte.",
  por_dia_habil: "Cifra de resumen_del_hub: reparte lo que falta entre los días hábiles restantes.",
  objetivo_del_dia: "Cifra de resumen_del_hub: reparte el objetivo mensual sobre el día.",
  proyeccion: "Cifra de resumen_del_hub: proyecta el cierre a partir del ritmo medido.",
  leads_que_hacen_falta: "Cifra de resumen_del_hub: deriva la necesidad diaria de las tasas y el objetivo.",
  cupos_con_caja: "Se pide por consultar_hechos: son ventas relacionadas con sus abonos vigentes.",
  escalera_sin_resultado: "Se pide por consultar_hechos: es una marca de los deals de la escalera.",
  descuento_promedio: "Cifra de resumen_del_hub: promedia el descuento de las ventas, sin filas propias.",
  descuento_promedio_porcentaje: "Cifra de resumen_del_hub: expresa el mismo descuento como porcentaje.",
  presupuesto: "Cifra de resumen_del_hub: es la parte consumida del presupuesto de la cohorte.",
  agendas_dia: "Cifra de resumen_del_hub: promedia las agendas sobre los días hábiles transcurridos.",
  agendas_req: "Cifra de resumen_del_hub: deriva las agendas necesarias del objetivo y las tasas.",
  inversion_req: "Cifra de resumen_del_hub: deriva la inversión diaria de agendas y costo por agenda.",
  roas_proy: "Cifra de resumen_del_hub: proyecta el ROAS cuando terminen las citas pendientes.",
  envios_sin_id: "Se pide por consultar_hechos: son envíos de pauta sin anuncio identificado.",
  registros_sin_utm: "Se pide por consultar_hechos: son envíos agrupables por la categoría sin origen.",
  ventas_sin_anuncio: "Se pide por consultar_hechos: son ventas atribuibles a envíos sin anuncio identificado.",
  embudo: "Se pide por consultar_hechos: cuenta envíos por el paso alcanzado en el formulario.",
  inversion: "Se pide por consultar_hechos: es gasto de pauta agrupado por periodo.",
  costo_agenda_crm: "Cifra de resumen_del_hub: divide inversión entre agendas del CRM.",
  cac: "Cifra de resumen_del_hub: divide inversión entre ventas del mismo periodo.",
  costo_agenda_meta: "Cifra de resumen_del_hub: divide inversión entre agendas informadas por Meta.",
  roas: "Cifra de resumen_del_hub: relaciona vendido atribuido con inversión convertida.",
  profit: "Cifra de resumen_del_hub: resta la inversión al vendido atribuido.",
  cpm: "Cifra de resumen_del_hub: agrega costo e impresiones reportados por Meta.",
  ctr: "Cifra de resumen_del_hub: agrega clics e impresiones reportados por Meta.",
  llegada_landing: "Cifra de resumen_del_hub: agrega llegadas y clics reportados por Meta.",
  conversion_landing: "Cifra de resumen_del_hub: relaciona envíos con llegadas a la página.",
  frecuencia: "Cifra de resumen_del_hub: agrega impresiones y alcance reportados por Meta.",
} as const satisfies Partial<Record<ClaveDeConcepto, RazonSinLista>>;

/** Solo baja cuando un concepto obtiene una lista consultable propia. */
export const TOPE_DE_CONCEPTOS_SIN_LISTA_DEL_MCP = 48;

export function viaDeConceptoSinLista(clave: ClaveRegistrada): "consultar_hechos" | "resumen_del_hub" {
  const razon = (CONCEPTOS_SIN_LISTA_EN_EL_MCP as Partial<Record<ClaveRegistrada, RazonSinLista>>)[clave];
  if (!razon) throw new Error(`El concepto ${clave} no tiene vía de consulta registrada.`);
  return razon.startsWith("Se pide por consultar_hechos")
    ? "consultar_hechos"
    : "resumen_del_hub";
}

type FichaAuditable = { listas: readonly string[] };

/** Compara fichas, listas y excepciones sin depender del registro real; los tests sintéticos muerden ambos bordes. */
export function auditarCoberturaDeConceptos(
  registro: Readonly<Record<string, FichaAuditable>>,
  listasAceptadas: readonly string[],
  excepciones: Readonly<Partial<Record<ClaveDeConcepto | string, string>>>,
) {
  const claves = Object.keys(registro);
  const clavesDeExcepcion = Object.keys(excepciones);
  const aceptadas = new Set(listasAceptadas);
  return {
    sinCobertura: claves.filter((clave) => registro[clave].listas.length === 0 && !(clave in excepciones)).sort(),
    listasDesconocidas: claves.flatMap((clave) => registro[clave].listas
      .filter((lista) => !aceptadas.has(lista))
      .map((lista) => `${clave}:${lista}`)).sort(),
    excepcionesInexistentes: clavesDeExcepcion.filter((clave) => !(clave in registro)).sort(),
    excepcionesConLista: clavesDeExcepcion.filter((clave) => (registro[clave]?.listas.length ?? 0) > 0).sort(),
  };
}
