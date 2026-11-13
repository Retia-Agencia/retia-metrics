import { z } from "zod";
import { ETAPAS } from "@/lib/deals/etapas";
import { fechaDeInstanteEnBogota } from "@/lib/format";
import { monto } from "@/lib/format";
import type { FichaDeLead } from "@/lib/queries/ficha-lead";
import type { AlertasDelDeal, FichaDeDeal } from "@/lib/queries/ficha-deal";
import type { FiltrosKanban, TableroKanban, TarjetaDeal } from "@/lib/queries/kanban";
import type { FiltroAplicado } from "@/lib/queries/resolver-filtros";
import type { bandejaParaActor } from "@/lib/queries/operacion";
import type { FilaLead } from "@/lib/queries/leads";
import { nombreDeEtapa } from "@/lib/queries/vista-metrica";

const programa = z.object({
  nombre: z.string().describe("Nombre legible del programa."),
  slug: z.string().describe("Identificador opaco del programa usado en sus enlaces."),
}).strict().describe("Programa al que pertenecen todas las personas encontradas.");

const fila = z.object({
  id_de_la_persona: z.string().describe("Identificador opaco de la persona."),
  nombre: z.string().nullable().describe("Nombre de la persona, cuando está disponible."),
  email: z.string().describe("Correo principal de la persona."),
  telefono: z.string().nullable().describe("Teléfono de la persona, cuando está disponible."),
  calidad: z.string().nullable().describe("Calidad comercial asignada a la persona, cuando existe."),
  estado_del_deal: z.object({
    clave: z.enum(ETAPAS as [typeof ETAPAS[number], ...typeof ETAPAS[number][]]).describe("Clave estable de la etapa del deal."),
    nombre: z.string().describe("Nombre de negocio de la etapa del deal."),
  }).strict().nullable().describe("Etapa actual del deal, o null cuando la persona no tiene uno."),
  fecha_de_ultima_aplicacion: z.string().nullable().describe("Fecha de la última aplicación en Bogotá, con formato AAAA-MM-DD, o null cuando no está disponible."),
  enlace_de_la_persona: z.string().url().describe("Enlace a la ficha de la persona en el CRM."),
}).strict().describe("Persona encontrada, limitada a los campos visibles de negocio.");

export const salidaDeBuscarLeads = z.object({
  programa,
  total: z.number().int().describe("Cantidad total de personas que cumplen la búsqueda y los filtros."),
  pagina: z.number().int().describe("Número de la página devuelta."),
  hay_otra_pagina: z.boolean().describe("Indica si se puede pedir la página siguiente."),
  filas: z.array(fila).describe("Personas incluidas en esta página."),
}).strict();

type ProgramaVisible = { nombre: string; slug: string };

const instante = z.string().describe("Instante en formato ISO 8601.");
const fechaNegocio = z.string().describe("Fecha de negocio en Bogotá, con formato AAAA-MM-DD.");
const etapa = z.object({
  clave: z.enum(ETAPAS as [typeof ETAPAS[number], ...typeof ETAPAS[number][]]).describe("Clave estable de la etapa."),
  nombre: z.string().describe("Nombre de negocio de la etapa."),
}).strict().describe("Etapa del deal.");
const dinero = z.object({
  valor: z.number().describe("Valor monetario sin formato."),
  moneda: z.string().describe("Moneda del valor, sin conversiones."),
  legible: z.string().describe("Valor monetario listo para mostrar, con su moneda."),
}).strict().describe("Importe monetario con moneda y representación legible.");

const llamadaDeBusqueda = z.object({
  id_de_la_llamada: z.string().describe("Identificador opaco de la llamada."), resultado: z.string().describe("Resultado actual de la llamada."), fecha_de_agenda: instante.nullable().describe("Instante agendado, cuando existe."), closer: z.string().nullable().describe("Nombre de quien atiende la llamada."),
}).strict().describe("Llamada reciente del deal.");
const dealDeBusqueda = z.object({
  id_del_deal: z.string().optional().describe("Identificador opaco del deal."), etapa: etapa.optional(), dueno: z.object({ id_del_usuario: z.string().describe("Identificador opaco del dueño."), nombre: z.string().describe("Nombre del dueño.") }).strict().nullable().optional().describe("Dueño actual del deal."),
  cohorte: z.object({ id_de_la_cohorte: z.string().describe("Identificador opaco de la cohorte."), codigo: z.string().describe("Código legible de la cohorte.") }).strict().nullable().optional().describe("Cohorte de origen del deal."),
  ultima_actividad: instante.optional().describe("Última actividad ocurrida del deal."), ultimo_cambio_de_dueno: z.object({ de: z.string().nullable().describe("Dueño anterior."), a: z.string().nullable().describe("Dueño nuevo."), cuando: instante.describe("Instante del cambio."), por: z.string().nullable().describe("Persona que hizo el cambio.") }).strict().nullable().optional().describe("Último traspaso del deal."),
  enlace: z.string().optional().describe("Enlace al deal en el CRM."), pendiente: z.string().nullable().optional().describe("Pendiente operativo, en detalle completo."), llamadas: z.array(llamadaDeBusqueda).optional().describe("Hasta tres llamadas recientes."),
}).strict().describe("Deal visible de la persona.");
const personaDeBusqueda = z.object({
  id_de_la_persona: z.string().optional().describe("Identificador opaco de la persona."), nombre: z.string().nullable().optional().describe("Nombre de la persona."), email: z.string().optional().describe("Correo principal."), enlace: z.string().optional().describe("Enlace a la ficha en el CRM."),
  telefono: z.string().nullable().optional().describe("Teléfono, solo en detalle completo."), deals: z.array(dealDeBusqueda).optional().describe("Deals visibles según el alcance."), llamadas: z.array(llamadaDeBusqueda).optional().describe("Llamadas incluidas cuando se solicitan sin deals."),
}).strict().describe("Persona encontrada.");
export const salidaDeBuscar = z.object({
  programas: z.array(z.object({ programa, total: z.number().int().describe("Personas encontradas en este programa."), filas: z.array(personaDeBusqueda).describe("Página de personas de este programa."), hay_otra_pagina: z.boolean().describe("Indica si este programa tiene otra página.") }).strict().describe("Resultado independiente de un programa.")).describe("Secciones por programa, sin total combinado."),
}).strict().describe("Búsqueda global separada por programa.");

