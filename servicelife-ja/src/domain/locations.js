export const frequencies = Object.freeze([
  ['', '(not set)'], ['weekly', '毎週'], ['bi_weekly', '2週間ごと'], ['tri_weekly', '3週間ごと'],
  ['monthly', '毎月'], ['bi_monthly', '2か月ごと'], ['quarterly', '3か月ごと'], ['bi_annual', '半年ごと'], ['annual', '年1回']
]);
export function selectLocations(records, state) {
  const query = String(state.search || '').trim().toLocaleLowerCase();
  return records.filter(record =>
    (state.active === '' || record.active === (state.active === 'true')) &&
    (!query || [record.name, record.street, record.unit, record.city, record.state, record.postcode,
      record.contactName, record.phone, record.email].join(' ').toLocaleLowerCase().includes(query)));
}
export function locationAddress(record) {
  return [record.street, record.unit, [record.city, record.state, record.postcode].filter(Boolean).join(' ')].filter(Boolean).join(' • ');
}
export function frequencyLabel(value) { return frequencies.find(([key]) => key === value)?.[1] || value; }
