import { dataPorExtenso } from "@/lib/tempo";
import type { AgendamentoCompleto } from "@/lib/tipos";

/** Link do WhatsApp da cliente com uma mensagem pronta, conforme a situação da reserva. */
export function linkWhatsappCliente(ag: AgendamentoCompleto): string {
  const nome = ag.cliente.nome.trim().split(/\s+/)[0] || "tudo bem";
  const quando = `${dataPorExtenso(ag.data)} às ${ag.inicio}`;
  let texto: string;
  if (ag.status === "aguardando_pagamento") {
    texto = `Oi, ${nome}! Tudo bem? Aqui é do Espaço Beauty. Você agendou ${ag.servico.nome} para ${quando}, certo? Conseguiu fazer o pagamento da taxa (sinal) para a gente finalizar o seu agendamento? Se já pagou, pode me enviar o comprovante por aqui.`;
  } else if (ag.status === "pendente") {
    texto = `Oi, ${nome}! Tudo bem? Aqui é do Espaço Beauty. Recebi o seu aviso de pagamento de ${ag.servico.nome} (${quando}). Pode me enviar o comprovante por aqui para eu confirmar o seu horário?`;
  } else if (ag.status === "confirmado") {
    texto = `Oi, ${nome}! Tudo bem? Aqui é do Espaço Beauty. Passando para confirmar o seu horário de ${ag.servico.nome}: ${quando}. Te esperamos!`;
  } else {
    texto = `Oi, ${nome}! Tudo bem? Aqui é do Espaço Beauty.`;
  }
  return `https://wa.me/55${ag.cliente.telefone.replace(/\D/g, "")}?text=${encodeURIComponent(texto)}`;
}
