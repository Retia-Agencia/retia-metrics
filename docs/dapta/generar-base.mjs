// Genera un form de Dapta por programa (<slug>.json) que replica la logica de los Typeform
// (Tactical GmPGBOf9, ComunicArte nkMLdeh8, Comunícate con Confianza E5F4chVT) con los estados del ADR 0061.
// Uso: node generar-base.mjs            -> todos los programas de PROGRAMAS
// score = hvm_points - 1 por cada respuesta de baja intencion - 100 por cada descalificante. Un solo
// numero guarda los tres ejes del Typeform (ADR 0102): hvm va de 10 en 10, asi que la intencion queda en
// las unidades. score >= -10 es "sin descalificar" (sin descalificantes da -2 o mas; con uno, -50 o menos).
import fs from 'node:fs';

const DESC = -100;
const INTENCION = -1; // ADR 0102: baja Lead Value un nivel, no descalifica

// Lo unico que cambia entre programas. `ingresos`: [valor, etiqueta, hvm, descalifica]
const PROGRAMAS = {
  comunicarte: {
    nombre: 'Postulación Evento Comunicarte', titulo: 'Postulación Evento Comunicarte', ticket: '797',
    motivacion: '¿Qué te motivó a hacer parte del Método Comunicarte?',
    urgencia: '¿Qué tan urgente es para ti empezar el programa para aprender a comunicarte como un experto?',
    agendaAyuda: 'Si eres seleccionado, en la misma llamada podrás reservar tu cupo',
    // El evento de las citas reales desde octubre (medido en Calendly el 19-oct); el del 30-sep era postulacion-comunicarte
    calendly: 'https://calendly.com/d/d3xv-66m-ynn/postulacion-metodo-comunicarte',
    evento: ['https://api.calendly.com/event_types/098ad9d0-5268-4156-afc1-b371a42f6945', 'Postulación Método Comunicarte'],
    // Tema "Classic blue" del Typeform. Su fuente es la del sistema, que Dapta no tiene: inter es la mas cercana
    marca: { background: '#FFFFFF', foreground: '#000000', primaryColor: '#0445AF', fontFamily: 'inter' },
    pixel: '974573078957944', // Pixel_Comunicarte_2026, el mismo de su Typeform
    ingresos: [
      ['ingreso_1', 'Menos de $700 USD', 0, true],
      ['ingreso_2', '$700 - $1.500 USD', 10, true],
      ['ingreso_3', '$1.500 - $3.000 USD', 20, false],
      ['ingreso_4', 'Más de $3.000 USD', 30, false],
    ],
  },
  tactical: {
    nombre: 'Postulación De Cero a Tactical Investor', titulo: 'De Cero a Tactical Investor', ticket: '1.500',
    motivacion: '¿Qué te motivó a hacer parte del Programa de Cero a Tactical Investor?',
    urgencia: '¿Qué tan urgente es para ti empezar el programa para aprender a invertir como un experto?',
    agendaAyuda: 'Si eres seleccionado te invitaremos allí de una vez a reservar tu cupo',
    calendly: 'https://calendly.com/d/d2ft-nk5-gns/postulacion-de-cero-a-tactical-investor', // 19-oct
    evento: ['https://api.calendly.com/event_types/0049872a-7a3f-4e9c-a7d2-d9f88bfc1927', 'Postulación: De Cero a Tactical Investor'],
    marca: { background: '#2A222B', foreground: '#FAFAFA', primaryColor: '#FAFAFA', fontFamily: 'inter' }, // "Inky black"
    pixel: '1526923172471788', // Pixel_Deceroatactical_2026, el mismo de su Typeform
    ingresos: [ // descalifica menos de 1.000, como su Typeform; los puntos son el estandar (su Typeform no los tiene)
      ['ingreso_1', 'Menos de $1.000 USD', 0, true],
      ['ingreso_2', '$1.000 - $3.000 USD', 10, false],
      ['ingreso_3', '$3.000 - $10.000 USD', 20, false],
      ['ingreso_4', 'Más de $10.000 USD', 30, false],
    ],
  },
  confianza: {
    nombre: 'Postulación Comunícate con Confianza', titulo: 'Comunícate con Confianza', ticket: '800',
    motivacion: '¿Qué te motivó a hacer parte del Programa Comunícate con confianza?',
    urgencia: '¿Qué tan urgente es para ti empezar a comunícarte como un experto ?', // tal cual el Typeform
    agendaAyuda: 'Si eres seleccionado te invitaremos allí de una vez a reservar tu cupo',
    calendly: 'https://calendly.com/d/dv7k-r6w-g55/postulacion-comunicate-con-confianza', // 19-oct
    evento: ['https://api.calendly.com/event_types/030f9e46-1bf8-4be7-b8f4-406a19fd78f7', 'Postulación Comunícate con Confianza'],
    marca: { background: '#0B0E11', foreground: '#FFFFFF', primaryColor: '#00B2F0', fontFamily: 'inter' }, // "PowerTalk"
    pixel: '1068355778485503', // Power Talk, el mismo de su Typeform
    ingresos: [
      ['ingreso_1', 'Menos de $1.000 USD', 0, true],
      ['ingreso_2', '$1.000 - $3.000 USD', 10, false],
      ['ingreso_3', '$3.000 - $10.000 USD', 20, false],
      ['ingreso_4', 'Más de $10.000 USD', 30, false],
    ],
  },
  memorable: {
    nombre: 'Postulación Memorable', titulo: 'Postulación Memorable', ticket: '1.200',
    motivacion: '¿Qué te motivó a hacer parte de Memorable?',
    urgencia: '¿Qué tan urgente es para ti empezar el programa y aprender a ser memorable en redes sociales?',
    agendaAyuda: 'Si eres seleccionado te invitaremos allí de una vez a reservar tu cupo',
    calendly: null, // Memorable aun no tiene Calendly (Mani, 30-sep)
    ingresos: [ // los rangos de Tactical (Mani, 30-sep)
      ['ingreso_1', 'Menos de $1.000 USD', 0, true],
      ['ingreso_2', '$1.000 - $3.000 USD', 10, false],
      ['ingreso_3', '$3.000 - $10.000 USD', 20, false],
      ['ingreso_4', 'Más de $10.000 USD', 30, false],
    ],
  },
};
// El value es la misma etiqueta (A10, 30-sep): Dapta manda el value en el webhook, y asi `respuestas`
// se lee igual que un envio de Typeform. Ninguna condicion usa el value: los saltos van por @score.
const opt = (_slug, label, points) => ({ label, value: label, points });
// flowGroup no va: la API de Dapta lo deriva del tipo y rechaza el que no sale de el (UNSUPPORTED_FIELD, 19-oct).
const lead = { required: true };

