/**
 * "¿Qué trae ventas?" y "¿Qué llega sin origen?" como Cifras (420, `docs/diseno-cifra-y-pauta.md` §5.1 y §5.2).
 *
 * Puro: recibe la vista del ROAS de pauta ya cargada (`cargarRoasDePauta`) y la traza por anuncio, y arma cada celda
 * con `armarCifra`. No recalcula nada: inversión, agendadas, ventas y ROAS son los del renglón; el costo por agenda es
 * la inversión del renglón entre sus agendadas. La evidencia de Agendadas y Ventas sale de los MISMOS envíos que
 * suman la celda (`filtrarEnviosDePauta`, la función que usa la página de la lista), así que la lista cuenta lo mismo
 * que la cifra por construcción; lo vigila `tests/pauta-origen-cifras.test.ts`.
 */
import { armarCifra, type CifraDeMetrica, type EntradaDeCifra } from "@/lib/metricas/cifra";
import { explicacionDe, VARIANTES_DE_PAUTA } from "@/lib/metricas/explicacion";
import { ETIQUETA_DE_RESULTADO } from "@/lib/deals/estado-de-llamada";
import { fecha, fechaDeInstanteEnBogota, num, usd } from "@/lib/format";
import {
  filtrarEnviosDePauta,
  type NivelPauta,
  type PasoPauta,
  type RenglonRoas,
  type VistaRoasDePauta,
} from "@/lib/queries/roas-de-pauta";

/** Ver por (diseño §5.1). Cuenta es la cuenta de Meta del gasto (416). */
export const VER_POR_ORIGEN = [
  { id: "cuenta", etiqueta: "Cuenta" },
  { id: "canal", etiqueta: "Canal" },
  { id: "campana", etiqueta: "Campaña" },
  { id: "anuncio", etiqueta: "Anuncio" },
] as const;
export type VerPorOrigen = (typeof VER_POR_ORIGEN)[number]["id"];

export function verPorOrigen(valor: string | string[] | undefined): VerPorOrigen {
  return VER_POR_ORIGEN.find((v) => v.id === valor)?.id ?? "campana";
}

type Enlace = (nivel: NivelPauta, id: string | undefined, paso: PasoPauta) => string;
type Lista = NonNullable<EntradaDeCifra["lista"]>;

export interface ContextoDeOrigen {
  vista: VistaRoasDePauta;
  /** El enlace a la lista de una fila y un paso; sin él (la sesión no abre listas) ninguna cifra trae evidencia. */
  enlace?: Enlace;
  programa?: string;
  /** El periodo en palabras ("del 12 oct al 10 nov"), para "Calculada con". */
  periodo: string;
}

export interface FilaDeQueTraeVentas {
  clave: string;
  nombre: string;
  nivel: NivelPauta;
  id: string | null;
  /** Gastó sin traer una sola agenda: el badge rojo "Revisar" (diseño §5.1). */
  revisar: boolean;
  /** Abre el detalle de conjuntos y anuncios (solo una campaña de Meta). */
  conDetalle: boolean;
  inversion: CifraDeMetrica;
  agendas: CifraDeMetrica;
  costo: CifraDeMetrica;
  ventas: CifraDeMetrica;
  roas: CifraDeMetrica;
}

const SIN_GASTO_CANAL = "Meta da el gasto por anuncio, no por canal: un canal no tiene inversión propia.";
const SIN_GASTO = "Sin gasto: no viene de un anuncio pago identificado.";

function etiquetaDeNivel(nivel: NivelPauta): string {
  switch (nivel) {
    case "campana": return "Campaña";
    case "conjunto": return "Conjunto";
    case "anuncio": case "anuncio_sin_identificar": return "Anuncio";
    case "canal": return "Canal";
    case "cuenta_meta": return "Cuenta de Meta";
    default: return "Origen";
  }
}

