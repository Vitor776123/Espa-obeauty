import { Suspense } from "react";
import { exigirMembro } from "@/lib/auth";
import { db } from "@/lib/supabase/admin";
import { escopoDe } from "@/lib/painel";
import { dataCurta, formatBRL, formatTelefone, soDigitos } from "@/lib/tempo";
import { ROTULO_STATUS, type StatusAgendamento } from "@/lib/tipos";
import { Titulo, Vazio, EsqueletoPainel } from "@/app/painel/ui";

export const metadata = { title: "Clientes" };

type Cli = { id: string; nome: string; telefone: string; email: string | null; created_at: string };
type Hist = { cliente_id: string; data: string; inicio: string; status: StatusAgendamento; valor_pago: number | string; servico: { nome: string } | null };

async function Clientes({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q = "" } = await searchParams;
  const m = await exigirMembro();
  const escopo = escopoDe(m);
  const busca = q.trim().slice(0, 60);

  let qa = db().from("agendamentos").select("cliente_id, data, inicio, status, valor_pago, servico:servicos(nome)").order("data", { ascending: false }).limit(5000);
  if (escopo) qa = qa.eq("profissional_id", escopo);
  const { data: ags, error: e1 } = await qa;
  if (e1) throw new Error(`Falha ao ler histórico: ${e1.message}`);
  const historico = (ags ?? []) as unknown as Hist[];

  let qc = db().from("clientes").select("*").order("nome").limit(300);
  if (escopo) {
    const ids = [...new Set(historico.map((h) => h.cliente_id))];
    qc = qc.in("id", ids.length ? ids : ["00000000-0000-0000-0000-000000000000"]);
  }
  if (busca) {
    const d = soDigitos(busca);
    const nomeSeguro = busca.replace(/[,()%*]/g, " ");
    qc = qc.or(d.length >= 3 ? `nome.ilike.%${nomeSeguro}%,telefone.ilike.%${d}%` : `nome.ilike.%${nomeSeguro}%`);
  }
  const { data: clientes, error: e2 } = await qc;
  if (e2) throw new Error(`Falha ao ler clientes: ${e2.message}`);
  const lista = (clientes ?? []) as Cli[];

  const porCliente = new Map<string, Hist[]>();
  for (const h of historico) porCliente.set(h.cliente_id, [...(porCliente.get(h.cliente_id) ?? []), h]);

  return (
    <div className="mx-auto max-w-4xl">
      <Titulo titulo="Clientes" descricao={`${lista.length} ${lista.length === 1 ? "cliente" : "clientes"}${busca ? ` para “${busca}”` : ""}.`} />
      <form action="/painel/clientes" className="mb-6 flex gap-2">
        <label htmlFor="busca" className="sr-only">Buscar por nome ou telefone</label>
        <input id="busca" name="q" defaultValue={busca} className="campo max-w-sm" placeholder="Buscar por nome ou telefone" />
        <button type="submit" className="btn btn-contorno">Buscar</button>
      </form>

      {lista.length === 0 ? (
        <Vazio titulo="Nenhuma cliente encontrada">Clientes entram aqui automaticamente quando fazem o primeiro agendamento.</Vazio>
      ) : (
        <ul className="space-y-2.5">
          {lista.map((c) => {
            const hs = porCliente.get(c.id) ?? [];
            const feitos = hs.filter((h) => h.status === "concluido" || h.status === "confirmado");
            const gasto = hs.filter((h) => h.status !== "cancelado" && h.status !== "expirado").reduce((s, h) => s + Number(h.valor_pago), 0);
            const ultimo = hs.find((h) => h.status === "concluido");
            return (
              <li key={c.id} className="rounded-2xl border border-linha bg-white">
                <details>
                  <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-6 gap-y-1 p-4 [&::-webkit-details-marker]:hidden">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{c.nome}</span>
                      <span className="tabular block text-sm text-suave">{formatTelefone(c.telefone)}</span>
                    </span>
                    <span className="tabular text-sm text-suave">{feitos.length} {feitos.length === 1 ? "visita" : "visitas"}</span>
                    <span className="tabular text-sm text-suave">{formatBRL(gasto)} pagos</span>
                    <span className="text-sm font-semibold text-framboesa">Histórico</span>
                  </summary>
                  <div className="space-y-3 border-t border-linha px-4 py-4">
                    <div className="flex flex-wrap gap-2">
                      <a className="btn btn-contorno btn-pequeno" target="_blank" rel="noreferrer" href={`https://wa.me/55${c.telefone}`}>Chamar no WhatsApp</a>
                      {c.email ? <span className="self-center text-sm text-suave">{c.email}</span> : null}
                    </div>
                    {ultimo ? <p className="text-sm text-suave">Último atendimento: {dataCurta(ultimo.data)}.</p> : null}
                    {hs.length === 0 ? (
                      <p className="text-sm text-suave">Sem agendamentos.</p>
                    ) : (
                      <ul className="divide-y divide-linha text-sm">
                        {hs.slice(0, 15).map((h, i) => (
                          <li key={i} className="flex flex-wrap justify-between gap-2 py-2">
                            <span className="tabular">{dataCurta(h.data)} · {String(h.inicio).slice(0, 5)} · {h.servico?.nome ?? "Serviço"}</span>
                            <span className="text-suave">{ROTULO_STATUS[h.status]}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export default function Pagina(props: Parameters<typeof Clientes>[0]) {
  return (
    <Suspense fallback={<EsqueletoPainel />}>
      <Clientes {...props} />
    </Suspense>
  );
}