const contacto = z.object({
  id: z.string().describe("Identificador opaco del contacto."),
  tipo: z.enum(["correo", "telefono"]).describe("Tipo de contacto."),
  valor: z.string().describe("Correo o teléfono del contacto."),
  es_principal: z.boolean().describe("Indica si es el contacto principal de la persona."),
  confirmado: z.boolean().describe("Indica si el contacto está confirmado."),
  envio: z.number().int().nullable().optional().describe("Número del envío donde apareció, cuando aplica."),
  agregado_a_mano: z.boolean().optional().describe("Indica si se agregó manualmente."),
  creado_en: instante.optional().describe("Instante de creación del contacto."),
}).strict().describe("Medio de contacto de la persona.");

const dealDePersona = z.object({
  id_del_deal: z.string().describe("Identificador opaco del deal."),
  etapa: etapa,
  pendiente: z.string().nullable().describe("Pendiente operativo del deal, cuando existe."),
  cerrado: z.boolean().describe("Indica si el deal está cerrado."),
  dueno: z.string().nullable().optional().describe("Nombre del dueño del deal, cuando el rol puede verlo."),
  cohorte: z.string().nullable().describe("Código de la cohorte, cuando existe."),
  envio: z.number().int().nullable().describe("Número del envío que abrió el deal, cuando existe."),
  creado_en: instante.describe("Instante de creación del deal."),
  llamadas: z.number().int().describe("Cantidad de llamadas del deal."),
  anulado: z.object({ en: instante.describe("Instante de anulación."), motivo: z.string().describe("Motivo de anulación.") }).strict().nullable().describe("Anulación del deal, o null si está vigente."),
  enlace: z.string().describe("Enlace al deal en el CRM."),
}).strict().describe("Deal visible de la persona.");

const valorDeCampo = z.object({
  estado: z.enum(["no_habia", "vacio", "valor"]).describe("Estado del valor en el envío."),
  texto: z.string().nullable().describe("Texto de la respuesta, o null cuando no había un valor."),
}).strict().describe("Valor visible de un campo del envío.");

const envioDePersona = z.object({
  id: z.string().describe("Identificador opaco del envío."),
  numero: z.number().int().describe("Número ordinal del envío de la persona."),
  es_parcial: z.boolean().describe("Indica si el envío quedó parcial."),
  empezo_como_parcial_en: instante.nullable().describe("Instante en que empezó como parcial, cuando aplica."),
  fecha: instante.describe("Instante del envío."),
  fecha_es_de_llegada: z.boolean().describe("Indica si la fecha corresponde a la llegada al CRM."),
  calificacion: z.string().nullable().describe("Calificación del envío, cuando existe."),
  fuente: z.string().describe("Fuente del envío."),
  canal: z.string().describe("Canal resuelto del envío."),
  campos: z.array(z.object({ campo: z.string().describe("Nombre de la pregunta."), valor: valorDeCampo }).strict()).optional().describe("Campos visibles del envío; solo en detalle completo."),
  cambios: z.array(z.object({ campo: z.string().describe("Nombre de la pregunta."), antes: valorDeCampo.describe("Valor anterior."), despues: valorDeCampo.describe("Valor nuevo.") }).strict()).nullable().optional().describe("Cambios respecto del envío anterior; solo en detalle completo."),
}).strict().describe("Envío de la persona visible en la ficha.");

export const salidaDeFichaDeLead = z.object({
  programa,
  basico: z.boolean().describe("Indica que Customer Success recibe la proyección básica de la ficha."),
  ficha: z.object({
    id_de_la_persona: z.string().describe("Identificador opaco de la persona."),
    nombre: z.string().nullable().describe("Nombre de la persona, cuando está disponible."),
    email: z.string().describe("Correo principal de la persona."),
    telefono: z.string().nullable().describe("Teléfono principal, cuando está disponible."),
    entrada: z.enum(["formulario", "crm"]).describe("Forma en que la persona entró al CRM."),
    calidad: z.string().nullable().describe("Calidad comercial asignada, cuando existe."),
    valor: z.string().nullable().describe("Valor comercial asignado, cuando existe."),
    cantidad_de_envios: z.number().int().describe("Cantidad de envíos de la persona."),
    fecha_de_primera_aplicacion: fechaNegocio.nullable().describe("Fecha de la primera aplicación, o null en la proyección básica cuando no está disponible."),
    fecha_de_ultima_aplicacion: fechaNegocio.nullable().describe("Fecha de la última aplicación, o null en la proyección básica cuando no está disponible."),
    creado_en: instante.describe("Instante de creación de la persona."),
    unido_por_telefono: z.boolean().describe("Indica si la persona fue unida por teléfono."),
    solo_parciales: z.boolean().describe("Indica si todos sus envíos son parciales."),
    envios: z.array(envioDePersona).describe("Envíos visibles; en la proyección básica sus detalles sensibles se ocultan en la fuente."),
    contactos: z.array(contacto).describe("Contactos visibles de la persona."),
    deals: z.array(dealDePersona).describe("Deals visibles de la persona."),
    enlace: z.string().describe("Enlace a la ficha de la persona en el CRM."),
  }).strict().describe("Ficha de la persona con la proyección autorizada para el rol."),
}).strict();

