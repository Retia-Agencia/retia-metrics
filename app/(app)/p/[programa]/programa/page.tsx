import { Enlace } from "@/components/enlace";
import type { ReactNode } from "react";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { paginaConCapacidad } from "@/lib/auth/page-guards";
import { rolDeVista } from "@/lib/auth/vista";
import { administraUsuarios, configuraPrograma, editaObjetivo, leePrograma, veEquipoComercial, type Rol } from "@/lib/auth/roles";
import { programaDeLaFichaPorSlug } from "@/lib/auth/alcance";
import { db } from "@/lib/db";
import type { CohorteVista } from "@/lib/queries/ficha-programa";
import {
  SECCIONES_DE_LA_FICHA,
  type ClaveDePaso,
} from "@/lib/programas/configuracion";
import { fecha, fechaHoraEnBogota, hoyEnBogota, num, usd } from "@/lib/format";
import { PageShell } from "@/components/page-shell";
import { PantallaFija, clasesDeZonaConScroll } from "@/components/layout/pantalla-fija";
import { Pestanas, urlConSeccion, type GrupoDePestanas } from "@/components/layout/pestanas";
import { SkusDelPrograma } from "@/components/skus-del-programa";
import { listarSkus, slugsDelPrograma } from "@/lib/catalogo/skus";
import { FuentesAdmin } from "@/components/admin/fuentes-admin";
import { puedeSerMiembro } from "@/lib/auth/roles";
import { PlataformasDelPrograma } from "./plataformas-del-programa";
import { UmbralesDelPrograma } from "./umbrales-del-programa";
import { ObjetivosDeLaCohorte } from "./objetivos-de-la-cohorte";
import {
  DIAS_SEGUIDOS_POR_DEFECTO,
  METRICAS_CON_UMBRAL,
  NOMBRE_DE_METRICA_CON_UMBRAL,
} from "@/lib/catalogo/umbrales";
import { ActivarPrograma, EditarPrograma } from "./editar-programa";
import { EquipoDelPrograma } from "./equipo-del-programa";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { METRICAS_DEL_REPORTE } from "@/lib/catalogo/reportes-whatsapp";
import { ReporteWhatsapp } from "@/components/pauta/reporte-whatsapp";
import {
  DEFINICION_METRICAS_OBJETIVO,
  METRICAS_OBJETIVO,
  METRICAS_OFRECIDAS,
} from "@/lib/objetivos/metricas";
import { cohorteAnterior } from "@/lib/objetivos/cohorte-anterior";
import { IntegracionesDelPrograma } from "@/components/integraciones/integraciones-del-programa";
import { RecorridoDeConfiguracion } from "./recorrido-de-configuracion";
import { cargarDatosDePrograma } from "@/lib/programa/cargar-datos";

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
    secciones: configura ? ["programa", "ventas", "integraciones"] : ["programa", "ventas"],
    muestraComision: veEquipoComercial(rol),
  } as const;
}

