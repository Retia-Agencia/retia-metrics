import { cop, horaEnBogota, instanteDeBogota, num, pct } from "@/lib/format";
import { rutaDePrograma } from "@/lib/nav";
import { NOTA_SIN_ERRORES } from "@/lib/semaforo/semaforo";
import { nombreCorto, VOCABULARIO_PAUTA_SEMANAL } from "@/lib/vocabulario-metricas";
import type { RespuestaSemaforo } from "./contrato";

const EMOJI = {
  exito: "🟢",
  alerta: "🟡",
  peligro: "🔴",
  sin_dato: "⚪",
} as const;

const NOMBRE_DEL_COLOR = {
  exito: "verde",
  alerta: "amarillo",
  peligro: "rojo",
} as const;

const MOTIVO = {
  sin_cohorte: "No hay cohorte activa",
  sin_umbral: "Falta cargar la meta en el CRM",
  sin_pauta: "No hay gasto de pauta hoy",
  sin_agendas_meta: "Meta no reporta agendas de este programa",
  meta_sin_contar: "Meta aún no cuenta las agendas del CRM (las cuenta con retraso)",
} as const;

const LARGO_MAXIMO_CAMPANA = 40;

function piezasDelNombre(nombre: string): string[] {
  return nombre.split(/ \| |_/).map((pieza) => pieza.trim()).filter(Boolean);
}

function clavePieza(pieza: string): string {
  return pieza.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
}

function cortar(texto: string): string {
  return texto.length > LARGO_MAXIMO_CAMPANA
    ? `${texto.slice(0, LARGO_MAXIMO_CAMPANA - 1).trimEnd()}…`
    : texto;
}

/**
 * Acorta los nombres de campaña de un bloque sin catálogo: quita las piezas (separadas por " | " o "_")
 * que aparecen en más de la mitad de las campañas, porque no distinguen una de otra. Si un nombre
 * queda vacío o igual a otro, vuelve al nombre completo; todo se corta a 40 caracteres.
 */
export function nombresCortosDeCampanas(nombres: string[]): string[] {
  const piezas = nombres.map(piezasDelNombre);
  const apariciones = new Map<string, number>();
  for (const lista of piezas) {
    for (const clave of new Set(lista.map(clavePieza))) {
      apariciones.set(clave, (apariciones.get(clave) ?? 0) + 1);
    }
  }
  const cortos = piezas.map((lista) => cortar(
    lista.filter((pieza) => (apariciones.get(clavePieza(pieza)) ?? 0) * 2 <= nombres.length).join(" · "),
  ));
  return cortos.map((corto, indice) =>
    corto === "" || cortos.indexOf(corto) !== cortos.lastIndexOf(corto) ? cortar(nombres[indice]) : corto
  );
}

type Bloque = RespuestaSemaforo["envios"][number]["bloques"][number];
type Sincronizacion = RespuestaSemaforo["sincronizacion"];
type Metrica = Bloque["metricas"][number];

function pesos(valor: number | null): string {
  return valor === null ? "—" : cop(valor);
}

const ROTULO = {
  inversion: VOCABULARIO_PAUTA_SEMANAL.inversion,
  agendasMeta: VOCABULARIO_PAUTA_SEMANAL.agendas_meta,
  agendasCrm: nombreCorto("agendadas"),
  costoAgendaMeta: VOCABULARIO_PAUTA_SEMANAL.costo_agenda_meta,
} as const;

function frenteALaMeta(porcentajeDelUmbral: number | null): string {
  if (porcentajeDelUmbral === null) return "";
  const diferencia = Math.round(porcentajeDelUmbral) - 100;
  if (diferencia > 0) return ` · ${pct(diferencia / 100, 0)} más caro que la meta`;
  if (diferencia < 0) return ` · ${pct(-diferencia / 100, 0)} más barato que la meta`;
  return " · igual a la meta";
}

