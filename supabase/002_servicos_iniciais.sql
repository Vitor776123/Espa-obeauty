
update beauty.configuracoes set nome_salao='Espaço Beauty', responsavel='Eliana Domingues' where id=1;

insert into beauty.profissionais (id, nome, bio, cor, ordem)
values ('00000000-0000-4000-8000-0000000e11a0', 'Eliana Domingues', 'Fundadora do Espaço Beauty.', '#A8325A', 1)
on conflict (id) do nothing;

insert into beauty.horarios_trabalho (profissional_id, dia_semana, inicio, fim, almoco_inicio, almoco_fim)
select '00000000-0000-4000-8000-0000000e11a0', d, '10:00', '19:00', '13:00', '14:00'
from generate_series(1,6) d
on conflict (profissional_id, dia_semana) do nothing;

insert into beauty.servicos (slug, nome, descricao, descricao_longa, foto_url, passos, preco_base, duracao_min, tem_tamanho, ativo, ordem) values
('pe', 'Pé', 'Cuidado completo dos pés', 'Higiene, cutilagem e esmaltação para deixar os pés macios, bem cuidados e prontos para sandália.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/f1469332-362a-454f-a40d-2169e37b3334/1778849740833-pe.jpg', array['Escalda-pés para amaciar a pele e relaxar', 'Remoção das cutículas, corte e lixa das unhas', 'Esfoliação e remoção de calosidades', 'Hidratação com uma massagem rápida', 'Esmaltação com a cor que você escolher']::text[], 45, 50, false, true, 1),
('mao', 'Mão', 'Cuidado completo das mãos', 'Cutilagem, hidratação e esmaltação para mãos delicadas e unhas bem acabadas.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/de9e2e14-13eb-48d0-be1a-79f38506ac8a/1778849733318-mao.jpg', array['Higienização e remoção do esmalte antigo', 'Remoção das cutículas, corte e lixa das unhas', 'Hidratação com uma massagem rápida', 'Esmaltação com a cor que você escolher']::text[], 35, 45, false, true, 2),
('pe-e-mao', 'Pé e Mão', 'Manicure e pedicure combinados', 'Manicure e pedicure no mesmo horário, para sair com mãos e pés impecáveis em uma única visita.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/b66c5ad7-da1c-4f70-bb82-e12857a43e21/1778849733856-pemao.jpg', array['Escalda-pés e higienização das mãos', 'Cutilagem, corte e lixa das unhas dos pés e das mãos', 'Esfoliação e remoção de calosidades nos pés', 'Hidratação com massagem', 'Esmaltação das mãos e dos pés']::text[], 70, 110, false, true, 3),
('spa-dos-pes', 'Spa dos Pés', 'Tratamento relaxante para os pés', 'Um momento de pausa: esfoliação, máscara hidratante e massagem relaxante para pés renovados.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/a2e98016-878d-4c0b-a9e5-19994860e373/1778849734299-spa.jpg', array['Escalda-pés aromático', 'Esfoliação para renovar a pele', 'Máscara hidratante com tempo de ação', 'Massagem relaxante nos pés e nas pernas', 'Finalização com hidratante']::text[], 80, 60, false, true, 4),
('plastica-dos-pes', 'Plástica dos Pés', 'Reconstrução estética dos pés', 'Tratamento intensivo para pés ressecados e com calosidades, devolvendo maciez e aparência saudável.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/a77c392e-4175-4cae-b7a3-296bb0d64fd0/1778849734718-plastica.jpg', array['Escalda-pés e higienização', 'Remoção cuidadosa de calosidades e pele ressecada', 'Aplicação do tratamento de hidratação profunda', 'Pausa com os pés envoltos para potencializar o efeito', 'Remoção do produto e finalização com hidratante']::text[], 85, 60, false, true, 5),
('corte-e-escova', 'Corte e Escova', 'Corte feminino com escova modeladora', 'Corte pensado para o seu tipo de fio e o seu estilo, finalizado com escova modeladora.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/d6f95c29-23d6-4ca0-a063-802352f78543/1778849741752-corte-escova.jpg', array['Conversa sobre o corte e o resultado que você quer', 'Lavagem com massagem no couro cabeludo', 'Corte sob medida', 'Escova modeladora', 'Finalização']::text[], 80, 80, false, true, 6),
('corte', 'Corte', 'Corte feminino', 'Corte feminino sob medida, respeitando o caimento natural dos seus fios.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/83af5194-cd07-4f33-8252-5996b95d4e6e/1778849735404-corte.jpg', array['Conversa sobre o corte que você quer', 'Lavagem dos fios', 'Corte sob medida', 'Finalização']::text[], 50, 30, false, true, 7),
('progressiva', 'Progressiva', 'Alisamento progressivo dos fios', 'Reduz o volume e o frizz e deixa os fios alinhados e com brilho. O tempo e o valor variam com o comprimento do cabelo.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/f7dd48aa-4944-4d89-9bf4-5b2591d928c9/1778849735859-progressiva.jpg', array['Avaliação dos fios e escolha do tamanho', 'Lavagem de limpeza profunda', 'Aplicação do produto mecha a mecha', 'Tempo de pausa para o produto agir', 'Secagem e finalização com prancha', 'Orientações de cuidado para manter o resultado']::text[], 0, 0, true, true, 8),
('cronograma-capilar', 'Cronograma Capilar', 'Hidratação, nutrição e reconstrução', 'Tratamento intensivo para devolver água, óleo e proteína aos fios, conforme a necessidade do seu cabelo.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/f693f485-e1e5-4ebe-9714-d4625efde7a5/1778849736345-cronograma.jpg', array['Avaliação dos fios e da etapa de que precisam', 'Lavagem de limpeza', 'Aplicação do tratamento escolhido', 'Tempo de ação do produto', 'Enxágue e finalização']::text[], 80, 90, false, true, 9),
('relaxamento', 'Relaxamento', 'Relaxamento dos fios', 'Suaviza a curvatura e o volume dos fios, deixando o cabelo mais solto e fácil de modelar.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/70edd9d0-8bfd-40ec-9eaf-3813fcf7ce1f/1778849737075-relaxamento.jpg', array['Avaliação dos fios', 'Aplicação do produto relaxante', 'Tempo de pausa', 'Enxágue e neutralização', 'Escova e finalização']::text[], 150, 120, false, true, 10),
('escova', 'Escova', 'Escova modeladora', 'Lavagem e escova modeladora para fios alinhados, com movimento e brilho.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/4bf332a2-d2ca-48ad-a650-9841bc4493cd/1778849737623-escova.jpg', array['Lavagem dos fios', 'Aplicação de protetor térmico', 'Secagem e modelagem com escova', 'Finalização']::text[], 60, 60, false, true, 11),
('sobrancelha', 'Sobrancelha', 'Design de sobrancelhas', 'Design que valoriza o formato do seu rosto, com fios removidos na medida certa.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/66fcaa45-ad34-471c-ac47-5102b0f4f44a/1778849738257-sobrancelha.jpg', array['Higienização da pele', 'Definição do desenho ideal para o seu rosto', 'Remoção dos fios', 'Finalização com produto calmante']::text[], 25, 20, false, true, 12),
('buco', 'Buço', 'Depilação do buço', 'Remoção rápida dos pelos do buço, com cuidado para a pele sensível da região.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/25b2aa09-d196-4d34-964a-9b2446bfb2fb/1778849738752-buco.jpg', array['Higienização da pele', 'Aplicação do produto e remoção dos pelos', 'Finalização com produto calmante']::text[], 20, 20, false, true, 13),
('tintura-raiz-e-escova', 'Tintura Raiz + Escova', 'Coloração da raiz com escova', 'Renova a cor na raiz e termina com escova para você sair pronta.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/ae253001-7aa7-48bf-930f-9a153bb0fcf2/1778849741289-tintura-raiz.jpg', array['Conversa sobre a cor', 'Aplicação do produto na raiz', 'Tempo de ação', 'Lavagem e hidratação', 'Escova e finalização']::text[], 90, 90, false, true, 14),
('tintura-completa-e-escova', 'Tintura Completa + Escova', 'Coloração completa com escova', 'Coloração do comprimento inteiro, com escova para finalizar.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/f3e2965b-8d63-494c-982d-c78a7c931f2f/1778849739126-tintura-completa.jpg', array['Conversa sobre a cor e o resultado desejado', 'Aplicação do produto na raiz e no comprimento', 'Tempo de ação', 'Lavagem e hidratação', 'Escova e finalização']::text[], 150, 150, false, true, 15),
('botox', 'Botox', 'Botox capilar para hidratação profunda', 'Reposição intensa de nutrientes que reduz o frizz e devolve maciez e brilho. O tempo e o valor variam com o comprimento do cabelo.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/44bf5038-a0db-45bc-94a8-3b9da178af82/1778849739559-botox.jpg', array['Avaliação dos fios e escolha do tamanho', 'Lavagem de limpeza', 'Aplicação do botox capilar', 'Tempo de ação do produto', 'Enxágue, secagem e finalização']::text[], 0, 0, true, true, 16),
('progressiva-organica', 'Progressiva Orgânica', 'Progressiva sem formol', 'Alisamento com fórmula sem formol, que alinha os fios e reduz o volume. O tempo e o valor variam com o comprimento do cabelo.', 'https://yubwtxbyonrlawazcwcy.supabase.co/storage/v1/object/public/servicos/fbd34742-2056-4110-856f-5cc313ba2aba/1778849740070-progressiva-organica.jpg', array['Avaliação dos fios e escolha do tamanho', 'Lavagem de limpeza profunda', 'Aplicação do produto mecha a mecha', 'Tempo de pausa para o produto agir', 'Secagem e finalização com prancha', 'Orientações de cuidado para manter o resultado']::text[], 0, 0, true, true, 17)
on conflict (slug) do nothing;

