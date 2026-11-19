export const app = {
  data: null,
  page: "dashboard",
  parts: [],
  filters: {},
  charts: [],
  calendar: null,
  refresh: null,
  render: null,
};
export const clicks = {},
  submits = {};
export const pages = [
  ["dashboard", "ダッシュボード", "gauge-high"],
  ["bookings", "予約管理", "clipboard-list"],
  ["schedule", "スケジュール管理", "calendar-days"],
  ["customers", "顧客名簿", "address-book"],
  ["sales", "売上管理", "chart-column"],
  ["fleet", "車両管理", "truck"],
  ["tags", "ステータス管理", "tags"],
  ["audit", "ログ監視", "shield-halved"],
  ["settings", "設定管理", "gear"],
  ["logout", "ログアウト", "right-from-bracket"],
];
export const stages = {
  booked: ["訪問予定", "blue"],
  enroute: ["移動中", "purple"],
  onsite: ["到着済み", "amber"],
  working: ["作業中", "amber"],
  done: ["完了確認済み", "green"],
  declined: ["見積もりのみ", "gray"],
  cancelled: ["取消", "gray"],
};
export const e = (x) =>
  String(x ?? "").replace(
    /[&<>"']/g,
    (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c],
  );
export const icon = (n) => `<i aria-hidden="true" class="fa-solid fa-${e(n)}"></i>`;
export const link = (href, text, cl = "") => `<a class="${cl}" href="${e(href)}">${text}</a>`;
export const button = (action, text, id = "", cl = "btn", misc = "") =>
  `<button type="button" class="${cl}" data-act="${e(action)}" data-id="${e(id)}" ${misc}>${text}</button>`;
export const pill = (text, color = "gray") => `<span class="pill ${e(color)}">${e(text)}</span>`;
export const stage = (b) => pill(...(stages[b.status] || [b.status, "gray"]));
export const payPill = (b) =>
  pill(
    b.payment,
    b.payment === "精算済み"
      ? "green"
      : b.payment === "失敗"
        ? "red"
        : b.payment === "未精算"
          ? "gray"
          : "amber",
  );
export const find = (rows, id) => rows.find((row) => row.id === id);
export const customer = (id) => find(app.data.customers, id);
export const staff = (id) => find(app.data.staff, id);
export const vehicle = (id) => find(app.data.vehicles, id);
export const booking = (id) => find(app.data.bookings, id);
export const isAdmin = () => staff(app.data.me)?.role === "管理者";
export const staffName = (id) => staff(id)?.nick || id || "―";
export const carName = (id) => vehicle(id)?.model || "―";
export const money = (val) =>
  val === null || val === undefined
    ? "―"
    : new Intl.NumberFormat("ja-JP", {
        style: "currency",
        currency: "AUD",
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      }).format(val);
export function dateAdd(day, n) {
  const d = new Date(day + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}
export function dateLabel(day, full = false) {
  return day
    ? new Intl.DateTimeFormat("ja-JP", {
        ...(full ? { year: "numeric" } : {}),
        month: "numeric",
        day: "numeric",
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(day.slice(0, 10) + "T12:00Z"))
    : "―";
}
export const stamp = (t) => (t ? `${t.slice(0, 10).replaceAll("-", "/")} ${t.slice(11, 16)}` : "―");
export const order = (a, b) => (a.date + " " + a.start).localeCompare(b.date + " " + b.start);
export const minute = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));
export const hhmm = (n) =>
  String(Math.floor(n / 60)).padStart(2, "0") + ":" + String(n % 60).padStart(2, "0");
export const ending = (b) => hhmm(minute(b.start) + b.duration);
export function hrefDetail(type, id, tab = "") {
  return `#${app.page}/${type}/${encodeURIComponent(id)}${tab ? "/" + tab : ""}`;
}
export const bookLink = (b, text) => link(hrefDetail("booking", b.id), text || e(b.id), "textlink");
export const customerLink = (id, text) =>
  link(hrefDetail("person", id), text || e(customer(id)?.name), "textlink");
export const opt = (value, label, selected) =>
  `<option value="${e(value)}"${String(value) === String(selected) ? " selected" : ""}>${e(label)}</option>`;
export const options = (items, value, all) =>
  (all !== undefined ? opt("", all, value) : "") +
  items.map((i) => (Array.isArray(i) ? opt(i[0], i[1], value) : opt(i, i, value))).join("");
export const field = (title, input, wide = false) =>
  `<label class="field ${wide ? "wide" : ""}"><span>${e(title)}</span>${input}</label>`;
export const input = (name, value = "", type = "text", attrs = "") =>
  `<input name="${e(name)}" type="${e(type)}" value="${e(value)}" ${attrs}>`;
export const select = (name, items, value, all) =>
  `<select name="${e(name)}">${options(items, value, all)}</select>`;
export const note = (name, value = "", attrs = "") =>
  `<textarea name="${e(name)}" rows="3" ${attrs}>${e(value)}</textarea>`;
export const hint = (text) => `<p class="hint">${e(text)}</p>`;
export const empty = (text) => `<div class="empty">${e(text)}</div>`;
export const kv = (items) =>
  `<dl class="kv">${items.map(([key, val]) => `<div><dt>${e(key)}</dt><dd>${val ?? "―"}</dd></div>`).join("")}</dl>`;
export const panel = (title, body, actions = "", ic = "") =>
  `<section class="panel"><header class="panelhead"><h2>${ic ? icon(ic) : ""}${e(title)}</h2>${actions}</header>${body}</section>`;
export const tabs = (rows, selected) =>
  `<nav class="tabs" aria-label="ページ内表示">${rows.map(([id, t, h]) => link(h, e(t), selected === id ? "selected" : "")).join("")}</nav>`;
export function table(heads, rows, label = "該当する記録はありません。") {
  return rows.length
    ? `<table><thead><tr>${heads.map((t) => `<th scope="col">${e(t)}</th>`).join("")}</tr></thead><tbody>${rows.map((cells) => `<tr>${cells.map((cell, i) => `<td data-label="${e(heads[i] || "")}">${cell ?? "―"}</td>`).join("")}</tr>`).join("")}</tbody></table>`
    : empty(label);
}
export const metric = (title, value, unit, detail, ic, color = "green", href = "") => {
  const html = `<span class="metric-top">${e(title)}<span class="metric-icon ${color}">${icon(ic)}</span></span><strong>${e(value)}<small>${e(unit)}</small></strong><span class="metric-note">${e(detail)}</span>`;
  return href ? link(href, html, "metric " + color) : `<div class="metric ${color}">${html}</div>`;
};
export async function api(path, data) {
  const opts =
    data === undefined
      ? {}
      : {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        };
  const res = await fetch("/exops-field-demo/api/" + path, { ...opts, cache: "no-store" });
  const value = await res.json();
  if (!res.ok) {
    const er = new Error(value.error || "読み込みに失敗しました。");
    er.status = res.status;
    throw er;
  }
  return value;
}
export function toast(text, error = false) {
  const n = document.querySelector("#toast");
  n.textContent = text;
  n.className = error ? "on error" : "on";
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => (n.className = ""), 4300);
}
export function dialogHTML(title, body, desc = "", close = "close-editor") {
  return `<header class="dialoghead"><div>${desc ? `<span class="overline">${e(desc)}</span>` : ""}<h2>${e(title)}</h2></div>${button(close, icon("xmark"), "", "iconbtn", 'aria-label="閉じる"')}</header>${body}`;
}
export const formFoot = (text = "保存する") =>
  `<footer class="formfoot">${button("close-editor", "閉じる")}<button class="btn primary" type="submit">${e(text)}</button></footer>`;
