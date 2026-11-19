import {
  app,
  clicks,
  submits,
  e,
  icon,
  link,
  button,
  pill,
  stage,
  payPill,
  customer,
  staff,
  booking,
  vehicle,
  staffName,
  carName,
  money,
  dateLabel,
  stamp,
  order,
  ending,
  hrefDetail,
  bookLink,
  customerLink,
  field,
  input,
  select,
  note,
  panel,
  table,
  empty,
  kv,
  dialogHTML,
  editor,
  mutate,
  values,
  paid,
  isAdmin,
  tabs,
  api,
  toast,
  filesFrom,
  closeEditor,
  attention,
} from "./ui.js";
import { tagNames } from "./workspace.js";

document.addEventListener("change", (ev) => {
  if (ev.target.name === "messageBooking")
    location.hash = hrefDetail("booking", ev.target.value, "messages");
});
const hrefPublic = (b) => "/exops-field-demo/customer/?token=" + encodeURIComponent(b.token);
const customerPage = (b, title) =>
  `<a class="btn" target="_blank" rel="noopener" href="${e(hrefPublic(b))}">${icon("mobile-screen-button")} ${e(title)}</a>`;
const hidden = (b) => input("id", b.id, "hidden") + input("version", b.version, "hidden");
const dated = (val) => e(stamp(val));
const docUrl = (b, d) =>
  "/exops-field-demo/api/pdf?booking=" + encodeURIComponent(b.id) + "&id=" + encodeURIComponent(d.id);