insert into beauty.variacoes_servico (servico_id, tamanho, preco, duracao_min)
select s.id, v.tamanho, v.preco, v.dur from (values
('progressiva', 'curto', 120, 60),
('progressiva', 'medio', 160, 120),
('progressiva', 'longo', 250, 180),
('botox', 'curto', 100, 180),
('botox', 'medio', 150, 210),
('botox', 'longo', 250, 240),
('progressiva-organica', 'curto', 150, 180),
('progressiva-organica', 'medio', 200, 210),
('progressiva-organica', 'longo', 250, 240)
) as v(slug, tamanho, preco, dur) join beauty.servicos s on s.slug = v.slug
on conflict (servico_id, tamanho) do nothing;

insert into beauty.servico_profissionais (servico_id, profissional_id)
select id, '00000000-0000-4000-8000-0000000e11a0' from beauty.servicos
on conflict do nothing;

-- Categorias dos serviços iniciais
update beauty.servicos set categoria = 'Unhas' where slug in ('pe','mao','pe-e-mao','spa-dos-pes','plastica-dos-pes');
update beauty.servicos set categoria = 'Cabelo' where slug in ('corte-e-escova','corte','escova');
update beauty.servicos set categoria = 'Tratamentos e coloração' where slug in ('progressiva','cronograma-capilar','relaxamento','tintura-raiz-e-escova','tintura-completa-e-escova','botox','progressiva-organica');
update beauty.servicos set categoria = 'Sobrancelha e buço' where slug in ('sobrancelha','buco');
