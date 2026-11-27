export const notificationCategories = Object.freeze([
  ['', 'すべてのカテゴリ'], ['appointment','予約内容'], ['lead','見込み客'],
  ['invoice','請求書'], ['payment','入金'], ['contract','契約'],
  ['inventory','在庫'], ['equipment','機材'], ['system','システム']
]);

// These are capabilities of the reviewed offline snapshot, not production
// authorization. Missing categories/pages must not be presented as empty data.
export function selectNotifications(data, query = {}) {
  const page = Math.max(1, Math.floor(Number(query.page) || 1));
  if (query.category || (query.unread_only && query.unread_only !== '1') ||
      (query.unread_only && !data.unreadAvailable) || !data.pages.includes(page)) {
    return { status:404, page, rows:[] };
  }
  const items = query.unread_only ? data.items.filter(item => !item.read) : data.items;
  return { status:200, page, total:data.total, pages:Math.max(1,Math.ceil(data.total/25)), rows:items.slice((page-1)*25,page*25) };
}