/**
 * La ficha del programa elegido se reparte en tres pestañas: Programa, Ventas e Integraciones
 * (ADR 0132), con todo lo que lo define sin entrar a Ajustes.
 *
 * Alcance (ADR 0048): un closer la ve solo en los programas donde tiene membresía activa; un
 * programa ajeno es 404, igual que uno que no existe. La ficha se LEE; quien administra
 * (`esAdministrador`: gerente o developer) edita los SKUs y ciclos AQUÍ (A-10: se encuentran
 * desde el programa). Las cuentas de Meta y el reporte por WhatsApp (265) también los configura quien administra.
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

  const presentacion = presentacionDeLaFicha(rol);
  const { configura } = presentacion;
  // ADR 0118: todo gerente agrega existentes; la lista de candidatos ya sale filtrada por su alcance.
  const puedeAgregarMiembros = administraUsuarios(rol);
  const query = await searchParams;
  const encabezados = await headers();
  const origen = `${encabezados.get("x-forwarded-proto") ?? "http"}://${encabezados.get("host")!}`;
  const datos = await cargarDatosDePrograma(db, {
    visibleId: visible.id,
    userId: session.user.id,
    rol,
    busqueda: query,
    hoy: hoyEnBogota(),
    origen,
    ahora: new Date(),
  });
  if (!datos) notFound();
  const {
    ficha,
    enRecorrido,
    activa,
    pasos,
    fuentesAdmin,
    membresias,
    usuarios,
    cuentas,
    seccion,
    umbrales,
    objetivos,
    costoReciente,
    sinAsignar,
    estadosIntegraciones,
    resumenCapi,
    cuentasMeta,
    consultaMeta,
    reporteWhatsapp,
    objetivosDelReporte,
    vistaPrevia,
  } = datos;
  const { programa, cohortes, checkouts, equipo, plataformas, plataformasDisponibles } = ficha;
  const [skus, nombresDeSku] = configura
    ? await Promise.all([listarSkus(db, programa.id), slugsDelPrograma(db, programa.id)])
    : [[], []];
  const faltan = pasos.filter((paso) => paso.exigidoParaActivar && !paso.hecho);
  const recomendados = pasos.filter((paso) => !paso.exigidoParaActivar && !paso.hecho);
  const programaParaEditar = {
    id: programa.id,
    slug: programa.slug,
    nombre: programa.nombre,
    webUrl: null,
    calendlyUrl: programa.calendlyUrl,
    diasSinActividad: programa.diasSinActividad,
    cortePagoRapidoDias: programa.cortePagoRapidoDias,
    activo: programa.activo,
  };

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
      id: SECCIONES_DE_LA_FICHA[0],
      etiqueta: "Programa",
      descripcion: "Sus datos, a dónde llevan sus links y quién lo trabaja.",
      href: urlConSeccion(base, query, SECCIONES_DE_LA_FICHA[0]),
    },
    {
      id: SECCIONES_DE_LA_FICHA[1],
      etiqueta: "Ventas",
      descripcion: "Las cohortes que se venden, cómo se cobra y cuándo alerta la meta.",
      href: urlConSeccion(base, query, SECCIONES_DE_LA_FICHA[1]),
    },
    {
      id: SECCIONES_DE_LA_FICHA[2],
      etiqueta: "Integraciones",
      descripcion: "Formularios, Calendly, Meta y los avisos por WhatsApp.",
      href: urlConSeccion(base, query, SECCIONES_DE_LA_FICHA[2]),
    },
  ];
  const grupos: GrupoDePestanas[] = [
    {
      pestanas: configura
        ? todasLasPestanas
        : todasLasPestanas.filter((pestana) => presentacion.secciones.includes(pestana.id)),
    },
  ];
  const cohortesConObjetivos = cohortes.map((cohorte, i) => {
    const filas = objetivos.filter((objetivo) => objetivo.cohortId === cohorte.id);
    const anterior = cohorteAnterior(cohortes, cohorte.id);
    return {
      id: cohorte.id,
      codigo: cohorte.codigo,
      estado: cohorte.estado,
      metaCupos: cohorte.metaCupos,
      metaLeadsDia: cohorte.metaLeadsDia,
      fechaInicioClases: cohorte.fechaInicioClases,
      fechaInicioVentas: cohorte.fechaInicioVentas,
      fechaCierreVentas: cohorte.fechaCierreVentas,
      notas: cohorte.notas,
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
  const integracionesVisibles = estadosIntegraciones.map((estado) => ({
    ...estado,
    probadaEn: estado.probadaEn ? fechaHoraEnBogota(estado.probadaEn) : null,
    actualizadaEn: estado.actualizadaEn ? fechaHoraEnBogota(estado.actualizadaEn) : null,
  }));
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
        destino: reporteWhatsapp.destino,
        horas: reporteWhatsapp.horas,
        horaCierre: reporteWhatsapp.horaCierre,
        metricas: reporteWhatsapp.metricas.filter((metrica) => metrica === "costo_por_agenda"),
      }
    : null;

  const propsDeIntegraciones = {
    programId: programa.id,
    integraciones: integracionesVisibles,
    cuentasMeta,
    disponiblesMeta: consultaMeta.disponibles,
    errorMeta: consultaMeta.error,
    roundRobin: {
      calendlyUrl: programa.calendlyUrl,
      orgCompartida: programa.calendlyOrgCompartida,
      configurado: programa.calendlyRoundRobinConfigurado,
    },
    resumenCapi,
  };
  const editores = {
    datos: <EditarPrograma programa={programaParaEditar} trigger="Editar datos" />,
    calendly: <IntegracionesDelPrograma {...propsDeIntegraciones} tipos={["calendly"]} />,
    fuente_principal: fuentesAdmin ? <FuentesAdmin programas={[fuentesAdmin]} /> : null,
    equipo: (
      <EquipoDelPrograma
        programa={{ id: programa.id, nombre: programa.nombre }}
        membresias={membresias}
        elegibles={elegibles}
        puedeAgregar={puedeAgregarMiembros}
        cuentas={cuentas}
      />
    ),
    cohorte_activa: (
      configura ? (
        <SkusDelPrograma
          slug={programa.slug}
          programId={programa.id}
          skus={skus}
          nombres={nombresDeSku.flatMap((fila) => fila.nombre ? [fila.nombre] : [])}
          codigosDeCohorte={cohortes.map((cohorte) => cohorte.codigo)}
        />
      ) : <ListaDeCohortes cohortes={cohortes} />
    ),
    plataforma_pago: (
      <PlataformasDelPrograma
        programId={programa.id}
        plataformas={plataformas}
        disponibles={plataformasDisponibles}
        enlaces={checkouts.map((c) => ({
          id: c.id,
          nombre: c.nombre,
          url: c.url,
          monto: c.monto,
          moneda: c.moneda,
          plataformaId: c.plataformaId,
        }))}
        puedeEditar={configura}
      />
    ),
    cuenta_meta: <IntegracionesDelPrograma {...propsDeIntegraciones} tipos={["meta"]} />,
  } satisfies Record<ClaveDePaso, ReactNode>;

  return (
    <PageShell
      titulo={programa.nombre}
      descripcion="Programa"
      // Desde un atajo de Metas del Hub (ticket 310): "Volver" regresa al Hub con su periodo.
      volver={uno(query.desde) ? { desde: uno(query.desde), porDefecto: { href: `/p/${programa.slug}/hub`, etiqueta: "Hub" } } : undefined}
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
        {!enRecorrido ? <Pestanas grupos={grupos} activa={seccion} etiqueta="Sección del programa" /> : null}

        <div className={clasesDeZonaConScroll()}>
          {enRecorrido ? (
            <RecorridoDeConfiguracion
              pasos={pasos}
              editores={editores}
              activar={<ActivarPrograma id={programa.id} habilitado={faltan.length === 0} />}
            />
          ) : null}

          {!enRecorrido && seccion === "programa" ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
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
                <Kpi etiqueta="Pago rápido">
                  {programa.cortePagoRapidoDias == null ? (
                    <Badge variant="alerta">Sin definir</Badge>
                  ) : (
                    <p className="cifra text-2xl font-semibold">{num(programa.cortePagoRapidoDias)}</p>
                  )}
                  <p className="text-xs text-muted-foreground">días hábiles tras la cita (escalera de conversión)</p>
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
                          <Enlace precarga="nunca" href={urlConSeccion(base, query, "integraciones")} className={ENLACE}>
                            Ir a Formularios
                          </Enlace>
                        ) : null}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {configura ? (
                <Card id="equipo" className="scroll-mt-4">
                  <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
                    <CardTitle className="text-base">
                      Equipo <span className="cifra text-muted-foreground">· {num(equipo.length)}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="text-sm">
                    <EquipoDelPrograma
                      programa={{ id: programa.id, nombre: programa.nombre }}
                      membresias={membresias}
                      elegibles={elegibles}
                      puedeAgregar={puedeAgregarMiembros}
                      cuentas={cuentas}
                    />
                  </CardContent>
                </Card>
              ) : null}

              {configura && programa.activo && recomendados.length > 0 ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Pendientes recomendados</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-3 text-sm">
                      {recomendados.map((paso) => (
                        <li key={paso.clave} className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{paso.titulo}</p>
                            <p className="text-muted-foreground">{paso.explicacion}</p>
                          </div>
                          {paso.clave === "datos" ? (
                            <EditarPrograma programa={programaParaEditar} trigger="Configurar" />
                          ) : (
                            <Button
                              size="sm"
                              variant="ghost"
                              nativeButton={false}
                              render={<Enlace precarga="nunca" href={paso.seccion === "programa" ? `#${paso.clave}` : urlConSeccion(base, query, paso.seccion)} />}
                            >
                              Configurar
                            </Button>
                          )}
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                </Card>
              ) : null}
            </div>
          ) : null}

          {!enRecorrido && seccion === "integraciones" ? (
            <div className="space-y-4">
              {fuentesAdmin ? (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Formularios</CardTitle>
                  </CardHeader>
                  <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                    <FuentesAdmin programas={[fuentesAdmin]} />
                  </CardContent>
                </Card>
              ) : null}

              <IntegracionesDelPrograma
                programId={programa.id}
                integraciones={integracionesVisibles}
                cuentasMeta={cuentasMeta}
                disponiblesMeta={consultaMeta.disponibles}
                errorMeta={consultaMeta.error}
                roundRobin={{
                  calendlyUrl: programa.calendlyUrl,
                  orgCompartida: programa.calendlyOrgCompartida,
                  configurado: programa.calendlyRoundRobinConfigurado,
                }}
                resumenCapi={resumenCapi}
              />

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

          {!enRecorrido && seccion === "ventas" ? (
            <div className="grid gap-4 lg:grid-cols-2">
              <Card id="cohortes" className="scroll-mt-4 lg:col-span-2">
                <CardHeader>
                  <CardTitle className="text-base">SKUs y cohortes</CardTitle>
                </CardHeader>
                <CardContent className="md:max-h-[calc(100dvh-18rem)] md:overflow-y-auto">
                  {configura ? (
                    <SkusDelPrograma
                      slug={programa.slug}
                      programId={programa.id}
                      skus={skus}
                      nombres={nombresDeSku.flatMap((fila) => fila.nombre ? [fila.nombre] : [])}
                      codigosDeCohorte={cohortes.map((cohorte) => cohorte.codigo)}
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
                      nombre: c.nombre,
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
                    slug={programa.slug}
                    cohortes={cohortesConObjetivos}
                    objetivos={objetivos}
                    metricas={metricasObjetivo}
                    valoresDeHoy={{ costo_por_agenda: costoReciente?.costo ?? null }}
                    puedeCopiar={configura}
                  />
                </CardContent>
              </Card>

              <Card id="alertas" className="scroll-mt-4 lg:col-span-2">
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
        Este programa todavía no tiene cohortes. Quien administra las crea desde un SKU nuevo.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-border text-sm">
      {cohortes.map((c) => (
        <li id={`cohorte-${c.id}`} key={c.id} className="scroll-mt-4 grid gap-1 py-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
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
            · precio <span className="cifra text-foreground">{c.precioUsd === null ? "Sin precio" : usd(c.precioUsd)}</span>
          </p>
        </li>
      ))}
    </ul>
  );
}
