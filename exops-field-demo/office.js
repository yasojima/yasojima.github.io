import {
  app,
  clicks,
  submits,
  e,
  icon,
  link,
  button,
  pill,
  customer,
  staff,
  vehicle,
  staffName,
  money,
  dateLabel,
  dateAdd,
  stamp,
  hrefDetail,
  field,
  input,
  select,
  note,
  panel,
  table,
  metric,
  empty,
  kv,
  dialogHTML,
  editor,
  mutate,
  values,
  isAdmin,
  tabs,
  csv,
  daysLeft,
  dueLabel,
  denied,
  api,
  toast,
} from "./ui.js";
import { drawRevenue } from "./workspace.js";

const goSearch = `<button class="btn primary">${icon("magnifying-glass")} 集計・表示</button>`;
const hiddenId = (id) => input("id", id || "", "hidden");
const days = ["月", "火", "水", "木", "金", "土", "日"];
function checks(name, arr) {
  return `<div class="checks">${days.map((v, i) => `<label><input name="${name}" value="${i}" type="checkbox" ${arr.includes(i) ? "checked" : ""}> ${v}</label>`).join("")}</div>`;
}
function salesData() {
  const s = app.data,
    f = app.filters.sales || {},
    from = f.from || s.today.slice(0, 7) + "-01",
    to = f.to || s.today,
    period = f.period || "day";
  const paid = s.bookings.filter(
    (b) => b.payment === "精算済み" && b.paidAt.slice(0, 10) >= from && b.paidAt.slice(0, 10) <= to,
  );
  const requests = s.bookings.filter(
      (b) => b.issued.slice(0, 10) >= from && b.issued.slice(0, 10) <= to,
    ),
    byDate = {};
  const sum = { 現金: 0, カード: 0, その他: 0 };
  for (const b of paid) {
    const key = b.paidAt.slice(0, period === "day" ? 10 : 7);
    const group = byDate[key] ?? (byDate[key] = { 現金: 0, カード: 0, その他: 0, count: 0 });
    group[b.method] += b.final;
    group.count++;
    sum[b.method] += b.final;
  }
  const clients = new Set(requests.map((b) => b.customer)),
    known = new Set(
      s.bookings
        .filter((b) => b.payment === "精算済み" && b.paidAt.slice(0, 10) <= to)
        .map((b) => b.customer),
    );
  return { from, to, period, paid, requests, clients, known, sum, byDate };
}
export function sales() {
  const a = salesData(),
    total = Object.values(a.sum).reduce((t, n) => t + n, 0);
  const groups = Object.entries(a.byDate).sort((a, b) => b[0].localeCompare(a[0]));
  return `<form data-form="sales" class="filterbox filters">${field("集計開始日", input("from", a.from, "date", "required"))}${field("集計終了日", input("to", a.to, "date", "required"))}${field(
    "集計単位",
    select(
      "period",
      [
        ["day", "日別"],
        ["month", "月別"],
      ],
      a.period,
    ),
  )}${goSearch}</form>
 <div class="metrics">${metric("期間売上", money(total), "", "精算日の合計", "chart-line")}${metric("無料見積もり受付", a.requests.length, "件", "受付日で集計", "clipboard-list", "blue")}${metric("問い合わせたお客様", a.clients.size, "名", "同一ユーザーIDは1名", "people-group", "purple")}${metric("有料利用者", new Set(a.paid.map((b) => b.customer)).size, "名", "期間内に精算したお客様", "coins", "amber")}</div>
 <div class="twocol">${panel("期間の売上", `<div class="chartbox"><canvas id="salechart" aria-label="売上の内訳" role="img"></canvas></div>`, "", "chart-column")}${panel(
   "決済方法別",
   `<div class="list">${Object.entries(a.sum)
     .map(([t, n]) => `<div class="listline"><span>${e(t)}</span><b>${money(n)}</b></div>`)
     .join(
       "",
     )}<div class="listline"><span>受付顧客の利用実績</span><span>あり ${[...a.clients].filter((id) => a.known.has(id)).length}名 ／ なし ${[...a.clients].filter((id) => !a.known.has(id)).length}名</span></div></div>`,
   "",
   "credit-card",
 )}</div>
 ${panel(
   a.period === "month" ? "月別の売上" : "日別の売上",
   table(
     ["期間", "現金", "カード", "その他", "合計額", "精算件数"],
     groups.map(([k, v]) => [
       e(k),
       money(v.現金),
       money(v.カード),
       money(v.その他),
       money(v.現金 + v.カード + v.その他),
       v.count + "件",
     ]),
   ),
   button("sales-csv", icon("download") + " CSV出力"),
   "table",
 )}`;
}
export function mountSales() {
  const a = salesData(),
    groups = Object.entries(a.byDate).sort();
  drawRevenue(
    "salechart",
    groups.map((x) => x[0]),
    groups.map(([, v]) => v.現金 + v.カード + v.その他),
  );
}
clicks["sales-csv"] = () => {
  const a = salesData();
  csv("売上集計", [
    ["期間", "現金", "カード", "その他", "精算件数"],
    ...Object.entries(a.byDate)
      .sort()
      .map(([k, v]) => [k, v.現金, v.カード, v.その他, v.count]),
  ]);
};
submits.sales = (f, d) => {
  if (d.from > d.to) throw Error("終了日を開始日以降にしてください。");
  app.filters.sales = d;
  app.render();
};
export function fleet() {
  const f = app.filters.fleet || {},
    cars = app.data.vehicles.filter(
      (v) =>
        (!f.q ||
          [v.id, v.plate, v.maker, v.model].join(" ").toLowerCase().includes(f.q.toLowerCase())) &&
        (!f.from || v.due >= f.from) &&
        (!f.to || v.due <= f.to),
    );
  return (
    `<form class="filterbox filters" data-form="fleet">${field("車両ID・ナンバー・車種", input("q", f.q, "search"))}${field("期限日（開始）", input("from", f.from, "date"))}${field("期限日（終了）", input("to", f.to, "date"))}${goSearch}</form>` +
    panel(
      "登録車両",
      table(
        ["車両ID", "メーカー・車種", "ナンバー", "検査・登録の期限日", "期限の状況"],
        cars.map((v) => [
          link(hrefDetail("car", v.id), e(v.id), "textlink"),
          link(hrefDetail("car", v.id), e(v.maker + " " + v.model), "textlink"),
          e(v.plate),
          e(v.due),
          pill(...dueLabel(v)),
        ]),
      ),
      isAdmin() ? button("edit-car", icon("plus") + " 車両を登録", "", "btn primary") : "",
      "truck",
    )
  );
}
export function carDetail(v) {
  return dialogHTML(
    v.maker + " " + v.model,
    `<div class="dialogbody">${pill(...dueLabel(v))}${kv([
      ["車両ID", e(v.id)],
      ["ナンバー", e(v.plate)],
      ["対象期間の開始", e(v.start)],
      ["対象期限", e(v.due)],
      ["最終点検日", e(v.checked)],
      ["今回の更新", v.done ? "完了" : "未実施"],
    ])}${isAdmin() ? button("edit-car", icon("pen") + " 点検・期限を更新", v.id, "btn primary") : ""}</div>`,
    "車両管理",
    "close-detail",
  );
}
clicks["edit-car"] = (id) => {
  const v = vehicle(id) || {
    id: "",
    start: app.data.today,
    checked: app.data.today,
    due: dateAdd(app.data.today, 365),
  };
  editor(
    id ? "点検・期限を更新" : "車両を登録",
    hiddenId(v.id) +
      `<div class="formgrid">${[
        ["メーカー", "maker"],
        ["車種", "model"],
        ["ナンバー", "plate"],
      ]
        .map(([t, k]) => field(t, input(k, v[k], "text", "required")))
        .join("")}${[
        ["対象期間の開始", "start"],
        ["次回期限", "due"],
        ["最終点検日", "checked"],
      ]
        .map(([t, k]) => field(t, input(k, v[k], "date", "required")))
        .join(
          "",
        )}<label class="checks"><input type="checkbox" name="done" ${v.done ? "checked" : ""}> 今回の点検・更新を完了</label></div>`,
    "edit-car",
  );
};
submits["edit-car"] = (f, d) =>
  mutate({ action: "vehicle", ...d, done: !!d.done }, "車両情報を保存しました。");
