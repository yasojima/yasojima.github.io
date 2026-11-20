/* Private to this browser's copy of the EXOPS trial. PDF bytes are read only on demand. */
const OfficeStore = (() => {
  const expenses = "/expenses/", documents = "/compliance/audit-log/";
  const categories = ["ガソリン代", "有料道路・駐車料金", "処分費", "消耗品費", "その他"];
  const statuses = ["確認待ち", "承認済み", "差し戻し", "支払済み"];
  const roles = {company_admin: "会社管理者", technician: "Alex Morgan"};
  let connection;
  function database() {
    if (!connection) connection = new Promise((resolve, reject) => {
      const request = indexedDB.open("exops-servicelife-office", 1);
      request.onupgradeneeded = () => {
        for (const name of ["expenses", "documents", "files"]) request.result.createObjectStore(name, {keyPath:"id"});
      };
      request.onsuccess = () => {
        const db = request.result;
        db.onversionchange = () => { db.close(); connection = undefined; };
        resolve(db);
      };
      request.onerror = () => reject(request.error);
    }).catch(error => {connection = undefined; throw error;});
    return connection;
  }
  function access(place) {
    if (place.route === documents && place.role === "company_admin") return "documents";
    if (place.route === expenses && Object.hasOwn(roles, place.role)) return "expenses";
    throw Error("この画面を開く権限がありません。");
  }
  function read(req) {
    return new Promise((resolve,reject) => {req.onsuccess=()=>resolve(req.result); req.onerror=()=>reject(req.error);});
  }
  function clean(value, name, max, required=true) {
    const text = String(value ?? "").trim();
    if ((required && !text) || text.length > max) throw Error(name + "を確認してください。");
    return text;
  }
  function date(value, name) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(Date.parse(value)) ||
        new Date(value).toISOString().slice(0,10) !== value) throw Error(name+"を確認してください。");
    return value;
  }
  async function vehicles() {
    return (await FleetStore.snapshot(true)).vehicles.map(({key,id,plate,maker,model})=>({key,id,plate,maker,model}));
  }
  async function snapshot(place) {
    const kind = access(place);
    const db = await database();
    const [all, cars] = await Promise.all([read(db.transaction(kind).objectStore(kind).getAll()),
      kind === "expenses" ? vehicles() : undefined]);
    const records = kind === "expenses" && place.role !== "company_admin" ? all.filter(r=>r.owner===place.role) : all;
    return {records, cars, today:FleetStore.today(), admin:place.role==="company_admin",
      categories, statuses, vehicle:place.vehicle, person:roles[place.role]};
  }
  async function expense(d) {
    const amount = String(d.amount || "");
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw Error("金額を小数点以下2桁までで入力してください。");
    const [whole, decimal=""] = amount.split(".");
    const cents = Number(whole)*100 + Number(decimal.padEnd(2,"0"));
    if (cents<1) throw Error("金額は0より大きい値を入力してください。");
    const key = Number(d.vehicle);
    const car = (await vehicles()).find(v=>v.key===key);
    if (!car) throw Error("車両管理に登録されている車両を選んでください。");
    if (!categories.includes(d.category)) throw Error("費目を選んでください。");
    return {date:date(d.date,"支払日"), cents, vehicle:car.key, team:clean(d.team,"班",70),
      category:d.category, description:clean(d.description,"内容",180,false), vendor:clean(d.vendor,"支払先",120,false),
      notes:clean(d.notes,"メモ",1200,false)};
  }
  async function version(d) {
    const file=d.file;
    if (!(file instanceof ArrayBuffer) || file.byteLength<5 || new TextDecoder().decode(file.slice(0,5)) !== "%PDF-") throw Error("控えにはPDFファイルを選んでください。");
    const registered=date(d.date,"提出・登録日"), due=d.due?date(d.due,"更新期限"):"";
    if (due && due<registered) throw Error("更新期限は提出・登録日以降を指定してください。");
    return {office:clean(d.office,"事業所名",110), title:clean(d.title,"書類名",150), number:clean(d.number,"登録・許可番号",100,false),
      date:registered, due, notes:clean(d.notes,"メモ",1100,false), savedAt:new Date().toISOString(),
      fileId:crypto.randomUUID(), filename:clean(d.filename || "控え.pdf","ファイル名",255), size:file.byteLength};
  }
  async function save(place, draft) {
    const kind=access(place);
    const item=kind==="expenses"?await expense(draft):await version(draft);
    if (kind==="expenses" && draft.status && !statuses.includes(draft.status)) throw Error("対応状況を確認してください。");
    const db=await database(), id=draft.id||crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(kind==="documents"?[kind,"files"]:[kind],"readwrite");
      const store=tx.objectStore(kind); let issue;
      const req=store.get(id);
      req.onsuccess=()=>{
        const old=req.result;
        if ((draft.id && (!old || old.revision!==draft.revision)) || (!draft.id && old)) issue="別の画面で更新されました。詳細を開き直してください。";
        if (kind==="expenses" && old && place.role!=="company_admin" && (old.owner!==place.role || old.status!=="確認待ち")) issue="この明細は管理者が確認済みです。";
        if (issue) {tx.abort();return;}
        const revision=(old?.revision||0)+1;
        if (kind==="documents") {
          tx.objectStore("files").add({id:item.fileId, documentId:id, bytes:draft.file});
          store.put({id,revision,history:[...(old?.history||[]),item]});
        } else {
          store.put({...item,id,revision,owner:old?.owner||place.role,person:old?.person||roles[place.role],
            status:place.role==="company_admin"?(draft.status||statuses[0]):statuses[0]});
        }
      };
      tx.oncomplete=()=>resolve(id);
      tx.onabort=()=>reject(Error(issue || (tx.error?.name==="QuotaExceededError"?"ブラウザの保存容量が不足しています。":"保存できませんでした。もう一度お試しください。")));
    });
  }
  async function attachment(place, key) {
    if (access(place)!=="documents") throw Error("この書類を開く権限がありません。");
    const db=await database(), file=await read(db.transaction("files").objectStore("files").get(key));
    if (!file) throw Error("控えのPDFを確認できませんでした。");
    const record=await read(db.transaction("documents").objectStore("documents").get(file.documentId));
    const entry=record?.history.find(v=>v.fileId===key);
    if (!entry) throw Error("対象となる書類がありません。");
    return {bytes:new Blob([file.bytes],{type:"application/pdf"}), name:entry.filename};
  }
  return {expenses,documents,snapshot,save,attachment};
})();