const act = (name, label, b, cl = "btn") => button(name, label, b.id, cl);
const attachInput = `<input type="file" name="files" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple>`;
function dialogTabs(kind, id, tab, data) {
  return tabs(
    data.map(([k, t]) => [k, t, hrefDetail(kind, id, k)]),
    tab,
  );
}
function mediaList(b) {
  if (!b.media.length) return empty("この予約の写真・動画はまだありません。");
  return `<div class="pad media">${b.media
    .map((m) => {
      const url =
        "/exops-field-demo/api/media?booking=" + encodeURIComponent(b.id) + "&id=" + encodeURIComponent(m.id);
      const expired =
        m.expired ||
        Math.abs(new Date(app.data.today) - new Date(m.at.slice(0, 10))) > 183 * 86400000;
      return expired
        ? `<p class="hint">${e(m.name)} は保存期間を過ぎています。</p>`
        : `<figure>${m.mime.startsWith("image/") ? `<a href="${e(url)}" target="_blank" rel="noopener"><img src="${e(url)}" alt="${e(m.name)}"></a>` : `<video controls src="${e(url)}"></video>`}<figcaption>${e(m.group)} · ${e(m.name)}</figcaption></figure>`;
    })
    .join("")}</div>`;
}
function progression(b) {
  const buttons = [];
  if (b.status === "booked") buttons.push(["enroute", "出発を記録"]);
  if (["booked", "enroute"].includes(b.status)) buttons.push(["onsite", "到着を記録"]);
  if (b.status === "onsite") buttons.push(["working", "作業開始を記録"]);
  if (["booked", "enroute", "onsite"].includes(b.status))
    buttons.push(["declined", "見積もりのみで終了"]);
  if (["booked", "enroute"].includes(b.status)) buttons.push(["cancelled", "予約を取り消す"]);
  const el = buttons.map(([k, t]) => button("change-stage", e(t), b.id, "btn", `data-value="${k}"`));
  if (["done", "declined"].includes(b.status) && !b.released)
    el.unshift(act("release", "次に動ける時間を記録", b, "btn primary"));
  return el.join("");
}
export function reservationDetail(b, tab = "info") {
  if (!["info", "docs", "messages"].includes(tab)) tab = "info";
  const c = customer(b.customer),
    t = dialogTabs("booking", b.id, tab, [
      ["info", "予約の詳細"],
      ["docs", "金額・帳票"],
      ["messages", "連絡・履歴"],
    ]);
  let body;
  if (tab === "docs") {
    const created = b.docs.slice().reverse();
    body = `<div class="row">${stage(b)}${payPill(b)}</div>${kv([
      ["概算金額", money(b.estimate)],
      ["確定金額", money(b.final)],
    ])}<div class="actions">${act("new-estimate", icon("file-lines") + " 見積書を作成", b)}${act("new-invoice", icon("file-invoice") + " 請求書を作成", b, "btn primary")}${link(hrefDetail("person", c.id, "settle") + "?b=" + encodeURIComponent(b.id), "顧客詳細で精算", "btn")}</div>${panel(
      "この予約の帳票",
      table(
        ["帳票", "金額", "発行日時", "操作"],
        created.map((d) => [
          e(d.kind) + (d.signed ? `<small class="sub">お客様確認済み</small>` : ""),
          money(d.amount),
          dated(d.at),
          button(
            "doc-preview",
            icon("eye") + " プレビュー",
            b.id,
            "btn tiny",
            `data-value="${e(d.id)}"`,
          ),
        ]),
        "見積書・請求書を作成すると、ここに保存されます。",
      ),
    )}`;
  } else if (tab === "messages") {
    const related = app.data.bookings
      .filter((item) => item.customer === c.id)
      .sort((a, b) => order(b, a));
    body = `${
      related.length > 1
        ? field(
            "対象の予約",
            select(
              "messageBooking",
              related.map((item) => [
                item.id,
                item.date + " " + item.start + " · " + item.service + " · " + item.id,
              ]),
              b.id,
            ),
          )
        : ""
    }<div class="actions">${act("message-form", icon("paper-plane") + " メッセージを作成", b, "btn primary")}${customerPage(b, "お客様側で確認")}</div><p class="localnote">デモ送信はこの予約のお客様ページに届きます。</p><div id="conversation">${conversation(b)}</div>`;
  } else {
    body = `<div class="sectionline"><div class="row">${stage(b)}${attention(b) ? pill(attention(b), "amber") : ""}</div>${customerLink(c.id, "顧客名簿を開く")}</div>
  ${kv([
    ["訪問日時", e(dateLabel(b.date, true) + " " + b.start + "–" + ending(b))],
    ["サービス", e(b.service)],
    ["担当スタッフ・車両", e(staffName(b.staff) + " ／ " + carName(b.vehicle))],
    ["所要時間", e(b.duration) + "分"],
    ["現場住所", e(b.address)],
    ["電話番号", `<a href="tel:${e(c.phone)}">${e(c.phone)}</a>`],
    ["受付時の希望日時", e(b.requested)],
    ["現場の注意事項", e(b.notes || "―")],
  ])}
  <div class="actions">${["booked", "enroute"].includes(b.status) ? act("edit-schedule", icon("calendar-days") + " 日時・配車を変更", b) : ""}${act("message-form", icon("envelope") + " お客様に連絡", b)}${["onsite", "working"].includes(b.status) ? act("block-form", icon("truck") + " 帰社・荷下ろしを記録", b) : ""}</div>
  ${panel(
    "現場の記録",
    `<div class="pad stack">${kv([
      ["到着", dated(b.arrival)],
      ["作業開始", dated(b.began)],
      ["お客様の完了確認", b.confirmed ? dated(b.confirmed) + " · " + e(b.signed) : "―"],
      ["次に動ける時刻", dated(b.released)],
    ])}<div class="actions">${progression(b)}${customerPage(b, "お客様の完了確認画面")}</div>${b.reported ? `<p class="plain">${e(b.reported)}</p>` : ""}${act("add-report", "完了報告を入力", b)}</div>`,
  )}
  ${panel("受付資料・作業前後の写真", mediaList(b), act("add-media", icon("camera") + " 追加", b, "btn tiny"), "images")}`;
  }
  return dialogHTML(
    c.name + " 様",
    `<div class="dialogbody">${t}${body}</div>`,
    "予約の詳細　／　" + b.id,
    "close-detail",
  );
}
function conversation(b) {
  return (
    b.messages
      .slice()
      .reverse()
      .map(
        (m) =>
          `<article class="message ${m.direction === "受信" ? "inbound" : ""}"><div class="sectionline"><strong>${e(m.subject)}</strong>${pill(m.direction, m.direction === "受信" ? "blue" : "green")}</div><small class="sub">${e(stamp(m.at) + "　" + staffName(m.actor))} · ${e(m.sender || (m.direction === "受信" ? customer(b.customer).email : app.data.settings.sender))} → ${e(m.to || (m.direction === "受信" ? app.data.settings.sender : customer(b.customer).email))}</small><p>${e(m.body)}</p>${m.doc ? link("/exops-field-demo/api/pdf?booking=" + encodeURIComponent(b.id) + "&id=" + encodeURIComponent(m.doc), icon("paperclip") + " 添付PDF", "textlink") : ""}</article>`,
      )
      .join("") || empty("対応履歴はありません。")
  );
}
export function personDetail(c, tab = "info") {
  if (!["info", "history", "settle"].includes(tab)) tab = "info";
  const mine = app.data.bookings.filter((b) => b.customer === c.id).sort((a, b) => order(b, a)),
    used = paid(c).sort(order);
  const t = dialogTabs("person", c.id, tab, [
    ["info", "顧客情報"],
    ["history", "予約履歴"],
    ["settle", "精算"],
  ]);
  let body = "";
  if (tab === "info") {
    const map = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(c.address);
    body = `<div class="actions">${pill(used.length ? "利用実績あり" : "利用実績なし", used.length ? "blue" : "gray")}${tagNames(c)}</div>${kv(
      [
        ["氏名", e(c.name)],
        ["お住まいのエリア", e(c.area)],
        ["メールアドレス", e(c.email)],
        ["電話番号", e(c.phone)],
        [
          "住所",
          e(c.address) +
            `<small class="sub"><a target="_blank" rel="noopener" href="${e(map)}">Googleマップで開く</a></small>`,
        ],
        ["利用回数", e(used.length) + "回"],
        ["初回利用日", e(used[0]?.date || "―")],
        ["最終利用日", e(used.at(-1)?.date || "―")],
        ["メモ", e(c.memo || "―")],
      ],
    )}<div class="actions">${isAdmin() ? button("edit-customer", icon("pen") + " 顧客情報を編集", c.id) : ""}${mine.length ? link(hrefDetail("booking", mine[0].id, "messages"), icon("envelope") + " メッセージ", "btn") : ""}</div>`;
  } else if (tab === "history") {
    body = table(
      ["訪問日時", "受付番号・サービス", "状況", "精算"],
      mine.map((b) => [
        `${e(dateLabel(b.date))} ${e(b.start)}`,
        `${bookLink(b)}<span class="sub">${e(b.service)}</span>`,
        stage(b),
        payPill(b),
      ]),
    );
  } else {
    const focus = new URLSearchParams(location.hash.split("?")[1]).get("b");
    const ordered = [...mine].sort((a, b) => Number(b.id === focus) - Number(a.id === focus));
    body =
      ordered
        .map(
          (b) =>
            `<section class="panel"><div class="panelhead"><h3>${e(dateLabel(b.date))} · ${e(b.service)}</h3>${payPill(b)}</div><div class="pad stack">${kv(
              [
                ["受付番号", bookLink(b)],
                ["確定金額", money(b.final)],
                ["決済方法", e(b.method || "―")],
                ["受領の記録", b.paidAt ? dated(b.paidAt) + " " + e(staffName(b.paidBy)) : "―"],
              ],
            )}<div class="actions">${b.payment === "精算済み" ? "" : b.final === null ? link(hrefDetail("booking", b.id, "docs"), "確定金額を入力", "btn") : ["declined", "cancelled"].includes(b.status) ? "" : act("cash", "現金受領", b, "btn primary") + act("card", "カード決済案内", b) + act("other", "その他で受領", b)}${customerPage(b, "お客様ページ")}</div></div></section>`,
        )
        .join("") || empty("精算する予約がありません。");
  }
  return dialogHTML(
    c.name + " 様",
    `<div class="dialogbody">${t}${body}</div>`,
    "顧客名簿　／　" + c.id,
    "close-detail",
  );
}
clicks["edit-schedule"] = (id) => {
  const b = booking(id);
  editor(
    "日時・配車を変更",
    hidden(b) +
      `<div class="formgrid">${field("訪問日", input("date", b.date, "date", "required"))}${field("開始時刻", input("start", b.start, "time", "required"))}${field(
        "所要時間",
        select(
          "duration",
          [30, 60, 90, 120, 180, 240].map((n) => [n, n + "分"]),
          b.duration,
        ),
      )}${field(
        "担当スタッフ",
        select(
          "staff",
          app.data.staff
            .filter((s) => s.active && (s.field ?? s.role !== "管理者"))
            .map((s) => [s.id, s.name]),
          b.staff,
        ),
      )}${field(
        "車両",
        select(
          "vehicle",
          app.data.vehicles.filter((v) => v.active).map((v) => [v.id, v.model]),
          b.vehicle,
        ),
        true,
      )}</div>`,
    "reschedule",
    "変更を保存",
    b.id,
  );
};
submits.reschedule = (f, d) =>
  mutate({ action: "schedule", ...d }, "予約とカレンダーに反映しました。");
