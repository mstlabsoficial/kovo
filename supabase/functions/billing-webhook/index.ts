// KOVO · Edge Function `billing-webhook` (Deno). PREPARADA, NO DESPLEGADA.
// Necesita, como secretos de la función (nunca en Git):
//   BILLING_WEBHOOK_SECRET   secreto de firma que da el proveedor de pago
//   BILLING_PROVIDER         nombre del proveedor (cuando se elija)
// SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY los inyecta Supabase en el entorno de la función.
// Desplegar solo con aprobación: supabase functions deploy billing-webhook --no-verify-jwt
// (el proveedor no envía JWT de Supabase; la autenticación es la firma del cuerpo).
import { handleWebhook } from './core.js';

const URL = Deno.env.get('SUPABASE_URL') ?? '';
const SERVICE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

async function rpc(fn: string, args: Record<string, unknown>) {
  const r = await fetch(`${URL}/rest/v1/rpc/${fn}`, {
    method: 'POST',
    headers: { apikey: SERVICE, authorization: `Bearer ${SERVICE}`, 'content-type': 'application/json' },
    body: JSON.stringify(args)
  });
  if (!r.ok) throw new Error(`rpc ${fn}: HTTP ${r.status}`);
  return r.json();
}

Deno.serve(async (req: Request) => {
  try {
    const out = await handleWebhook(req, {
      secret: Deno.env.get('BILLING_WEBHOOK_SECRET') ?? '',
      provider: Deno.env.get('BILLING_PROVIDER') ?? 'pendiente',
      rpc,
      log: (e: Record<string, unknown>) => console.log(JSON.stringify(e))
    });
    return new Response(JSON.stringify(out.body), { status: out.status, headers: { 'content-type': 'application/json' } });
  } catch (_e) {
    // 500: el proveedor reintentará más tarde. Sin detalles en la respuesta.
    console.log(JSON.stringify({ level: 'error', msg: 'fallo interno del webhook' }));
    return new Response(JSON.stringify({ error: 'internal' }), { status: 500, headers: { 'content-type': 'application/json' } });
  }
});
