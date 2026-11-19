import {
  e,
  icon,
  button,
  pill,
  stages,
  money,
  stamp,
  dateLabel,
  field,
  input,
  select,
  note,
  kv,
  panel,
  dialogHTML,
  editor,
  closeEditor,
  api,
  toast,
  filesFrom,
  values,
  clicks,
  submits,
} from "./ui.js";

const state = {
  token: new URL(location.href).searchParams.get("token"),
  slot: "",
  day: "",
  info: null,
  slots: null,
  requestKey: crypto.randomUUID(),
};
const root = () => document.getElementById("root");
const slotBox = () => document.getElementById("public-slots");
function heading(company) {
  return `<header class="publicbrand"><img src="/exops-field-demo/logo.png" alt="EXOPS"><div><strong>${e(company)}</strong><small>出張サービス · お客様専用ページ</small></div></header>`;
}
function localNote() {
  return `<p class="localnote">このMacで試せる操作デモです。入力には架空の情報をお使いください。メール・カード決済はデモ内で再現します。</p>`;
}
function slotView() {
  const slots = state.slots;
  return slots.slots.length
    ? `<div class="slotgrid">${slots.slots.map((s) => button("public-slot", e(s.start), s.start, "slot" + (state.slot === s.start ? " active" : ""), `aria-pressed="${state.slot === s.start}"`)).join("")}</div>`
    : `<p class="notice warn">${slots.closed ? "会社休業日です。" : "現在この日に受付できる枠はありません。"} 別の日付を選んでください。</p>`;
}
async function fetchDay(day) {
  const r = await api("slots?date=" + encodeURIComponent(day));
  if (state.day !== day) return;
  state.slots = r;
  state.slot = "";
  if (slotBox()) slotBox().innerHTML = slotView();
}
async function showBook() {
  const initial = await api("slots");
  state.day = initial.today;
  state.slots = initial;
  const cfg = state.slots;
  root().innerHTML = `<main class="publicmain" id="main">${heading(cfg.company)}<div class="pagehead"><div><h1>無料の訪問見積もり</h1><p>訪問日時を選び、ご依頼の内容をお知らせください。</p></div></div>
 <form class="stack" data-form="public-book">${panel("1. ご希望の訪問日時", `<div class="pad stack">${field("ご希望日（シドニー時間）", input("date", state.day, "text", 'id="public-date" required'))}<div id="public-slots">${slotView()}</div></div>`)}
 ${panel("2. ご依頼の内容", `<div class="pad formgrid">${field("サービス", select("service", cfg.services, cfg.services[0]))}${field("ご依頼の内容・現場の状況", note("notes", "", 'placeholder="例　ベッド1台の回収。玄関まで階段が5段あります。" required'))}${field("写真・動画を添付（任意）", '<input name="files" type="file" accept="image/jpeg,image/png,image/webp,video/mp4,video/quicktime,video/webm" multiple>')}<p class="hint">対象物や搬出経路が分かる資料をお送りください。デモは1回5件、各5MBまでです。</p></div>`)}
 ${panel(
   "3. お客様情報",
   `<div class="pad formgrid">${[
     ["お名前", "name", "text"],
     ["メールアドレス", "email", "email"],
     ["電話番号", "phone", "tel"],
     ["お住まいのエリア", "area", "text"],
     ["訪問先住所", "address", "text"],
   ]
     .map(([t, k, ty]) => field(t, input(k, "", ty, "required")))
     .join(
       "",
     )}<p class="notice">ご予約は無料見積もりの訪問です。現場で料金をご確認いただき、作業を依頼するかお選びいただけます。当日のご連絡はメールをご確認ください。</p><button class="btn primary submit">無料見積もりを依頼する</button><p class="formerror" role="alert"></p></div>`,
 )}
 </form>${localNote()}</main>`;
  const picker = document.getElementById("public-date");
  flatpickr(picker, {
    locale: "ja",
    defaultDate: state.day,
    minDate: initial.today,
    disableMobile: true,
    disable: [
      (val) => {
        const day = [
          val.getFullYear(),
          String(val.getMonth() + 1).padStart(2, "0"),
          String(val.getDate()).padStart(2, "0"),
        ].join("-");
        return cfg.holidays.includes(day) || cfg.weekly.includes((val.getDay() + 6) % 7);
      },
    ],
    onChange: (_, day) => {
      if (day) {
        state.day = day;
        fetchDay(day).catch((err) => toast(err.message, true));
      }
    },
  });
}
clicks["public-slot"] = (id) => {
  state.slot = id;
  slotBox().innerHTML = slotView();
};
submits["public-book"] = async (form, d) => {
  if (!state.slot) throw Error("ご希望の空き時間を選択してください。");
  const files = await filesFrom(form.elements.files);
  const res = await api("book", {
    ...d,
    requestKey: state.requestKey,
    date: state.day,
    start: state.slot,
    files,
  });
  history.replaceState({}, "", "/exops-field-demo/customer/?token=" + encodeURIComponent(res.token));
  state.token = res.token;
  await showTicket();
  toast("無料見積もりを受け付けました。");
};
function messageList(b) {
  return b.messages
    .slice()
    .reverse()
    .map(
      (m) =>
        `<article class="message ${m.direction === "受信" ? "inbound" : ""}"><b>${e(m.subject)}</b><small class="sub">${e(stamp(m.at))} · ${m.direction === "受信" ? "お客様" : e(b.company)}</small><p>${e(m.body)}</p>${m.doc ? `<a target="_blank" class="textlink" href="/exops-field-demo/api/pdf?id=${encodeURIComponent(m.doc)}&token=${encodeURIComponent(state.token)}">${icon("paperclip")} 添付されたPDFを開く</a>` : ""}</article>`,
    )
    .join("");
}
async function showTicket() {
  const b = await api("public?token=" + encodeURIComponent(state.token));
  state.info = b;
  const confirm = b.confirmed
    ? `<div class="notice">確認者 ${e(b.signed)} 様　${e(stamp(b.confirmed))}</div>`
    : b.final !== null && !["declined", "cancelled"].includes(b.status)
      ? button("public-sign", icon("signature") + " 作業の完了を確認する", "", "btn primary")
      : "";
  const card = ["案内済み", "失敗", "保留"].includes(b.payment)
    ? button("public-pay", icon("credit-card") + " カード決済を試す", "", "btn primary")
    : "";
  root().innerHTML = `<main class="publicmain" id="main">${heading(b.company)}<div class="pagehead"><div><h1>ご予約の確認</h1><p>${e(b.name)} 様</p></div>${pill(stages[b.status]?.[0] || b.status, "green")}</div>
 ${panel(
   "無料見積もりの受付",
   `<div class="pad stack">${kv([
     ["受付番号", e(b.id)],
     ["訪問日時", e(dateLabel(b.date, true) + " " + b.start)],
     ["サービス", e(b.service)],
     ["訪問先", e(b.address)],
     ["概算金額", money(b.estimate)],
     ["確定金額", money(b.final)],
     ["精算状況", e(b.payment)],
   ])}${confirm}${card}</div>`,
   "",
   "calendar-check",
 )}
 ${panel("業者とのメッセージ", `<div class="pad stack"><div id="public-messages">${messageList(b)}</div><form data-form="public-reply" class="stack">${field("業者への返信", note("body", "", "required"))}<button class="btn primary">デモ返信を送る</button><p class="formerror" role="alert"></p></form></div>`, "", "envelope")}
 ${["booked", "enroute"].includes(b.status) ? button("public-cancel", "予約を取り消す", "", "btn danger") : ""}${localNote()}</main>`;
}
clicks["public-sign"] = async () => {
  const b = state.info;
  if (!b.inputAt) await api("public-action", { action: "startSign", token: state.token });
  const current = await api("public?token=" + encodeURIComponent(state.token));
  state.info = current;
  editor(
    "作業の完了確認",
    kv([
      ["サービス内容", e(current.service)],
      ["確定金額", money(current.final)],
    ]) +
      field(
        "内容を確認されたお客様のお名前",
        input("name", "", "text", 'required autocomplete="name"'),
      ) +
      input("version", current.version, "hidden"),
    "public-sign",
    "作業の完了を確認する",
    current.id,
  );
};
submits["public-sign"] = async (f, d) => {
  await api("public-action", {
    action: "confirm",
    token: state.token,
    name: d.name,
    version: d.version,
  });
  closeEditor();
  await showTicket();
  toast("完了確認が事務所に届きました。");
};
submits["public-reply"] = async (f, d) => {
  await api("public-action", { action: "reply", token: state.token, body: d.body });
  await showTicket();
  toast("返信を保存しました。");
};
clicks["public-pay"] = () =>
  editor(
    "カード決済の体験",
    `<p class="notice">架空の決済会社の画面です。カード情報の入力や請求は発生しません。</p>${field("決済会社から返す結果", select("result", ["完了", "保留", "失敗"], "完了"))}`,
    "public-pay",
    "この結果を反映",
  );
