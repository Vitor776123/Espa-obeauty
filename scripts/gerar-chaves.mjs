// Gera as chaves das notificações (VAPID) e o segredo do agendador diário.
// Uso: npm run gerar-chaves   → copie as linhas para as variáveis de ambiente da Vercel (e para o .env.local).
import webpush from "web-push";
import { randomBytes } from "node:crypto";

const { publicKey, privateKey } = webpush.generateVAPIDKeys();
console.log("\nCopie estas linhas para as variáveis de ambiente (Vercel > Settings > Environment Variables):\n");
console.log(`NEXT_PUBLIC_VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log(`VAPID_SUBJECT=mailto:SEU-EMAIL@exemplo.com`);
console.log(`CRON_SECRET=${randomBytes(32).toString("hex")}`);
console.log("\nGuarde a chave privada e o CRON_SECRET em local seguro. Não publique no GitHub.\n");
