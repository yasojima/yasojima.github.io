import {
  app,
  clicks,
  submits,
  pages,
  e,
  icon,
  link,
  button,
  pill,
  staff,
  booking,
  customer,
  vehicle,
  staffName,
  isAdmin,
  dateLabel,
  stamp,
  hrefDetail,
  kv,
  dialogHTML,
  editor,
  closeEditor,
  disposeCharts,
  values,
  api,
  toast,
  daysLeft,
  dueLabel,
  attention,
  input,
  field,
} from "./ui.js";
import {
  dashboard,
  mountDashboard,
  bookings,
  schedule,
  mountSchedule,
  customers,
} from "./workspace.js";
import { sales, mountSales, fleet, tags, audit, settings, carDetail } from "./office.js";
import { reservationDetail, personDetail } from "./details.js";
import { publicMain } from "./public.js";
import {disposeCrew} from "./crew.js";

const views = { dashboard, bookings, schedule, customers, sales, fleet, tags, audit, settings };
const dialog = document.getElementById("detail");
let lastBase = "#dashboard",
  seen = "",
  lastAnchor = "",
  refreshing = false,
  mobileOpen = false;
function noticeRows() {
  const b = app.data.bookings.filter((b) => attention(b));
  const cars = app.data.vehicles.filter((v) => daysLeft(v.due) <= 183);
  const births = app.data.staff.filter(
    (s) => s.active && s.birthday?.slice(5) === app.data.today.slice(5),
  );
  return [
    ...cars.map((v) => ({
      name: v.model,
      sub: "点検・更新期限 " + v.due,
      text: dueLabel(v)[0],
      href: `#fleet/car/${v.id}`,
    })),
    ...b.map((x) => ({
      name: customer(x.customer)?.name,
      sub: x.date + " " + x.start + " · " + x.service,
      text: attention(x),
      href: `#schedule/booking/${x.id}`,
    })),
    ...births.map((x) => ({
      name: x.name + "さんの誕生日です",
      sub: "お祝いを開く",
      text: "誕生日",
      id: x.id,
    })),
  ];
}
function navItems() {
  const visible = pages.filter(([id]) => isAdmin() || id !== "audit");
  const groups = [
    ["業務", ["dashboard", "bookings", "schedule", "customers"]],
    ["運営管理", ["sales", "fleet", "tags"]],
    ["システム", ["audit", "settings", "logout"]],
  ];
  return groups
    .map(
      ([label, ids]) =>
        `<div class="navgroup">${label}</div>${visible
          .filter(([id]) => ids.includes(id))
          .map(([id, t, i]) =>
            id === "logout"
              ? `<a class="navitem" href="#logout" data-act="logout">${icon(i)} ${e(t)}</a>`
              : link("#" + id, icon(i) + e(t), "navitem" + (app.page === id ? " active" : "")),
          )
          .join("")}`,
    )
    .join("");
}
function shell(body) {
  const s = app.data,
    me = staff(s.me),
    page = pages.find(([id]) => id === app.page),
    notes = noticeRows().length;
  return `<div class="demobar"><div class="group"><span class="mode"><i class="live-dot"></i>操作デモ · ブラウザ内に保存</span><span class="rolecaption">表示する権限</span>${button("switch-role", "管理者", "admin", "rolebtn" + (isAdmin() ? " current" : ""))}${button("switch-role", "現場スタッフ", "field", "rolebtn" + (!isAdmin() ? " current" : ""))}</div><a class="publiclink" href="/exops-field-demo/customer/" target="_blank" rel="noopener">${icon("mobile-screen-button")} お客様の予約ページ</a></div>
 <div class="shell"><aside class="side"><a href="#dashboard" class="brand"><img src="/exops-field-demo/logo.png" alt="EXOPS"><span><b>${e(s.settings.company)}</b><small>業務管理画面</small></span></a>
 <nav aria-label="メインメニュー">${navItems()}</nav><div class="profile"><span class="avatar">${e(me.nick.slice(0, 1))}</span><span>${e(me.name)}<small>${e(me.role)}</small></span></div></aside>
 <div class="workspace body-${e(app.page)}"><header class="top"><div>${button("hamb", icon("bars"), "", "iconbtn hamb", 'aria-label="メニュー" aria-expanded="' + mobileOpen + '"')}<h1>${icon(page[2])}${e(page[1])}</h1></div>
 <div><span class="date">${e(dateLabel(s.today, true))}</span>${button("refresh", icon("rotate") + " <span class='refreshtext'>更新</span>", "", "btn", 'aria-label="更新"')}${button("notifications", icon("bell") + (notes ? `<b class="badgecount">${notes}</b>` : ""), "", "iconbtn", `aria-label="通知 ${notes}件"`)}</div></header>
 <main id="main" class="content">${body}</main></div></div>`;
}
function readRoute() {
  const raw = location.hash.slice(1) || "dashboard",
    [path, query] = raw.split("?"),
    parts = path.split("/").map(decodeURIComponent);
  let page = parts[0];
  if (!views[page]) {
    page = "dashboard";
    parts[0] = "dashboard";
  }
  app.page = page;
  app.parts = parts;
  if (query === "attention=1" && raw !== lastAnchor) app.filters.bookings = { attention: "1" };
  lastAnchor = raw;
  const type = parts[1],
    key = parts[2];
  if (!["booking", "person", "car"].includes(type) || !key) {
    lastBase = "#" + raw;
    seen = "";
    return null;
  }
  return { type, key, tab: parts[3] };
}
function render() {
  if (!app.data) return;
  const route = readRoute();
  disposeCrew();
  disposeCharts();
  const body = views[app.page]();
  document.getElementById("root").innerHTML = shell(body);
  document.title = pages.find((p) => p[0] === app.page)[1] + "｜EXOPS";
  if (app.page === "dashboard") mountDashboard();
  if (app.page === "sales") mountSales();
  if (app.page === "schedule") mountSchedule().catch((err) => toast(err.message, true));
  if (route) {
    const { type, key, tab } = route;
    const target =
      type === "booking" ? booking(key) : type === "person" ? customer(key) : vehicle(key);
    if (!target) {
      toast("対象の記録がありません。", true);
      location.hash = "#" + app.page;
      return;
    }
    const content =
      type === "booking"
        ? reservationDetail(target, tab)
        : type === "person"
          ? personDetail(target, tab)
          : carDetail(target);
    const scroll = seen === type + key ? dialog.scrollTop : 0;
    dialog.innerHTML = content;
    if (!dialog.open) dialog.showModal();
    dialog.scrollTop = scroll;
    if (seen !== type + key) {
      seen = type + key;
      if (type !== "car")
        api("action", {
          action: "view",
          ...(type === "booking" ? { booking: key } : { id: key }),
        }).catch((err) => toast(err.message, true));
    }
  } else if (dialog.open) dialog.close();
}
async function refresh() {
  const data = await api("state");
  app.data = data;
  render();
}
app.refresh = refresh;
app.render = render;
function loginView() {
  disposeCrew();
  app.data = null;
  if (dialog.open) dialog.close();
  closeEditor();
  disposeCharts();
  const box = document.getElementById("root");
  box.innerHTML = `<main class="login" id="main"><div class="publicbrand"><img src="/exops-field-demo/favicon.png" alt=""><div><strong>EXOPS</strong><small>出張サービス管理画面</small></div></div><section class="panel"><div class="panelhead"><h1>ログイン</h1></div><div class="pad stack"><p>架空のデータで管理者と現場スタッフの操作を試せます。</p><div class="actions">${button("switch-role", "管理者で試す", "admin", "btn primary")}${button("switch-role", "現場スタッフで試す", "field")}</div><details><summary>登録したアカウントでログイン</summary><form class="stack pad" data-form="login">${field("ログインID", input("login", "", "text", "required"))}${field("パスワード", input("password", "", "password", "required"))}<button class="btn primary">ログイン</button><p class="formerror" role="alert"></p></form></details></div></section><a href="/exops-field-demo/customer/" class="textlink">お客様の予約ページへ</a></main>`;
}
async function login(payload, keepPage = false) {
  await api("login", payload);
  localStorage.removeItem("exops.preview.loggedout");
  closeEditor();
  if (dialog.open) dialog.close();
  seen = "";
  if (!keepPage && location.hash !== "#dashboard") history.replaceState({}, "", "#dashboard");
  await refresh();
}
clicks["switch-role"] = (id) => login({ demo: id });
submits.login = (f, d) => login(d);
clicks.logout = async () => {
  await api("logout", {});
  localStorage.setItem("exops.preview.loggedout", "yes");
  history.replaceState({}, "", "#login");
  loginView();
};
clicks.hamb = () => {
  mobileOpen = !mobileOpen;
  document.body.classList.toggle("nav-open", mobileOpen);
  document.querySelector(".hamb")?.setAttribute("aria-expanded", String(mobileOpen));
};
clicks.refresh = async () => {
  await refresh();
  toast("最新の予約・稼働状況を読み込みました。");
};
clicks["close-editor"] = closeEditor;
clicks["close-detail"] = () => {
  location.hash = lastBase.split("/")[0] === "#" + app.page ? lastBase : "#" + app.page;
};
clicks.notifications = () => {
  const notes = noticeRows(),
    n = document.getElementById("editor");
  n.innerHTML = dialogHTML(
    "通知",
    `<div class="dialogbody list">${notes.length ? notes.map((item) => `<div class="listline"><span><b>${e(item.name)}</b><small class="sub">${e(item.sub)}</small></span>${item.href ? link(item.href, e(item.text), "btn tiny") : button("birthday", "お祝いを見る", item.id, "btn tiny")}</div>`).join("") : "<p>新しい通知はありません。</p>"}</div>`,
  );
  if (!n.open) n.showModal();
};
clicks.birthday = (id) => {
  const n = document.getElementById("editor");
  n.innerHTML = dialogHTML(
    "お誕生日おめでとうございます",
    `<div class="dialogbody"><div class="present" aria-hidden="true">🎉 🎁 🎊</div><p>${e(staff(id).name)}さん、よい一年をお過ごしください。</p></div>`,
  );
};
dialog.addEventListener("cancel", (ev) => {
  ev.preventDefault();
  clicks["close-detail"]();
});
document.addEventListener("click", async (ev) => {
  const el = ev.target.closest("[data-act]");
  if (!el) {
    if (ev.target.closest("a[href^='#']")) {
      closeEditor();
      mobileOpen = false;
      document.body.classList.remove("nav-open");
    }
    return;
  }
  ev.preventDefault();
  if (el.disabled) return;
  const fn = clicks[el.dataset.act];
  if (!fn) return;
  try {
    await fn(el.dataset.id, el);
  } catch (err) {
    showError(err, el.closest("dialog"));
  }
});
function showError(err, container) {
  const note = container?.querySelector(".formerror");
  if (note) {
    note.textContent = err.message;
    note.scrollIntoView({ block: "nearest" });
  } else toast(err.message, true);
}
for (const event of ["input", "change"])
  document.addEventListener(event, (ev) => {
    const form = ev.target.closest("form");
    if (form) form.dataset.dirty = "1";
  });