export function tags() {
  return (
    panel(
      "利用実績の区分",
      table(
        ["区分", "判定"],
        [
          [pill("利用実績なし", "gray"), "有料利用の実績がないお客様"],
          [pill("利用実績あり", "blue"), "一度以上、支払いが完了したお客様"],
        ],
      ),
      "",
      "user-tag",
    ) +
    panel(
      "サブステータス",
      table(
        ["表示順", "名称", "文字色", "操作"],
        app.data.tags.map((t, i) => [
          i + 1,
          `<b style="color:${e(t.color)}">${e(t.name)}</b>`,
          e(t.color),
          isAdmin()
            ? `<div class="actions">${button("edit-tag", "編集", t.id, "btn tiny")}${button("move-tag", "上へ", t.id, "btn tiny", `data-value="-1" ${i === 0 ? "disabled" : ""}`)}${button("move-tag", "下へ", t.id, "btn tiny", `data-value="1" ${i === app.data.tags.length - 1 ? "disabled" : ""}`)}</div>`
            : "―",
        ]),
      ),
      isAdmin() ? button("edit-tag", icon("plus") + " 追加", "", "btn primary") : "",
      "tags",
    )
  );
}
clicks["edit-tag"] = (id) => {
  const t = app.data.tags.find((x) => x.id === id) || { id: "", color: "#b93438" };
  editor(
    "サブステータスの編集",
    hiddenId(t.id) +
      `<div class="formgrid">${field("名称", input("name", t.name, "text", "required"))}${field("文字色", input("color", t.color, "color"))}</div>${id ? button("delete-tag", "削除する", id, "btn danger") : ""}`,
    "edit-tag",
  );
};
submits["edit-tag"] = (f, d) => mutate({ action: "tag", ...d }, "ステータスを保存しました。");
clicks["move-tag"] = (id, el) =>
  mutate({ action: "tagMove", id, delta: +el.dataset.value }, "並び順を変更しました。");