export function aSalidaDeFichaDeLead(resultado: { ficha: FichaDeLead; basico: boolean }, programaVisible: ProgramaVisible, enlaces: { persona: (id: string) => string; deal: (id: string) => string }, detalle: "compacta" | "completa" = "compacta") {
  const f = resultado.ficha;
  const detalleVisible = resultado.basico ? "compacta" : detalle;
  const valor = (v: FichaDeLead["envios"][number]["campos"][number]["valor"]) => ({ estado: v.tipo, texto: v.tipo === "valor" ? v.texto : null });
  return { programa: programaVisible, basico: resultado.basico, ficha: {
    id_de_la_persona: f.id, nombre: f.nombre, email: f.email, telefono: f.telefono,
    entrada: f.entrada, calidad: f.leadQuality, valor: f.leadValue,
    cantidad_de_envios: f.numAplicaciones,
    fecha_de_primera_aplicacion: f.fechaPrimeraAplicacion ? fechaDeInstanteEnBogota(f.fechaPrimeraAplicacion) : null,
    fecha_de_ultima_aplicacion: f.fechaUltimaAplicacion ? fechaDeInstanteEnBogota(f.fechaUltimaAplicacion) : null,
    creado_en: f.creadoEn.toISOString(), unido_por_telefono: f.unidoPorTelefono, solo_parciales: f.soloParciales,
    envios: f.envios.map((e) => ({ id: e.id, numero: e.numero, es_parcial: e.esParcial, empezo_como_parcial_en: e.empezoComoParcial?.toISOString() ?? null, fecha: e.fecha.toISOString(), fecha_es_de_llegada: e.fechaEsDeLlegada, calificacion: e.calificacion, fuente: e.fuente, canal: e.canal, ...(detalleVisible === "completa" ? { campos: e.campos.map((x) => ({ campo: x.campo, valor: valor(x.valor) })), cambios: e.cambios?.map((x) => ({ campo: x.campo, antes: valor(x.antes), despues: valor(x.despues) })) ?? null } : {}) })),
    contactos: f.contactos.map((c) => ({ id: c.id, tipo: c.tipo, valor: c.valor, es_principal: c.esPrincipal, confirmado: c.confirmado, envio: c.envioNumero, agregado_a_mano: c.agregadoAMano, creado_en: c.creadoEn.toISOString() })),
    deals: f.deals.map((d) => ({ id_del_deal: d.id, etapa: { clave: d.etapa, nombre: nombreDeEtapa(d.etapa) }, pendiente: d.pendiente, cerrado: d.cerrado, ...(resultado.basico ? {} : { dueno: d.ownerNombre }), cohorte: d.cohorteCodigo, envio: d.envioNumero, creado_en: d.creadoEn.toISOString(), llamadas: d.llamadas, anulado: d.anulado ? { en: d.anulado.en.toISOString(), motivo: d.anulado.motivo } : null, enlace: enlaces.deal(d.id) })),
    enlace: enlaces.persona(f.id),
  }};
}

const personaDeDeal = z.object({
  id_de_la_persona: z.string().describe("Identificador opaco de la persona."), cantidad_de_envios: z.number().int().describe("Cantidad de envíos."),
  nombre: z.string().nullable().describe("Nombre, cuando está disponible."), email: z.string().describe("Correo principal."),
  telefono: z.string().nullable().describe("Teléfono, cuando está disponible."),
  enlace_de_la_persona: z.string().describe("Enlace a la ficha de la persona."),
}).strict().describe("Persona vinculada al deal.");
const usuario = z.object({ id: z.string().describe("Identificador opaco del usuario."), nombre: z.string().nullable().describe("Nombre del usuario, cuando existe.") }).strict().nullable().describe("Usuario asignado, o null.");
const anulado = z.object({ en: instante.describe("Instante de anulación."), por: z.string().nullable().describe("Nombre de quien anuló."), motivo: z.string().describe("Motivo de anulación.") }).strict().nullable().describe("Datos de anulación, o null si está vigente.");
const requisito = z.object({ codigo: z.string().describe("Clave estable del requisito."), mensaje: z.string().describe("Explicación legible del requisito.") }).strict().describe("Requisito del deal.");

