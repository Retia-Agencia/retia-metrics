import { fechaCorta, fechaHoraEnBogota, monto, num } from "@/lib/format";
import { hostsDeCalendlySinCloser, type HostDeCalendlySinCloser } from "@/lib/calendly/hosts-sin-closer";
import { saludDeFuentes, type SaludDeFuenteConDatos } from "@/lib/queries/salud-fuentes";
import type { Db } from "@/lib/db/tipos";
import {
  descuadresRecientesDePauta,
  TOLERANCIA_CUADRE,
  type DescuadreDePauta,
} from "@/lib/pauta/cuadre";

export type TipoDeAlerta =
  | "fuente_silenciosa"
  | "sobres_con_error"
  | "completos_sin_calidad"
  | "traza_de_pauta_rota"
  | "host_de_calendly_sin_closer"
  | "pauta_descuadrada"
  | "sin_envios_global";

export interface ContextoDeAlertas {
  fuentes: SaludDeFuenteConDatos[];
  hostsSinCloser: HostDeCalendlySinCloser[];
  descuadres?: DescuadreDePauta[];
}

type DefinicionDeAlerta = {
  severidad: "critica" | "aviso";
  evaluar(contexto: ContextoDeAlertas, ahora: Date): { clave: string; texto: string }[];
};

export const HORAS_SILENCIO_GLOBAL = 3;

const destino = "Revisar en Ajustes › Webhook Health.";
const contexto = (fuente: SaludDeFuenteConDatos) => `${fuente.programaNombre} · ${fuente.nombre}`;

function porFuente(
  tipo: TipoDeAlerta,
  deFuente: (fuente: SaludDeFuenteConDatos, ahora: Date) => string | null,
): DefinicionDeAlerta["evaluar"] {
  return ({ fuentes }, ahora) => fuentes.flatMap((fuente) => {
    const texto = deFuente(fuente, ahora);
    return texto === null ? [] : [{ clave: `${tipo}:${fuente.sourceId}`, texto }];
  });
}