document.addEventListener("submit", async (ev) => {
  const f = ev.target.closest("form[data-form]");
  if (!f) return;
  ev.preventDefault();
  if (f.dataset.busy) return;
  const handler = submits[f.dataset.form];
  if (!handler) return;
  const btn = ev.submitter;
  f.dataset.busy = "1";
  if (btn) btn.disabled = true;
  try {
    await handler(f, values(f));
  } catch (err) {
    showError(err, f);
  } finally {
    delete f.dataset.busy;
    if (btn) btn.disabled = false;
  }
});
if (/\/customer\/?$/.test(location.pathname)) publicMain();
else {
  window.addEventListener("hashchange", () => {
    if (app.data) {
      mobileOpen = false;
      document.body.classList.remove("nav-open");
      render();
    }
  });
  (async () => {
    try {
      await refresh();
    } catch (err) {
      if (err.status === 401 && !localStorage.getItem("exops.preview.loggedout")) {
        await login({ demo: "admin" }, true);
      } else {
        loginView();
        if (err.status !== 401) toast(err.message, true);
      }
    }
  })().catch((err) => {
    loginView();
    toast(err.message, true);
  });
  setInterval(async () => {
    if (
      !app.data ||
      refreshing ||
      document.hidden ||
      document.querySelector("#editor[open]") ||
      document.activeElement?.matches("input,select,textarea") ||
      document.querySelector(".flatpickr-calendar.open,form[data-dirty='1']")
    )
      return;
    refreshing = true;
    try {
      const { revision } = await api("revision");
      if (revision !== app.data.revision) await refresh();
    } catch (err) {
      if (err.status === 401) loginView();
    } finally {
      refreshing = false;
    }
  }, 3500);
}