export const salidaDeFichaDeDeal = z.object({
  programa,
  ficha: z.object({
    id_del_deal: z.string().describe("Identificador opaco del deal."), cortesia: z.boolean().describe("Indica si el deal es una cortesía."), etapa,
    pendiente: z.string().nullable().describe("Pendiente operativo, cuando existe."), persona: personaDeDeal,
    origen: z.object({ id_del_envio: z.string().describe("Identificador opaco del envío de origen."), fecha: instante.describe("Instante del envío de origen."), calificacion: z.string().nullable().describe("Calificación del envío."), fuente: z.string().nullable().describe("Fuente UTM."), medio: z.string().nullable().describe("Medio UTM."), campana: z.string().nullable().describe("Campaña UTM."), contenido: z.string().nullable().describe("Contenido UTM."), termino: z.string().nullable().describe("Término UTM."), id_del_anuncio: z.string().nullable().describe("Identificador UTM del anuncio.") }).strict().nullable().describe("Origen del deal, o null si no tiene envío de origen."),
    perfil: z.object({ calidad: z.string().nullable().describe("Calidad comercial."), valor: z.string().nullable().describe("Valor comercial."), respuestas: z.array(z.object({ pregunta: z.string().describe("Pregunta."), respuesta: z.string().describe("Respuesta.") }).strict()).describe("Respuestas visibles del formulario.") }).strict().describe("Perfil comercial de la persona."),
    contactos: z.array(contacto).describe("Contactos visibles de la persona."), dueno: usuario, setter: usuario,
    entregado_en: instante.nullable().describe("Instante del handoff, cuando existe."), enlace_de_agenda: z.string().nullable().describe("Enlace de agenda, cuando existe."),
    tiene_cita_vigente: z.boolean().describe("Indica si existe una cita vigente."), valor_vendido: dinero.nullable().describe("Valor vendido en USD, o null si no se puede calcular."),
    ticket: z.object({ id_de_la_cohorte: z.string().describe("Identificador opaco de la cohorte."), codigo: z.string().describe("Código de la cohorte."), precio: dinero.describe("Precio de la cohorte."), es_la_activa_sugerida: z.boolean().describe("Indica si es la cohorte activa sugerida.") }).strict().nullable().describe("Ticket sugerido, o null."),
    descuento: z.object({ valor: dinero.describe("Valor del descuento."), porcentaje: z.number().describe("Porcentaje de descuento.") }).strict().nullable().describe("Descuento aplicado, o null."),
    vendido: z.boolean().describe("Indica si el deal está vendido."), cohorte: z.object({ id: z.string().describe("Identificador opaco de la cohorte."), codigo: z.string().describe("Código de la cohorte."), inicio_de_clases: fechaNegocio.nullable().describe("Fecha de inicio de clases, cuando está definida.") }).strict().nullable().describe("Cohorte del deal, o null."),
    cohortes_vendiendo_hoy: z.array(z.object({ id: z.string().describe("Identificador opaco de la cohorte."), codigo: z.string().describe("Código de la cohorte.") }).strict()).describe("Cohortes que venden hoy."),
    cohorte_de_destino: z.object({ id: z.string().describe("Identificador opaco de la cohorte."), codigo: z.string().describe("Código de la cohorte."), inicio_de_ventas: fechaNegocio.nullable().describe("Inicio de ventas, cuando está definido.") }).strict().nullable().describe("Destino legado de próxima cohorte, o null."),
    cohorte_de_destino_libre: z.string().nullable().describe("Destino de próxima cohorte escrito como texto."), acuerdo_de_pago: z.string().nullable().describe("Acuerdo de pago."),
    fecha_limite_de_pago: fechaNegocio.nullable().describe("Fecha límite de pago."), fecha_limite_sugerida: fechaNegocio.nullable().describe("Fecha límite sugerida."), fecha_de_seguimiento: fechaNegocio.nullable().describe("Fecha de seguimiento."),
    motivo: z.object({ id: z.string().describe("Identificador opaco del motivo."), nombre: z.string().describe("Nombre del motivo.") }).strict().nullable().describe("Motivo asignado, o null."),
    incorporado_en: instante.nullable().describe("Instante de onboarding."), creado_en: instante.describe("Instante de creación."), anulado,
    precio: dinero.nullable().describe("Precio del deal, o null si no se puede calcular."), abonado: dinero.nullable().describe("Total abonado, o null si no hay moneda."), saldo: dinero.nullable().describe("Saldo, o null si no se puede calcular."), motivo_sin_saldo: z.string().nullable().describe("Razón por la que el saldo no se puede calcular."),
    llamadas: z.array(z.object({ id: z.string().describe("Identificador opaco de la llamada."), resultado: z.string().describe("Resultado de la llamada."), fecha_de_agenda: instante.nullable().describe("Instante agendado."), fecha_de_llamada: instante.nullable().describe("Instante de realización."), enlace_de_calendly: z.string().nullable().describe("Enlace de Calendly."), enlace_de_grain: z.string().nullable().describe("Enlace de Grain."), closer: z.string().nullable().describe("Nombre del closer."), notas: z.string().nullable().describe("Notas."), origen: z.string().describe("Origen de la llamada."), anulado, sin_grain: z.boolean().describe("Indica si fue atendida sin Grain."), puede_marcarse_atendida: z.boolean().describe("Indica si puede marcarse atendida."), motivo_para_no_marcarla: z.string().nullable().describe("Razón que impide marcarla atendida.") }).strict()).describe("Llamadas del deal."),
    abonos: z.array(z.object({ id: z.string().describe("Identificador opaco del abono."), fecha: fechaNegocio.describe("Fecha del abono."), monto: dinero.describe("Monto del abono."), concepto: z.string().describe("Concepto del abono."), nota: z.string().nullable().describe("Nota."), plataforma: z.string().nullable().describe("Nombre de la plataforma."), enlace_de_pago: z.string().nullable().describe("Nombre del enlace de pago."), comprobante: z.string().nullable().describe("URL del comprobante."), closer: z.string().nullable().describe("Identificador del closer."), anulado }).strict()).describe("Abonos del deal."),
    actividades: z.array(z.object({ id: z.string().describe("Identificador opaco de la actividad."), tipo: z.string().describe("Tipo de actividad."), canal: z.string().nullable().describe("Canal."), fecha: instante.describe("Instante de la actividad."), nota: z.string().nullable().describe("Nota."), proximo_contacto: fechaNegocio.nullable().describe("Fecha del próximo contacto."), pendiente: z.string().nullable().describe("Pendiente puesto por la actividad."), autor: z.string().nullable().describe("Nombre del autor."), anulado }).strict()).describe("Actividades del deal."),
    historial_de_etapas: z.array(z.object({ id: z.string().describe("Identificador opaco del movimiento."), desde: etapa.nullable().describe("Etapa anterior."), hasta: etapa.describe("Etapa nueva."), fecha: instante.describe("Instante del movimiento."), por: z.string().nullable().describe("Nombre de quien movió el deal."), motivo: z.string().nullable().describe("Motivo del movimiento.") }).strict()).describe("Historial de etapas."),
    destinos_de_correccion: z.array(etapa).describe("Etapas válidas para corregir el deal."),
    enlaces_de_pago: z.array(z.object({ id: z.string().describe("Identificador opaco del enlace."), nombre: z.string().describe("Nombre del enlace."), enlace: z.string().describe("URL de pago."), monto: dinero.describe("Monto del enlace."), plataforma: z.string().nullable().describe("Nombre de la plataforma.") }).strict()).describe("Enlaces de pago disponibles."),
    enlace: z.string().describe("Enlace al deal en el CRM."),
  }).strict().describe("Ficha visible del deal."),
  alertas: z.object({
    posibles_duplicados: z.array(z.object({ id_del_contacto: z.string().describe("Identificador opaco del contacto."), correo_principal: z.string().describe("Correo principal."), correo_sin_confirmar: z.string().describe("Correo sin confirmar."), telefono_en_comun: z.string().nullable().describe("Teléfono compartido."), envio: z.object({ id: z.string().describe("Identificador opaco del envío."), fecha: instante.describe("Instante del envío."), fuente: z.string().nullable().describe("Fuente del envío.") }).strict().nullable().describe("Envío relacionado, o null.") }).strict()).describe("Posibles personas duplicadas."),
    propiedades: z.array(requisito).describe("Propiedades faltantes."), urgentes: z.array(z.object({ motivo: z.string().describe("Clave del motivo."), mensaje: z.string().describe("Mensaje legible.") }).strict()).describe("Alertas urgentes."),
    alertas: z.array(z.object({ motivo: z.string().describe("Clave del motivo."), mensaje: z.string().describe("Mensaje legible.") }).strict()).describe("Alertas no urgentes."),
    para_avanzar: z.array(z.object({ destino: etapa.describe("Etapa de destino."), camino_feliz: z.boolean().describe("Indica si es el siguiente paso esperado."), faltan: z.array(requisito).describe("Requisitos faltantes.") }).strict()).describe("Requisitos para avanzar por etapa."), aviso: z.string().nullable().describe("Aviso general, cuando existe."),
  }).strict().nullable().describe("Alertas calculadas del deal, o null."),
}).strict();

