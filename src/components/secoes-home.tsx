import Link from "next/link";
import { getConfig, listarHorarios, listarServicos } from "@/lib/dados";
import { resumoHorario } from "@/lib/horario-texto";
import { GradeServicos, type ServicoPublico } from "@/components/grade-servicos";
import { Marca } from "@/components/marca";
import { IconeRelogio, IconeSino, IconeVolta, IconeZap } from "@/components/icones";

export async function Catalogo() {
  const servicos = await listarServicos();
  const publico: ServicoPublico[] = servicos.map((s) => {
    const precos = s.tem_tamanho ? s.variacoes.map((v) => v.preco) : [s.preco_base];
    const duracoes = s.tem_tamanho ? s.variacoes.map((v) => v.duracao_min) : [s.duracao_min];
    return {
      id: s.id,
      slug: s.slug,
      nome: s.nome,
      categoria: s.categoria,
      descricao: s.descricao ?? "",
      descricaoLonga: s.descricao_longa ?? "",
      foto: s.foto_url,
      passos: s.passos,
      temTamanho: s.tem_tamanho,
      preco: precos.length ? Math.min(...precos) : 0,
      duracaoMin: duracoes.length ? Math.min(...duracoes) : 0,
      duracaoMax: duracoes.length ? Math.max(...duracoes) : 0,
      variacoes: s.variacoes.map((v) => ({ tamanho: v.tamanho, preco: v.preco, duracao: v.duracao_min })),
    };
  });
  if (!publico.length) {
    return <p className="text-suave">Os serviços estarão aqui em breve.</p>;
  }
  return <GradeServicos servicos={publico} />;
}

export function CatalogoEsqueleto() {
  return (
    <div aria-hidden className="grid grid-cols-2 gap-x-4 gap-y-10 md:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: 8 }).map((_, i) => (
        <div key={i}>
          <div className="arco-suave aspect-[4/5] animate-pulse bg-cha-claro" />
          <div className="mt-4 h-5 w-2/3 rounded bg-cha-claro" />
          <div className="mt-2 h-4 w-1/2 rounded bg-cha-claro/70" />
        </div>
      ))}
    </div>
  );
}

