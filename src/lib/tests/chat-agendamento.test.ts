import { describe, expect, it } from "vitest";
import {
  agruparHoras,
  atrasoDigitando,
  emailValido,
  emojiCategoria,
  emojiServico,
  nomeValido,
  primeiroNome,
  rotuloDia,
  telefoneValido,
} from "../chat-agendamento";

describe("emojiServico", () => {
  it("usa o emoji certo para cada tipo de serviço", () => {
    expect(emojiServico("Pé")).toBe("💅");
    expect(emojiServico("Mão")).toBe("💅");
    expect(emojiServico("Pé e Mão")).toBe("💅");
    expect(emojiServico("Spa dos Pés")).toBe("💅");
    expect(emojiServico("Plástica dos Pés")).toBe("💅");
    expect(emojiServico("Corte")).toBe("✂️");
    expect(emojiServico("Corte e Escova")).toBe("✂️");
    expect(emojiServico("Escova")).toBe("💇‍♀️");
    expect(emojiServico("Tintura Raiz + Escova")).toBe("🎨");
    expect(emojiServico("Progressiva")).toBe("💆‍♀️");
    expect(emojiServico("Botox")).toBe("💆‍♀️");
    expect(emojiServico("Sobrancelha")).toBe("👁️");
    expect(emojiServico("Extensão de Cílios")).toBe("👁️");
    expect(emojiServico("Buço")).toBe("🌸");
  });

  it("cai na categoria e, por fim, num coração", () => {
    expect(emojiServico("Algo novo", "Unhas")).toBe("💅");
    expect(emojiServico("Algo novo")).toBe("💖");
  });

  it("não confunde palavras que só contêm 'pe' ou 'mao'", () => {
    expect(emojiServico("Penteado")).toBe("💇‍♀️");
  });
});

describe("emojiCategoria", () => {
  it("mapeia as categorias do salão", () => {
    expect(emojiCategoria("Unhas")).toBe("💅");
    expect(emojiCategoria("Cabelo")).toBe("💇‍♀️");
    expect(emojiCategoria("Tratamentos e coloração")).toBe("🎨");
    expect(emojiCategoria("Sobrancelha e buço")).toBe("👁️");
    expect(emojiCategoria("Outra")).toBe("✨");
  });
});

describe("rotuloDia", () => {
  it("destaca hoje e amanhã e abrevia os outros dias", () => {
    expect(rotuloDia("2026-11-13", "2026-11-13")).toBe("Hoje · 13/11");
    expect(rotuloDia("2026-11-14", "2026-11-13")).toBe("Amanhã · 14/11");
    expect(rotuloDia("2026-11-16", "2026-11-13")).toBe("Seg · 16/11");
  });

  it("vira o mês corretamente em 'amanhã'", () => {
    expect(rotuloDia("2026-12-01", "2026-11-30")).toBe("Amanhã · 01/12");
  });
});

describe("agruparHoras", () => {
  it("separa manhã, tarde e noite e esconde grupos vazios", () => {
    const g = agruparHoras(["14:00", "10:00", "18:00", "11:30", "12:00"]);
    expect(g.map((x) => x.titulo)).toEqual(["Manhã", "Tarde", "Noite"]);
    expect(g[0].horas).toEqual(["10:00", "11:30"]);
    expect(g[1].horas).toEqual(["12:00", "14:00"]);
    expect(g[2].horas).toEqual(["18:00"]);
    expect(agruparHoras(["10:00"]).map((x) => x.titulo)).toEqual(["Manhã"]);
    expect(agruparHoras([])).toEqual([]);
  });
});

describe("validações", () => {
  it("nome precisa ter letras de verdade", () => {
    expect(nomeValido("Maria")).toBe(true);
    expect(nomeValido("  Ana Paula  ")).toBe(true);
    expect(nomeValido("a")).toBe(false);
    expect(nomeValido("12345")).toBe(false);
    expect(nomeValido("   ")).toBe(false);
  });

  it("telefone aceita 10 ou 11 dígitos com DDD", () => {
    expect(telefoneValido("(11) 91234-5678")).toBe(true);
    expect(telefoneValido("(11) 1234-5678")).toBe(true);
    expect(telefoneValido("1234-5678")).toBe(false);
    expect(telefoneValido("(11) 91234-56789")).toBe(false);
  });

  it("e-mail simples", () => {
    expect(emailValido("ana@exemplo.com")).toBe(true);
    expect(emailValido("ana@exemplo")).toBe(false);
    expect(emailValido("ana exemplo.com")).toBe(false);
  });

  it("primeiro nome com inicial maiúscula", () => {
    expect(primeiroNome("  maria das dores ")).toBe("Maria");
    expect(primeiroNome("")).toBe("");
  });
});

describe("atrasoDigitando", () => {
  it("cresce com o texto, tem teto e some com movimento reduzido", () => {
    expect(atrasoDigitando("oi", false)).toBeLessThan(atrasoDigitando("uma mensagem bem mais comprida aqui", false));
    expect(atrasoDigitando("x".repeat(500), false)).toBe(1100);
    expect(atrasoDigitando("oi", true)).toBe(0);
  });
});
