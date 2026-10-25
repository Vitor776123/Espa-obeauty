# Espaço Beauty

Site de agendamento do **Espaço Beauty · Eliana Domingues**: vitrine de serviços, reserva online com sinal por PIX, painel da equipe, lembretes por notificação e remarcação pelo link.

Feito com Next.js 16 (App Router), Tailwind 4 e Supabase. Roda na Vercel.

## O que o site faz

**Para a cliente**
- Home com serviços, foto e janela “Como é o procedimento” com o botão “Agendar este serviço”.
- Reserva em 4 passos: serviço (e tamanho do cabelo), dia e horário, dados, confirmação.
- Sinal de 20% (ou valor total) por PIX. O horário fica segurado por 30 minutos enquanto ela paga.
- Link da reserva: ver detalhes, remarcar, cancelar, salvar na agenda do celular e ligar a notificação de lembrete.
- Lembrete automático um dia antes, por notificação do próprio site (sem WhatsApp).

**Para a equipe** (`/entrar`, depois `/painel`)
- **Hoje**: atendimentos do dia, faturamento previsto, já recebido, pendente, pagamentos para conferir, próximos 7 dias.
- **Agenda**: por dia e por profissional, com bloqueios, detalhes, confirmar pagamento, receber o restante, concluir, remarcar, cancelar, não compareceu, WhatsApp e exportação em CSV.
- **Novo agendamento**: para quem chamou no WhatsApp ou veio ao salão, com busca da cliente pelo telefone e cobrança por PIX ou pagamento já recebido.
- **Serviços**: nome, categoria, descrições, foto, passo a passo, preço único ou por tamanho de cabelo, duração, ativo, quem faz.
- **Profissionais**: cada uma com agenda e horário de trabalho próprios (dias, entrada, saída, almoço).
- **Bloqueios**: folgas e compromissos (um dia, vários dias ou horário), com aviso se já havia agendamento.
- **Clientes**: busca e histórico.
- **Configurações**: dados do salão, chave PIX, regras (sinal, prazo do PIX, antecedência, prazo para remarcar, janela da agenda), notificações no aparelho, contas da equipe.

Quem tem acesso de **administradora** vê tudo. Quem tem acesso de **profissional** vê só a própria agenda.

## Colocar no ar (passo a passo)

### 1. Banco de dados
O banco já está criado no projeto **Leonidas** do Supabase, no schema `beauty` (não mexe nas tabelas dos outros apps). Os arquivos em `supabase/` são o registro do que foi aplicado:
`001_schema.sql` (tabelas, regras e bloqueio de horário duplicado) e `002_servicos_iniciais.sql` (serviços iniciais).

### 2. GitHub
Crie um repositório novo e envie todos os arquivos desta pasta (menos `node_modules` e `.env.local`, que já estão no `.gitignore`).

### 3. Vercel
1. Em vercel.com, **Add New > Project** e escolha o repositório.
2. Em **Environment Variables**, cadastre as variáveis abaixo (o arquivo `.env.example` tem a lista).
3. Clique em **Deploy**. Depois, ajuste `NEXT_PUBLIC_SITE_URL` para o endereço final (algo como `https://espaco-beauty.vercel.app`) e faça um **Redeploy**.

| Variável | De onde vem |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase > Project Settings > API > Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase > Project Settings > API > chave `anon` / publishable |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase > Project Settings > API > chave `service_role` (**secreta**, só na Vercel) |
| `NEXT_PUBLIC_SITE_URL` | Endereço do site, sem barra no final |
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `CRON_SECRET` | Rode `npm run gerar-chaves` e copie as linhas |
| `MERCADOPAGO_ACCESS_TOKEN`, `MERCADOPAGO_WEBHOOK_SECRET` | Só quando for ligar o pagamento automático (veja abaixo) |

> `SUPABASE_SERVICE_ROLE_KEY` e `VAPID_PRIVATE_KEY` nunca podem ir para o GitHub nem aparecer no navegador.