/** Las primeras cinco filas de la lista detrás de Agendadas o Ventas, de los mismos envíos que suman la celda. */
export function listaDeOrigen(vista: VistaRoasDePauta, r: RenglonRoas, paso: "agenda" | "venta", enlace: Enlace): Lista {
  const envios = filtrarEnviosDePauta(vista.envios, r.nivel, r.id ?? undefined);
  const filas: Array<{ fecha: string; id: string; celdas: string[] }> = [];
  for (const e of envios) {
    if (paso === "venta") {
      if (e.venta) filas.push({ fecha: e.venta.dia, id: e.venta.dealId, celdas: [e.nombre ?? "Sin nombre", fecha(e.venta.dia), e.venta.sinValorVendido ? "—" : usd(e.venta.valorVendidoUsd)] });
    } else {
      for (const c of e.citas) {
        const dia = fechaDeInstanteEnBogota(c.fecha);
        filas.push({ fecha: dia, id: c.id, celdas: [e.nombre ?? "Sin nombre", fecha(dia), (ETIQUETA_DE_RESULTADO as Record<string, string>)[c.resultado] ?? c.resultado] });
      }
    }
  }
  // El mismo orden que la página de la lista: por fecha y luego por id.
  filas.sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id));
  return {
    href: enlace(r.nivel, r.id ?? undefined, paso),
    nombre: paso === "venta" ? "ventas" : "agendas",
    total: filas.length,
    filas: filas.slice(0, 5).map((f) => f.celdas),
  };
}

/**
 * Lo que decía el "Cómo se calcula" del ROAS de pauta (madurez, tasa de cambio, cobertura del gasto, citas sin marcar,
 * ventas sin valor y la reconciliación con Comercial): ahora son notas de la explicación del ROAS del Total.
 */
export function notasDelRoasTotal(vista: VistaRoasDePauta): Array<readonly [string, string]> {
  const notas: Array<readonly [string, string]> = [];
  const { total, coberturaGasto } = vista;
  if (vista.ventanaCierreDias === null) notas.push(["Madurez", "Todavía no hay 5 ventas para estimar cuánto tarda una venta."]);
  else {
    const edad = total.desdeDias === null || total.hastaDias === null ? "" : `Los registros tienen entre ${num(total.desdeDias)} y ${num(total.hastaDias)} días; `;
    const subira = total.desdeDias !== null && total.desdeDias < vista.ventanaCierreDias ? " El ROAS de este periodo todavía va a subir." : "";
    notas.push(["Madurez", `${edad}aquí una venta tarda en mediana ${num(vista.ventanaCierreDias)} días desde el registro (sobre ${num(vista.ventasParaMadurez)} ventas).${subira}`]);
  }
  notas.push(["Tasa de cambio", `${vista.trmEtiqueta ?? "No hay una tasa de cambio aplicada en este periodo."}${vista.diasSinTrm.length > 0 ? ` Días sin tasa: ${vista.diasSinTrm.map(fecha).join(", ")}.` : ""}`]);
  if (coberturaGasto.primerDia === null || coberturaGasto.ultimoDia === null) notas.push(["Gasto cargado", "No hay gasto de Meta cargado."]);
  else if (coberturaGasto.primerDia > vista.rango.desde || coberturaGasto.diasSinFila.length > 0) {
    notas.push(["Gasto cargado", `Hay gasto de Meta desde el ${fecha(coberturaGasto.primerDia)} hasta el ${fecha(coberturaGasto.ultimoDia)}.`]);
  }
  if (vista.citasSinMarcar > 0) notas.push(["Citas sin marcar", `${num(vista.citasSinMarcar)}: el closer no marcó si la persona asistió.`]);
  if (total.sinValorVendido > 0) notas.push(["Ventas sin valor vendido", `${num(total.sinValorVendido)}: cuentan como venta pero suman 0 al valor vendido.`]);
  const r = vista.reconciliacion;
  if (r.sinEnvioDePautaODeOtroPeriodo > 0) {
    notas.push(["Contra Comercial", `En el periodo se cerraron ${num(r.ventasDelPeriodoPorFecha)} ventas; aquí cuentan ${num(r.atribuidasPorCohorteEnPeriodo)} de registros de pauta de este periodo. Las otras ${num(r.sinEnvioDePautaODeOtroPeriodo)} no vienen de pauta o se registraron en otro periodo.`]);
  }
  return notas;
}

