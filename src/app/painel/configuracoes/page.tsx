import { Suspense } from "react";
import { exigirAdmin } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { getConfig, listarProfissionais } from "@/lib/dados";
import { mpAtivo } from "@/lib/mercadopago";
import { Titulo, EsqueletoPainel } from "@/app/painel/ui";
import { FormularioConfig } from "@/app/painel/configuracoes/formulario";
import { NotificacoesAparelho } from "@/app/painel/configuracoes/notificacoes";
import { Equipe, type MembroLista } from "@/app/painel/configuracoes/equipe";

export const metadata = { title: "Configurações" };

async function Configuracoes() {
  const eu = await exigirAdmin();
  const [cfg, profs, { data: linhas }] = await Promise.all([
    getConfig(),
    listarProfissionais({ incluirInativos: true }),
    db().from("equipe").select("user_id, papel, profissional_id, nome").order("created_at"),
  ]);

  // e-mails vêm do Auth (a tabela do Beauty guarda só o vínculo)
  const emails = new Map<string, string>();
  for (const l of linhas ?? []) {
    const { data } = await db().auth.admin.getUserById(l.user_id);
    emails.set(l.user_id, data.user?.email ?? "");
  }
  const membros: MembroLista[] = (linhas ?? []).map((l) => ({
    userId: l.user_id,
    nome: l.nome ?? emails.get(l.user_id) ?? "Equipe",
    email: emails.get(l.user_id) ?? "",
    papel: l.papel,
    profissional: profs.find((p) => p.id === l.profissional_id)?.nome ?? null,
    eu: l.user_id === eu.userId,
  }));

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "";
  const mp = mpAtivo();

  return (
    <div className="mx-auto max-w-3xl space-y-14">
      <Titulo titulo="Configurações" descricao="Dados do salão, regras de agendamento, avisos e quem acessa o painel." />

      <FormularioConfig cfg={cfg} />

      <section className="space-y-4">
        <h2 className="text-2xl">Pagamento automático (Mercado Pago)</h2>
        {mp ? (
          <p className="flex flex-wrap items-center gap-2">
            <span className="selo selo-ok">Ligado</span>
            <span className="text-sm text-suave">O PIX é gerado no site e o horário é confirmado sozinho quando o pagamento cai.</span>
          </p>
        ) : (
          <div className="space-y-2">
            <p className="flex items-center gap-2">
              <span className="selo selo-alerta">Em espera</span>
              <span className="text-sm text-suave">Por enquanto, a cliente paga na chave PIX acima e a equipe confirma no painel.</span>
            </p>
            <p className="text-sm text-suave">
              Para ligar: crie a conta no Mercado Pago, copie o Access Token de produção para a variável <code className="rounded bg-cha-claro px-1.5">MERCADOPAGO_ACCESS_TOKEN</code> na Vercel e cadastre o endereço de notificações{" "}
              <code className="break-all rounded bg-cha-claro px-1.5">{site || "https://seu-site"}/api/mp/webhook</code>. Os passos completos estão no arquivo README.
            </p>
          </div>
        )}
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Avisos neste aparelho</h2>
        <NotificacoesAparelho chavePublica={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />
      </section>

      <section className="space-y-4">
        <h2 className="text-2xl">Equipe</h2>
        <Equipe membros={membros} profissionais={profs.filter((p) => p.ativo).map((p) => ({ id: p.id, nome: p.nome }))} />
      </section>
    </div>
  );
}

export default function Pagina() {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Configuracoes />
    </Suspense>
  );
}
