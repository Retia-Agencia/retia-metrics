#!/usr/bin/env node
/**
 * `npm test`: corre vitest UNA vez por maquina, sin huerfanos y con limite de tiempo.
 *
 * 🩸 28-sep: tres suites a la vez (una sesion, un agente y un subagente que se
 * relanzaba) sobre la misma maquina, mas workers de vitest que sobrevivian a su padre
 * muerto. Cada suite de PGlite aplica TODAS las migraciones, asi que se ahogaban entre
 * si: una corrida de 66 s se colgo mas de 55 minutos, varias veces, sin un solo error.
 * Este script cierra las tres puertas:
 *
 * 1. **Candado por maquina** (no por worktree: la CPU es una sola). Si ya hay una suite
 *    viva, sale de inmediato diciendo cual, en vez de apilarse detras.
 * 2. **Barre huerfanos** antes de arrancar: workers de vitest de este repo cuyo padre
 *    ya murio (ppid 1; en Windows, por PowerShell).
 * 3. **Limite duro** (`TEST_TIMEOUT_S`, 480 s por defecto; la suite tarda ~70-140 s).
 *    Al vencer, o con Ctrl-C, mata el GRUPO de procesos entero, no solo al padre.
 *
 * Los argumentos pasan a vitest: `npm test -- tests/llamadas-del-deal.test.ts`.
 */
import { spawn, execFileSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const CANDADO = join(tmpdir(), "retia-metrics-tests.lock");
const LIMITE_S = Number(process.env.TEST_TIMEOUT_S ?? 480);
const esWindows = process.platform === "win32";

function vivo(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

// 1. Candado. Un candado de un proceso muerto (kill -9) se reclama solo.
if (existsSync(CANDADO)) {
  const { pid, cwd, desde } = JSON.parse(readFileSync(CANDADO, "utf8"));
  if (vivo(pid)) {
    console.error(
      `\n  Ya hay una suite corriendo en esta maquina (pid ${pid}, desde ${desde}, en ${cwd}).\n` +
        `  Espera a que termine; dos a la vez se ahogan entre si y ninguna acaba.\n` +
        `  Si esta colgada: kill ${pid}\n`,
    );
    process.exit(2);
  }
}
writeFileSync(CANDADO, JSON.stringify({ pid: process.pid, cwd: process.cwd(), desde: new Date().toISOString() }));

// 2. Huerfanos: procesos de vitest de este repo adoptados por init. El proceso principal
// puede llevar una ruta RELATIVA (`node node_modules/.bin/vitest`), asi que "de este repo"
// se decide por su directorio de trabajo, no solo por el comando. Varias pasadas: los
// workers de un principal quedan huerfanos recien cuando el principal muere.
function directorioDe(pid) {
  try {
    return execFileSync("lsof", ["-a", "-p", pid, "-d", "cwd", "-Fn"], { encoding: "utf8" });
  } catch {
    return "";
  }
}
/**
 * En Windows no hay ppid 1 ni `lsof`: se pregunta a PowerShell. Con el candado tomado no hay
 * otra suite viva de esta maquina, asi que todo proceso de vitest que corra DESDE ESTE REPO
 * es un huerfano (los workers llevan la ruta del repo en la linea de comando). El `npx vitest`
 * que los lanzo no la lleva: ese se reconoce porque su padre ya murio.
 * 🩸 30-sep: 31 procesos de tres suites cortadas por el limite seguian vivos (~500 MB cada
 * uno) y ahogaban a la siguiente, que a su vez se cortaba y dejaba los suyos.
 */
function barrerHuerfanosWindows() {
  const repo = process.cwd().replace(/\\/g, "/").toLowerCase();
  const ps = `
    $vivos = @{}; foreach ($p in Get-CimInstance Win32_Process) { $vivos[[int]$p.ProcessId] = $true }
    # Solo node.exe: esta misma PowerShell lleva "vitest" y la ruta del repo en su linea de
    # comando, y sin el filtro se mataba a si misma a mitad del barrido.
    foreach ($p in Get-CimInstance Win32_Process -Filter "Name='node.exe'") {
      $c = [string]$p.CommandLine
      if ($p.ProcessId -eq ${process.pid} -or $c -notmatch 'vitest') { continue }
      $delRepo = $c.Replace('\\', '/').ToLower().Contains('${repo.replace(/'/g, "''")}')
      $npxSinPadre = $c -match 'npx-cli\\.js"?\\s+vitest' -and -not $vivos[[int]$p.ParentProcessId]
      if ($delRepo -or $npxSinPadre) { Stop-Process -Id $p.ProcessId -Force -ErrorAction SilentlyContinue; $p.ProcessId }
    }`;
  try {
    const matados = execFileSync("powershell", ["-NoProfile", "-NonInteractive", "-Command", ps], { encoding: "utf8" })
      .split(/\r?\n/)
      .filter((l) => l.trim());
    for (const pid of matados) console.error(`  (huerfano de vitest eliminado: pid ${pid.trim()})`);
  } catch {}
}

if (esWindows) {
  barrerHuerfanosWindows();
} else {
  for (let pasada = 0; pasada < 3; pasada++) {
    let matados = 0;
    const filas = execFileSync("ps", ["-axo", "pid=,ppid=,command="], { encoding: "utf8" }).split("\n");
    for (const fila of filas) {
      const [pid, ppid, ...cmd] = fila.trim().split(/\s+/);
      const comando = cmd.join(" ");
      if (ppid !== "1" || !comando.includes("vitest")) continue;
      if (!comando.includes("retia-metrics") && !directorioDe(pid).includes("retia-metrics")) continue;
      try {
        process.kill(Number(pid), "SIGKILL");
        matados++;
        console.error(`  (huerfano de vitest eliminado: pid ${pid})`);
      } catch {}
    }
    if (matados === 0) break;
    execFileSync("sleep", ["0.5"]);
  }
}

// 3. Vitest en su propio grupo, para poder matarlo entero.
const hijo = spawn("npx", ["vitest", "run", ...process.argv.slice(2)], {
  stdio: "inherit",
  detached: !esWindows,
  shell: esWindows,
});

let terminado = false;
function soltar() {
  try {
    if (JSON.parse(readFileSync(CANDADO, "utf8")).pid === process.pid) rmSync(CANDADO);
  } catch {}
}
function matarGrupo(senal) {
  if (terminado) return;
  try {
    // En Windows `hijo` es la shell: matarla sola deja vivos a npx, vitest y sus workers.
    // `taskkill /T` se lleva el arbol entero.
    if (esWindows) execFileSync("taskkill", ["/pid", String(hijo.pid), "/T", "/F"], { stdio: "ignore" });
    else process.kill(-hijo.pid, senal);
  } catch {}
  if (esWindows) barrerHuerfanosWindows();
}

const reloj = setTimeout(() => {
  console.error(`\n  La suite paso de ${LIMITE_S} s: se corta (normal es ~70-140 s). Revisa si otra cosa usa la CPU.\n`);
  matarGrupo("SIGKILL");
}, LIMITE_S * 1000);

for (const senal of ["SIGINT", "SIGTERM", "SIGHUP"]) {
  process.on(senal, () => {
    matarGrupo("SIGKILL");
    soltar();
    process.exit(130);
  });
}

hijo.on("exit", (codigo, senal) => {
  terminado = true;
  clearTimeout(reloj);
  soltar();
  process.exit(codigo ?? (senal ? 1 : 0));
});