export const REGISTRO_DE_ALERTAS = {
  fuente_silenciosa: {
    severidad: "critica",
    evaluar: porFuente("fuente_silenciosa", (fuente, ahora) => {
      if (!["sin_respuestas", "muerta", "sin_envios"].includes(fuente.estado)) return null;
      const silencio = fuente.ultimo
        ? `lleva ${num(Math.round((ahora.getTime() - fuente.ultimo.getTime()) / 3_600_000))} horas sin envíos`
        : "nunca recibió envíos";
      return `🔴 ${contexto(fuente)}: ${silencio}. ${destino}`;
    }),
  },
  sobres_con_error: {
    severidad: "critica",
    evaluar: porFuente("sobres_con_error", (fuente) => fuente.sobresPendientes > 0
      ? `🔴 ${contexto(fuente)}: ${fuente.sobresPendientes === 1 ? "1 sobre tiene error" : `${num(fuente.sobresPendientes)} sobres tienen error`}. ${destino}`
      : null),
  },
  completos_sin_calidad: {
    severidad: "aviso",
    evaluar: porFuente("completos_sin_calidad", (fuente) => fuente.sinCalidad > 0
      ? `🟡 ${contexto(fuente)}: ${num(fuente.sinCalidad)} envíos completos llegaron sin calidad. ${destino}`
      : null),
  },
  traza_de_pauta_rota: {
    severidad: "aviso",
    evaluar: porFuente("traza_de_pauta_rota", (fuente) => {
      if (!fuente.trazaRota && !fuente.fbclidRoto) return null;
      const problemas = [
        fuente.trazaRota ? `${num(fuente.pagosSinId)} sin identificador del anuncio` : null,
        fuente.fbclidRoto ? `${num(fuente.pagosSinFbclid)} sin identificador del clic` : null,
      ].filter((problema): problema is string => problema !== null).join(" y ");
      return `🟡 ${contexto(fuente)}: de ${num(fuente.pagos)} envíos pagos, ${problemas}. ${destino}`;
    }),
  },
  host_de_calendly_sin_closer: {
    severidad: "critica",
    evaluar: ({ hostsSinCloser }) => hostsSinCloser.map(({ programId, programaNombre, host, citas }) => ({
      clave: `host_de_calendly_sin_closer:${programId}:${host}`,
      texto: `🔴 ${programaNombre}: la cuenta de Calendly ${host} tiene ${num(citas)} ${citas === 1 ? "cita agendada" : "citas agendadas"} y no está vinculada a ningún closer del programa. Esos deals no cambian de dueño hasta vincularla. Revisar en Ajustes › Usuarios.`,
    })),
  },
  pauta_descuadrada: {
    severidad: "critica",
    evaluar: ({ descuadres = [] }) => {
      const porCuenta = Map.groupBy(
        descuadres.filter((fila) =>
          Math.abs(Number(fila.gastoMeta) - Number(fila.gastoCrm)) > TOLERANCIA_CUADRE),
        (descuadre) => descuadre.cuentaId,
      );
      return [...porCuenta.entries()].map(([cuentaId, filas]) => {
        const ordenadas = filas.toSorted((a, b) => a.fecha.localeCompare(b.fecha));
        const primera = ordenadas[0];
        const gastoMeta = ordenadas.reduce((total, fila) => total + Number(fila.gastoMeta), 0);
        const gastoCrm = ordenadas.reduce((total, fila) => total + Number(fila.gastoCrm), 0);
        const faltantes = ordenadas.filter((fila) => Number(fila.gastoCrm) < Number(fila.gastoMeta));
        const sobrantes = ordenadas.filter((fila) => Number(fila.gastoCrm) > Number(fila.gastoMeta));
        const periodo = (grupo: DescuadreDePauta[]) => grupo.length === 1
          ? fechaCorta(grupo[0].fecha)
          : `${fechaCorta(grupo[0].fecha)} a ${fechaCorta(grupo.at(-1)!.fecha)}`;
        const detalle = (direccion: "faltan" | "sobran", grupo: DescuadreDePauta[]) => {
          const diferencia = grupo.reduce((total, fila) => total + Math.abs(
            Number(fila.gastoMeta) - Number(fila.gastoCrm),
          ), 0);
          return `${direccion} ${monto(diferencia, primera.moneda)} en ${grupo.length} ${grupo.length === 1 ? "día" : "días"} (${periodo(grupo)})`;
        };
        const diferencia = Math.abs(gastoMeta - gastoCrm);
        const esMixto = faltantes.length > 0 && sobrantes.length > 0;
        const balance = esMixto
          ? `${detalle("faltan", faltantes)} y ${detalle("sobran", sobrantes)}`
          : `(${gastoCrm < gastoMeta ? "faltan" : "sobran"} ${monto(diferencia, primera.moneda)}) en ${ordenadas.length} ${ordenadas.length === 1 ? "día" : "días"} (${periodo(ordenadas)})`;
        return {
          clave: `pauta_descuadrada:${cuentaId}`,
          texto: `🔴 ${primera.programaNombre} · cuenta ${primera.idMeta}: Meta reporta ${monto(gastoMeta, primera.moneda)} y el CRM ${monto(gastoCrm, primera.moneda)}; ${balance}. Correr el relleno de gasto de esa ventana.`,
        };
      });
    },
  },
  sin_envios_global: {
    severidad: "critica",
    evaluar: ({ fuentes }, ahora) => {
      if (fuentes.length === 0) return [];
      const ultimos = fuentes.flatMap((fuente) => fuente.ultimo ? [fuente.ultimo] : []);
      const ultimo = ultimos.length === 0
        ? null
        : new Date(Math.max(...ultimos.map((fecha) => fecha.getTime())));
      const horas = ultimo === null
        ? HORAS_SILENCIO_GLOBAL
        : Math.round((ahora.getTime() - ultimo.getTime()) / 3_600_000);
      if (ultimo && ahora.getTime() - ultimo.getTime() <= HORAS_SILENCIO_GLOBAL * 3_600_000) return [];
      const fecha = ultimo ? fechaHoraEnBogota(ultimo) : "nunca";
      return [{
        clave: "sin_envios_global:todas",
        texto: `🔴 Ningún formulario le ha llegado al CRM en las últimas ${num(horas)} horas (último: ${fecha}). ${destino}`,
      }];
    },
  },
} satisfies Record<TipoDeAlerta, DefinicionDeAlerta>;

export const TIPOS_DE_ALERTA = Object.keys(REGISTRO_DE_ALERTAS) as [TipoDeAlerta, ...TipoDeAlerta[]];

export async function alertasActivas(db: Db, ahora: Date) {
  const [fuentes, hostsSinCloser, descuadres] = await Promise.all([
    saludDeFuentes(db, ahora),
    hostsDeCalendlySinCloser(db),
    descuadresRecientesDePauta(db, ahora),
  ]);
  return alertasDelContexto({ fuentes, hostsSinCloser, descuadres }, ahora);
}

/** Las alertas de un contexto ya calculado: quien ya tiene sus consultas no las recalcula. */
export function alertasDelContexto(contexto: ContextoDeAlertas, ahora: Date) {
  return TIPOS_DE_ALERTA.flatMap((tipo) => {
    const definicion = REGISTRO_DE_ALERTAS[tipo];
    return definicion.evaluar(contexto, ahora).map((alerta) => ({
        ...alerta,
        tipo,
        severidad: definicion.severidad,
      }));
  }).sort((a, b) => a.clave.localeCompare(b.clave));
}
