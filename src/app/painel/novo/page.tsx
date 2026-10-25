import { Suspense } from "react";
import { exigirMembro } from "@/lib/auth";
import { getConfig, listarProfissionais, listarServicos } from "@/lib/dados";
import { mpAtivo } from "@/lib/mercadopago";
import { dataValida, hojeSP, somarDias } from "@/lib/tempo";
import { FormularioNovo } from "@/app/painel/novo/formulario";
import { Titulo, EsqueletoPainel } from "@/app/painel/ui";

export const metadata = { title: "Novo agendamento" };

async function Novo({ searchParams }: { searchParams: Promise<{ data?: string; prof?: string }> }) {
  const sp = await searchParams;
  const m = await exigirMembro();
  const [servicos, profissionais, cfg] = await Promise.all([listarServicos(), listarProfissionais(), getConfig()]);
  const hoje = hojeSP();
  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";

  return (
    <div className="mx-auto max-w-5xl">
      <Titulo titulo="Novo agendamento" descricao="Para clientes que chamaram no WhatsApp ou vieram ao salão. Você pode marcar para daqui a pouco." />
      <FormularioNovo
        servicos={servicos}
        profissionais={profissionais}
        profissionalFixa={m.papel === "admin" ? null : m.profissionalId}
        hoje={hoje}
        maxData={somarDias(hoje, cfg.janela_dias)}
        sinalPct={cfg.sinal_percentual}
        mpAtivo={mpAtivo()}
        dataInicial={sp.data && dataValida(sp.data) && sp.data >= hoje ? sp.data : null}
        profInicial={sp.prof ?? null}
        siteUrl={site}
      />
    </div>
  );
}

export default function Pagina(props: Parameters<typeof Novo>[0]) {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Novo {...props} />
    </Suspense>
  );
}