/** Las cinco Cifras de una fila de "¿Qué trae ventas?". */
export function filaDeQueTraeVentas(r: RenglonRoas, c: ContextoDeOrigen, clave: string, nombre = r.nombre): FilaDeQueTraeVentas {
  const filtros: Array<readonly [string, string]> = [];
  if (c.programa) filtros.push(["Programa", c.programa]);
  filtros.push(["Área", "Paid"]);
  if (r.nivel !== "total") filtros.push([etiquetaDeNivel(r.nivel), nombre]);
  filtros.push(["Periodo", c.periodo]);
  const periodo = `${r.nivel === "total" ? "toda la pauta" : `${etiquetaDeNivel(r.nivel).toLowerCase()} ${nombre}`}, ${c.periodo}`;
  const base = { filtros, periodo };
  const sinGasto = r.gastoCop === null ? SIN_GASTO_CANAL : r.nivel === "sin_anuncio" ? SIN_GASTO : null;
  const inversion = r.gastoCop === null || r.nivel === "sin_anuncio" ? null : r.gastoCop;
  const costo = inversion === null || r.agendas === 0 ? null : inversion / r.agendas;
  const roas = r.roas;
  return {
    clave,
    nombre,
    nivel: r.nivel,
    id: r.id,
    revisar: (r.nivel === "anuncio" || r.nivel === "anuncio_sin_identificar") && (r.gastoCop ?? 0) > 0 && r.agendas === 0,
    conDetalle: r.nivel === "campana" && r.id !== null,
    inversion: armarCifra({
      ...base, concepto: "inversion", explicacion: explicacionDe("inversion", VARIANTES_DE_PAUTA.inversion_origen), valor: inversion,
      motivo: sinGasto ?? undefined,
    }),
    agendas: armarCifra({
      ...base, concepto: "agendadas", explicacion: explicacionDe("agendadas", VARIANTES_DE_PAUTA.agendas_origen), valor: r.agendas,
      lista: c.enlace ? listaDeOrigen(c.vista, r, "agenda", c.enlace) : undefined,
      notas: r.agendas > 0 ? [["Con resultado", `${num(r.shows)} asistieron y ${num(r.noShows)} no asistieron.`]] : undefined,
    }),
    costo: armarCifra({
      ...base, concepto: "costo_agenda_crm", explicacion: explicacionDe("costo_agenda_crm", VARIANTES_DE_PAUTA.costo_agenda_origen), valor: costo,
      partes: inversion === null ? undefined : [inversion, r.agendas],
      motivo: costo === null ? sinGasto ?? (r.agendas === 0 ? "Sin agendadas: no hay entre qué dividir." : undefined) : undefined,
    }),
    ventas: armarCifra({
      ...base, concepto: "ventas", explicacion: explicacionDe("ventas", VARIANTES_DE_PAUTA.ventas_origen), valor: r.ventas,
      lista: c.enlace ? listaDeOrigen(c.vista, r, "venta", c.enlace) : undefined,
      notas: r.ventas > 0 ? [
        ["Cuándo", `${num(r.ventasEnLlamada)} en la llamada, ${num(r.ventasDespues)} después y ${num(r.ventasSinLlamada)} sin llamada.`],
        ["Pago", `${num(r.ventasCompletas)} completas y ${num(r.ventasParciales)} con abono.`],
        ["Valor vendido", `${usd(r.valorVendidoUsd)}${r.sinValorVendido > 0 ? `; ${num(r.sinValorVendido)} sin valor escrito por el closer` : ""}.`],
      ] : undefined,
    }),
    roas: armarCifra({
      ...base, concepto: "roas", explicacion: explicacionDe("roas"),
      valor: sinGasto ? null : roas.valor,
      motivo: sinGasto ?? (roas.valor === null ? roas.motivo ?? "No se puede calcular con los datos del periodo." : undefined),
      partes: sinGasto || r.gastoUsd === null ? undefined : [r.valorVendidoUsd, r.gastoUsd],
      parcial: !sinGasto && roas.valor !== null && roas.faltan > 0 ? `${num(roas.faltan)} de ${num(roas.base + roas.faltan)} ventas vienen de días sin gasto cargado.` : undefined,
      notas: r.nivel === "total" ? notasDelRoasTotal(c.vista) : undefined,
    }),
  };
}

