(function (root, createStorage) {
  if (typeof module === 'object' && module.exports) {
    module.exports = createStorage;
    return;
  }
  try {
    root.CCHCartStorage = createStorage(root.localStorage);
  } catch (error) {
    const unavailable = () => { throw error; };
    root.CCHCartStorage = Object.freeze({getItem: unavailable, setItem: unavailable, removeItem: unavailable});
  }
})(typeof globalThis === 'object' ? globalThis : this, function (storage, now) {
  'use strict';
  const currentTime = typeof now === 'function' ? now : Date.now;
  const keys = ['cch-cart-v1', 'cch-estimate-draft-v1', 'cch-estimate-receipt-v1'];
  const activityKey = 'cch-cart-last-activity-v1';
  const lifetime = 24 * 60 * 60 * 1000;

  function allowed(key) {
    if (!keys.includes(key)) throw new TypeError('保存対象のデータを確認できません。');
  }

  function touch() {
    const time = currentTime();
    const raw = storage.getItem(activityKey);
    const previous = raw === null ? null : Number(raw);
    if (previous !== null && Number.isFinite(previous) && previous >= 0 && time - previous >= lifetime) {
      for (const key of keys) storage.removeItem(key);
    }
    storage.setItem(activityKey, String(time));
  }

  touch();
  return Object.freeze({
    getItem(key) { allowed(key); touch(); return storage.getItem(key); },
    setItem(key, value) { allowed(key); touch(); storage.setItem(key, String(value)); },
    removeItem(key) { allowed(key); touch(); storage.removeItem(key); },
  });
});
