import fs from "node:fs";
import path from "node:path";

/**
 * Lo que un guardian necesita para leer el codigo del repo: los archivos .ts/.tsx de un
 * directorio y su texto sin comentarios (las cadenas se conservan). Los guardianes viejos
 * tienen su copia; los nuevos importan esta.
 */
const EXTENSIONES = new Set([".ts", ".tsx"]);

/** Quita comentarios y conserva cadenas y saltos de linea. */
export function sinComentarios(fuente: string): string {
  let salida = "";
  let estado: "codigo" | "linea" | "bloque" | "simple" | "doble" | "template" = "codigo";
  for (let i = 0; i < fuente.length; i++) {
    const c = fuente[i];
    const par = fuente.slice(i, i + 2);
    if (estado === "linea") {
      if (c === "\n") { estado = "codigo"; salida += "\n"; }
      continue;
    }
    if (estado === "bloque") {
      if (par === "*/") { estado = "codigo"; i++; } else if (c === "\n") salida += "\n";
      continue;
    }
    if (estado === "codigo") {
      if (par === "//") { estado = "linea"; i++; continue; }
      if (par === "/*") { estado = "bloque"; i++; continue; }
      if (c === "'") estado = "simple";
      else if (c === '"') estado = "doble";
      else if (c === "`") estado = "template";
      salida += c;
      continue;
    }
    // Dentro de una cadena: se copia tal cual, saltando el escape.
    if (c === "\\") { salida += par; i++; continue; }
    if ((estado === "simple" && c === "'") || (estado === "doble" && c === '"') || (estado === "template" && c === "`")) {
      estado = "codigo";
    }
    salida += c;
  }
  return salida;
}

export function archivos(dir: string): string[] {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const completo = path.join(dir, e.name);
    if (e.isDirectory()) return e.name === "node_modules" ? [] : archivos(completo);
    return EXTENSIONES.has(path.extname(e.name)) ? [completo] : [];
  });
}