clicks["delete-tag"] = (id) =>
  editor(
    "ステータスを削除",
    hiddenId(id) + "<p>この項目を顧客からも解除します。</p>",
    "delete-tag",
    "削除する",
  );
submits["delete-tag"] = (f, d) =>
  mutate({ action: "tagDelete", id: d.id }, "ステータスを削除しました。");
export function audit() {
  if (!isAdmin()) return denied();
  const f = app.filters.audit || {};
  const logs = app.data.logs.filter(
    (l) =>
      (!f.staff || l.actor === f.staff) &&
      (!f.customer || l.customer.includes(f.customer)) &&
      (!f.from || l.at.slice(0, 10) >= f.from) &&
      (!f.to || l.at.slice(0, 10) <= f.to),
  );
  return (
    `<form class="filterbox filters" data-form="audit">${field(
      "スタッフ",
      select(
        "staff",
        app.data.staff.map((s) => [s.id, s.name]),
        f.staff,
        "すべて",
      ),
    )}${field("顧客ユーザーID", input("customer", f.customer))}${field("開始日", input("from", f.from, "date"))}${field("終了日", input("to", f.to, "date"))}${goSearch}</form>` +
    panel(
      "スタッフの操作履歴",
      table(
        ["日時", "担当者", "操作内容", "顧客ユーザーID", "受付番号"],
        logs.map((l) => [
          e(stamp(l.at)),
          e(staffName(l.actor)),
          e(l.action),
          l.customer ? link(hrefDetail("person", l.customer), e(l.customer), "textlink") : "―",
          l.booking ? link(hrefDetail("booking", l.booking), e(l.booking), "textlink") : "―",
        ]),
      ),
      pill(logs.length + "件", "gray"),
      "shield-halved",
    )
  );
}
export function settings() {
  const cfg = app.data.settings,
    section = app.parts[1] || "general";
  const nav = tabs(
    [
      ["general", "基本情報", "#settings"],
      ["team", "スタッフ管理", "#settings/team"],
      ["company", "会社・接続", "#settings/company"],
    ],
    section,
  );
  if (section !== "general" && !isAdmin()) return nav + denied();
  if (section === "team") {
    return (
      nav +
      panel(
        "スタッフアカウント",
        table(
          ["氏名", "表示名", "ログインID", "権限", "勤務設定", "操作"],
          app.data.staff
            .filter((s) => s.active)
            .map((s) => [
              e(s.name),
              e(s.nick),
              e(s.login),
              pill(s.role, s.role === "管理者" ? "purple" : "blue"),
              s.off.length ? e(s.off.map((i) => days[i]).join("・")) + "休" : "定休指定なし",
              button("edit-staff", "編集", s.id, "btn tiny"),
            ]),
        ),
        button("edit-staff", icon("plus") + " スタッフ追加", "", "btn primary"),
        "users",
      )
    );
  }
  if (section === "company") {
    return (
      nav +
      `<form class="panel" data-form="company"><div class="panelhead"><h2>${icon("building")} 会社・受付日の設定</h2></div><div class="pad stack"><div class="formgrid">${[
        ["会社名", "company"],
        ["共通の送信元メール", "sender"],
        ["ウェブサイトURL", "url"],
        ["電話番号", "phone"],
        ["会社住所", "address"],
        ["利用中の決済会社", "provider"],
        ["口コミ案内URL（任意）", "review"],
      ]
        .map(([t, k]) =>
          field(
            t,
            input(
              k,
              cfg[k],
              k === "sender" ? "email" : "text",
              ["provider", "review"].includes(k) ? "" : "required",
            ),
          ),
        )
        .join(
          "",
        )}${field("毎週の定休日", checks("weekly", cfg.weekly), true)}${field("臨時休業日（1行に1日、例 2027-01-01）", note("holidays", cfg.holidays.join("\n")), true)}</div><p class="notice">休業日はお客様の予約カレンダーで選べなくなります。すでに受け付けた訪問は予定に残ります。</p><div class="sectionline"><span class="hint">メール・カード決済の接続モード　${pill("デモ", "blue")}</span><button class="btn primary">設定を保存</button></div><p class="localnote">外部への送信や課金は行いません。運用時の認証情報は本接続時に設定します。</p><p class="localnote">担当エンジニア窓口　EXOPSサポート · support@example.invalid（デモ）</p></div></form>`
    );
  }
  const me = staff(app.data.me);
  return (
    nav +
    panel(
      "自分のアカウント",
      `<div class="pad">${kv([
        ["氏名", e(me.name)],
        ["表示名", e(me.nick)],
        ["ログインID", e(me.login)],
        ["権限", e(me.role)],
        ["所属", e(cfg.company)],
        ["共通連絡先", e(cfg.sender)],
      ])}<form class="stack pad" data-form="signature-preference"><label class="checks"><input type="checkbox" name="enabled" ${me.signature === false ? "" : "checked"}> お客様へのメールに自分の名前を署名として入れる</label><button class="btn">自分の設定を保存</button></form></div>`,
      "",
      "user-circle",
    )
  );
}
submits["signature-preference"] = (f, d) =>
  mutate({ action: "signaturePreference", enabled: !!d.enabled }, "署名の設定を保存しました。");
