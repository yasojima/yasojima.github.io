export const customerTypes = Object.freeze([['residential','個人宅'],['commercial','事業所']]);
export const propertyTypes = Object.freeze({
  residential:[['house','戸建て'],['apartment','Apartment']],
  commercial:[['multifamily','Multifamily'],['retail','Retail'],['office','事務所'],['industrial','Industrial'],['restaurant','Restaurant'],['hospitality','Hospitality'],['land','Land']]
});
export const leadSources = Object.freeze([['','— 選択 —'],['referral','既存のお客様からの紹介'],['repeat','リピーター'],['google','Googleなどの検索'],
  ['yelp','Yelp'],['facebook','Facebook'],['instagram','Instagram'],['nextdoor','Nextdoor'],['home_advisor','HomeAdvisor'],['angi','Angi'],
  ['door_hanger','ドアに掛ける広告・チラシ'],['truck_signage','社用車に掲出した広告'],['direct_mail','郵送による案内'],['radio','ラジオ'],['tv','TV'],
  ['event','イベント・展示会'],['partner','提携先・物件管理会社'],['walk_in','来店'],['other','その他']]);
export function selectCustomers(records, state) {
  const query = String(state.search || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const rows = records.filter(record => (!state.type || record.type === state.type) &&
    (!query || record.searchValues.some(text => text.toLowerCase().includes(query))));
  const order = String(state.order || '-created_at'),key = {created_at:'createdAt',last_name:'lastName'}[order.replace(/^-/,'')];
  const direction = order.startsWith('-') ? -1 : 1;
  // Equal surnames retain the captured collection order. The reference accepts
  // only these two sorting fields; unrecognised fields leave that order intact.
  if (key) rows.sort((a,b) => direction * String(a[key]).localeCompare(String(b[key])));
  const size = [10,25,50,100].includes(Number(state.size)) ? Number(state.size) : 25;
  const pages = Math.max(1,Math.ceil(rows.length / size));
  const page = Math.min(pages,Math.max(1,Math.trunc(Number(state.page)) || 1)),start=(page-1)*size;
  return { total: rows.length, pages, page, size, from:rows.length?start+1:0,to:Math.min(start+size,rows.length),rows:rows.slice(start,start+size) };
}