export async function Combinados() {
  const cfg = await getConfig();
  const sinal = Number(cfg.sinal_percentual);
  const passos = [
    { t: "Escolha o serviço e o horário", d: "Você vê só os horários realmente livres da agenda." },
    {
      t: sinal > 0 ? `Confirme com o sinal de ${sinal}%` : "Confirme seus dados",
      d: sinal > 0 ? "O pagamento é por PIX, na própria tela. Se preferir, pode pagar o valor total." : "A reserva fica registrada na hora.",
    },
    { t: "Receba o lembrete", d: "No dia anterior o site avisa você. Se precisar, remarque pelo link da reserva." },
  ];
  return (
    <section className="no-escuro bg-ameixa text-perola">
      <div className="container-site grid gap-12 py-20 md:grid-cols-[1fr_1.2fr] md:gap-16 md:py-24">
        <div>
          <h2 className="titulo-secao">Reservar leva menos de um minuto</h2>
          <p className="mt-5 max-w-md text-cha">
            Remarque ou cancele pelo link da reserva até {cfg.limite_cancelamento_horas}h antes do horário.
            {sinal > 0 ? " O sinal não é devolvido em cancelamentos, mas continua valendo se você remarcar." : ""}
          </p>
          <Link href="/agendar" className="btn btn-ambar mt-8">
            Agendar horário
          </Link>
        </div>
        <ol className="space-y-8">
          {passos.map((p, i) => (
            <li key={p.t} className="flex gap-5">
              <span className="tabular font-display text-5xl italic leading-none text-ambar">{i + 1}</span>
              <span>
                <span className="block text-xl font-semibold">{p.t}</span>
                <span className="mt-1 block text-cha">{p.d}</span>
              </span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export async function Rodape() {
  const [cfg, horarios] = await Promise.all([getConfig(), listarHorarios()]);
  const linhas = resumoHorario(horarios);
  const insta = cfg.instagram?.replace(/^@/, "").trim();
  const zap = cfg.whatsapp?.replace(/\D/g, "");
  return (
    <footer className="no-escuro bg-ameixa text-perola">
      <div className="container-site border-t border-perola/15 pb-28 pt-12 md:pb-12">
        <div className="grid gap-10 md:grid-cols-[1.3fr_1fr_1fr]">
          <div>
            <Marca tom="claro" tamanho="grande" />
            {cfg.endereco ? <p className="mt-5 max-w-xs text-sm text-cha">{cfg.endereco}</p> : null}
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-ambar">Horário</h3>
            <ul className="mt-3 space-y-1 text-sm text-cha">
              {linhas.length ? linhas.map((l) => <li key={l}>{l}</li>) : <li>Consulte a agenda online.</li>}
            </ul>
          </div>
          <div>
            <h3 className="font-sans text-sm font-semibold text-ambar">Fale com a gente</h3>
            <ul className="mt-3 space-y-1 text-sm text-cha">
              {zap ? (
                <li>
                  <a className="underline-offset-4 hover:underline" href={`https://wa.me/55${zap}`} target="_blank" rel="noreferrer">
                    WhatsApp
                  </a>
                </li>
              ) : null}
              {insta ? (
                <li>
                  <a className="underline-offset-4 hover:underline" href={`https://instagram.com/${insta}`} target="_blank" rel="noreferrer">
                    Instagram @{insta}
                  </a>
                </li>
              ) : null}
              <li>
                <Link className="underline-offset-4 hover:underline" href="/agendar">
                  Agendar online
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <p className="mt-12 flex flex-wrap items-center justify-between gap-3 text-xs text-cha/80">
          <span>© {new Date().getFullYear()} Espaço Beauty · Eliana Domingues</span>
          <Link href="/entrar" className="underline-offset-4 hover:underline">
            Acesso da equipe
          </Link>
        </p>
      </div>
    </footer>
  );
}

export function RodapeBasico() {
  return (
    <footer className="bg-ameixa text-perola">
      <div className="container-site border-t border-perola/15 pb-28 pt-12 md:pb-12">
        <Marca tom="claro" tamanho="grande" />
      </div>
    </footer>
  );
}

export async function FaixaConfianca() {
  const cfg = await getConfig();
  const sinal = Number(cfg.sinal_percentual);
  const itens = [
    { Icone: IconeRelogio, t: "Horários de verdade", d: "Você só vê o que está livre na agenda." },
    {
      Icone: IconeVolta,
      t: sinal > 0 ? "Remarque sem perder o sinal" : "Remarque pelo link",
      d: `Até ${cfg.limite_cancelamento_horas}h antes do horário, sem precisar ligar.`,
    },
    { Icone: IconeSino, t: "Lembrete no dia anterior", d: "Chega como notificação no celular." },
  ];
  return (
    <section className="bg-[#2a0e1b] text-perola" aria-label="Como funciona a reserva">
      <ul className="container-site grid gap-4 py-6 md:grid-cols-3 md:gap-8">
        {itens.map(({ Icone, t, d }) => (
          <li key={t} className="flex items-center gap-3.5">
            <Icone className="h-7 w-7 flex-none text-ambar" />
            <span>
              <span className="block font-semibold">{t}</span>
              <span className="block text-sm leading-snug text-cha">{d}</span>
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export async function QuemAtende() {
  const cfg = await getConfig();
  const zap = cfg.whatsapp?.replace(/\D/g, "");
  return (
    <section>
      <div className="container-site grid items-center gap-10 py-20 md:grid-cols-[15rem_1fr] md:gap-16 md:py-24">
        <div
          role="img"
          aria-label="Espaço reservado para a foto da Eliana"
          className="arco-suave relative mx-auto grid aspect-[3/4] w-[70%] max-w-56 place-items-center font-display text-8xl italic text-white/90 shadow-suave ring-[6px] ring-perola outline outline-1 outline-offset-[6px] outline-linha md:w-full"
          style={{ background: "linear-gradient(160deg, #d98aa0, #8a2548)" }}
        >
          E
        </div>
        <div>
          <h2 className="titulo-secao">Quem atende você</h2>
          <p className="mt-4 max-w-lg">
            Eliana Domingues cuida das unhas, do cabelo e das sobrancelhas. Você escolhe o dia e o horário direto na agenda dela.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link href="/agendar" className="btn btn-principal">
              Agendar com a Eliana
            </Link>
            {zap ? (
              <a href={`https://wa.me/55${zap}`} target="_blank" rel="noreferrer" className="btn btn-contorno">
                Chamar no WhatsApp
              </a>
            ) : null}
          </div>
        </div>
      </div>
    </section>
  );
}

export async function BarraFixa() {
  const cfg = await getConfig();
  const zap = cfg.whatsapp?.replace(/\D/g, "");
  return (
    <div className="no-escuro fixed inset-x-0 bottom-0 z-40 flex gap-2.5 border-t border-ambar/25 bg-[#2a0e1b]/95 px-4 pb-[max(0.7rem,env(safe-area-inset-bottom))] pt-3 backdrop-blur md:hidden">
      <Link href="/agendar" className="btn btn-ambar flex-1">
        Agendar horário
      </Link>
      {zap ? (
        <a
          href={`https://wa.me/55${zap}`}
          target="_blank"
          rel="noreferrer"
          aria-label="Chamar no WhatsApp"
          className="grid h-12 w-12 flex-none place-items-center rounded-full bg-ok text-white"
        >
          <IconeZap className="h-6 w-6" />
        </a>
      ) : null}
    </div>
  );
}
