-- QR Code do PIX da Eliana (imagem enviada pelo painel, guardada no bucket beauty-servicos).
alter table beauty.configuracoes add column if not exists qr_pix_url text;
