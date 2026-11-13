import type { Metadata } from "next";
import { CabecalhoSite } from "@/components/cabecalho";
import { Marca } from "@/components/marca";
import { ChatAgendamentoPagina } from "@/app/agendar/chat";

export const metadata: Metadata = {
  title: "Agendar horário",
  description: "Escolha o serviço, veja os horários livres e reserve o seu.",
};

export default function Page() {
  return (
    <>
      <div className="hidden md:block">
        <CabecalhoSite />
      </div>
      <main className="md:pb-6">
        <div className="container-site hidden pb-6 pt-10 text-center md:block">
          <p className="font-display text-5xl">Vamos marcar?</p>
          <p className="mx-auto mt-2 max-w-sm text-suave">Converse com a nossa assistente e reserve o seu horário em um minutinho.</p>
        </div>
        <ChatAgendamentoPagina />
      </main>
      <footer className="container-site hidden py-10 md:block">
        <Marca />
      </footer>
    </>
  );
}