const comoDinero = (valor: number, moneda: string) => ({ valor, moneda, legible: monto(valor, moneda) });
const comoAnulado = (valor: { en: Date; porNombre: string | null; motivo: string } | null) => valor ? { en: valor.en.toISOString(), por: valor.porNombre, motivo: valor.motivo } : null;
export function aSalidaDeFichaDeDeal(f: FichaDeDeal, alertas: AlertasDelDeal | null, programaVisible: ProgramaVisible, enlaces: { deal: (id: string) => string; persona: (id: string) => string }) {
  const moneda = f.saldo.moneda;
  const ficha = {
    id_del_deal: f.dealId, cortesia: f.cortesia, etapa: { clave: f.etapa, nombre: nombreDeEtapa(f.etapa) }, pendiente: f.pendiente,
    persona: { id_de_la_persona: f.lead.id, cantidad_de_envios: f.lead.envios, nombre: f.lead.nombre, email: f.lead.email, telefono: f.lead.telefono, enlace_de_la_persona: enlaces.persona(f.lead.id) },
    origen: f.origen ? { id_del_envio: f.origen.envioId, fecha: f.origen.fecha.toISOString(), calificacion: f.origen.calificacion, fuente: f.origen.utm.source, medio: f.origen.utm.medium, campana: f.origen.utm.campaign, contenido: f.origen.utm.content, termino: f.origen.utm.term, id_del_anuncio: f.origen.utm.id } : null,
    perfil: { calidad: f.perfil.leadQuality, valor: f.perfil.leadValue, respuestas: f.perfil.respuestas },
    contactos: f.contactos.map((c) => ({ id: c.id, tipo: c.tipo, valor: c.valor, es_principal: c.esPrincipal, confirmado: c.confirmado })), dueno: f.owner, setter: f.setter,
    entregado_en: f.handoffEn?.toISOString() ?? null, enlace_de_agenda: f.linkAgenda, tiene_cita_vigente: f.tieneCitaVigente, valor_vendido: f.valorVendidoUsd === null ? null : comoDinero(f.valorVendidoUsd, "USD"),
    ticket: f.ticket ? { id_de_la_cohorte: f.ticket.cohorteId, codigo: f.ticket.codigo, precio: comoDinero(f.ticket.precioUsd, "USD"), es_la_activa_sugerida: f.ticket.esActivaSugerida } : null,
    descuento: f.descuento ? { valor: comoDinero(f.descuento.usd, "USD"), porcentaje: f.descuento.porcentaje } : null, vendido: f.vendido,
    cohorte: f.cohorte ? { id: f.cohorte.id, codigo: f.cohorte.codigo, inicio_de_clases: f.cohorte.inicioClases } : null, cohortes_vendiendo_hoy: f.cohortesVendiendoHoy,
    cohorte_de_destino: f.cohorteDestino ? { id: f.cohorteDestino.id, codigo: f.cohorteDestino.codigo, inicio_de_ventas: f.cohorteDestino.inicioVentas } : null, cohorte_de_destino_libre: f.cohorteDestinoTexto,
    acuerdo_de_pago: f.acuerdoPago, fecha_limite_de_pago: f.fechaLimitePago, fecha_limite_sugerida: f.fechaLimiteSugerida, fecha_de_seguimiento: f.fechaSeguimiento, motivo: f.motivo,
    incorporado_en: f.onboardedAt?.toISOString() ?? null, creado_en: f.creadoEn.toISOString(), anulado: comoAnulado(f.anulado),
    precio: f.saldo.precio === null || !moneda ? null : comoDinero(f.saldo.precio, moneda), abonado: !moneda ? null : comoDinero(f.saldo.abonado, moneda), saldo: f.saldo.saldo === null || !moneda ? null : comoDinero(f.saldo.saldo, moneda), motivo_sin_saldo: f.saldo.sinSaldoPorque,
    llamadas: f.llamadas.map((x) => ({ id: x.id, resultado: x.resultado, fecha_de_agenda: x.fechaAgenda?.toISOString() ?? null, fecha_de_llamada: x.fechaLlamada?.toISOString() ?? null, enlace_de_calendly: x.linkCalendly, enlace_de_grain: x.linkGrain, closer: x.closerNombre, notas: x.notas, origen: x.origen, anulado: x.anuladoEn ? { en: x.anuladoEn.toISOString(), por: x.anuladoPorNombre, motivo: x.motivoAnulacion ?? "" } : null, sin_grain: x.sinGrain, puede_marcarse_atendida: x.puedeMarcarAtendida, motivo_para_no_marcarla: x.mensajeNoPuedeMarcarAtendida })),
    abonos: f.abonos.map((x) => ({ id: x.id, fecha: x.fecha, monto: comoDinero(Number(x.monto), x.moneda), concepto: x.concepto, nota: x.nota, plataforma: x.plataformaNombre, enlace_de_pago: x.enlacePagoNombre, comprobante: x.comprobanteUrl, closer: x.closerId, anulado: x.anuladoEn ? { en: x.anuladoEn.toISOString(), por: x.anuladoPorNombre, motivo: x.motivoAnulacion ?? "" } : null })),
    actividades: f.actividades.map((x) => ({ id: x.id, tipo: x.tipo, canal: x.canal, fecha: x.fecha.toISOString(), nota: x.nota, proximo_contacto: x.proximoContacto, pendiente: x.pendientePuesto, autor: x.autorNombre, anulado: x.anuladoEn ? { en: x.anuladoEn.toISOString(), por: x.anuladoPorNombre, motivo: x.motivoAnulacion ?? "" } : null })),
    historial_de_etapas: f.historial.map((x) => ({ id: x.id, desde: x.de ? { clave: x.de, nombre: nombreDeEtapa(x.de) } : null, hasta: { clave: x.a, nombre: nombreDeEtapa(x.a) }, fecha: x.fecha.toISOString(), por: x.porNombre, motivo: x.motivoNombre })),
    destinos_de_correccion: f.destinosDeCorreccion.map((x) => ({ clave: x.etapa, nombre: x.nombre })),
    enlaces_de_pago: f.enlacesDePago.map((x) => ({ id: x.id, nombre: x.nombre, enlace: x.url, monto: comoDinero(Number(x.monto), x.moneda), plataforma: x.plataformaNombre })), enlace: enlaces.deal(f.dealId),
  };
  const alertasSalida = alertas ? { posibles_duplicados: alertas.posiblesDuplicados.map((x) => ({ id_del_contacto: x.contactoId, correo_principal: x.correoPrincipal, correo_sin_confirmar: x.correoSinConfirmar, telefono_en_comun: x.telefonoEnComun, envio: x.envio ? { id: x.envio.id, fecha: x.envio.fecha.toISOString(), fuente: x.envio.fuente } : null })), propiedades: alertas.propiedades, urgentes: alertas.urgentes, alertas: alertas.alertas, para_avanzar: alertas.paraAvanzar.map((x) => ({ destino: { clave: x.destino, nombre: x.nombreDestino }, camino_feliz: x.caminoFeliz, faltan: x.faltan })), aviso: alertas.aviso } : null;
  return { programa: programaVisible, ficha, alertas: alertasSalida };
}

