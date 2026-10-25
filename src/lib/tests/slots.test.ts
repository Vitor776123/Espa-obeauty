import { describe, expect, it } from "vitest";
import { cabe, gerarSlots, janelasDoDia } from "../slots";
import { agoraSP, diaDaSemana, instanteSP, somarDias, formatDuracao, formatTelefone, dataValida } from "../tempo";

const EXP = { inicio: "10:00", fim: "19:00", almoco_inicio: "13:00", almoco_fim: "14:00" };

describe("slots", () => {
  it("divide o dia em duas janelas por causa do almoço", () => {
    expect(janelasDoDia(EXP)).toEqual([
      { inicio: 600, fim: 780 },
      { inicio: 840, fim: 1140 },
    ]);
  });

  it("não oferece horário que atravessa o almoço", () => {
    const s = gerarSlots({ duracao: 60, expediente: EXP, ocupados: [], passoMin: 30 });
    expect(s).toContain("12:00");
    expect(s).not.toContain("12:30");
    expect(s).not.toContain("13:00");
    expect(s).toContain("14:00");
    expect(s[s.length - 1]).toBe("18:00");
  });

  it("respeita agendamentos e bloqueios existentes", () => {
    const s = gerarSlots({
      duracao: 30,
      expediente: EXP,
      ocupados: [{ inicio: 600, fim: 660 }], // 10:00–11:00 ocupado
      passoMin: 30,
    });
    expect(s[0]).toBe("11:00");
  });

  it("encosta no fim do expediente sem passar dele", () => {
    const s = gerarSlots({ duracao: 120, expediente: EXP, ocupados: [], passoMin: 10 });
    expect(s[s.length - 1]).toBe("17:00");
  });

  it("serviço mais longo que qualquer janela não tem horários", () => {
    expect(gerarSlots({ duracao: 360, expediente: EXP, ocupados: [], passoMin: 10 })).toEqual([]);
  });

  it("dia sem expediente não tem horários", () => {
    expect(gerarSlots({ duracao: 30, expediente: null, ocupados: [], passoMin: 10 })).toEqual([]);
  });

  it("aplica o mínimo de início (hoje + antecedência)", () => {
    const s = gerarSlots({ duracao: 30, expediente: EXP, ocupados: [], passoMin: 30, minimoInicio: 11 * 60 + 15 });
    expect(s[0]).toBe("11:30");
  });

  it("cabe() confirma e recusa horários específicos", () => {
    expect(cabe({ inicio: "14:00", duracao: 60, expediente: EXP, ocupados: [] })).toBe(true);
    expect(cabe({ inicio: "12:30", duracao: 60, expediente: EXP, ocupados: [] })).toBe(false);
    expect(cabe({ inicio: "14:00", duracao: 60, expediente: EXP, ocupados: [{ inicio: 870, fim: 900 }] })).toBe(false);
  });
});

describe("tempo", () => {
  it("calcula dia da semana e soma dias sem depender de fuso", () => {
    expect(diaDaSemana("2026-10-25")).toBe(0); // domingo
    expect(somarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(somarDias("2026-12-31", 1)).toBe("2027-01-01");
  });

  it("converte relógio de São Paulo (UTC−3)", () => {
    expect(agoraSP(new Date("2026-10-25T02:30:00Z"))).toEqual({ data: "2026-10-24", min: 23 * 60 + 30 });
    expect(instanteSP("2026-10-24", "10:00").toISOString()).toBe("2026-10-24T13:00:00.000Z");
  });

  it("formata duração, telefone e valida datas", () => {
    expect(formatDuracao(45)).toBe("45 min");
    expect(formatDuracao(120)).toBe("2h");
    expect(formatDuracao(210)).toBe("3h30");
    expect(formatTelefone("11987654321")).toBe("(11) 98765-4321");
    expect(dataValida("2026-02-30")).toBe(false);
    expect(dataValida("2026-02-28")).toBe(true);
  });
});
