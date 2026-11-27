export const reminderTabs = Object.freeze([
  ['pending', '今後の予定'], ['sent', '送信済み'],
  ['skipped', '処理対象外'], ['failed', '失敗'], ['', 'すべて']
]);

export function reminderState(snapshot, status = 'pending') {
  const key = reminderTabs.some(([key]) => key === status) ? status : 'pending';
  const found = snapshot.states.find(state => state.status === key);
  if (!found) return { status: key, available: false, code: 404, rows: [] };
  return { status: key, available: true, code: 200, rows: found.rows };
}
