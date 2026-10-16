import Link from "next/link";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { administraGlobal, configuraPrograma, editaObjetivo, leePrograma, veEquipoComercial, type Rol } from "@/lib/auth/roles";
import { programaDeLaFichaPorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import {
  fichaDelPrograma,
  faltaParaActivar,
  fuentesDelProgramaParaAdmin,
  type CohorteVista,
} from "@/lib/queries/ficha-programa";
import { fecha, hoyEnBogota, num, usd } from "@/lib/format";
import { costoPorAgendaDeLosUltimosHabiles } from "@/lib/semaforo/costo-por-agenda";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, pestanaActiva, urlConSeccion, type GrupoDePestanas } from "@/components/layout/pestanas";
import { CohortesAdmin } from "@/components/cohortes-admin";
import { FuentesAdmin } from "@/components/admin/fuentes-admin";
import { listarUsuarios, membresiasConCalendly } from "@/lib/catalogo/usuarios";
import { cuentasPorPrograma } from "@/lib/calendly/cuentas";
import { puedeSerMiembro } from "@/lib/auth/roles";
import { PlataformasDelPrograma } from "./plataformas-del-programa";
import { UmbralesDelPrograma } from "./umbrales-del-programa";
import { ObjetivosDeLaCohorte } from "./objetivos-de-la-cohorte";
import {
  DIAS_SEGUIDOS_POR_DEFECTO,
  METRICAS_CON_UMBRAL,
  NOMBRE_DE_METRICA_CON_UMBRAL,
  umbralesDelPrograma,
} from "@/lib/catalogo/umbrales";
import { ActivarPrograma, EditarPrograma } from "./editar-programa";
import { EquipoDelPrograma } from "./equipo-del-programa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  cuentasDelPrograma,
  cuentasDisponibles,
  estadoConexionMeta,
} from "@/lib/catalogo/meta";
import { CuentasDelPrograma } from "@/components/pauta/cuentas-del-programa";
import { cuposSinAsignar, objetivosDeCohortes } from "@/lib/catalogo/objetivos";
import {
  METRICAS_DEL_REPORTE,
  reporteDelPrograma,
} from "@/lib/catalogo/reportes-whatsapp";
import { ReporteWhatsapp } from "@/components/pauta/reporte-whatsapp";
import {
  DEFINICION_METRICAS_OBJETIVO,
  METRICAS_OBJETIVO,
  METRICAS_OFRECIDAS,
} from "@/lib/objetivos/metricas";
import { cohorteAnterior } from "@/lib/objetivos/cohorte-anterior";
import { vistaPreviaDelReporte } from "@/lib/reporte-whatsapp/vista-previa";

export const dynamic = "force-dynamic";