export function editor(title, body, form, submit = "保存する", desc = "") {
  const d = document.querySelector("#editor");
  d.innerHTML = dialogHTML(
    title,
    `<form data-form="${e(form)}"><div class="dialogbody">${body}<p class="formerror" role="alert"></p></div>${formFoot(submit)}</form>`,
    desc,
  );
  if (!d.open) d.showModal();
  return d;
}
export function closeEditor() {
  const d = document.querySelector("#editor");
  if (d.open) d.close();
}
export async function mutate(payload, msg, keep = false) {
  const result = await api("action", payload);
  if (!keep) closeEditor();
  await app.refresh();
  if (msg) toast(msg);
  return result;
}
export function values(form) {
  const data = Object.fromEntries(new FormData(form));
  for (const sel of form.querySelectorAll("select[multiple]"))
    data[sel.name] = [...sel.selectedOptions].map((o) => o.value);
  return data;
}
export async function filesFrom(inp) {
  const list = [...inp.files];
  if (list.length > 5 || list.some((f) => f.size > 5 * 1024 * 1024))
    throw Error("デモの添付は1回5件、1件5MBまでです。");
  return Promise.all(
    list.map(
      (file) =>
        new Promise((resolve, reject) => {
          const r = new FileReader();
          r.onload = () => resolve({ name: file.name, data: r.result.split(",")[1] });
          r.onerror = () => reject(Error("ファイルを読み込めませんでした。"));
          r.readAsDataURL(file);
        }),
    ),
  );
}
export function csv(name, rows) {
  const quote = (v) => {
    let text = String(v ?? "");
    if (/^[=+\-@\t\r]/.test(text)) text = "'" + text;
    return '"' + text.replaceAll('"', '""') + '"';
  };
  const blob = new Blob(["\uFEFF" + rows.map((r) => r.map(quote).join(",")).join("\r\n")], {
    type: "text/csv;charset=utf-8",
  });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name + ".csv";
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}
export function paid(c) {
  return app.data.bookings.filter((b) => b.customer === c.id && b.payment === "精算済み");
}
export function attention(b) {
  if (b.confirmed || ["cancelled", "declined"].includes(b.status)) return "";
  if (b.inputAt) return "確認待ち";
  return b.date + "T" + ending(b) < app.data.now.slice(0, 16) ? "要確認" : "";
}
export function daysLeft(day) {
  return Math.round((new Date(day + "T12:00Z") - new Date(app.data.today + "T12:00Z")) / 86400000);
}
export function dueLabel(car) {
  const n = daysLeft(car.due);
  return n < 0
    ? ["期限超過", "red"]
    : n <= 30
      ? ["1か月以内", "amber"]
      : n <= 92
        ? ["3か月以内", "amber"]
        : n <= 183
          ? ["6か月以内", "blue"]
          : ["期限内", "green"];
}
export function disposeCharts() {
  app.charts.splice(0).forEach((c) => c.destroy());
  if (app.calendar) {
    app.calendar.destroy();
    app.calendar = null;
  }
}
export const denied = () =>
  panel(
    "閲覧権限",
    `<p class="notice">${icon("lock")} 管理者権限のあるスタッフにご確認ください。</p>`,
  );
