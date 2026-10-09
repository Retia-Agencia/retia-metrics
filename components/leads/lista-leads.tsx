"use client";

import { useMemo, useSyncExternalStore } from "react";
import Link from "next/link";
import { Check, Columns3 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  claveDeColumnas,
  COLUMNAS_POR_DEFECTO,
  guardarColumnas,
  leerColumnas,
  type ColumnasFormulario,
} from "@/lib/leads/columnas-formulario";

/** `localStorage`, o null si el navegador no lo deja tocar (modo privado, bloqueado). */
function almacenamiento(): Storage | null {
  try {
    return typeof window !== "undefined" ? window.localStorage : null;
  } catch {
    return null;
  }
}

/** El texto guardado tal cual (una cadena se compara por valor: snapshot estable). */
function leerCrudo(clave: string): string | null {
  try {
    return almacenamiento()?.getItem(clave) ?? null;
  } catch {
    return null;
  }
}

const oyentesColumnas = new Set<() => void>();

function suscribirColumnas(oyente: () => void): () => void {
  oyentesColumnas.add(oyente);
  window.addEventListener("storage", oyente);
  return () => {
    oyentesColumnas.delete(oyente);
    window.removeEventListener("storage", oyente);
  };
}

function avisarColumnas(): void {
  for (const oyente of oyentesColumnas) oyente();
}

/**
 * Una fila de la lista de Leads, ya con todo lo que la vista pinta resuelto en el servidor: la
 * página es un Server Component y este es su isla cliente (ticket 209). Las cadenas van listas
 * para mostrar (`etapaNombre`, `fechaTexto`) porque el nombre de etapa vive en un módulo que carga
 * `lib/db` y no puede entrar al bundle del cliente (AGENTS.md).
 */
export interface FilaLeadVista {
  id: string;
  href: string;
  nombre: string | null;
  email: string;
  telefono: string | null;
  leadQuality: string | null;
  leadValue: string | null;
  tieneDeal: boolean;
  soloParciales: boolean;
  correosSinConfirmar: number;
  /** El nombre de la etapa del deal, o `null` si el lead no tiene deal. */
  etapaNombre: string | null;
  /** "source / medium" del último envío, o `null` ("Sin UTM"). */
  canal: string | null;
  /** La fecha del último envío ya formateada en Bogotá, o `null`. */
  fechaTexto: string | null;
  /** Número de aplicaciones, ya formateado. */
  aplicacionesTexto: string;
  numAplicaciones: number;
}

export interface ListaLeadsProps {
  vista: "tarjetas" | "tabla";
  filas: FilaLeadVista[];
  /** Las preguntas del formulario disponibles como columnas (texto crudo, del programa). */
  preguntas: string[];
  /** Por lead, el mapa `pregunta -> respuesta` de su último envío. */
  respuestasPorLead: Record<string, Record<string, string>>;
  /** Para recordar la elección por usuario y programa en el navegador. */
  userId: string;
  programId: string;
}

/**
 * La lista de Leads (ticket 072) con el control "Mostrar respuestas del formulario" (ticket 209,
 * A-105): el setter elige qué preguntas ver como columnas extra, como ocultar columnas en Sheets.
 * "Canal" entra al mismo selector (se puede ocultar), sin regla por rol. Por defecto la lista se ve como antes.
 *
 * La elección se recuerda por usuario y programa en localStorage, envuelta en try/catch: si el
 * almacenamiento falla, la lista se ve como siempre (Canal visible, sin respuestas). Las respuestas largas se truncan con
 * CSS y el texto completo aparece al pasar el cursor y al tocar (atributo `title`), en la tabla y
 * en las tarjetas. Tinta (§9): sin color/sombra/radio a mano, el acento morado solo en el chip
 * activo del Button.
 */
