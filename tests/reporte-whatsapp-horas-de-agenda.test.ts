import { describe, expect, it } from "vitest";
import { armarMensajeDeHorasDeAgenda } from "@/lib/reporte-whatsapp/horas-de-agenda";

describe("mensaje de horas de agenda", () => {
  it("arma la plantilla exacta, omite franjas vacias y muestra el empate de pico", () => {
    const texto = armarMensajeDeHorasDeAgenda("2025-10-21", [{
      programa: "Comunícate con Confianza",
      horas: [
        "06:14", "07:05", "07:48",
        "13:10", "13:52", "14:03", "14:20", "14:41", "14:58", "15:30",
        "20:15", "22:02", "22:19", "22:40", "22:51", "23:30",
      ],
      error: false,
    }, {
      programa: "Tactical Investor",
      horas: ["00:12", "01:30", "07:00"],
      error: false,
    }]);

    expect(texto).toBe(`🕒 Horas de agenda · martes 21-oct

*Comunícate con Confianza* · 16 agendas
🌅 Mañana (6 a 12): 06:14 · 07:05 · 07:48
☀️ Tarde (12 a 18): 13:10 · 13:52 · 14:03 · 14:20 · 14:41 · 14:58 · 15:30
🌙 Noche (18 a 24): 20:15 · 22:02 · 22:19 · 22:40 · 22:51 · 23:30
Hora pico: 14h y 22h (4 cada una)
━━━━━━━━━━
*Tactical Investor* · 3 agendas
🌑 Madrugada (0 a 6): 00:12 · 01:30
🌅 Mañana (6 a 12): 07:00

ℹ️ Hora en que la persona agendó en Calendly (CRM), hora de Bogotá.`);
  });

  it("una sola agenda no muestra pico", () => {
    const texto = armarMensajeDeHorasDeAgenda("2025-10-21", [
      { programa: "Uno", horas: ["12:05"], error: false },
    ]);

    expect(texto).toContain("*Uno* · 1 agenda\n☀️ Tarde (12 a 18): 12:05");
    expect(texto).not.toContain("Hora pico:");
  });

  it("distingue un programa sin agendas de un error de lectura", () => {
    const texto = armarMensajeDeHorasDeAgenda("2025-10-21", [
      { programa: "Vacío", horas: [], error: false },
      { programa: "Roto", horas: [], error: true },
    ]);

    expect(texto).toContain("*Vacío* · sin agendas\n━━━━━━━━━━\n*Roto* · no se pudieron leer las agendas");
  });
});