const avisoTarjeta = z.object({ faltan_para_la_etapa: z.number().int().describe("Cantidad de propiedades faltantes."), compromiso_vencido: z.boolean().describe("Indica si venció el compromiso."), cartera_vencida: z.boolean().describe("Indica si está en cartera vencida."), seguimiento_vencido: z.boolean().describe("Indica si venció el seguimiento."), persona_unida_por_telefono: z.boolean().describe("Indica si la persona fue unida por teléfono."), abono_sin_comprobante: z.boolean().describe("Indica si hay un abono sin comprobante."), enlace_sin_cita: z.boolean().describe("Indica si se envió el enlace y aún no hay cita.") }).strict().describe("Avisos operativos de la tarjeta.");
const tarjeta = z.object({
  id_del_deal: z.string().optional().describe("Identificador opaco del deal."), id_de_la_persona: z.string().optional().describe("Identificador opaco de la persona."), nombre: z.string().nullable().optional().describe("Nombre de la persona."), etapa: etapa.optional(),
  dueno: z.string().nullable().optional().describe("Nombre del dueño."), cohorte: z.string().nullable().optional().describe("Identificador opaco de la cohorte."), ultima_actividad: instante.optional().describe("Instante de última actividad."), enlace: z.string().optional().describe("Enlace al deal."),
  cantidad_de_envios: z.number().int().optional().describe("Cantidad de envíos."), email: z.string().optional().describe("Correo principal."), pendiente: z.string().nullable().optional().describe("Pendiente operativo."), cohorte_de_destino: z.string().nullable().optional().describe("Destino de próxima cohorte."), es_nuevo: z.boolean().optional().describe("Indica si es nuevo para el dueño."),
  saldo: dinero.nullable().optional().describe("Saldo, o null si no se puede calcular."), fuente: z.string().nullable().optional().describe("Fuente UTM."), medio: z.string().nullable().optional().describe("Medio UTM."), calidad: z.string().nullable().optional().describe("Calidad comercial."), valor: z.string().nullable().optional().describe("Valor comercial."), dias_en_la_etapa: z.number().int().optional().describe("Días en la etapa."), creado_en: instante.optional().describe("Instante de creación."), potencial: dinero.optional().describe("Potencial en USD."), recaudado: dinero.optional().describe("Recaudado de este deal en USD."),
  llamada: z.object({ id: z.string().describe("Identificador opaco de la llamada."), fecha: instante.nullable().describe("Instante de la llamada."), closer: z.string().nullable().describe("Nombre del closer."), notas: z.string().nullable().describe("Notas."), puede_marcarse_atendida: z.boolean().describe("Indica si puede marcarse atendida."), motivo_para_no_marcarla: z.string().nullable().describe("Razón que impide marcarla atendida.") }).strict().nullable().optional().describe("Próxima llamada, o null."), avisos: avisoTarjeta.optional(), enlace_de_la_persona: z.string().optional().describe("Enlace a la persona."),
}).strict().describe("Tarjeta visible del tablero.");
export const salidaDeTablero = z.object({ programa,
  pagina: z.number().int().describe("Página devuelta."),
  hay_otra_pagina: z.boolean().describe("Indica si quedan tarjetas en otra página."),
  filtros: z.object({ busqueda: z.string().optional().describe("Texto de búsqueda aplicado."), dueno: z.string().nullable().optional().describe("Dueño aplicado."), cohorte: z.string().nullable().optional().describe("Cohorte aplicada."), canal: z.string().nullable().optional().describe("Canal aplicado."), antiguedad_minima: z.number().nullable().optional().describe("Antigüedad mínima aplicada."), calidad: z.string().nullable().optional().describe("Calidad aplicada."), valor: z.string().nullable().optional().describe("Valor aplicado."), vista: z.string().describe("Vista del tablero."), orden: z.object({ campo: z.string().describe("Campo de orden."), sentido: z.string().describe("Sentido de orden.") }).strict().describe("Orden aplicado.") }).strict().describe("Filtros resueltos del tablero."),
  filtros_aplicados: z.array(z.object({ campo: z.string().describe("Filtro aplicado."), id: z.string().nullable().describe("Identificador resuelto, cuando aplica."), nombre: z.string().describe("Valor legible resuelto."), origen: z.enum(["pedido", "por_defecto"]).describe("Origen del filtro."), como_quitarlo: z.string().optional().describe("Instrucción para quitar un valor predeterminado.") }).strict().describe("Filtro resuelto.")).describe("Filtros resueltos, incluidos los predeterminados."),
  tablero: z.object({ columnas: z.array(z.object({ clave: z.string().describe("Clave estable de la columna."), nombre: z.string().describe("Nombre de negocio de la columna."), tarjetas: z.array(tarjeta).describe("Tarjetas de la columna."), potencial: dinero.describe("Potencial total en USD."), recaudado: dinero.nullable().describe("Recaudado total de la columna en USD, o null si no aplica.") }).strict()).describe("Columnas del tablero."), total: z.number().int().describe("Cantidad total de deals visibles."), en_proxima_cohorte: z.array(tarjeta).describe("Deals separados por próxima cohorte.") }).strict().describe("Tablero de deals."),
}).strict();