/** Las filas de la vista elegida, en el orden de la tabla. La fila Total va siempre primero. */
export function filasDeQueTraeVentas(c: ContextoDeOrigen, verPor: VerPorOrigen): FilaDeQueTraeVentas[] {
  const { vista } = c;
  const filas = [filaDeQueTraeVentas(vista.total, c, "total")];
  const conActividad = (r: RenglonRoas) => r.registros > 0 || r.agendas > 0 || r.ventas > 0;
  if (verPor === "canal") {
    for (const r of vista.canales) filas.push(filaDeQueTraeVentas(r, c, `canal:${r.id}`));
    return filas;
  }
  if (verPor === "cuenta") {
    for (const r of vista.cuentas) filas.push(filaDeQueTraeVentas(r, c, `cuenta:${r.id}`));
    return filas;
  }
  if (verPor === "campana") {
    for (const r of vista.campanas) filas.push(filaDeQueTraeVentas(r, c, `campana:${r.id}`));
  } else {
    const nombreDeCampana = new Map(vista.campanas.map((r) => [r.id, r.nombre]));
    const anuncios = [...vista.anuncios].sort((a, b) => (b.gastoCop ?? 0) - (a.gastoCop ?? 0));
    for (const r of anuncios) filas.push(filaDeQueTraeVentas(r, c, `anuncio:${r.id}`));
    for (const r of vista.anunciosSinIdentificar) {
      const campana = nombreDeCampana.get(r.padreId) ?? r.padreId;
      filas.push(filaDeQueTraeVentas(r, c, `sin-identificar:${r.id}`, `${r.nombre} · ${campana}`));
    }
  }
  if (conActividad(vista.sinAnuncio)) filas.push(filaDeQueTraeVentas(vista.sinAnuncio, c, "sin-anuncio"));
  return filas;
}

/** "¿Qué llega sin origen?" (diseño §5.2): las dos cifras, de los mismos renglones del ROAS. */
export function cifrasDeSinOrigen(c: ContextoDeOrigen): CifraDeMetrica[] {
  const { vista } = c;
  const filtros: Array<readonly [string, string]> = [];
  if (c.programa) filtros.push(["Programa", c.programa]);
  filtros.push(["Área", "Paid"], ["Periodo", c.periodo]);
  const registrosPauta = vista.total.registros;
  const sinAnuncio = vista.cobertura.soloCampanaOConjunto + vista.cobertura.sinCampana;
  const ventasSinAnuncio = vista.sinAnuncio.ventas + vista.anunciosSinIdentificar.reduce((n, r) => n + r.ventas, 0);
  const porcentaje = registrosPauta === 0 ? null : Math.round((sinAnuncio / registrosPauta) * 100);
  return [
    armarCifra({
      concepto: "envios_sin_id", explicacion: explicacionDe("envios_sin_id"), valor: sinAnuncio, filtros, periodo: c.periodo,
      linea: { antes: "de ", cifra: num(registrosPauta), despues: ` registros de pauta${porcentaje === null ? "" : ` (${porcentaje} %)`}` },
      notas: [
        ["Hasta la campaña", `${num(vista.cobertura.soloCampanaOConjunto)} registros: se sabe la campaña o el conjunto, no el anuncio.`],
        ["Sin campaña", `${num(vista.cobertura.sinCampana)} registros: solo se sabe que son de pauta.`],
        ["Hasta el anuncio", `${num(vista.cobertura.anuncio)} registros traen su anuncio.`],
      ],
    }),
    armarCifra({
      concepto: "ventas_sin_anuncio", explicacion: explicacionDe("ventas_sin_anuncio"), valor: ventasSinAnuncio, filtros, periodo: c.periodo,
      linea: { antes: "de ", cifra: num(vista.total.ventas), despues: " ventas de pauta" },
    }),
  ];
}