clicks["edit-staff"] = (id) => {
  const s = staff(id) || { id: "", active: true, role: "一般スタッフ", off: [], field: true };
  const body =
    hiddenId(s.id) +
    `<div class="formgrid">${[
      ["フルネーム", "name"],
      ["呼び名", "nick"],
      ["ログインID", "login"],
    ]
      .map(([t, k]) => field(t, input(k, s[k], "text", "required")))
      .join(
        "",
      )}${field("生年月日", input("birthday", s.birthday, "date", "required"))}${field("権限", select("role", ["一般スタッフ", "管理者"], s.role))}${field(id ? "新しいパスワード（変更時のみ）" : "パスワード（8文字以上）", input("password", "", "password", id ? 'autocomplete="new-password"' : 'required minlength="8" autocomplete="new-password"'))}${field("休みの曜日", checks("off", s.off), true)}<label class="checks wide"><input name="mobile" type="checkbox" ${(s.field ?? s.role !== "管理者") ? "checked" : ""}> 配車の担当候補に入れる</label></div>${id && !["S01", "S02"].includes(id) && id !== app.data.me ? button("retire", "アカウントを停止", id, "btn danger") : ""}`;
  editor(id ? "スタッフ情報の変更" : "スタッフを追加", body, "update-staff");
};
submits["update-staff"] = (f, d) =>
  mutate(
    { action: "staff", ...d, field: !!d.mobile, off: new FormData(f).getAll("off") },
    "スタッフ情報を保存しました。",
  );
clicks.retire = (id) =>
  editor(
    "アカウントを停止",
    hiddenId(id) + `<p>${e(staff(id).name)}さんのログインと新規割り当てを停止します。</p>`,
    "retire",
    "停止する",
  );
submits.retire = (f, d) => mutate({ action: "retire", id: d.id }, "アカウントを停止しました。");
submits.company = (f, d) =>
  mutate(
    {
      action: "company",
      ...d,
      weekly: new FormData(f).getAll("weekly"),
      holidays: d.holidays
        .split(/\s+/)
        .map((s) => s.trim())
        .filter(Boolean),
    },
    "受付日・会社情報を保存しました。",
  );
