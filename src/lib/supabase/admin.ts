import "server-only";
import { createClient } from "@supabase/supabase-js";

function criar() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const chave = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !chave) {
    throw new Error("Faltam NEXT_PUBLIC_SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY no ambiente.");
  }
  return createClient(url, chave, {
    db: { schema: "beauty" },
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

let cliente: ReturnType<typeof criar> | null = null;

/**
 * Cliente do banco com a chave secreta (service_role), apontado para o schema "beauty".
 * Só roda no servidor: o navegador nunca fala direto com as tabelas do Beauty.
 */
export function db() {
  return (cliente ??= criar());
}