function lineasMetrica(metrica: Metrica, tipo: Bloque["tipo"]): string[] {
  const costo = metrica.motivo === "meta_sin_contar"
    ? "esperando a Meta"
    : metrica.costo === null && metrica.agendasMeta === 0 && metrica.gasto > 0
      ? "sin agendas"
      : pesos(metrica.costo);
  const lineas: string[] = [];
  const nuevas = metrica.campanas.filter(
    (campana) => campana.codigo !== null && campana.proposito === null && campana.gasto > 0,
  );
  if (nuevas.length > 0) {
    lineas.push("🆕 Campañas nuevas: ¿agenda, lanzamiento u otro?");
    for (const campana of nuevas) {
      lineas.push(`#${campana.codigo} ${campana.nombre} · ${ROTULO.inversion} ${pesos(campana.gasto)}`);
    }
    lineas.push("👉 Responde citando este mensaje con el código y A (agenda), L (lanzamiento) u O (otro: compras, interacción), por ejemplo:");
    lineas.push(nuevas.length === 1
      ? `${nuevas[0].codigo} A`
      : `${nuevas[0].codigo} A, ${nuevas[1].codigo} L`);
  }
  lineas.push(
    `${EMOJI[metrica.color]} ${ROTULO.costoAgendaMeta}: ${costo}${frenteALaMeta(metrica.porcentajeDelUmbral)}`,
  );

  if (metrica.umbral) {
    lineas.push(
      `Meta ${pesos(metrica.umbral.meta)} · aceptable ${pesos(metrica.umbral.aceptable)}`,
    );
  }
  lineas.push(
    `${ROTULO.inversion} ${pesos(metrica.gasto)} · ${ROTULO.agendasMeta} ${metrica.agendasMeta === null ? "—" : num(metrica.agendasMeta)} · ${ROTULO.agendasCrm} ${num(metrica.agendasCrm)}`,
  );
  const campanasActivas = metrica.campanas.filter((campana) => campana.activa);
  const campanas = campanasActivas.some((campana) => campana.codigo !== null)
    ? campanasActivas
    : [];
  const nombresCortos = nombresCortosDeCampanas(campanas.map((campana) => campana.nombre));
  for (const [indice, campana] of campanas.entries()) {
    const costoCampana = campana.agendasMeta === null
      ? "—"
      : campana.agendasMeta === 0
        ? "sin agendas"
        : pesos(campana.costo);
    lineas.push(
      `• ${campana.codigo ? `#${campana.codigo} ` : ""}${nombresCortos[indice]}: ${ROTULO.inversion} ${pesos(campana.gasto)} · ${ROTULO.agendasMeta} ${campana.agendasMeta === null ? "—" : num(campana.agendasMeta)} · ${ROTULO.costoAgendaMeta} ${costoCampana}`,
    );
  }
  const pausadas = metrica.campanas.filter((campana) => !campana.activa && campana.gasto > 0);
  if (pausadas.length > 0) {
    const gastoPausado = pausadas.reduce((total, campana) => total + campana.gasto, 0);
    const agendasPausadas = pausadas.reduce((total, campana) => total + (campana.agendasMeta ?? 0), 0);
    lineas.push(`• Pausadas con gasto: ${ROTULO.inversion} ${pesos(gastoPausado)} · ${ROTULO.agendasMeta} ${num(agendasPausadas)}`);
  }
  const etiqueta = tipo === "cierre" ? "Día anterior" : "Ayer a esta hora";
  const costoComparacion = metrica.comparacion?.costo === null
    && metrica.comparacion.agendasMeta === 0
    && metrica.comparacion.gasto > 0
    ? "sin agendas"
    : pesos(metrica.comparacion?.costo ?? null);
  lineas.push(metrica.comparacion
    ? `${etiqueta}: ${ROTULO.costoAgendaMeta} ${costoComparacion} · ${ROTULO.inversion} ${pesos(metrica.comparacion.gasto)} · ${ROTULO.agendasMeta} ${metrica.comparacion.agendasMeta === null ? "—" : num(metrica.comparacion.agendasMeta)} · ${ROTULO.agendasCrm} ${num(metrica.comparacion.agendasCrm)}`
    : `${etiqueta}: sin foto`);
  if (metrica.lanzamiento.campanas.length > 0) {
    const resumenRegistros = metrica.lanzamiento.registrosMeta === null
      ? "registros Meta —"
      : metrica.lanzamiento.registrosMeta === 0
        ? "0 registros Meta · sin registros"
        : `${num(metrica.lanzamiento.registrosMeta)} registros Meta · CPL ${pesos(metrica.lanzamiento.costoPorRegistro)}`;
    lineas.push(`🚀 Lanzamiento: ${ROTULO.inversion} ${pesos(metrica.lanzamiento.gasto)} · ${resumenRegistros}`);
    for (const campana of metrica.lanzamiento.campanas.filter((campana) => campana.activa)) {
      const registrosCampana = campana.registrosMeta === null
        ? "— reg"
        : campana.registrosMeta === 0
          ? "0 reg · sin registros"
          : `${num(campana.registrosMeta)} reg · ${pesos(campana.costoPorRegistro)} c/u`;
      lineas.push(`• ${campana.codigo ? `#${campana.codigo} ` : ""}${campana.nombre}: ${ROTULO.inversion} ${pesos(campana.gasto)} · ${registrosCampana}`);
    }
    const pausadasLanzamiento = metrica.lanzamiento.campanas.filter(
      (campana) => !campana.activa && campana.gasto > 0,
    );
    if (pausadasLanzamiento.length > 0) {
      const gastoPausado = pausadasLanzamiento.reduce((total, campana) => total + campana.gasto, 0);
      const registrosPausados = pausadasLanzamiento.reduce(
        (total, campana) => total + (campana.registrosMeta ?? 0),
        0,
      );
      lineas.push(`• Pausadas con gasto: ${ROTULO.inversion} ${pesos(gastoPausado)} · ${num(registrosPausados)} reg`);
    }
    lineas.push(`${ROTULO.inversion} total del programa: ${pesos(metrica.gastoTotal)}`);
  }
  if (metrica.racha) {
    const { color, dias } = metrica.racha;
    lineas.push(`Días cerrados: ${EMOJI[color]} ${num(dias)} ${dias === 1 ? "" : "seguidos "}en ${NOMBRE_DEL_COLOR[color]}`);
  }
  if (metrica.motivo) lineas.push(MOTIVO[metrica.motivo]);
  for (const nota of metrica.notas.filter((nota) => nota.tipo === "problema")) {
    lineas.push(`⚠️ ${nota.texto}`);
  }
  if (tipo === "cierre" && metrica.trayectoria.length > 0) {
    const puntos = metrica.trayectoria.map(
      (punto) => `${punto.hora} ${ROTULO.inversion} ${pesos(punto.gasto)} · ${ROTULO.agendasMeta} ${punto.agendasMeta === null ? "—" : num(punto.agendasMeta)}`,
    );
    lineas.push(`Trayectoria: ${puntos.join(" | ")}`);
  }
  return lineas;
}

function conteoDeColores(bloques: Bloque[]): string {
  const conteos = { peligro: 0, alerta: 0, exito: 0, sin_dato: 0 };
  for (const bloque of bloques) {
    const color = bloque.metricas[0]?.color;
    if (color) conteos[color] += 1;
  }
  return (["peligro", "alerta", "exito", "sin_dato"] as const)
    .filter((color) => conteos[color] > 0)
    .map((color) => `${conteos[color]}${EMOJI[color]}`)
    .join(" · ");
}

export function fechaDeCierre(dia: string): string {
  const instante = instanteDeBogota(dia, "12:00");
  if (!instante) return dia;
  const partes = new Intl.DateTimeFormat("es-CO", {
    timeZone: "America/Bogota",
    weekday: "long",
    day: "numeric",
    month: "short",
  }).formatToParts(instante);
  const valor = (tipo: Intl.DateTimeFormatPartTypes) =>
    partes.find((parte) => parte.type === tipo)?.value.replace(".", "") ?? "";
  return `${valor("weekday")} ${valor("day")}-${valor("month")}`;
}

export function enlaceAlHub(origen: string, slug: string): string {
  return `${origen}${rutaDePrograma(slug, "hub")}?seccion=pauta`;
}

export function avisoDeErrorDeSincronizacion(
  sincronizacion: Sincronizacion,
): string | null {
  if (sincronizacion?.estado !== "error") return null;
  const hora = sincronizacion.ultimaFoto ? horaEnBogota(sincronizacion.ultimaFoto) : null;
  return `⚠️ No se pudo leer Meta; cifras de la última foto${hora ? ` (${hora})` : ""}`;
}

export function armarMensajeDeLaHora(
  bloques: Bloque[],
  hora: string,
  sincronizacion: Sincronizacion,
  origen: string,
): string {
  const todosSonCierre = bloques.every((bloque) => bloque.tipo === "cierre");
  const tiposMixtos = new Set(bloques.map((bloque) => bloque.tipo)).size > 1;
  const conteo = conteoDeColores(bloques);
  const titulo = todosSonCierre
    ? `🌙 Cierre del ${fechaDeCierre(bloques[0]?.metricas[0]?.dia ?? "")}`
    : `🚦 Semáforo de pauta · ${hora}${conteo ? ` · ${conteo}` : ""}`;
  const lineas = [titulo, ""];

  const bloquesFormateados = bloques.map((bloque) => {
    const cierre = tiposMixtos && bloque.tipo === "cierre" ? " (cierre)" : "";
    const lineasBloque = [`*${bloque.programa}*${cierre}`];
    if (bloque.error) lineasBloque.push(`⚠️ ${bloque.error}`);
    else {
      for (const metrica of bloque.metricas) {
        lineasBloque.push(...lineasMetrica(metrica, bloque.tipo));
      }
    }
    for (const fuente of bloque.trazaRota ?? []) {
      if (fuente.sinId) {
        lineasBloque.push(`⚠️ ${fuente.fuente}: ${num(fuente.pagosSinId)} de ${num(fuente.pagos)} envíos pagos sin anuncio (24 h)`);
      }
      if (fuente.fbclidRoto) {
        lineasBloque.push(`⚠️ ${fuente.fuente}: ${num(fuente.pagosSinFbclid)} de ${num(fuente.pagos)} envíos pagos sin fbclid (24 h)`);
      }
    }
    return lineasBloque.join("\n");
  });
  lineas.push(bloquesFormateados.join("\n━━━━━━━━━━\n"), "");

  const avisoSincronizacion = avisoDeErrorDeSincronizacion(sincronizacion);
  if (avisoSincronizacion) lineas.push(avisoSincronizacion);

  const cuentasMeta = bloques.flatMap((bloque) =>
    bloque.cuentasMeta.map((cuenta) => ({ ...cuenta, programa: bloque.programa })),
  );
  const cuentasConProblema = cuentasMeta.filter((cuenta) => cuenta.estado === "problema");
  if (cuentasMeta.length > 0) {
    if (cuentasConProblema.length === 0) {
      lineas.push(`💳 Cuentas de Meta: todas al día (${cuentasMeta.length})`);
    } else {
      lineas.push("💳 Cuentas de Meta con problema:");
      for (const cuenta of cuentasConProblema) {
        lineas.push(`🔴 ${cuenta.nombre} (${cuenta.programa}): ${cuenta.detalle}`);
      }
    }
  }

  const notasInformativas = new Set<string>();
  let tieneProblemas = cuentasConProblema.length > 0 || bloques.some(
    (bloque) => bloque.error !== null || (bloque.trazaRota?.length ?? 0) > 0,
  );
  for (const bloque of bloques) {
    if (bloque.error) continue;
    for (const metrica of bloque.metricas) {
      for (const nota of metrica.notas) {
        if (nota.tipo === "problema") tieneProblemas = true;
        else if (nota.texto !== NOTA_SIN_ERRORES) notasInformativas.add(nota.texto);
      }
    }
  }
  for (const nota of notasInformativas) lineas.push(`ℹ️ ${nota}`);
  if (!tieneProblemas) lineas.push("✅ Sin errores en esta corrida");
  lineas.push(`CRM: ${origen}`);
  if (bloques.some((bloque) => bloque.tipo === "dia")) {
    lineas.push("ℹ️ Las agendas de hoy pueden seguir subiendo: Meta las cuenta el día en que la persona vio el anuncio, aunque agende después.");
  }
  lineas.push("ℹ️ Costo por agenda = gasto de campañas de agenda ÷ agendas Meta (pixel); el lanzamiento va aparte. CPL de lanzamiento = gasto de lanzamiento ÷ registros Meta (pixel). CRM = citas con UTM de pauta.");
  return lineas.join("\n");
}
