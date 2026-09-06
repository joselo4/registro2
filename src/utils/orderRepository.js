import { prepareOrderUpdate } from './orderLifecycle.js';

const conflict = () => new Error('Otro operador modificó este pedido. Actualiza la lista antes de volver a intentarlo.');
const canonical = value => JSON.stringify(value, function (key, item) {
  return item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.keys(item).sort().map(k => [k, item[k]])) : item;
});

// Compare-and-swap prevents an old operator snapshot from overwriting newer work.
export async function saveOrderChange(client, previous, proposed) {
  if (!client) throw new Error('No hay conexión configurada con la tienda.');
  const id = String(proposed.id || '').trim().toUpperCase();
  const key = `order_${id}`;
  const { data: row, error: readError } = await client.from('helados_sync').select('value,updated_at').eq('key', key).maybeSingle();
  if (readError) throw readError;
  if (row && (!previous || canonical(row.value) !== canonical(previous))) throw conflict();
  if (!row && previous) {
    const { data: legacy, error } = await client.from('helados_sync').select('value').eq('key', 'orders').maybeSingle();
    if (error) throw error;
    const original = Array.isArray(legacy?.value) && legacy.value.find(order => order.id === previous.id);
    if (!original || canonical(original) !== canonical(previous)) throw conflict();
  }
  const next = prepareOrderUpdate(previous, { ...proposed, id });
  const record = { key, value: next, updated_at: next.updatedAt };
  let query;
  if (row) {
    query = client.from('helados_sync').update(record).eq('key', key);
    query = row.updated_at == null ? query.is('updated_at', null) : query.eq('updated_at', row.updated_at);
    query = query.eq('value', JSON.stringify(row.value));
  } else {
    // Supports legacy orders that only exist in the old aggregate. Insert never replaces a concurrent create.
    query = client.from('helados_sync').insert(record);
  }
  const { data, error } = await query.select('value').maybeSingle();
  if (error) throw error.code === '23505' ? conflict() : error;
  if (!data?.value) throw conflict();
  return data.value;
}

export async function fetchAllSyncRows(client) {
  const rows = [];
  const pageSize = 500;
  let after = null;
  while (true) {
    let query = client.from('helados_sync').select('*').order('key').limit(pageSize);
    if (after !== null) query = query.gt('key', after);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...(data || []));
    if (!data?.length || data.length < pageSize) return rows;
    after = data.at(-1).key;
  }
}
