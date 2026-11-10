import { tasa } from "@/components/dashboard/piezas";
import type { SeccionDeInfo } from "@/components/hub/info-de-pagina";
import { BarraDeEjemplo, Formula, Frase, Palabras, Pasos } from "@/components/hub/piezas-de-info";
import type { ProgramaDelReporte } from "@/components/dashboard/hoy/tipos";
import { num } from "@/lib/format";
import { definicion, nombreCorto, nombreLargo } from "@/lib/vocabulario-metricas";
import { textoDeRazon } from "@/lib/cobertura";
import { pct } from "@/lib/format";

/**
 * Lo que explica el botón Info de Hoy (378): una tarjeta por sección, en el orden de la página y con las
 * cifras reales del programa cuando hay uno solo en pantalla. Cada `id` es el de su bloque en la página.
 * No calcula nada: lee lo que ya trae el reporte.
 */
export function seccionesDeInfoDeHoy(programas: ProgramaDelReporte[]): SeccionDeInfo[] {
  const uno = programas.length === 1 ? programas[0].reporte : null;
  const e = uno?.vista.embudo;
  const p = uno?.proyeccion;

  const leadsQueHacenFalta = (() => {
    if (!p) return <Frase>Cada programa lo calcula con sus propias tasas: ábrelo con un solo programa para ver los números.</Frase>;
    const c = p.supuestos.conversion;
    const origen = c.origen === "objetivo_cohorte" ? "objetivo de la cohorte" : c.origen === "cohorte_anterior" ? `cohorte anterior${c.cohorteCodigo ? ` (${c.cohorteCodigo})` : ""}` : c.origen === "cohorte_en_curso" ? `cohorte en curso${c.cohorteCodigo ? ` (${c.cohorteCodigo})` : ""}${c.madurando ? ", madurando" : ""}` : "sin medición suficiente";
    const muestra = c.muestra ? `${num(c.muestra.personas)} personas con cita, ${num(c.muestra.shows)} asistentes` : undefined;
    const renglones = [
      { nombre: "Cupos que faltan", valor: num(p.faltan), origen: "Objetivo de la cohorte menos lo vendido" },
      { operador: "÷" as const, nombre: "Días hábiles que quedan", valor: num(p.diasHabilesRestantes), origen: "Contando hoy; sábados y domingos no cuentan" },
      ...(c.objetivoAgendaAVenta !== null
        ? [{ operador: "÷" as const, nombre: "De cada 100 citas, las que terminan en venta", valor: tasa(c.objetivoAgendaAVenta), origen: `Objetivo escrito en Configuración (${origen})` }]
        : [
          { operador: "÷" as const, nombre: nombreLargo("cierre_de_ventas"), valor: textoDeRazon(c.razonCierre, pct), origen: `${origen}${muestra ? ` · ${muestra}` : ""}` },
          { operador: "÷" as const, nombre: nombreLargo("asistencia"), valor: textoDeRazon(c.razonShow, pct), origen },
        ]),
      { operador: "÷" as const, nombre: "Citas por cada lead", valor: tasa(p.supuestos.agendasPorRegistro), origen: `${num(p.supuestos.agendasVentana)} citas de ${num(p.supuestos.registrosVentana)} leads en los últimos ${num(p.supuestos.diasHabilesVentana)} días hábiles` },
    ];
    return <>
      <Formula renglones={renglones} resultado={{ nombre: nombreLargo("leads_que_hacen_falta"), valor: p.leadsRequeridosDia.valor === null ? "—" : num(p.leadsRequeridosDia.valor, 0) }} />
      {p.leadsRequeridosDia.valor === null ? <Frase>{p.leadsRequeridosDia.razon}</Frase> : null}
    </>;
  })();

  return [
    {
      id: "cifras",
      titulo: "Las cuatro cifras",
      contenido: <Palabras items={[
        { palabra: nombreCorto("cupos_vendidos"), significa: definicion("cupos_vendidos") },
        { palabra: nombreCorto("objetivo_del_dia"), significa: "Lo que falta por vender de la cohorte, repartido entre los días hábiles que quedan." },
        { palabra: "Leads de hoy", significa: "Formularios completos que llegaron hoy." },
        { palabra: nombreCorto("objetivo_de_leads"), significa: definicion("objetivo_de_leads") },
        { palabra: "Entró a caja hoy", significa: definicion("entro_a_caja") },
        { palabra: nombreLargo("asistencia"), significa: definicion("asistencia") },
      ]} />,
    },
    {
      id: "leads-que-hacen-falta",
      titulo: nombreLargo("leads_que_hacen_falta"),
      contenido: <>
        <Frase>{definicion("leads_que_hacen_falta")}</Frase>
        {leadsQueHacenFalta}
      </>,
    },
    {
      id: "embudo",
      titulo: "Del lead a la venta",
      contenido: <>
        <Pasos pasos={[
          { titulo: "Leads", valor: uno ? num(uno.registros) : undefined },
          { titulo: nombreCorto("citas_del_dia"), valor: e ? num(e.agendas) : undefined },
          { titulo: nombreCorto("citas_realizadas"), valor: e ? num(e.llamadasConShow) : undefined },
          { titulo: nombreCorto("cupos_vendidos"), valor: e ? num(e.cierres) : undefined },
        ]} />
        {uno && e ? <BarraDeEjemplo etiqueta="Así se llena una barra" parte={e.agendas} total={Math.max(uno.registros, e.agendas, e.llamadasConShow, e.cierres, 1)} textoParte={`${num(e.agendas)} citas de ${num(Math.max(uno.registros, e.agendas, e.llamadasConShow, e.cierres, 1))} (la barra más larga = 100 %)`} /> : <Frase>La barra más larga es el 100 %; las demás se miden contra ella.</Frase>}
        {e ? <Formula
          renglones={[
            { nombre: "Personas que asistieron", valor: num(e.grupo.conShow) },
            { operador: "÷", nombre: "Personas con cita que ya ocurrió y resultado marcado", valor: num(e.grupo.deals), origen: "Una persona cuenta una vez aunque haya reagendado; las citas sin resultado quedan fuera" },
          ]}
          resultado={{ nombre: nombreLargo("asistencia"), valor: textoDeRazon(e.razonShow, pct) }}
        /> : null}
        {uno ? <Formula
          renglones={[
            { nombre: "Citas realizadas", valor: num(uno.showPorCita.realizadas) },
            { operador: "÷", nombre: "Citas que ya debían ocurrir", valor: num(uno.showPorCita.citasQueYaDebianOcurrir), origen: "Las canceladas no entran; las de hoy que aún no llegan, tampoco" },
          ]}
          resultado={{ nombre: nombreLargo("show_por_cita"), valor: tasa(uno.showPorCita.porcentaje) }}
        /> : null}
        {e ? <Formula
          renglones={[
            { nombre: "Personas que asistieron y compraron", valor: num(e.grupo.vendidos) },
            { operador: "÷", nombre: "Personas que asistieron", valor: num(e.grupo.conShow) },
          ]}
          resultado={{ nombre: nombreLargo("cierre_de_ventas"), valor: textoDeRazon(e.razonCierre, pct) }}
        /> : null}
        {uno && uno.showPorCita.sinMarcar > 0
          ? <Frase>Parcial: {num(uno.showPorCita.sinMarcar)} de las {num(uno.showPorCita.citasQueYaDebianOcurrir)} citas siguen sin resultado marcado por el closer. No son no shows: son datos que faltan. Si ninguna tiene resultado, la asistencia se ve como —.</Frase>
          : <Frase>Si faltan resultados por marcar, la asistencia se ve como parcial y dice cuántas citas faltan.</Frase>}
        <Frase>Los leads y las citas son hechos del mismo día, no necesariamente de las mismas personas.</Frase>
      </>,
    },
    {
      id: "dinero",
      titulo: "Dinero del día",
      contenido: <Palabras items={[
        { palabra: nombreCorto("vendido"), significa: definicion("vendido") },
        { palabra: nombreCorto("recaudado"), significa: definicion("recaudado") },
        { palabra: nombreCorto("por_cobrar"), significa: definicion("por_cobrar") },
        { palabra: nombreCorto("entro_a_caja"), significa: definicion("entro_a_caja") },
        { palabra: "Cómo nació", significa: "Agenda del día: la persona tuvo su llamada hoy. Seguimiento: su última llamada fue antes. Sin llamada: nunca tuvo una." },
      ]} />,
    },
    {
      id: "citas",
      titulo: "Citas del día",
      contenido: <>
        <Palabras items={[
          { palabra: nombreCorto("citas_del_dia"), significa: definicion("citas_del_dia") },
          { palabra: nombreCorto("citas_realizadas"), significa: definicion("citas_realizadas") },
          { palabra: nombreCorto("citas_canceladas"), significa: definicion("citas_canceladas") },
          { palabra: nombreCorto("citas_pendientes"), significa: definicion("citas_pendientes") },
        ]} />
        <Frase>La lista muestra cada cita con lo que pasó y agrupada por closer. Cada fila abre el negocio.</Frase>
      </>,
    },
    {
      id: "pendientes",
      titulo: "Alertas y pendientes",
      contenido: <Palabras items={[
        { palabra: "Citas de mañana", significa: "Citas con fecha de mañana que siguen vivas." },
        { palabra: "Sin Grain", significa: "Citas realizadas a las que falta pegar el enlace de la grabación." },
        { palabra: "Sin valor vendido", significa: "Personas atendidas a las que el closer no les escribió el valor vendido." },
        { palabra: "Alertas por persistencia", significa: "Una cifra por debajo de lo aceptable varios días hábiles seguidos." },
      ]} />,
    },
    {
      id: "semana",
      titulo: "La semana",
      contenido: uno ? (() => {
        const semana = uno.horizontes.find((h) => h.clave === "semana")!;
        const { dia, total } = uno.contexto.semana;
        const esperado = semana.meta === null || total === 0 ? null : (semana.meta * dia) / total;
        return <Formula
          renglones={[
            { nombre: nombreCorto("objetivo_semana"), valor: semana.meta === null ? "—" : num(semana.meta, 1), origen: "La parte del objetivo del mes que toca esta semana" },
            { operador: "×", nombre: "Días hábiles que van", valor: `${num(dia)} de ${num(total)}` },
          ]}
          resultado={{ nombre: nombreCorto("esperado_a_hoy"), valor: esperado === null ? "—" : num(esperado, 1) }}
        />;
      })() : <Frase>Esperado a hoy = objetivo de la semana × días hábiles que van ÷ días hábiles de la semana.</Frase>,
    },
    {
      id: "objetivos",
      titulo: "Objetivos del mes y la cohorte",
      contenido: <>
        <BarraDeEjemplo etiqueta="Ejemplo: cómo se llena la barra" parte={30} total={50} textoParte="llevamos 30 de un objetivo de 50" />
        <Palabras items={[
          { palabra: nombreCorto("llevamos"), significa: "Lo vendido desde que empezó el periodo. Es lo que llena la barra." },
          { palabra: "Deberías ir en", significa: "Lo esperado a hoy: lo que habría que llevar si se vendiera parejo cada día." },
          { palabra: nombreCorto("faltan"), significa: definicion("faltan") },
          { palabra: nombreCorto("por_dia_habil"), significa: definicion("por_dia_habil") },
          { palabra: nombreCorto("proyeccion"), significa: definicion("proyeccion") },
        ]} />
        <Frase>Este bloque no cambia con la fecha ni con los filtros.</Frase>
      </>,
    },
    {
      id: "configuracion",
      titulo: "Qué se puede configurar",
      contenido: <Palabras items={[
        { palabra: nombreCorto("objetivo_de_leads"), significa: definicion("objetivo_de_leads") },
        { palabra: nombreCorto("dias_del_ritmo"), significa: definicion("dias_del_ritmo") },
        { palabra: nombreCorto("citas_minimas"), significa: definicion("citas_minimas") },
      ]} />,
    },
  ];
}