export function ListaLeads({ vista, filas, preguntas, respuestasPorLead, userId, programId }: ListaLeadsProps) {
  const clave = useMemo(() => claveDeColumnas(userId, programId), [userId, programId]);
  // La preferencia se lee del navegador como almacen externo: el servidor y el primer render
  // del cliente usan el defecto (snapshot del servidor `null`) y luego se aplica la guardada.
  // Un cambio en otra pestaña llega por el evento `storage`.
  const crudo = useSyncExternalStore(suscribirColumnas, () => leerCrudo(clave), () => null);
  const columnas = useMemo<ColumnasFormulario>(
    () => (crudo === null ? COLUMNAS_POR_DEFECTO : leerColumnas(almacenamiento(), clave)),
    [crudo, clave],
  );

  const guardar = (siguiente: ColumnasFormulario) => {
    guardarColumnas(almacenamiento(), clave, siguiente);
    avisarColumnas();
  };

  const alternarCanal = () => guardar({ ...columnas, canal: !columnas.canal });
  const alternarPregunta = (pregunta: string) => {
    const activa = columnas.preguntas.includes(pregunta);
    guardar({
      ...columnas,
      preguntas: activa ? columnas.preguntas.filter((p) => p !== pregunta) : [...columnas.preguntas, pregunta],
    });
  };

  // Solo las preguntas elegidas que de verdad existen hoy en el programa, en el orden del catálogo.
  const preguntasVisibles = preguntas.filter((p) => columnas.preguntas.includes(p));
  const nActivas = (columnas.canal ? 1 : 0) + preguntasVisibles.length;

  const selector = (
    <Popover>
      <PopoverTrigger
        render={<Button type="button" variant="outline" size="sm" className="aria-expanded:border-ring" />}
      >
        <Columns3 aria-hidden className="size-3.5" />
        Mostrar respuestas del formulario
        {nActivas > 0 ? (
          <>
            {" · "}
            <span className="cifra">{nActivas}</span>
          </>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" aria-label="Columnas de la lista">
        <div className="space-y-1">
          <OpcionColumna etiqueta="Canal" activa={columnas.canal} onAlternar={alternarCanal} />
          {preguntas.length > 0 ? (
            <>
              <p className="px-1.5 pt-2 pb-1 text-xs text-muted-foreground">Respuestas del formulario</p>
              <div className="max-h-72 overflow-y-auto">
                {preguntas.map((pregunta) => (
                  <OpcionColumna
                    key={pregunta}
                    etiqueta={pregunta}
                    activa={columnas.preguntas.includes(pregunta)}
                    onAlternar={() => alternarPregunta(pregunta)}
                  />
                ))}
              </div>
            </>
          ) : (
            <p className="px-1.5 pt-2 text-xs text-muted-foreground">
              Este programa todavía no tiene respuestas de formulario para mostrar.
            </p>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );

  if (filas.length === 0) {
    return (
      <>
        <div className="mb-2 flex justify-end">{selector}</div>
        <p className="text-sm text-muted-foreground">No hay leads con estos filtros.</p>
      </>
    );
  }

  return (
    <>
      <div className="mb-2 flex justify-end">{selector}</div>
      {vista === "tarjetas" ? (
        <ul className="divide-y divide-border">
          {filas.map((f) => {
            const respuestas = respuestasPorLead[f.id] ?? {};
            return (
              <li
                key={f.id}
                className="relative flex flex-wrap items-start justify-between gap-2 rounded-md px-2 py-3 text-sm hover:bg-muted/50"
              >
                <div className="min-w-0 space-y-1">
                  <Link
                    href={f.href}
                    className="block truncate font-medium text-marca-texto underline-offset-2 outline-none after:absolute after:inset-0 hover:underline focus-visible:ring-3 focus-visible:ring-ring/50"
                  >
                    {f.nombre ?? f.email}
                  </Link>
                  {f.nombre ? <p className="truncate text-xs text-muted-foreground">{f.email}</p> : null}
                  <div className="flex flex-wrap items-center gap-1.5">
                    {f.leadQuality ? (
                      <Badge variant="neutro">{f.leadQuality}</Badge>
                    ) : (
                      <Badge
                        variant="alerta"
                        className="relative z-10"
                        title="El formulario no mandó lead_quality: su deal entró en Registrado o Potencial."
                      >
                        Sin calidad
                      </Badge>
                    )}
                    {f.tieneDeal ? <Badge variant="info">Con deal</Badge> : null}
                    {f.soloParciales ? <Badge variant="alerta">Abandonó el formulario</Badge> : null}
                    {f.correosSinConfirmar > 0 ? <Badge variant="alerta">Posible duplicado</Badge> : null}
                    {f.leadValue ? <Badge variant="secondary">{f.leadValue}</Badge> : null}
                  </div>
                  {columnas.canal || preguntasVisibles.length > 0 ? (
                    <dl className="relative z-10 space-y-0.5 pt-1 text-xs">
                      {columnas.canal ? (
                        <CampoTarjeta etiqueta="Canal" valor={f.canal ?? "Sin UTM"} />
                      ) : null}
                      {preguntasVisibles.map((pregunta) => (
                        <CampoTarjeta key={pregunta} etiqueta={pregunta} valor={respuestas[pregunta] ?? "—"} />
                      ))}
                    </dl>
                  ) : null}
                </div>
                <div className="text-right text-xs text-muted-foreground">
                  {f.fechaTexto ? <p>{f.fechaTexto}</p> : null}
                  <p>
                    <span className="cifra">{f.aplicacionesTexto}</span>{" "}
                    {f.numAplicaciones === 1 ? "aplicación" : "aplicaciones"}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      ) : (
        <table className="min-w-[56rem] w-full border-collapse text-sm">
          <thead className="sticky top-0 bg-card text-left text-xs text-muted-foreground">
            <tr className="border-b whitespace-nowrap">
              <th className="px-2 py-1.5 font-medium">Nombre</th>
              <th className="px-2 py-1.5 font-medium">Correo</th>
              <th className="px-2 py-1.5 font-medium">Teléfono</th>
              <th className="px-2 py-1.5 font-medium">Calidad</th>
              <th className="px-2 py-1.5 font-medium">Etapa del deal</th>
              {columnas.canal ? <th className="px-2 py-1.5 font-medium">Canal</th> : null}
              {preguntasVisibles.map((pregunta) => (
                <th key={pregunta} className="max-w-56 truncate px-2 py-1.5 font-medium" title={pregunta}>
                  {pregunta}
                </th>
              ))}
              <th className="px-2 py-1.5 font-medium">Último envío</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => {
              const respuestas = respuestasPorLead[f.id] ?? {};
              const clase = "block px-2 py-1.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50";
              return (
                <tr key={f.id} className="cursor-pointer border-b hover:bg-muted/50">
                  <td className="whitespace-nowrap">
                    <Link href={f.href} className={`${clase} font-medium text-marca-texto`}>
                      {f.nombre ?? f.email}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={f.href} tabIndex={-1} className={clase}>
                      {f.email}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={f.href} tabIndex={-1} className={`${clase} cifra`}>
                      {f.telefono ?? "—"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={f.href} tabIndex={-1} className={clase}>
                      {f.leadQuality ?? "Sin calidad"}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap">
                    <Link href={f.href} tabIndex={-1} className={clase}>
                      {f.etapaNombre ?? "Sin deal"}
                    </Link>
                  </td>
                  {columnas.canal ? (
                    <td className="whitespace-nowrap">
                      <Link href={f.href} tabIndex={-1} className={clase}>
                        {f.canal ?? "Sin UTM"}
                      </Link>
                    </td>
                  ) : null}
                  {preguntasVisibles.map((pregunta) => (
                    <td key={pregunta} className="max-w-56 align-top">
                      <CeldaRespuesta href={f.href} clase={clase} valor={respuestas[pregunta] ?? "—"} />
                    </td>
                  ))}
                  <td className="whitespace-nowrap">
                    <Link href={f.href} tabIndex={-1} className={`${clase} cifra`}>
                      {f.fechaTexto ?? "—"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </>
  );
}

/** Una opción del selector: una fila que alterna una columna, con el check a la izquierda. */
function OpcionColumna({
  etiqueta,
  activa,
  onAlternar,
}: {
  etiqueta: string;
  activa: boolean;
  onAlternar: () => void;
}) {
  return (
    <button
      type="button"
      role="menuitemcheckbox"
      aria-checked={activa}
      onClick={onAlternar}
      className="flex w-full items-start gap-2 rounded-md px-1.5 py-1 text-left text-sm outline-none hover:bg-accent focus-visible:bg-accent"
    >
      <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center text-marca-texto" aria-hidden>
        {activa ? <Check className="size-4" /> : null}
      </span>
      <span className="min-w-0 break-words">{etiqueta}</span>
    </button>
  );
}

/** Un campo extra en la tarjeta: la pregunta como etiqueta y la respuesta truncada (completa al tocar). */
function CampoTarjeta({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div className="flex gap-1.5">
      <dt className="shrink-0 font-medium text-muted-foreground">{etiqueta}:</dt>
      <dd className="line-clamp-2 min-w-0 break-words" title={valor}>
        {valor}
      </dd>
    </div>
  );
}

/** Una celda de respuesta en la tabla: truncada con CSS, el texto completo al pasar el cursor o tocar. */
function CeldaRespuesta({ href, clase, valor }: { href: string; clase: string; valor: string }) {
  return (
    <Link href={href} tabIndex={-1} className={clase} title={valor}>
      <span className="line-clamp-2 break-words">{valor}</span>
    </Link>
  );
}
