// Auditoría de mutación (docs/agents/tests.md §Cómo se mide la calidad). Cambia el código de un
// módulo a propósito y mira si algún test falla: un mutante que sobrevive es una regla sin test dueño.
// No corre en local (docs/agents/feedback-loops.md, regla del 20-nov): solo en .github/workflows/mutacion.yml.
// El módulo llega por MUTAR (una ruta o un glob de lib/).
const mutar = process.env.MUTAR;
if (!mutar) throw new Error("Falta MUTAR: la ruta del módulo de lib/ a mutar");

/** @type {import('@stryker-mutator/api/core').PartialStrykerOptions} */
export default {
  testRunner: "vitest",
  vitest: { configFile: "vitest.config.mts" },
  mutate: [mutar],
  coverageAnalysis: "perTest",
  concurrency: 2,
  timeoutMS: 60_000,
  reporters: ["html", "json", "clear-text", "progress"],
  htmlReporter: { fileName: "reports/mutation/index.html" },
  jsonReporter: { fileName: "reports/mutation/mutation.json" },
  thresholds: { high: 80, low: 60, break: null },
};