type Props = {
  params: Promise<{ programa: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function uno(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

const ENLACE =
  "font-medium text-marca-texto underline-offset-2 outline-none transition-colors duration-150 hover:underline focus-visible:underline";

const TONO_DE_COHORTE = { activo: "exito", futuro: "info", cerrado: "neutro" } as const;
const NOMBRE_DE_ESTADO_COHORTE = { activo: "Activa", futuro: "Futura", cerrado: "Cerrada" } as const;

/** Proyección visible de la ficha; la página la usa y `paginas.test.ts` fija su contrato por rol. */
export function presentacionDeLaFicha(rol: Rol | null) {
  const configura = configuraPrograma(rol);
  return {
    configura,
    secciones: configura ? ["general", "equipo", "captacion", "ventas"] : ["general", "ventas"],
    muestraComision: veEquipoComercial(rol),
  } as const;
}

/**
 * La tab Programa (ticket 100, la tab Programs del ADR 0050): la ficha del programa elegido,
 * con todo lo que lo define sin entrar a Ajustes: cohortes, destinos (formulario y checkouts),
 * Calendly, fuentes de leads, comisión y equipo.
 *
 * Alcance (ADR 0048): un closer la ve solo en los programas donde tiene membresía activa; un
 * programa ajeno es 404, igual que uno que no existe. La ficha se LEE; quien administra
 * (`esAdministrador`: gerente o developer) edita las cohortes AQUÍ con el mismo
 * `CohortesAdmin` y las mismas acciones de Ajustes (A-10: las cohortes se encuentran desde el
 * programa). Las cuentas de Meta y el reporte por WhatsApp (265) también los configura quien administra.
 * La reja de verdad son las acciones (`requireRole` y alcance del programa), no que el control aparezca.
 *
 * Ningún secreto llega aquí: la ficha dice SI hay token de Calendly y webhook conectado, nunca
 * cuál (ADR 0057); lo garantiza `programaPorId`, que pasa por el mismo `sinToken` del catálogo.
 */
export default async function FichaDelProgramaPage({ params, searchParams }: Props) {
  // La ficha la leen quien administra y quien maneja pauta; el closer recibe 404.
  const session = await paginaConCapacidad(leePrograma);
  const { programa: slug } = await params;
  const rol = await rolDeVista(session);
  const visible = await programaDeLaFichaPorSlug(session.user.id, rol, slug);
  if (!visible) notFound();

  const ficha = await fichaDelPrograma(visible.id, db);
  if (!ficha) notFound();

  const presentacion = presentacionDeLaFicha(rol);
  const { configura } = presentacion;
  const puedeAgregarMiembros = administraGlobal({
    rol,
    alcanceLimitado: session.user.alcanceLimitado,
  });
  const query = await searchParams;
  const { programa, cohortes, checkouts, fuentes, equipo, plataformas, plataformasDisponibles } =
    ficha;
  const activa = cohortes.find((c) => c.estado === "activo") ?? null;
  const faltan = faltaParaActivar(programa);
  const programaParaEditar = {
    id: programa.id,
    slug: programa.slug,
    nombre: programa.nombre,
    ticketUsd: programa.ticketUsd,
    comisionPorcentaje: programa.comisionPorcentaje,
    webUrl: null,
    calendlyUrl: programa.calendlyUrl,
    tieneTokenCalendly: programa.tieneTokenCalendly,
    webhookCalendlyConectado: programa.webhookCalendlyConectado,
    diasSinActividad: programa.diasSinActividad,
    activo: programa.activo,
  };

  const [fuentesAdmin, membresias, usuarios, cuentas] = configura
    ? await Promise.all([
        fuentesDelProgramaParaAdmin(programa.id, db),
        membresiasConCalendly(db, programa.id),
        puedeAgregarMiembros ? listarUsuarios(db) : Promise.resolve([]),
        cuentasPorPrograma(db, [programa.id]),
      ])
    : [null, [], [], {}];
  const miembros = new Set(membresias.map((m) => m.userId));
  // Quién se puede AGREGAR al equipo: quien puede ser miembro de un programa (closer,
  // developer y customer success, ticket 145), no solo quien trabaja leads. Es la pregunta
  // de configuración `puedeSerMiembro` (ADR 0025), nunca `rol === "..."`.
  const elegibles = usuarios
    .filter((usuario) => usuario.activo && puedeSerMiembro(usuario) && !miembros.has(usuario.id))
    .map(({ id, nombre, email }) => ({ id, nombre, email }));
  const base = `/p/${programa.slug}/programa`;
  const todasLasPestanas = [
    {
      id: "general",
      etiqueta: "General",
      descripcion: "El estado del programa y a dónde llevan sus links.",
      href: urlConSeccion(base, query, "general"),
    },
    {
      id: "equipo",
      etiqueta: "Equipo",
      descripcion: "Quién trabaja este programa y con qué rol.",
      href: urlConSeccion(base, query, "equipo"),
    },
    {
      id: "captacion",
      etiqueta: "Captación",
      descripcion: "Por dónde entran los leads y las citas.",
      href: urlConSeccion(base, query, "captacion"),
    },
    {
      id: "ventas",
      etiqueta: "Ventas",
      descripcion: "Las cohortes que se venden, cómo se cobra y cuándo alerta la meta.",
      href: urlConSeccion(base, query, "ventas"),
    },
  ];
  const grupos: GrupoDePestanas[] = [
    {
      pestanas: configura
        ? todasLasPestanas
        : todasLasPestanas.filter((pestana) => presentacion.secciones.includes(pestana.id)),
    },
  ];
  const pestanas = grupos.flatMap((grupo) => grupo.pestanas);
  const seccion = pestanaActiva(uno(query.seccion), pestanas, "general");
  // Los umbrales de las alertas (147) solo se leen en su pestaña.
  const umbrales = seccion === "ventas" ? await umbralesDelPrograma(db, programa.id) : [];
  const objetivos = seccion === "ventas" ? await objetivosDeCohortes(db, cohortes.map((c) => c.id)) : [];
  // El valor de hoy al lado del umbral (264): la misma definición que usa el semáforo (258, ADR 0024).
  const costoReciente = seccion === "ventas"
    ? await costoPorAgendaDeLosUltimosHabiles(db, { programId: programa.id, hoy: hoyEnBogota(), dias: 7 })
    : null;
  // Lo sin asignar sale de la misma función que usa la reja del reparto (ADR 0024: una cifra, un módulo).
  const sinAsignar =
    seccion === "ventas"
      ? await Promise.all(cohortes.map((c) => cuposSinAsignar(db, c.id)))
      : cohortes.map(() => 0);
  const cohortesConObjetivos = cohortes.map((cohorte, i) => {
    const filas = objetivos.filter((objetivo) => objetivo.cohortId === cohorte.id);
    const anterior = cohorteAnterior(cohortes, cohorte.id);
    return {
      id: cohorte.id,
      codigo: cohorte.codigo,
      estado: cohorte.estado,
      cuposSinAsignar: sinAsignar[i],
      tieneObjetivos: filas.length > 0,
      anteriorId: anterior?.id ?? null,
    };
  });
  const metricasObjetivo = METRICAS_OBJETIVO.map((metrica) => ({
    metrica,
    ...DEFINICION_METRICAS_OBJETIVO[metrica],
    ofrecida: METRICAS_OFRECIDAS.includes(metrica),
    puedeEditar: editaObjetivo(rol, DEFINICION_METRICAS_OBJETIVO[metrica].dePauta),
  }));
  const umbralesEditables = METRICAS_CON_UMBRAL.map((metrica) => {
    const fila = umbrales.find((u) => u.metrica === metrica);
    return {
      metrica,
      nombre: NOMBRE_DE_METRICA_CON_UMBRAL[metrica],
      aceptable: fila?.aceptable ?? null,
      diasSeguidos: fila?.diasSeguidos ?? null,
      activo: fila?.activo ?? false,
    };
  });
  const estadoMeta = seccion === "general"
    ? await estadoConexionMeta(db)
    : { conectada: false as const };
  const [cuentasMeta, consultaMeta] = seccion === "general"
    ? await Promise.all([
        cuentasDelPrograma(db, programa.id),
        configura && estadoMeta.conectada
          ? cuentasDisponibles(db)
              .then((disponibles) => ({ disponibles, error: null as string | null }))
              .catch((error: unknown) => ({
                disponibles: [],
                error: error instanceof Error ? error.message : "Error desconocido",
              }))
          : Promise.resolve({ disponibles: [], error: null as string | null }),
      ])
    : [[], { disponibles: [], error: null }];
  const [reporteWhatsapp, objetivosDelReporte] = seccion === "general"
    ? await Promise.all([
        reporteDelPrograma(db, programa.id),
        activa ? objetivosDeCohortes(db, [activa.id]) : Promise.resolve([]),
      ])
    : [null, []];
  const metricasDelReporte = METRICAS_DEL_REPORTE.map((metrica) => ({
    metrica,
    nombre: DEFINICION_METRICAS_OBJETIVO[metrica].nombre,
    tieneUmbral: objetivosDelReporte.some(
      (objetivo) => objetivo.activo && objetivo.area === null && objetivo.metrica === metrica,
    ),
  }));
  const configuracionReporte = reporteWhatsapp
    ? {
        activo: reporteWhatsapp.activo,
        horas: reporteWhatsapp.horas,
        horaCierre: reporteWhatsapp.horaCierre,
        metricas: reporteWhatsapp.metricas.filter((metrica) => metrica === "costo_por_agenda"),
      }
    : null;
  const vistaPrevia = seccion === "general"
    ? await (async () => {
        const encabezados = await headers();
        const origen = `${encabezados.get("x-forwarded-proto") ?? "http"}://${encabezados.get("host")!}`;
        return vistaPreviaDelReporte(db, {
          programId: programa.id,
          programa: programa.nombre,
          slug: programa.slug,
          origen,
          ahora: new Date(),
        });
      })()
    : { dia: null, cierre: null, aviso: null };

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Programa"
      fija
      acciones={
        configura ? (
          <div className="flex items-center gap-2">
            {!programa.activo ? <Badge variant="neutro">Inactivo</Badge> : null}
            <EditarPrograma programa={programaParaEditar} />
          </div>
        ) : null
      }
    >
      <PantallaFija>
        <Pestanas grupos={grupos} activa={seccion} etiqueta="Sección del programa" />

        <div className={clasesDeZonaConScroll()}>
          {seccion === "general" ? (
            <div className="space-y-4">
              {!programa.activo && configura ? (
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-3 space-y-0">
                    <CardTitle className="text-base">Le falta para activarse</CardTitle>
                    <ActivarPrograma id={programa.id} habilitado={faltan.length === 0} />
                  </CardHeader>
                  <CardContent>
                    {faltan.length === 0 ? (
                      <p className="text-sm text-muted-foreground">El programa está listo para activarse.</p>
                    ) : (
                      <ul className="space-y-2 text-sm">
                        {faltan.map((item) => (
                          <li key={item.clave} className="flex items-center justify-between gap-3">
                            <span>{item.texto}</span>
                            {item.clave === "fuente_principal" ? (
                              <Button
                                size="sm"
                                variant="ghost"
                                nativeButton={false}
                                render={<Link href={urlConSeccion(base, query, "captacion")} />}
                              >
                                Ir a Formularios
                              </Button>
                            ) : (
                              <EditarPrograma programa={programaParaEditar} trigger="Editar" />
                            )}
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              ) : null}

              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                <Kpi etiqueta="Ticket de referencia">
                  <p className="cifra text-2xl font-semibold">{usd(Number(programa.ticketUsd))}</p>
                </Kpi>
                {presentacion.muestraComision ? <Kpi etiqueta="Comisión del closer">
                  {programa.comisionPorcentaje == null ? (
                    <Badge variant="alerta">Sin cargar</Badge>
                  ) : (
                    <p className="cifra text-2xl font-semibold">{num(Number(programa.comisionPorcentaje), 2)} %</p>
                  )}
                  <p className="text-xs text-muted-foreground">del valor vendido</p>
                </Kpi> : null}
                <Kpi etiqueta="Cohorte activa">
                  {activa ? (
                    <p className="cifra text-2xl font-semibold">{activa.codigo}</p>
                  ) : (
                    <Badge variant="alerta">Ninguna</Badge>
                  )}
                </Kpi>
                <Kpi etiqueta="Estancado tras">
                  <p className="cifra text-2xl font-semibold">{num(programa.diasSinActividad)}</p>
                  <p className="text-xs text-muted-foreground">días hábiles sin actividad</p>
                </Kpi>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Destinos</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">
                      Formulario{programa.formulario ? ` (fuente principal: ${programa.formulario.fuente})` : ""}
                    </p>
                    {programa.formulario ? (
                      <a
                        href={programa.formulario.url}
                        target="_blank"
                        rel="noreferrer"
                        className={`${ENLACE} break-all`}
                      >
                        {programa.formulario.url}
                      </a>
                    ) : (
                      <div className="space-y-1">
                        <Badge variant="peligro">Sin fuente principal</Badge>
                        <p className="text-muted-foreground">
                          Ningún formulario está marcado como principal: es el que se usa para generar los links de captación (ADR 0068).
                          {configura ? " Edita el formulario, pega su URL pública y márcalo como principal." : ""}
                        </p>
                        {configura ? (
                          <Link href={urlConSeccion(base, query, "captacion")} className={ENLACE}>
                            Ir a Formularios
                          </Link>
                        ) : null}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Cuentas de Meta</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CuentasDelPrograma
                      programId={programa.id}
                      conectada={estadoMeta.conectada}
                      cuentas={cuentasMeta}
                      disponibles={consultaMeta.disponibles}
                      errorDeConsulta={consultaMeta.error}
                      puedeEditar={configura}
                    />
                  </CardContent>
                </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reporte por WhatsApp</CardTitle>
                </CardHeader>
                <CardContent>
                  <ReporteWhatsapp
                    programId={programa.id}
                    configuracion={configuracionReporte}
                    metricasDisponibles={metricasDelReporte}
                    puedeEditar={configura}
                    vistaPrevia={vistaPrevia}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "equipo" ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                  <CardTitle className="text-base">
                    Equipo <span className="cifra text-muted-foreground">· {num(equipo.length)}</span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="text-sm">
                  {configura ? (
                    <EquipoDelPrograma
                      programa={{ id: programa.id, nombre: programa.nombre }}
                      membresias={membresias}
                      elegibles={elegibles}
                      puedeAgregar={puedeAgregarMiembros}
                      cuentas={cuentas}
                    />
                  ) : equipo.length === 0 ? (
                    <p className="text-muted-foreground">
                      Nadie tiene membresía activa en este programa. Quien administra la asigna en Equipo.
                    </p>
                  ) : (
                    <ul className="divide-y divide-border">
                      {equipo.map((m) => (
                        <li key={m.membresiaId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{m.nombre}</p>
                            <p className="truncate text-xs text-muted-foreground">{m.email}</p>
                          </div>
                          {m.calendlyEmail ? (
                            <span className="truncate text-xs text-muted-foreground">Calendly: {m.calendlyEmail}</span>
                          ) : (
                            <Badge variant="alerta">Sin cuenta de Calendly</Badge>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "captacion" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {configura && fuentesAdmin ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Formularios</CardTitle>
                  </CardHeader>
                  <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                    <FuentesAdmin programas={[fuentesAdmin]} />
                  </CardContent>
                </Card>
              ) : (
                <Card>
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">Fuentes de leads</CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                    {fuentes.length === 0 ? (
                      <p className="text-muted-foreground">
                        Este programa no tiene fuentes de leads: ningún formulario le está entregando envíos.
                        Quien administra la crea en Formularios.
                      </p>
                    ) : (
                      <ul className="divide-y divide-border">
                        {fuentes.map((f) => (
                          <li key={f.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                            <div className="min-w-0">
                              <p className="truncate font-medium">{f.nombre}</p>
                              <p className="text-xs text-muted-foreground">{f.proveedor ?? f.tipo}</p>
                            </div>
                            <span className="flex flex-wrap items-center gap-1.5">
                              {f.activo ? <Badge variant="exito">Activa</Badge> : <Badge variant="neutro">Inactiva</Badge>}
                              {f.activo && f.estado === "rota" ? <Badge variant="peligro">Rota</Badge> : null}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>
              )}

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Calendly</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <div className="flex flex-wrap items-center gap-2">
                    {programa.tieneTokenCalendly ? (
                      <Badge variant="exito">Token cargado</Badge>
                    ) : (
                      <Badge variant="peligro">Sin token</Badge>
                    )}
                    {programa.webhookCalendlyConectado ? (
                      <Badge variant="exito">Webhook conectado</Badge>
                    ) : (
                      <Badge variant="alerta">Webhook sin conectar</Badge>
                    )}
                  </div>
                  <p className="text-muted-foreground">
                    {programa.tieneTokenCalendly
                      ? programa.webhookCalendlyConectado
                        ? "Las citas de Calendly llegan solas y se cuelgan del deal cuando no hay duda."
                        : "Hay token, pero el webhook no está conectado: las citas nuevas no llegan solas."
                      : "Sin token no se puede leer la fecha de una cita ni conectar el webhook."}
                  </p>
                  {programa.calendlyUrl ? (
                    <a href={programa.calendlyUrl} target="_blank" rel="noreferrer" className={`${ENLACE} break-all`}>
                      {programa.calendlyUrl}
                    </a>
                  ) : null}
                  <p className="text-xs text-muted-foreground">
                    La cuenta de Calendly de cada closer en este programa está en Equipo.
                  </p>
                </CardContent>
              </Card>
            </div>
          ) : null}

          {seccion === "ventas" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Cohortes</CardTitle>
                </CardHeader>
                <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                  {configura ? (
                    <CohortesAdmin
                      slug={programa.slug}
                      programId={programa.id}
                      ticketUsd={programa.ticketUsd}
                      cohortes={cohortes}
                    />
                  ) : (
                    <ListaDeCohortes cohortes={cohortes} />
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Plataformas de pago</CardTitle>
                </CardHeader>
                <CardContent>
                  <PlataformasDelPrograma
                    programId={programa.id}
                    plataformas={plataformas}
                    disponibles={plataformasDisponibles}
                    enlaces={checkouts.map((c) => ({
                      id: c.id,
                      url: c.url,
                      monto: c.monto,
                      moneda: c.moneda,
                      plataformaId: c.plataformaId,
                    }))}
                    puedeEditar={configura}
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Objetivos de la cohorte</CardTitle>
                </CardHeader>
                <CardContent>
                  <ObjetivosDeLaCohorte
                    cohortes={cohortesConObjetivos}
                    objetivos={objetivos}
                    metricas={metricasObjetivo}
                    valoresDeHoy={{ costo_por_agenda: costoReciente?.costo ?? null }}
                    puedeCopiar={configura}
                  />
                </CardContent>
              </Card>

              <Card className="lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">Alertas por persistencia</CardTitle>
                </CardHeader>
                <CardContent>
                  <UmbralesDelPrograma
                    programId={programa.id}
                    umbrales={umbralesEditables}
                    diasPorDefecto={DIAS_SEGUIDOS_POR_DEFECTO}
                    editable={configura}
                  />
                </CardContent>
              </Card>
            </div>
          ) : null}
        </div>
      </PantallaFija>
    </PageShell>
  );
}

function Kpi({ etiqueta, children }: { etiqueta: string; children: ReactNode }) {
  return (
    <Card>
      <CardContent className="space-y-1 py-4">
        <p className="text-xs text-muted-foreground">{etiqueta}</p>
        {children}
      </CardContent>
    </Card>
  );
}

/** Las cohortes en solo lectura, para quien no administra. */
function ListaDeCohortes({ cohortes }: { cohortes: CohorteVista[] }) {
  if (cohortes.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Este programa todavía no tiene cohortes. Quien administra las crea aquí mismo.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border text-sm">
      {cohortes.map((c) => (
        <li key={c.id} className="grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
          <div className="min-w-0 space-y-1">
            <p className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.codigo}</span>
              <Badge variant={TONO_DE_COHORTE[c.estado]}>{NOMBRE_DE_ESTADO_COHORTE[c.estado]}</Badge>
            </p>
            <p className="text-xs text-muted-foreground">
              Ventas {c.fechaInicioVentas ? `del ${fecha(c.fechaInicioVentas)} ` : ""}al{" "}
              {c.fechaCierreVentas ? fecha(c.fechaCierreVentas) : "Por definir"} · clases
              desde el {c.fechaInicioClases ? fecha(c.fechaInicioClases) : "Por definir"}
            </p>
          </div>
          <p className="text-xs text-muted-foreground">
            Meta <span className="cifra text-foreground">{num(c.metaCupos)}</span> cupos
            {c.metaLeadsDia != null ? (
              <>
                {" "}· <span className="cifra text-foreground">{num(c.metaLeadsDia)}</span> leads por día
              </>
            ) : null}{" "}
            · precio <span className="cifra text-foreground">{usd(Number(c.precioUsd))}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
