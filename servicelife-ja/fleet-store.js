/* The public demo keeps each browser's vehicles in its own IndexedDB. */
const FleetStore = (() => {
  const formatDate = date => date.toISOString().slice(0, 10);
  function today() {
    const now = new Date();
    return formatDate(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate())));
  }
  function monthsBefore(day, months) {
    const date = new Date(day + "T00:00:00Z");
    const last = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() - months + 1, 0));
    last.setUTCDate(Math.min(date.getUTCDate(), last.getUTCDate()));
    return formatDate(last);
  }
  function termView(term, day) {
    const milestones = [6, 3, 1].map(months => ({months, date: monthsBefore(term.due, months)}));
    const days = Math.round((Date.parse(term.due) - Date.parse(day)) / 86400000);
    const current = milestones.filter(m => m.date <= day).at(-1);
    const bucket = term.done ? "done" : days < 0 ? "overdue" : current ? "m" + current.months : "later";
    return {...term, milestones, days, bucket};
  }
  const vehicleId = key => "V-" + String(key).padStart(4, "0");
  function samples() {
    const offset = days => {
      const date = new Date(today() + "T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + days);
      return formatDate(date);
    };
    const term = (kind, days, done = false) => ({
      id: crypto.randomUUID(), kind, start: offset(-200), due: offset(days),
      checked: offset(done ? -3 : -200), done
    });
    return [
      ["いすゞ", "エルフ 2t", "DEMO-01", [term("定期点検", -8), term("登録更新", 240)]],
      ["トヨタ", "ハイエース", "DEMO-02", [term("登録更新", 18)]],
      ["日野", "デュトロ 3t", "DEMO-03", [term("定期点検", 64)]],
      ["三菱ふそう", "キャンター", "DEMO-04", [term("定期点検", 140)]],
      ["トヨタ", "ダイナ", "DEMO-05", [term("定期点検", -2, true)]]
    ].map(([maker, model, plate, terms]) => ({maker, model, plate, plateKey: plate, revision: 1, terms}));
  }
  let connection;
  function database() {
    if (!connection) connection = new Promise((resolve, reject) => {
      const req = indexedDB.open("exops-servicelife-vehicles", 1);
      req.onupgradeneeded = () => {
        const store = req.result.createObjectStore("vehicles", {keyPath: "key", autoIncrement: true});
        store.createIndex("plate", "plateKey", {unique: true});
        for (const car of samples()) store.add(car);
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => { db.close(); connection = undefined; };
        resolve(db);
      };
      req.onerror = () => reject(req.error);
    }).catch(error => { connection = undefined; throw error; });
    return connection;
  }
  async function snapshot(showVehicles) {
    const db = await database();
    const records = await new Promise((resolve, reject) => {
      const req = db.transaction("vehicles").objectStore("vehicles").getAll();
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    const day = today(), alerts = [];
    const vehicles = records.map(car => {
      const terms = car.terms.map(term => termView(term, day));
      const id = vehicleId(car.key);
      for (const term of terms) {
        if (["done", "later"].includes(term.bucket)) continue;
        alerts.push({key: car.key, id, plate: car.plate, model: car.model, kind: term.kind,
          due: term.due, bucket: term.bucket, days: term.days});
      }
      return {...car, id, terms};
    });
    alerts.sort((a, b) => a.due.localeCompare(b.due) || a.key - b.key);
    return {day, alerts, vehicles: showVehicles ? vehicles : undefined};
  }
  function textField(value, label, max) {
    const text = typeof value === "string" ? value.trim() : "";
    if (!text || text.length > max) throw Error(label + "を1〜" + max + "文字で入力してください。");
    return text;
  }
  function dateField(value, label) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
        !Number.isFinite(Date.parse(value)) || formatDate(new Date(value)) !== value) {
      throw Error(label + "に有効な日付を入力してください。");
    }
    return value;
  }
  async function save(draft) {
    const maker = textField(draft.maker, "メーカー", 70), model = textField(draft.model, "車種", 70);
    const plate = textField(draft.plate, "ナンバー", 40);
    if (!Array.isArray(draft.terms) || !draft.terms.length) throw Error("対象となる期限を入力してください。");
    const terms = draft.terms.map(row => {
      const kind = textField(row.kind, "期限の種類", 70);
      const start = dateField(row.start, "開始日"), due = dateField(row.due, "期限日");
      const done = row.done === true;
      const checked = (row.checked || done) ? dateField(row.checked, "最終点検・更新日") : "";
      if (due < start) throw Error("期限日は開始日と同じ日か、それ以降にしてください。");
      if (checked && checked > today()) throw Error("最終点検・更新日は今日までの日付を指定してください。");
      return {id: row.id || crypto.randomUUID(), kind, start, due, checked, done};
    });
    const db = await database();
    return new Promise((resolve, reject) => {
      const tx = db.transaction("vehicles", "readwrite"), store = tx.objectStore("vehicles");
      let savedKey, error;
      const write = previous => {
        const record = {maker, model, plate, plateKey: plate.normalize("NFKC").replace(/\s+/g, "").toUpperCase(),
          terms, revision: (previous?.revision || 0) + 1};
        if (previous) record.key = previous.key;
        const req = store.put(record);
        req.onsuccess = () => { savedKey = req.result; };
      };
      if (draft.key) {
        const req = store.get(draft.key);
        req.onsuccess = () => {
          const previous = req.result;
          if (!previous || previous.revision !== draft.revision) {
            error = "別の画面で更新されました。詳細を開き直してから編集してください。";
            tx.abort(); return;
          }
          write(previous);
        };
      } else write(null);
      tx.oncomplete = () => resolve(savedKey);
      tx.onabort = () => reject(Error(error || (tx.error?.name === "ConstraintError" ?
        "このナンバーの車両はすでに登録されています。" : "保存できませんでした。入力内容を確認して、もう一度お試しください。")));
    });
  }
  return {snapshot, save, today};
})();
