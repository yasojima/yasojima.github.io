/* Private to this browser's copy of the EXOPS trial. PDF bytes are read only on demand. */
const OfficeStore = (() => {
  const expenses = "/expenses/", documents = "/compliance/audit-log/";
  const categories = ["ガソリン代", "有料道路・駐車料金", "処分費", "消耗品費", "交通費", "通信費", "外注費", "その他"];
  const statuses = ["確認待ち", "修正依頼", "承認済み", "支払済み"];
  const destinations = ["経理部", "責任者"];
  const payments = ["立替（個人の現金）", "立替（個人のカード）", "立替（その他）", "会社払い（現金）", "会社払い（法人カード）", "会社払い（振込・その他）"];
  const demoAccounts = {
    company_admin: {id:"demo-company-admin", name:"会社管理者"},
    technician: {id:"demo-alex-morgan", name:"Alex Morgan"}
  };
  const demoAccount = role => demoAccounts[role];
  const ownerOf = row => row.accountId || demoAccount(row.owner)?.id;
  const stateOf = row => row.status === "差し戻し" ? "修正依頼" : row.status;
  function expenseView(row) {
    // Early demo entries had three separate free-text fields and no approval destination.
    const parts = [row.vendor && "利用先：" + row.vendor, row.description, row.notes].filter(Boolean);
    return {...row, notes:[...new Set(parts)].join("\n"), status:stateOf(row)};
  }
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
    if (place.route === expenses && place.account?.id && Object.hasOwn(demoAccounts,place.role)) return "expenses";
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
    let records = all;
    if (kind === "expenses") {
      if (place.role !== "company_admin") records = records.filter(r=>ownerOf(r)===place.account.id);
      records = records.map(expenseView);
    }
    return {records, cars, today:FleetStore.today(), admin:place.role==="company_admin",
      categories, statuses, destinations, payments, vehicle:place.vehicle, person:place.account?.name};
  }
  async function corrections(place) {
    const account = place.account?.id;
    if (!account) return [];
    const db = await database();
    const rows = await read(db.transaction("expenses").objectStore("expenses").getAll());
    return rows.filter(r=>ownerOf(r)===account && stateOf(r)==="修正依頼")
      .map(r=>({id:r.id, date:r.date, category:r.category, reason:r.correctionReason || ""}));
  }
  async function expense(d) {
    const amount = String(d.amount || "");
    if (!/^\d{1,10}(?:\.\d{1,2})?$/.test(amount)) throw Error("金額を小数点以下2桁までで入力してください。");
    const [whole, decimal=""] = amount.split(".");
    const cents = Number(whole)*100 + Number(decimal.padEnd(2,"0"));
    if (cents<1) throw Error("金額は0より大きい値を入力してください。");
    let vehicle = null;
    if (d.vehicle) {
      vehicle = Number(d.vehicle);
      if (!(await vehicles()).some(v=>v.key===vehicle)) throw Error("登録車両を選び直してください。");
    }
    const destination = clean(d.destination,"承認先",40);
    if (destination && !destinations.includes(destination)) throw Error("承認先を選び直してください。");
    const payment = clean(d.payment,"支払方法",40,false);
    if (payment && !payments.includes(payment)) throw Error("支払方法を選び直してください。");
    return {date:date(d.date,"支払日"), cents, vehicle, team:clean(d.team,"班",70,false),
      category:clean(d.category,"経費の種類",90), destination, payment, notes:clean(d.notes,"用途・備考",2000,false)};
  }
  function receiptOf(draft) {
    if (draft.receiptBytes == null) return null;
    if (!(draft.receiptBytes instanceof ArrayBuffer)) throw Error("領収書を選び直してください。");
    const bytes = new Uint8Array(draft.receiptBytes);
    const signatures = [
      ["application/pdf", [37,80,68,70,45]], ["image/jpeg", [255,216,255]],
      ["image/png", [137,80,78,71,13,10,26,10]]
    ];
    const match = signatures.find(([,prefix])=>prefix.every((b,i)=>bytes[i]===b));
    if (!match) throw Error("領収書にはPDF・JPEG・PNGを選んでください。");
    return {id:crypto.randomUUID(), name:clean(draft.receiptName,"ファイル名",255), type:match[0]};
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
    const receipt = kind==="expenses" ? receiptOf(draft) : null;
    const needsCorrection = kind==="expenses" && place.role==="company_admin" && draft.status==="修正依頼";
    const reason = needsCorrection ? clean(draft.correctionReason,"修正理由",1000) : "";
    const db=await database(), id=draft.id||crypto.randomUUID();
    return new Promise((resolve,reject)=>{
      const tx=db.transaction(kind==="documents" || receipt ? [kind,"files"] : [kind],"readwrite");
      const store=tx.objectStore(kind); let issue;
      const req=store.get(id);
      req.onsuccess=()=>{
        const old=req.result;
        if ((draft.id && (!old || old.revision!==draft.revision)) || (!draft.id && old)) issue="別の画面で更新されました。詳細を開き直してください。";
        if (kind==="expenses" && old && place.role!=="company_admin" && (ownerOf(old)!==place.account.id || !["確認待ち","修正依頼"].includes(stateOf(old)))) issue="この明細は編集できません。最新の対応状況を確認してください。";
        if (issue) {tx.abort();return;}
        const revision=(old?.revision||0)+1;
        if (kind==="documents") {
          tx.objectStore("files").add({id:item.fileId, documentId:id, bytes:draft.file});
          store.put({id,revision,history:[...(old?.history||[]),item]});
        } else {
          if (receipt) {
            const files=tx.objectStore("files");
            files.add({id:receipt.id, expenseId:id, bytes:draft.receiptBytes});
            if (old?.receipt) files.delete(old.receipt.id);
          }
          store.put({...item,id,revision,owner:old?.owner||place.role,accountId:old?ownerOf(old):place.account.id,
            person:old?.person||place.account.name, receipt:receipt||old?.receipt||null,
            correctionReason:needsCorrection?reason:(old?.correctionReason||""),
            status:old && place.role==="company_admin"?(draft.status||statuses[0]):statuses[0]});
        }
      };
      tx.oncomplete=()=>resolve(id);
      tx.onabort=()=>reject(Error(issue || (tx.error?.name==="QuotaExceededError"?"ブラウザの保存容量が不足しています。":"保存できませんでした。もう一度お試しください。")));
    });
  }
  async function attachment(place, key) {
    const kind=access(place);
    const db=await database(), file=await read(db.transaction("files").objectStore("files").get(key));
    if (!file) throw Error("控えのPDFを確認できませんでした。");
    if (kind==="expenses") {
      const row=file.expenseId && await read(db.transaction(kind).objectStore(kind).get(file.expenseId));
      if (!row || row.receipt?.id!==key || (place.role!=="company_admin" && ownerOf(row)!==place.account.id)) throw Error("対象の領収書を確認できませんでした。");
      return {bytes:new Blob([file.bytes],{type:row.receipt.type}),name:row.receipt.name,receipt:true};
    }
    if (!file.documentId) throw Error("対象の書類を確認できませんでした。");
    const record=await read(db.transaction("documents").objectStore("documents").get(file.documentId));
    const entry=record?.history.find(v=>v.fileId===key);
    if (!entry) throw Error("対象となる書類がありません。");
    return {bytes:new Blob([file.bytes],{type:"application/pdf"}), name:entry.filename};
  }
  return {expenses,documents,snapshot,save,attachment,corrections,demoAccount};
})();
