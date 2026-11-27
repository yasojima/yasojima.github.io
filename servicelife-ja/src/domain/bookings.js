export const statuses = Object.freeze({ scheduled: '予約済み', confirmed: '確認済み', in_progress: '作業中', completed: '作業完了', cancelled: 'キャンセル済み', en_route: '移動中' });
const normalize = text => String(text ?? '').trim().replace(/\s+/g, ' ').replace(/[’‘]/g, "'").toLowerCase();
export function selectBookings(records, state) {
  const needle = normalize(state.search);
  const serviceIds = new Set(Array.isArray(state.services) ? state.services : state.service ? [state.service] : []);
  const filtered = records.filter(record =>
    (!state.status || record.status === state.status) &&
    (!state.staff || record.staffId === state.staff) &&
    (!state.date || record.startsAt.slice(0, 10) === state.date) &&
    (!serviceIds.size || serviceIds.has(record.serviceId) || record.services.some(s => serviceIds.has(s.id))) &&
    (!needle || record.searchValues.some(value => normalize(value).includes(needle)))
  );
  const ascending = !String(state.order || '-start_datetime').startsWith('-');
  const key = String(state.order || '').endsWith('id') ? 'id' : 'startsAt';
  filtered.sort((a, b) => {
    const comparison = String(a[key]).localeCompare(String(b[key]));
    return (ascending ? comparison : -comparison) || a.id.localeCompare(b.id);
  });
  const size = [10, 25, 50, 100].includes(Number(state.size)) ? Number(state.size) : 25;
  const pages = Math.max(1, Math.ceil(filtered.length / size));
  const page = Math.min(pages, Math.max(1, Math.trunc(Number(state.page)) || 1));
  const start = (page - 1) * size;
  return { total: filtered.length, page, pages, size, from: filtered.length ? start + 1 : 0, to: Math.min(start + size, filtered.length), rows: filtered.slice(start, start + size) };
}
export function searchCustomers(customers, query) {
  const needle = normalize(query);
  return customers.filter(c => [c.name, c.phone, c.email, c.address].some(v => normalize(v).includes(needle)));
}
export function refuseMutation() {
  return { ok: false, status: 403, message: '確認用デモのため、保存・送信は行いません。' };
}
export function initialBookingState(query) {
  return { search: query.get('search') || '', status: query.get('status') || '', staff: query.get('technician') || '',
    services: query.getAll('job_type_any').flatMap(s => s.split(',')), date: query.get('date') || '', size: 25, page: 1, order: query.get('ordering') || '-start_datetime' };
}
