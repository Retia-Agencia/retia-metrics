import { fechaHoraEnBogota, num } from "@/lib/format";
import { saludDeFuentes, type SaludDeFuenteConDatos } from "@/lib/queries/salud-fuentes";
import type { Db } from "@/lib/db/tipos";

export type TipoDeAlerta =
  | "fuente_silenciosa"
  | "sobres_con_error"
  | "completos_sin_calidad"
  | "lectura_form30x_vieja"
  | "traza_de_pauta_rota"
  | "sin_envios_global";

type DefinicionDeAlerta = {
  severidad: "critica" | "aviso";
  evaluar(fuentes: SaludDeFuenteConDatos[], ahora: Date): { clave: string; texto: string }[];
};

export const HORAS_SILENCIO_GLOBAL = 3;

const destino = "Revisar en Ajustes › Webhook Health.";
const contexto = (fuente: SaludDeFuenteConDatos) => `${fuente.programaNombre} · ${fuente.nombre}`;

function porFuente(
  tipo: TipoDeAlerta,
  deFuente: (fuente: SaludDeFuenteConDatos, ahora: Date) => string | null,
): DefinicionDeAlerta["evaluar"] {
  return (fuentes, ahora) => fuentes.flatMap((fuente) => {
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
  lectura_form30x_vieja: {
    severidad: "aviso",
    evaluar: porFuente("lectura_form30x_vieja", (fuente) => fuente.lecturaVieja
      ? `🟡 ${contexto(fuente)}: la lectura de Form30x está desactualizada. ${destino}`
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
  sin_envios_global: {
    severidad: "critica",
    evaluar: (fuentes, ahora) => {
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
  const fuentes = await saludDeFuentes(db, ahora);
  return TIPOS_DE_ALERTA.flatMap((tipo) => {
    const definicion = REGISTRO_DE_ALERTAS[tipo];
    return definicion.evaluar(fuentes, ahora).map((alerta) => ({
        ...alerta,
        tipo,
        severidad: definicion.severidad,
      }));
  }).sort((a, b) => a.clave.localeCompare(b.clave));
}
