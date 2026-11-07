// Detecta qué ha cambiado en el estado de KOVO entre dos momentos: altas, modificaciones y bajas.
// Solo CALCULA cambios. No envía nada, no sincroniza y no sobrescribe datos remotos.
// El futuro modo Supabase usará esta lista para guardar únicamente las filas afectadas.

// Colecciones de registros (cada elemento es una fila).
export const COLLECTIONS = ['services', 'patients', 'appts', 'notes', 'invoices', 'expenses', 'bank', 'employees', 'payrolls', 'audit', 'outbox'];
// Objetos únicos de configuración.
export const DOCS = ['pro', 'settings', 'avail', 'oblPaid'];
// Solo de pantalla o internos del modo demo: nunca se sincronizan.
export const LOCAL_ONLY = ['role', 'view', 'cal', 'sel', 'seq', 'builtFor', 'lastHash'];

// La auditoría no tiene id: se identifica por fecha y texto.
const keyOf = (col, item) => (item && item.id != null ? String(item.id) : `${item.at}|${item.what}`);

export function snapshot(S) {
  const snap = { rows: {}, docs: {} };
  for (const col of COLLECTIONS) {
    const m = new Map();
    for (const item of S[col] || []) m.set(keyOf(col, item), JSON.stringify(item));
    snap.rows[col] = m;
  }
  for (const d of DOCS) snap.docs[d] = JSON.stringify(S[d] ?? null);
  return snap;
}

// Devuelve [{ type: 'insert'|'update'|'delete', collection, id, row }]
export function diff(prev, next) {
  const out = [];
  for (const col of COLLECTIONS) {
    const a = prev.rows[col], b = next.rows[col];
    for (const [id, json] of b) {
      if (!a.has(id)) out.push({ type: 'insert', collection: col, id, row: JSON.parse(json) });
      else if (a.get(id) !== json) out.push({ type: 'update', collection: col, id, row: JSON.parse(json) });
    }
    for (const id of a.keys()) if (!b.has(id)) out.push({ type: 'delete', collection: col, id, row: null });
  }
  for (const d of DOCS) {
    if (prev.docs[d] !== next.docs[d]) out.push({ type: 'update', collection: d, id: d, row: JSON.parse(next.docs[d]) });
  }
  return out;
}

// Recuerda el último estado y devuelve los cambios desde entonces.
export function createTracker() {
  let last = null;
  return {
    reset(S) { last = snapshot(S); },
    changes(S) {
      const next = snapshot(S);
      const out = last ? diff(last, next) : [];
      last = next;
      return out;
    }
  };
}
