export const reminderTabs = Object.freeze([
  ['pending', '今後の予定'], ['sent', '送信済み'],
  ['skipped', '処理対象外'], ['failed', '失敗'], ['', 'すべて']
]);

export function reminderState(snapshot,status='pending'){
 const key=reminderTabs.some(([k])=>k===status)?status:'pending';
 const rows=[...new Map(snapshot.states.flatMap(s=>s.rows||[]).map((r,i)=>[r.id||JSON.stringify(r),r])).values()];
 return {status:key,available:true,code:200,rows:key?rows.filter(r=>r.status===key):rows};
}
