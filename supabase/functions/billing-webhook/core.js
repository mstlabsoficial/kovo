// KOVO · webhook de la pasarela de pago (cobro KOVO → clínica). Lógica pura, sin dependencias:
// funciona igual en Deno (Supabase Edge Functions) y en Node (pruebas).
//
// ESTADO: preparado, NO desplegado. El proveedor de pago no está elegido ni contratado, no hay
// claves y no hay precios. No cobra nada. Se despliega solo con aprobación (docs/ops/README.md).
//
// Flujo: el proveedor envía el evento firmado → se verifica la firma (HMAC-SHA256 del cuerpo exacto
// con marca de tiempo, tolerancia 5 min) → se normaliza a la forma de apply_billing_event → la RPC
// (solo service role) lo registra de forma idempotente y actualiza suscripción y estado de la cuenta.

const enc = new TextEncoder();
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');

// Comparación en tiempo constante.
function safeEqual(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let d = 0;
  for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

export async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return hex(await crypto.subtle.sign('HMAC', key, enc.encode(message)));
}

// Cabecera con el formato `t=<segundos>,v1=<hex>` (el que usan los proveedores habituales; se adapta
// al elegir proveedor). Firma = HMAC-SHA256(secreto, `${t}.${cuerpo}`).
export async function verifySignature({ header, body, secret, now = Date.now(), toleranceSec = 300 }) {
  if (!secret) return { ok: false, reason: 'missing_secret' };
  if (!header) return { ok: false, reason: 'missing_signature' };
  const parts = Object.fromEntries(String(header).split(',').map(p => p.trim().split('=')).filter(x => x.length === 2));
  const t = Number(parts.t);
  if (!Number.isInteger(t)) return { ok: false, reason: 'bad_header' };
  if (Math.abs(now / 1000 - t) > toleranceSec) return { ok: false, reason: 'stale' };
  const expected = await hmacHex(secret, `${t}.${body}`);
  return safeEqual(expected, String(parts.v1 || '')) ? { ok: true } : { ok: false, reason: 'bad_signature' };
}

const STATUS = { trialing: 'trialing', active: 'active', past_due: 'past_due', unpaid: 'unpaid', canceled: 'cancelled', cancelled: 'cancelled', incomplete: 'incomplete', incomplete_expired: 'cancelled' };
const PLANS = new Set(['starter', 'professional', 'clinic']);

// Evento de suscripción → payload de apply_billing_event. La clínica y el plan viajan en los
// metadatos que KOVO pone al crear la suscripción en el proveedor (org_id, plan_code). Devuelve null
// si el evento no es de suscripción (se responde 200 y se ignora).
export function normalizeEvent(event) {
  if (!event || typeof event !== 'object' || typeof event.id !== 'string' || typeof event.type !== 'string') throw new Error('evento sin id o tipo');
  if (!/^customer\.subscription\.(created|updated|deleted)$/.test(event.type)) return null;
  const s = event.data?.object || {};
  const meta = s.metadata || {};
  const status = event.type.endsWith('.deleted') ? 'cancelled' : STATUS[s.status];
  if (!status) throw new Error(`estado de suscripción desconocido: ${s.status}`);
  const plan = meta.plan_code && PLANS.has(meta.plan_code) ? meta.plan_code : null;
  return {
    eventId: event.id,
    eventType: event.type,
    payload: {
      org_id: meta.org_id || null,
      plan_code: plan,
      status,
      current_period_end: Number.isInteger(s.current_period_end) ? new Date(s.current_period_end * 1000).toISOString() : null,
      cancel_at_period_end: typeof s.cancel_at_period_end === 'boolean' ? s.cancel_at_period_end : null,
      provider_customer_id: typeof s.customer === 'string' ? s.customer : null,
      provider_subscription_id: typeof s.id === 'string' ? s.id : null
    }
  };
}

// Manejador completo. deps: { secret, provider, rpc(fn, args) } — rpc llama a PostgREST con la clave
// de servicio (solo en el servidor). Nunca registra el cuerpo ni datos personales en los logs.
export async function handleWebhook(req, { secret, provider = 'pendiente', rpc, log = () => {} }) {
  if (req.method !== 'POST') return { status: 405, body: { error: 'method_not_allowed' } };
  const body = await req.text();
  if (body.length > 256 * 1024) return { status: 413, body: { error: 'too_large' } };
  const sig = await verifySignature({ header: req.headers.get('x-kovo-signature') || req.headers.get('stripe-signature'), body, secret });
  if (!sig.ok) { log({ level: 'warn', msg: 'firma rechazada', reason: sig.reason }); return { status: 400, body: { error: 'invalid_signature' } }; }
  let event;
  try { event = JSON.parse(body); } catch { return { status: 400, body: { error: 'invalid_json' } }; }
  let n;
  try { n = normalizeEvent(event); } catch (e) { log({ level: 'warn', msg: 'evento no válido', reason: e.message }); return { status: 400, body: { error: 'invalid_event' } }; }
  if (!n) return { status: 200, body: { result: 'ignored' } };
  const result = await rpc('apply_billing_event', { p_provider: provider, p_event_id: n.eventId, p_event_type: n.eventType, p_payload: n.payload });
  log({ level: result === 'error' ? 'error' : 'info', msg: 'evento de pago', type: n.eventType, result });
  // 'error' se guarda en billing_provider_events.error y se revisa a mano; se responde 200 para que
  // el proveedor no reintente sin fin un evento que no se puede aplicar.
  return { status: 200, body: { result } };
}