### 4. Primeiro acesso da Eliana
1. No Supabase: **Authentication > Users > Add user**, com o e-mail e uma senha, marcando **Auto Confirm User**.
2. No **SQL Editor**, rode (trocando o e-mail):

```sql
insert into beauty.equipe (user_id, papel, nome)
select id, 'admin', 'Eliana Domingues' from auth.users where email = 'EMAIL-DA-ELIANA@exemplo.com'
on conflict (user_id) do update set papel = 'admin';
```

3. Entre em `/entrar`. Depois disso, novas pessoas são criadas dentro do painel, em **Configurações > Equipe**.

> O login do Supabase é compartilhado com outros apps do mesmo projeto. Por isso, estar logado não basta: só entra no painel quem está na tabela `beauty.equipe`.

### 5. Lembretes e rotina diária
O arquivo `vercel.json` agenda uma rotina todo dia às 9h (horário de Brasília). Ela libera horários cujo PIX não foi pago, manda o lembrete de 24 horas para as clientes que ligaram as notificações e envia o resumo do dia para a equipe. Ela só roda com `CRON_SECRET` configurado.

### 6. Notificações
- Equipe: **Configurações > Avisos neste aparelho > Ligar notificações**.
- Cliente: na página da reserva, botão para receber o lembrete.
- **iPhone**: o iOS só entrega notificação de site instalado. Abra o site no Safari, toque em Compartilhar, **Adicionar à Tela de Início** e abra por esse ícone antes de ligar as notificações.

### 7. Pagamento automático (Mercado Pago), quando quiserem
1. Criar a conta no Mercado Pago e uma aplicação em Suas integrações.
2. Copiar o **Access Token de produção** para `MERCADOPAGO_ACCESS_TOKEN` na Vercel.
3. Em Webhooks da aplicação, cadastrar a URL `https://SEU-SITE/api/mp/webhook` com o evento **Pagamentos**, e copiar a assinatura secreta para `MERCADOPAGO_WEBHOOK_SECRET`.
4. Fazer um **Redeploy**.

Sem o token, o site funciona em **PIX manual**: a cliente paga na chave PIX cadastrada, toca em “Já paguei” e a equipe confirma no painel (aparece em “Para conferir”). Com o token, o PIX é gerado no site e o horário é confirmado sozinho quando o pagamento cai. O Mercado Pago exige o e-mail da cliente nesse modo.

### 8. Logo e fotos
- **Logo**: coloque o arquivo em `public/logo.png` e troque a constante `LOGO_URL` em `src/components/marca.tsx` para `"/logo.png"`. Troque também os ícones `public/icon-192.png`, `public/icon-512.png`, `public/apple-touch-icon.png` e `src/app/icon.png` se quiser o logo no ícone do celular.
- **Fotos dos serviços**: hoje apontam para as imagens do site antigo. Para migrar, abra cada serviço em **Painel > Serviços > Editar > Trocar foto** (a imagem é reduzida e guardada no Supabase).

## Rodando no computador

```bash
cp .env.example .env.local   # preencha os valores
npm install
npm run dev                  # http://localhost:3000
npm test                     # testes do cálculo de horários
npm run typecheck
```

## Como funciona por dentro (resumo)

- **Sem horário duplicado**: o banco recusa dois agendamentos sobrepostos da mesma profissional (restrição `agendamentos_sem_conflito`). Mesmo com duas clientes clicando juntas, só uma reserva passa.
- **Preço e duração** sempre vêm do banco, nunca do navegador.
- **Reserva com PIX**: nasce como “aguardando pagamento” e segura o horário pelo tempo configurado; expira sozinha se não for paga.
- **Fuso**: todos os horários são de Brasília.
- **Segurança**: o navegador nunca fala direto com as tabelas do Beauty. Tudo passa pelo servidor, com a chave secreta guardada na Vercel.