clicks["change-stage"] = (id, el) => {
  const b = booking(id),
    stage = el.dataset.value;
  editor(
    el.textContent,
    hidden(b) +
      input("stage", stage, "hidden") +
      `<p>${e(customer(b.customer).name + " 様　" + b.start + "　" + b.service)}</p>`,
    "stage",
    "記録する",
    b.id,
  );
};
submits.stage = (f, d) => mutate({ action: "stage", ...d }, "予約の状況を記録しました。");
clicks.release = (id) => {
  const b = booking(id);
  editor(
    "次に動ける時間を記録",
    hidden(b) +
      field(
        "これから必要な片付け・移動時間",
        select(
          "buffer",
          [0, 15, 30, 45, 60, 90, 120].map((n) => [n, n === 0 ? "今すぐ" : n + "分"]),
          0,
        ),
      ),
    "release",
    "空き状況に反映",
    id,
  );
};
submits.release = (f, d) =>
  mutate({ action: "release", ...d }, "スタッフと車両の空き状況を更新しました。");
clicks["add-report"] = (id) => {
  const b = booking(id);
  editor(
    "完了報告",
    hidden(b) + field("作業結果・引き継ぎ", note("body", b.reported, "required"), true),
    "report",
    "保存する",
    id,
  );
};
submits.report = (f, d) => mutate({ action: "report", ...d }, "完了報告を保存しました。");
clicks["add-media"] = (id) =>
  editor(
    "写真・動画を追加",
    input("id", id, "hidden") +
      `<div class="formgrid">${field("種類", select("group", ["作業前", "作業後"], "作業前"), true)}${field("ファイル（各5MBまで）", attachInput, true)}</div>`,
    "media",
    "追加する",
    id,
  );