function aTarjeta(t: TarjetaDeal, enlaces: { deal: (id: string) => string; persona: (id: string) => string }, detalle: "compacta" | "completa") { const base = { id_del_deal: t.dealId, id_de_la_persona: t.leadId, nombre: t.nombreLead, etapa: { clave: t.etapa, nombre: nombreDeEtapa(t.etapa) }, dueno: t.ownerNombre, cohorte: t.cohortId, ultima_actividad: t.ultimaActividadEn.toISOString(), enlace: enlaces.deal(t.dealId) }; return detalle === "compacta" ? base : { ...base, cantidad_de_envios: t.envios, email: t.emailLead, pendiente: t.pendiente, cohorte_de_destino: t.cohorteDestinoTexto, es_nuevo: t.esNuevo, saldo: t.saldo === null || !t.moneda ? null : comoDinero(t.saldo, t.moneda), fuente: t.utmSource, medio: t.utmMedium, calidad: t.leadQuality, valor: t.leadValue, dias_en_la_etapa: t.diasEnEtapa, creado_en: t.creadoEn.toISOString(), potencial: comoDinero(t.potencialUsd, "USD"), recaudado: comoDinero(t.confirmadoUsd, "USD"), llamada: t.llamada ? { id: t.llamada.id, fecha: t.llamada.fecha?.toISOString() ?? null, closer: t.llamada.closerNombre, notas: t.llamada.notas, puede_marcarse_atendida: t.llamada.puedeMarcarAtendida, motivo_para_no_marcarla: t.llamada.mensajeNoPuedeMarcarAtendida } : null, avisos: { faltan_para_la_etapa: t.avisos.faltanALaEtapa, compromiso_vencido: t.avisos.compromisoVencido, cartera_vencida: t.avisos.carteraVencida, seguimiento_vencido: t.avisos.seguimientoVencido, persona_unida_por_telefono: t.avisos.leadUnidoPorTelefono, abono_sin_comprobante: t.avisos.abonoSinComprobante, enlace_sin_cita: t.avisos.linkSinCita }, enlace_de_la_persona: enlaces.persona(t.leadId) }; }
export function aSalidaDeTablero(tablero: TableroKanban, filtros: FiltrosKanban, filtrosAplicados: FiltroAplicado[], programaVisible: ProgramaVisible, enlaces: { deal: (id: string) => string; persona: (id: string) => string }, detalle: "compacta" | "completa" = "compacta") { return { programa: programaVisible, filtros: { busqueda: filtros.q, dueno: filtros.ownerUserId, cohorte: filtros.cohorteId, canal: filtros.canal, antiguedad_minima: filtros.antiguedadMinima, calidad: filtros.leadQuality, valor: filtros.leadValue, vista: filtros.vista ?? "todo", orden: filtros.orden }, filtros_aplicados: filtrosAplicados, tablero: { columnas: tablero.columnas.map((c) => ({ clave: c.clave, nombre: nombreDeEtapa(c.clave), tarjetas: c.tarjetas.map((t) => aTarjeta(t, enlaces, detalle)), potencial: comoDinero(c.potencialUsd, "USD"), recaudado: c.confirmadoUsd === null ? null : comoDinero(c.confirmadoUsd, "USD") })), total: tablero.total, en_proxima_cohorte: [] } }; }

