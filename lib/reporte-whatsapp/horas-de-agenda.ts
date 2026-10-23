import { fechaDeCierre } from "@/lib/reporte-whatsapp/mensaje";

interface ProgramaConHoras {
  programa: string;
  horas: string[];
  agendasMeta?: number | null;
  error: boolean;
}

const FRANJAS = [
  { desde: 0, hasta: 6, etiqueta: "🌑 Madrugada (0 a 6)" },
  { desde: 6, hasta: 12, etiqueta: "🌅 Mañana (6 a 12)" },
  { desde: 12, hasta: 18, etiqueta: "☀️ Tarde (12 a 18)" },
  { desde: 18, hasta: 24, etiqueta: "🌙 Noche (18 a 24)" },
] as const;

function unirConY(valores: string[]): string {
  if (valores.length <= 1) return valores[0] ?? "";
  return `${valores.slice(0, -1).join(", ")} y ${valores.at(-1)}`;
}

function lineaDePico(horas: string[]): string | null {
  const conteos = new Map<string, number>();
  for (const hora of horas) {
    const horaEntera = hora.slice(0, 2);
    conteos.set(horaEntera, (conteos.get(horaEntera) ?? 0) + 1);
  }
  const maximo = Math.max(0, ...conteos.values());
  if (maximo <= 1) return null;
  const picos = [...conteos.entries()]
    .filter(([, conteo]) => conteo === maximo)
    .map(([hora]) => `${hora}h`);
  const detalle = picos.length > 1 ? `${maximo} cada una` : `${maximo} agendas`;
  return `Hora pico: ${unirConY(picos)} (${detalle})`;
}

function bloqueDePrograma({ programa, horas, agendasMeta, error }: ProgramaConHoras): string {
  if (error) return `*${programa}* · no se pudieron leer las agendas`;
  const meta = agendasMeta === undefined || agendasMeta === null ? "" : ` (Meta: ${agendasMeta})`;
  if (horas.length === 0) return `*${programa}* · sin agendas${meta}`;

  const lineas = [`*${programa}* · ${horas.length} ${horas.length === 1 ? "agenda" : "agendas"}${meta}`];
  for (const franja of FRANJAS) {
    const horasDeFranja = horas.filter((hora) => {
      const valor = Number(hora.slice(0, 2));
      return valor >= franja.desde && valor < franja.hasta;
    });
    if (horasDeFranja.length > 0) lineas.push(`${franja.etiqueta}: ${horasDeFranja.join(" · ")}`);
  }
  const pico = lineaDePico(horas);
  if (pico) lineas.push(pico);
  return lineas.join("\n");
}

export function armarMensajeDeHorasDeAgenda(dia: string, programas: ProgramaConHoras[]): string {
  const bloques = programas.map(bloqueDePrograma).join("\n━━━━━━━━━━\n");
  return [
    `🕒 Horas de agenda · ${fechaDeCierre(dia)}`,
    "",
    bloques,
    "",
    "ℹ️ Agendas del CRM con UTM de pauta, por la hora en que la persona agendó en Calendly (hora de Bogotá). Meta cuenta aparte las que se atribuye, por eso puede dar más.",
  ].join("\n");
}