submits.media = async (f, d) => {
  const files = await filesFrom(f.elements.files);
  if (!files.length) throw Error("添付するファイルを選んでください。");
  await mutate({ action: "media", id: d.id, group: d.group, files }, "予約に保存しました。");
};
for (const [action, kind] of [
  ["new-estimate", "見積書"],
  ["new-invoice", "請求書"],
])
  clicks[action] = (id) => {
    const b = booking(id);
    editor(
      kind + "を作成",
      hidden(b) +
        input("kind", kind, "hidden") +
        `<div class="formgrid">${field("宛名", input("recipient", customer(b.customer).name, "text", "readonly"))}${field("金額（AUD）", input("amount", kind === "請求書" ? (b.final ?? b.estimate) : b.estimate, "number", 'step=".01" min="0" required'))}${field("うち税額（AUD・任意）", input("tax", "", "number", 'step=".01" min="0"'))}${field("ご案内・前提条件", note("note", kind === "見積書" ? "お送りいただいた資料に基づく概算です。現地で内容と金額をご相談する場合があります。" : "ご利用いただきありがとうございます。"), true)}</div>`,
      "document",
      "PDFを作成して確認",
      id,
    );
  };
submits.document = async (f, d) => {
  const result = await mutate({ action: "document", ...d }, "PDFを生成しました。");
  preview(d.id, result.doc);
};
function preview(id, did) {
  const b = booking(id),
    d = b.docs.find((x) => x.id === did);
  if (!d) return;
  const url = docUrl(b, d);
  const n = editor(
    d.kind + "プレビュー",
    hidden(b) +
      input("doc", did, "hidden") +
      `<iframe class="docframe" title="${e(d.kind)}PDF" src="${e(url)}"></iframe><div class="actions"><a href="${e(url)}" class="btn" download="${e(b.id + d.kind)}.pdf">${icon("download")} PDFを保存</a></div>${kv(
        [
          ["宛先", e(customer(b.customer).email)],
          ["金額", money(d.amount)],
        ],
      )}`,
    "compose-doc",
    "添付してメールを作成",
    id,
  );
  return n;
}
clicks["doc-preview"] = (id, el) => preview(id, el.dataset.value);
const templates = {
  当日の予約確認: (b) =>
    `本日 ${b.start} に${b.service}の無料見積もりでお伺いします。よろしくお願いいたします。`,
  到着時間の案内: (b, t) =>
    `${t || b.start} 頃に到着する予定です。到着まで今しばらくお待ちください。`,
  遅延連絡: (b, t) =>
    `前の現場の都合で到着が遅れております。${t || b.start} 頃にお伺いする予定です。`,
  個別連絡: () => "",
};
function compose(id, did = "") {
  const b = booking(id),
    c = customer(b.customer),
    doc = b.docs.find((x) => x.id === did);
  const subject = doc ? doc.kind + "のご案内" : "当日の予約確認";
  const body = doc
    ? `${c.name} 様\n\n${doc.kind}を添付いたしました。内容をご確認ください。`
    : `${c.name} 様\n\n${templates[subject](b)}`;
  const d = editor(
    "メッセージを作成",
    hidden(b) +
      input("doc", did, "hidden") +
      `<div class="formgrid">${field("差出人", input("from", app.data.settings.sender, "text", "readonly"))}${field("宛先", input("to", c.email, "email", "readonly"))}${!doc ? field("定型文", select("template", Object.keys(templates), subject)) + field("到着予定時刻", input("arrival", b.start, "time")) : ""}${field("件名", input("subject", subject, "text", "required"), true)}${field("本文", note("body", body, 'required rows="5"'), true)}${doc ? `<p class="notice wide">${icon("paperclip")} ${e(doc.kind)}PDF　${e(money(doc.amount))}　自動添付</p>` : ""}<label class="checks wide"><input type="checkbox" name="signature" ${staff(app.data.me).signature === false ? "" : "checked"}> 担当者名を署名に入れる</label></div>`,
    "send-message",
    "内容を確認してデモ送信",
    id,
  );
  const form = d.querySelector("form");
  function fill() {
    const t = form.elements.template.value;
    form.elements.subject.value = t === "個別連絡" ? "" : t;
    form.elements.body.value = `${c.name} 様\n\n${templates[t](b, form.elements.arrival.value)}`;
  }
  form.elements.template?.addEventListener("change", fill);
  form.elements.arrival?.addEventListener("change", fill);
}
clicks["message-form"] = (id) => compose(id);
submits["compose-doc"] = (f, d) => compose(d.id, d.doc);
submits["send-message"] = async (f, d) => {
  await mutate(
    {
      action: "message",
      id: d.id,
      doc: d.doc,
      subject: d.subject,
      body:
        d.body +
        (d.signature ? "\n\n" + app.data.settings.company + "　" + staffName(app.data.me) : ""),
    },
    "お客様ページと対応履歴に保存しました。",
  );
};
for (const [a, label] of [
  ["cash", "現金の受領を記録"],
  ["other", "その他の支払いを記録"],
  ["card", "カード決済案内を送信"],
])
  clicks[a] = (id) => {
    const b = booking(id);
    editor(
      label,
      hidden(b) +
        input("act", a, "hidden") +
        kv([
          ["お客様", e(customer(b.customer).name)],
          ["金額", money(b.final)],
          ["担当", e(staffName(app.data.me))],
        ]) +
        (a === "card" ? `<p class="notice">デモの決済リンクがお客様ページに届きます。</p>` : ""),
      "pay",
      a === "card" ? "デモ送信する" : "受領を確定する",
      id,
    );
  };