function formDe(p) {
const steps = [
  { key: 'nombre', type: 'text', question: '¿Cuál es tu nombre completo?', ...lead },
  { key: 'email', type: 'email', question: '¿Cuál es tu correo electrónico?', ...lead },
  { key: 'whatsapp', type: 'phone', question: '¿Cuál es tu número de WhatsApp?', phoneDefaultCountry: 'CO', ...lead },
  { key: 'ingreso', type: 'multiple_choice', required: true, question: '¿Cuánto ganas mensualmente? (en dólares)', options: [
    ...p.ingresos.map(([v, l, hvm, desc]) => opt(v, l, hvm + (desc ? DESC : 0))),
  ] },
  { key: 'motivacion', type: 'textarea', required: true, scoringEnabled: false,
    question: p.motivacion,
    helper: 'Cuéntanos por qué quieres participar y qué esperarías obtener del programa' },
  { key: 'urgencia', type: 'multiple_choice', required: true,
    question: p.urgencia, options: [
    opt('muy_urgente', 'Muy urgente', 0),
    opt('puede_esperar', 'Estoy interesado pero puede esperar', INTENCION),
    opt('no_prioridad', 'No es prioridad', DESC),
  ] },
  { key: 'situacion', type: 'multiple_choice', required: true,
    question: '¿Cómo se podría describir mejor tu situación profesional?', options: [
    opt('estudiante', 'Estudiante', 0),
    opt('desempleado', 'Desempleado', 0),
    opt('exp_0_5', '0-5 años de experiencia', 10),
    opt('exp_5_15', '5-15 años de experiencia', 20),
    opt('exp_15_mas', '+15 años de experiencia', 20),
    opt('pensionado', 'Pensionado', 10),
  ] },
  { key: 'inversion', type: 'multiple_choice', required: true,
    question: `¿Estás dispuesto y en la capacidad de invertir ${p.ticket} USD en ti?`, options: [
    opt('si_puedo', 'Sí, tengo la disposición y capacidad de invertir en este momento', 0),
    opt('si_facilidades', 'Sí, pero necesito facilidades de pago', INTENCION),
    opt('no_recursos', 'No, en este momento no cuento con los recursos', DESC),
  ] },
  // Solo lo ve quien no tiene ninguna respuesta descalificante (el Typeform saltaba al final).
  { key: 'agenda', type: 'scheduler', required: true, question: 'Agenda aquí tu entrevista',
    helper: p.agendaAyuda,
    hideWhen: { field: '@score', op: 'lt', value: -10 },
    scheduler: { provider: 'calendly', url: p.calendly ?? 'https://calendly.com/REEMPLAZAR', prefill: true,
      prefillMap: { name: 'nombre', email: 'email' },
      // El evento escogido, el mismo que guarda el editor con Calendly conectado en Integrations
      ...(p.evento ? { eventTypeUri: p.evento[0], eventTypeName: p.evento[1] } : {}) } },
  // Las seis UTM (utm_id incluido) las captura Dapta solo desde la URL (medido el 1-oct). ad_id, adset_id y
  // campaign_id no: van como pasos ocultos, los ocultos completos del ADR 0087. Un oculto no se le muestra a nadie.
  // fbclid tambien (ADR 0099 punto 3, 22-oct): Meta lo agrega a cada clic y CAPI lo necesita.
  ...['ad_id', 'adset_id', 'campaign_id', 'fbclid'].map((key) => ({ key, type: 'text', question: key, hidden: true })),
];

const GRACIAS = 'Nuestro equipo revisará tu perfil, y en caso de ser seleccionado/a te invitaremos a reservar un cupo en esta edición del programa.';
const AGENDADO = 'Nuestro equipo revisará tu perfil, te entrevistará en el horario que escogiste, y en caso de ser seleccionado/a te invitaremos a reservar un cupo en esta edición del programa.';
// Las dos pantallas finales del Typeform, tal cual (19-oct). La etiqueta del outcome es el titulo de la pantalla
// y lo que manda el webhook: el CRM ya no la parte, saca estado, lead_value y lead_quality del score
// (calidadDesdeScore). Por eso bastan dos: sin descalificantes (score >= -10, vio el Calendly) y con alguno.
const outcomes = [
  { id: 'agendado', label: 'Gracias ¡nos vemos en tu entrevista!', minScore: -10, message: AGENDADO },
  { id: 'en_revision', label: '¡Perfecto! Estamos analizando tu aplicación, pronto nos comunicaremos contigo',
    minScore: -302, maxScore: -11, message: GRACIAS }, // -302: los tres descalificantes y las dos de baja intencion
];

const config = {
  version: 1,
  title: p.titulo,
  language: 'es',
  layout: 'slides',
  // Los colores del tema de su Typeform (19-oct); esquinas pequenas y texto a la izquierda, como alla
  ...(p.marca ? { branding: { ...p.marca, backgroundStyle: 'solid', radius: 'soft', buttonStyle: 'solid', contentAlign: 'left' } } : {}),
  steps,
  scoring: { enabled: true },
  ...(p.pixel ? { tracking: { metaPixelId: p.pixel } } : {}),
  outcomes,
  partialSubmitAfterStep: 8, // tras "inversion": el parcial previo al Calendly (ADR 0061 punto 6)
};
return { name: p.nombre, config };
}

for (const [slug, p] of Object.entries(PROGRAMAS)) {
  const form = formDe(p);
  fs.writeFileSync(new URL(`./${slug}.json`, import.meta.url), JSON.stringify(form, null, 2) + '\n');
  console.log(slug, form.config.steps.length, 'pasos,', form.config.outcomes.length, 'outcomes');
}