type ResultadoBandeja = NonNullable<Awaited<ReturnType<typeof bandejaParaActor>>>;
const filaLlamada = z.object({ id_de_la_llamada: z.string().describe("Identificador opaco de la llamada."), id_del_deal: z.string().nullable().describe("Identificador opaco del deal."), nombre: z.string().nullable().describe("Nombre de la persona."), email: z.string().nullable().describe("Correo de la persona."), fecha_de_agenda: instante.nullable().describe("Instante agendado."), enlace_de_calendly: z.string().nullable().describe("Enlace de Calendly."), dueno: z.string().nullable().describe("Nombre del dueño."), puede_colgarse: z.boolean().optional().describe("Indica si la llamada puede vincularse a un deal."), sugerencias: z.array(z.object({ id_del_deal: z.string().describe("Identificador opaco del deal sugerido."), nombre: z.string().nullable().describe("Nombre de la persona sugerida."), email: z.string().describe("Correo de la persona sugerida."), enlace: z.string().describe("Enlace al deal sugerido.") }).strict()).optional().describe("Deals sugeridos para vincular."), cantidad_de_posibles: z.number().optional().describe("Cantidad de deals posibles."), horas_sin_deal: z.number().optional().describe("Horas transcurridas sin deal."), es_antigua: z.boolean().optional().describe("Indica si la llamada suelta es antigua."), explicacion: z.object({ veredicto: z.string().describe("Clasificación de la llamada suelta."), causa: z.string().describe("Causa de la clasificación."), accion: z.string().describe("Acción recomendada.") }).strict().optional().describe("Explicación de la llamada suelta."), enlace: z.string().nullable().describe("Enlace al deal, cuando existe.") }).strict().describe("Llamada pendiente.");
const origenBandeja = z.object({ fuente: z.string().nullable().describe("Fuente UTM."), medio: z.string().nullable().describe("Medio UTM."), campana: z.string().nullable().describe("Campaña UTM."), traido_por: z.string().nullable().describe("Nombre de quien trajo a la persona.") }).strict().describe("Origen de la persona.");
const sinDueno = z.object({ id_del_deal: z.string().describe("Identificador opaco del deal."), id_de_la_persona: z.string().describe("Identificador opaco de la persona."), nombre: z.string().nullable().describe("Nombre de la persona."), email: z.string().describe("Correo de la persona."), puntaje: z.number().nullable().describe("Puntaje comercial."), fecha_de_ultima_aplicacion: fechaNegocio.nullable().describe("Fecha de última aplicación."), origen: origenBandeja, id_de_la_llamada: z.string().nullable().describe("Identificador de la llamada por completar."), enlace: z.string().describe("Enlace al deal."), enlace_de_la_persona: z.string().describe("Enlace a la persona.") }).strict().describe("Deal sin dueño.");
export const salidaDeBandeja = z.object({ programa, llamadas_por_registrar: z.array(filaLlamada).describe("Llamadas vencidas por registrar."), pendientes_por_closer: z.array(z.object({ closer: z.string().describe("Nombre del closer."), cantidad: z.number().int().describe("Cantidad pendiente.") }).strict()).describe("Conteo pendiente por closer."), llamadas_sin_deal: z.array(filaLlamada).describe("Llamadas sin deal."), llamadas_sin_closer: z.array(filaLlamada).describe("Llamadas sin closer."), atencion: z.array(z.object({ id_del_deal: z.string().describe("Identificador opaco del deal."), nombre: z.string().nullable().describe("Nombre de la persona."), email: z.string().describe("Correo de la persona."), etapa, acepta_abono: z.boolean().describe("Indica si acepta abonos."), motivo: z.string().describe("Motivo de atención."), dueno: z.string().nullable().describe("Nombre del dueño."), saldo: dinero.nullable().describe("Saldo, o null si no se puede calcular."), fecha: fechaNegocio.nullable().describe("Fecha relevante."), dias_sin_actividad: z.number().int().nullable().describe("Días sin actividad."), enlace: z.string().describe("Enlace al deal.") }).strict()).describe("Deals que requieren atención."), perdidos: z.array(z.object({ id_del_deal: z.string().describe("Identificador opaco del deal."), nombre: z.string().nullable().describe("Nombre de la persona."), email: z.string().describe("Correo de la persona."), desde: instante.describe("Instante desde el que está perdido."), minutos: z.number().describe("Minutos transcurridos."), origen: origenBandeja, enlace: z.string().describe("Enlace al deal.") }).strict()).describe("Deals perdidos en Calendly."), pendiente_de_setteo: z.array(sinDueno).describe("Deals pendientes de setteo."), sin_dueno: z.array(sinDueno).describe("Deals agendados sin dueño.") }).strict();
export function aSalidaDeBandeja(r: ResultadoBandeja, programaVisible: ProgramaVisible, enlaces: { deal: (id: string) => string; persona: (id: string) => string }) { const llamada = (x: ResultadoBandeja["inbox"]["llamadasDeHoy"][number]) => ({ id_de_la_llamada: x.callId, id_del_deal: x.dealId, nombre: x.leadNombre, email: x.leadEmail, fecha_de_agenda: x.fechaAgenda?.toISOString() ?? null, enlace_de_calendly: x.linkCalendly, dueno: x.ownerNombre, puede_colgarse: x.puedeColgar, sugerencias: x.sugerencias?.map((s) => ({ id_del_deal: s.dealId, nombre: s.leadNombre, email: s.leadEmail, enlace: enlaces.deal(s.dealId) })), cantidad_de_posibles: x.posibles, horas_sin_deal: x.horasSuelta, es_antigua: x.sueltaVieja, explicacion: x.explicacion ? { veredicto: x.explicacion.veredicto, causa: x.explicacion.causa, accion: x.explicacion.queHacer } : undefined, enlace: x.dealId ? enlaces.deal(x.dealId) : null }); const origen = (x: { utmSource: string | null; utmMedium: string | null; utmCampaign: string | null; traidoPorNombre: string | null }) => ({ fuente: x.utmSource, medio: x.utmMedium, campana: x.utmCampaign, traido_por: x.traidoPorNombre }); const sd = (x: ResultadoBandeja["secciones"]["unclaimed"][number]) => ({ id_del_deal: x.dealId, id_de_la_persona: x.leadId, nombre: x.leadNombre, email: x.leadEmail, puntaje: x.puntaje, fecha_de_ultima_aplicacion: x.fechaUltimaAplicacion ? fechaDeInstanteEnBogota(x.fechaUltimaAplicacion) : null, origen: origen(x.origen), id_de_la_llamada: x.llamadaPorCompletarId, enlace: enlaces.deal(x.dealId), enlace_de_la_persona: enlaces.persona(x.leadId) }); return { programa: programaVisible, llamadas_por_registrar: r.inbox.llamadasDeHoy.map(llamada), pendientes_por_closer: r.inbox.porMarcarPorCloser.map((x) => ({ closer: x.closer, cantidad: x.cantidad })), llamadas_sin_deal: r.inbox.llamadasSueltas.map(llamada), llamadas_sin_closer: r.inbox.llamadasSinCloser.map((x) => ({ id_de_la_llamada: x.callId, id_del_deal: x.dealId, nombre: x.leadNombre, email: x.leadEmail, fecha_de_agenda: x.fechaAgenda?.toISOString() ?? null, enlace_de_calendly: null, dueno: null, enlace: x.dealId ? enlaces.deal(x.dealId) : null })), atencion: r.inbox.atencion.map((x) => ({ id_del_deal: x.dealId, nombre: x.leadNombre, email: x.leadEmail, etapa: { clave: x.etapa, nombre: nombreDeEtapa(x.etapa) }, acepta_abono: x.aceptaAbono, motivo: x.motivo, dueno: x.ownerNombre, saldo: x.saldo === null || !x.moneda ? null : comoDinero(x.saldo, x.moneda), fecha: x.fecha, dias_sin_actividad: x.diasSinActividad, enlace: enlaces.deal(x.dealId) })), perdidos: r.perdidos.map((x) => ({ id_del_deal: x.dealId, nombre: x.leadNombre, email: x.leadEmail, desde: x.desde.toISOString(), minutos: x.minutos, origen: origen(x.origen), enlace: enlaces.deal(x.dealId) })), pendiente_de_setteo: r.secciones.pendienteSetteo.map(sd), sin_dueno: r.secciones.unclaimed.map(sd) }; }

export function aSalidaDeBuscarLeads(
  resultado: { filas: FilaLead[]; total: number },
  programaVisible: ProgramaVisible,
  pagina: number,
  hayOtraPagina: boolean,
  enlaceDePersona: (id: string) => string,
) {
  return {
    programa: programaVisible,
    total: resultado.total,
    pagina,
    hay_otra_pagina: hayOtraPagina,
    filas: resultado.filas.map((fila) => ({
      id_de_la_persona: fila.id,
      nombre: fila.nombre,
      email: fila.email,
      telefono: fila.telefono,
      calidad: fila.leadQuality,
      estado_del_deal: fila.etapa === null ? null : { clave: fila.etapa, nombre: nombreDeEtapa(fila.etapa) },
      fecha_de_ultima_aplicacion: fila.fechaUltimaAplicacion ? fechaDeInstanteEnBogota(fila.fechaUltimaAplicacion) : null,
      enlace_de_la_persona: enlaceDePersona(fila.id),
    })),
  };
}