submits.pay = (f, d) =>
  mutate({ action: d.act, id: d.id, version: d.version }, "精算情報を更新しました。");
clicks["edit-customer"] = (id) => {
  const c = customer(id);
  editor(
    "顧客情報を編集",
    input("id", id, "hidden") +
      `<div class="formgrid">${[
        ["氏名", "name"],
        ["電話番号", "phone"],
        ["メールアドレス", "email"],
        ["エリア", "area"],
        ["住所", "address"],
      ]
        .map(([t, k]) =>
          field(t, input(k, c[k], k === "email" ? "email" : "text", "required"), k === "address"),
        )
        .join(
          "",
        )}${field("性別", select("gender", ["男性", "女性", "その他"], c.gender, "未指定"))}${field("サブステータス", `<div class="checks">${app.data.tags.map((t) => `<label><input type="checkbox" name="tag" value="${e(t.id)}" ${c.tags.includes(t.id) ? "checked" : ""}> ${e(t.name)}</label>`).join("")}</div>`, true)}${field("顧客メモ", note("memo", c.memo), true)}</div>${button("delete-customer", "顧客名簿から削除", id, "btn danger")}`,
    "customer",
    "保存する",
    id,
  );
};
submits.customer = (f, d) =>
  mutate(
    { action: "customer", ...d, tags: new FormData(f).getAll("tag") },
    "顧客情報を保存しました。",
  );
clicks["delete-customer"] = (id) =>
  editor(
    "顧客名簿から削除",
    input("id", id, "hidden") +
      `<p>${e(customer(id).name)} 様の連絡先を削除します。既存の予約・精算には受付番号が残ります。</p>`,
    "delete-customer",
    "削除する",
  );
submits["delete-customer"] = async (f, d) => {
  await mutate({ action: "deleteCustomer", id: d.id }, "名簿から削除しました。");
  location.hash = "#customers";
};
