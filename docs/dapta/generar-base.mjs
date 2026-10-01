// Genera un form de Dapta por programa (<slug>.json) que replica la logica de los Typeform
// (Tactical GmPGBOf9, ComunicArte nkMLdeh8) con los estados del ADR 0061.
// Uso: node generar-base.mjs            -> todos los programas de PROGRAMAS
// score = hvm_points + (-100 por cada respuesta descalificante). Un solo numero guarda los dos
// ejes del Typeform: score >= 0 es "sin descalificar" y hvm = score mod 100.
import fs from 'node:fs';

const DESC = -100;

// Lo unico que cambia entre programas. `ingresos`: [valor, etiqueta, hvm, descalifica]
const PROGRAMAS = {
  comunicarte: {
    nombre: 'Postulación Evento Comunicarte', titulo: 'Postulación Evento Comunicarte', ticket: '797',
    motivacion: '¿Qué te motivó a hacer parte del Método Comunicarte?',
    urgencia: '¿Qué tan urgente es para ti empezar el programa para aprender a comunicarte como un experto?',
    agendaAyuda: 'Si eres seleccionado, en la misma llamada podrás reservar tu cupo',
    ingresos: [
      ['ingreso_1', 'Menos de $700 USD', 0, true],
      ['ingreso_2', '$700 - $1.500 USD', 10, true],
      ['ingreso_3', '$1.500 - $3.000 USD', 20, false],
      ['ingreso_4', 'Más de $3.000 USD', 30, false],
    ],
  },
  memorable: {
    nombre: 'Postulación Memorable', titulo: 'Postulación Memorable', ticket: '1.200',
    motivacion: '¿Qué te motivó a hacer parte de Memorable?',
    urgencia: '¿Qué tan urgente es para ti empezar el programa y aprender a ser memorable en redes sociales?',
    agendaAyuda: 'Si eres seleccionado te invitaremos allí de una vez a reservar tu cupo',
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
const lead = { flowGroup: 'lead_capture', required: true };

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
    opt('puede_esperar', 'Estoy interesado pero puede esperar', 0),
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
    opt('si_facilidades', 'Sí, pero necesito facilidades de pago', 0),
    opt('no_recursos', 'No, en este momento no cuento con los recursos', DESC),
  ] },
  // Solo lo ve quien no tiene ninguna respuesta descalificante (el Typeform saltaba al final).
  { key: 'agenda', type: 'scheduler', required: true, question: 'Agenda aquí tu entrevista',
    helper: p.agendaAyuda,
    hideWhen: { field: '@score', op: 'lt', value: 0 },
    scheduler: { provider: 'calendly', url: 'https://calendly.com/REEMPLAZAR', prefill: true,
      prefillMap: { name: 'nombre', email: 'email' } } },
  // utm_source/medium/campaign/content/term los captura Dapta solo; utm_id (llave del anuncio, ADR 0062) no.
  { key: 'utm_id', type: 'text', hidden: true },
];

// lead_value del Typeform: [hvm minimo, valor si limpio, valor si descalificado]
const TRAMOS = [
  { min: 30, max: 50, limpio: 'MUY ALTO VALOR', desc: 'ALTO VALOR' },
  { min: 15, max: 29, limpio: 'ALTO VALOR', desc: 'VALOR MEDIO' },
  { min: 0, max: 14, limpio: 'VALOR MEDIO', desc: 'BAJO VALOR' },
];
const GRACIAS = 'Nuestro equipo revisará tu perfil, y en caso de ser seleccionado/a te invitaremos a reservar un cupo en esta edición del programa.';
const AGENDADO = 'Nuestro equipo revisará tu perfil, te entrevistará en el horario que escogiste, y en caso de ser seleccionado/a te invitaremos a reservar un cupo en esta edición del programa.';
const outcomes = [];
for (const t of TRAMOS) {
  outcomes.push({ id: `limpio_${t.min}`, label: `con_calendly_sin_agenda|${t.limpio}|High`,
    minScore: t.min, ...(t.min === 30 ? {} : { maxScore: t.max }),
    message: AGENDADO, redirectUrl: 'https://example.com/REEMPLAZAR-agendado' });
  for (const k of [1, 2, 3]) // hasta tres respuestas descalificantes (ingreso, urgencia, inversion)
    outcomes.push({ id: `desc${k}_${t.min}`, label: `setteo_no_calificado|${t.desc}|Low`,
      minScore: t.min - 100 * k, maxScore: t.max - 100 * k,
      message: GRACIAS, redirectUrl: 'https://example.com/REEMPLAZAR-gracias' });
}

const config = {
  version: 1,
  title: p.titulo,
  language: 'es',
  layout: 'slides',
  steps,
  scoring: { enabled: true },
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