submits["public-pay"] = async (f, d) => {
  await api("public-action", { action: "cardResult", token: state.token, result: d.result });
  closeEditor();
  await showTicket();
  toast("デモの決済結果を反映しました。");
};
clicks["public-cancel"] = () =>
  editor(
    "ご予約の取り消し",
    `<p>受付番号 ${e(state.info.id)} の無料見積もりを取り消します。</p>`,
    "public-cancel",
    "取り消しを確定",
  );
submits["public-cancel"] = async () => {
  await api("public-action", { action: "cancel", token: state.token });
  closeEditor();
  state.token = "";
  root().innerHTML = `<main class="publicmain">${heading(state.info.company)}${panel("予約を取り消しました", `<div class="pad"><a href="/exops-field-demo/customer/" class="btn">新しく見積もりを依頼する</a></div>`)}</main>`;
};
export async function publicMain() {
  document.title = "お客様の無料見積もり｜EXOPS";
  try {
    if (state.token) {
      await showTicket();
      setInterval(async () => {
        if (!state.token || document.hidden || document.querySelector("dialog[open]")) return;
        try {
          const b = await api("public?token=" + encodeURIComponent(state.token));
          if (b.version !== state.info.version) {
            if (
              document.activeElement?.tagName === "TEXTAREA" ||
              document.querySelector("textarea")?.value
            ) {
              const box = document.querySelector("#public-messages");
              if (box) box.innerHTML = messageList(b);
            } else await showTicket();
          }
        } catch (err) {
          if (err.status === 400) unavailable(err.message);
        }
      }, 4000);
    } else await showBook();
  } catch (err) {
    unavailable(err.message);
  }
}
function unavailable(text) {
  root().innerHTML = `<main class="publicmain">${heading("EXOPS")}${panel("予約ページ", `<div class="pad stack"><p>${e(text)}</p><a class="btn" href="/exops-field-demo/customer/">無料見積もりページへ</a></div>`)}</main>`;
}
