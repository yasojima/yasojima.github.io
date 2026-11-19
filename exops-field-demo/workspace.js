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
  stages,
  payPill,
  customer,
  staff,
  vehicle,
  staffName,
  carName,
  money,
  dateAdd,
  dateLabel,
  stamp,
  order,
  ending,
  hrefDetail,
  bookLink,
  customerLink,
  opt,
  options,
  field,
  input,
  select,
  note,
  panel,
  table,
  metric,
  empty,
  editor,
  mutate,
  values,
  csv,
  paid,
  attention,
  daysLeft,
  dueLabel,
  api,
  toast,
  tabs,
  hhmm,
  minute,
} from "./ui.js";
import {crewPanel, mountCrew} from "./crew.js";

const color = {
  booked: "#4988a6",
  enroute: "#8162a1",
  onsite: "#be8335",
  working: "#b77a26",
  done: "#4c8960",
  declined: "#7e8982",
  cancelled: "#9b9e9b",
};
const activeStaff = () => app.data.staff.filter((s) => s.active && (s.field ?? s.role !== "管理者"));
const activeCars = () => app.data.vehicles.filter((v) => v.active);
const selectStaff = () => activeStaff().map((s) => [s.id, s.name]);
const selectCars = () => activeCars().map((v) => [v.id, v.model]);
const btnSearch = `<button class="btn primary">${icon("magnifying-glass")} 検索</button>`;
const filters = (id, html) =>
  `<form class="filterbox filters" data-form="${id}">${html}<div class="actions">${btnSearch}${button("reset-search", "解除", id, "btn")}</div></form>`;
const sortedBookings = () => [...app.data.bookings].sort(order);
const timeCell = (b) => `<b>${e(b.start)}</b><small class="sub">${e(ending(b))} 終了予定</small>`;
const personCell = (b) =>
  `${bookLink(b, e(customer(b.customer)?.name))}<small class="sub">${e(b.service)}</small>`;
const staffCell = (b) => `${e(staffName(b.staff))}<span class="sub">${e(carName(b.vehicle))}</span>`;
function contacts(c) {
  const current = app.data.bookings
    .filter((b) => b.customer === c.id)
    .sort((a, b) => Math.abs(dateDiff(a.date)) - Math.abs(dateDiff(b.date)) || order(a, b))[0];
  const tel = c.phone
    ? `<a href="tel:${e(c.phone)}" class="iconbtn" aria-label="${e(c.name)}様に電話">${icon("phone")}</a>`
    : "";
  const chat = current
    ? `<a href="${e(hrefDetail("booking", current.id, "messages"))}" class="iconbtn" aria-label="${e(c.name)}様のメッセージ">${icon("comment")}</a>`
    : "";
  return `<span class="contacticons">${tel}${chat}</span>`;
}
const rowSummary = (b) => [
  timeCell(b),
  personCell(b),
  e(customer(b.customer)?.area),
  staffCell(b),
  stage(b),
];
export function dashboard() {
  const s = app.data,
    list = sortedBookings().filter((b) => b.date === s.today),
    active = list.filter((b) => b.status !== "cancelled");
  const week = dateAdd(s.today, -6);
  const recent = s.bookings.filter(
    (b) =>
      b.payment === "精算済み" && b.paidAt.slice(0, 10) >= week && b.paidAt.slice(0, 10) <= s.today,
  );
  const paidTotal = recent.reduce((a, b) => a + b.final, 0);
  const staffLines = activeStaff()
    .map((p, i) => {
      const own = active.filter((b) => b.staff === p.id);
      const current =
        own.find((b) => ["working", "onsite", "enroute"].includes(b.status)) ||
        own.find((b) => b.status === "booked");
      return `<div class="staffline"><span class="row"><span class="avatar v${i + 1}">${e(p.nick.slice(0, 1))}</span><span><b>${e(p.name)}</b><small class="sub">${current ? e(current.start + " · " + carName(current.vehicle)) : "予定なし"}</small></span></span>${current ? bookLink(current, stage(current)) : pill("空き", "gray")}</div>`;
    })
    .join("");
  const needs = active.filter((b) => attention(b));
  return `<div class="pagehead"><div><h2>本日の業務状況</h2><p class="introdate">${e(dateLabel(s.today, true))}　シドニー時間</p></div>${link("#schedule", icon("calendar-days") + " カレンダーを開く", "btn primary")}</div>
 <div class="metrics">${metric("本日の訪問", active.length, "件", "受付済みの訪問予定", "calendar-check", "green", "#schedule")}${metric("現場で対応中", active.filter((b) => ["enroute", "onsite", "working"].includes(b.status)).length, "件", "移動中・到着済み・作業中", "truck-fast", "blue", "#schedule/dispatch")}${metric("完了確認待ち", needs.length, "件", "入力途中・終了予定超過", "clock", "amber", "#bookings?attention=1")}${metric("直近7日の売上", money(paidTotal), "", "精算済みのサービス代金", "chart-line", "purple", "#sales")}</div>
 <div class="twocol"><div>${panel("売上の推移", `<div class="chartbox"><canvas id="mainchart" aria-label="直近7日間の精算済み売上" role="img"></canvas></div>`, link("#sales", "売上管理", "textlink"), "chart-column")}</div>
 <div>${panel("スタッフの稼働状況", `<div class="roster">${staffLines}</div>`, pill(activeStaff().length + "名", "green"), "people-group")}</div></div>
 <div class="twocol"><div>${panel("本日の訪問予定", table(["時間", "顧客・サービス", "エリア", "担当・車両", "状況"], active.slice(0, 5).map(rowSummary)), link("#schedule", "全" + active.length + "件を確認", "textlink"), "calendar-day")}</div>
 <div>${panel(
   "現場への連絡",
   `<div class="list">${
     [...s.bookings]
       .filter((b) => b.date === s.today)
       .slice(0, 3)
       .map(
         (b) =>
           `<div class="listline"><span><b>${e(customer(b.customer)?.name)}</b><small class="sub">${e(b.start + " · " + b.service)}</small></span>${link(hrefDetail("booking", b.id, "messages"), icon("envelope") + " 連絡", "btn tiny")}</div>`,
       )
       .join("") || empty("本日の連絡先はありません。")
   }</div>`,
   "",
   "comment-dots",
 )}</div></div>`;
}
export function drawRevenue(id, days, amounts) {
  const canvas = document.getElementById(id);
  if (!canvas) return;
  app.charts.push(
    new Chart(canvas, {
      type: "bar",
      data: {
        labels: days,
        datasets: [
          {
            label: "売上（AUD）",
            data: amounts,
            backgroundColor: "#4a8a60",
            hoverBackgroundColor: "#24683b",
            borderRadius: 3,
            maxBarThickness: 36,
          },
        ],
      },
      options: {
        animation: false,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (c) => money(c.raw) } },
        },
        scales: {
          x: { grid: { display: false } },
          y: { beginAtZero: true, ticks: { maxTicksLimit: 5 }, grid: { color: "#edf1ee" } },
        },
      },
    }),
  );
}
export function mountDashboard() {
  const days = Array.from({ length: 7 }, (_, i) => dateAdd(app.data.today, i - 6));
  drawRevenue(
    "mainchart",
    days.map((d) => d.slice(5).replace("-", "/")),
    days.map((d) =>
      app.data.bookings
        .filter((b) => b.payment === "精算済み" && b.paidAt.startsWith(d))
        .reduce((a, b) => a + b.final, 0),
    ),
  );
}
function hit(str, query) {
  return String(str ?? "")
    .toLocaleLowerCase()
    .includes(
      String(query ?? "")
        .trim()
        .toLocaleLowerCase(),
    );
}
function matchesPerson(b, q) {
  const c = customer(b.customer);
  return [b.id, b.customer, c?.name, c?.phone, c?.phone?.replace(/\D/g, ""), b.address].some((v) =>
    hit(v, q),
  );
}
function bookingMatches() {
  const f = app.filters.bookings || {};
  return sortedBookings()
    .filter(
      (b) =>
        (!f.q || matchesPerson(b, f.q)) &&
        (!f.state || b.status === f.state) &&
        (!f.day || b.date === f.day) &&
        (!f.attention || attention(b)),
    )
    .sort((a, b) => Math.abs(dateDiff(a.date)) - Math.abs(dateDiff(b.date)) || order(a, b));
}
function dateDiff(d) {
  return Math.round((new Date(d + "T12:00Z") - new Date(app.data.today + "T12:00Z")) / 86400000);
}
export function bookings() {
  const f = app.filters.bookings || {},
    bs = bookingMatches();
  return (
    filters(
      "bookings",
      field(
        "顧客名・電話番号・受付番号・ユーザーID",
        input("q", f.q, "search", 'placeholder="名前・番号を入力"'),
      ) +
        field("訪問日", input("day", f.day, "date")) +
        field(
          "予約の状況",
          select(
            "state",
            Object.entries(stages).map(([k, v]) => [k, v[0]]),
            f.state,
            "すべて",
          ),
        ) +
        field("完了確認", select("attention", [["1", "確認待ち・要確認"]], f.attention, "すべて")),
    ) +
    panel(
      "予約の検索結果",
      table(
        ["受付番号", "訪問日時", "顧客・サービス", "エリア", "担当・車両", "進み具合"],
        bs.map((b) => [
          bookLink(b),
          `${e(dateLabel(b.date))}<span class="sub">${e(b.start)}</span>`,
          personCell(b),
          e(customer(b.customer)?.area),
          staffCell(b),
          `${stage(b)} ${attention(b) ? pill(attention(b), "amber") : ""}`,
        ]),
      ),
      `<span class="actions">${pill(bs.length + "件", "gray")}${button("export-book", icon("download") + " CSV出力")}</span>`,
      "clipboard-list",
    )
  );
}
clicks["export-book"] = () =>
  csv("予約", [
    ["受付番号", "訪問日", "時刻", "ユーザーID", "顧客名", "サービス", "概算 AUD", "確定 AUD"],
    ...bookingMatches().map((b) => [
      b.id,
      b.date,
      b.start,
      b.customer,
      customer(b.customer)?.name,
      b.service,
      b.estimate,
      b.final,
    ]),
  ]);
const calendarFilters = () =>
  app.filters.schedule ??
  (app.filters.schedule = { day: app.data.today, staff: "", vehicle: "", service: "", length: "60" });
function dayControls(f) {
  return `<div class="actions">${button("day-prev", icon("chevron-left"), "", "iconbtn", 'aria-label="前の日程"')}<input class="datepick" type="text" id="schedule-date" aria-label="表示日" value="${e(f.day)}">${button("day-next", icon("chevron-right"), "", "iconbtn", 'aria-label="次の日程"')}${button("today", "今日")}</div>`;
}
function calendarRows(f) {
  return sortedBookings().filter(
    (b) =>
      (!f.staff || b.staff === f.staff) &&
      (!f.vehicle || b.vehicle === f.vehicle) &&
      (!f.service || b.service === f.service) &&
      b.status !== "cancelled",
  );
}
function intervals(f) {
  return app.data.blocks.filter(
    (b) => (!f.staff || b.staff === f.staff) && (!f.vehicle || b.vehicle === f.vehicle),
  );
}
function blockChip(b) {
  return button(
    "remove-block",
    `${e(b.start + "–" + b.end)} ${e(b.reason)}<small>${e(carName(b.vehicle))}</small>`,
    b.id,
    "eventchip",
  );
}
function dispatch(f) {
  const bs = calendarRows(f).filter((b) => b.date === f.day),
    blocks = intervals(f).filter((b) => b.date === f.day);
  return activeStaff()
    .filter((s) => !f.staff || s.id === f.staff)
    .map((s) => {
      const events = bs
        .filter((b) => b.staff === s.id)
        .map((b) =>
          link(
            hrefDetail("booking", b.id),
            `<b>${e(b.start + "–" + ending(b))}</b> ${e(customer(b.customer)?.name)}<small>${e(b.service)} · ${e(carName(b.vehicle))}</small>`,
            "eventchip",
          ),
        );
      events.push(...blocks.filter((b) => b.staff === s.id).map(blockChip));
      return `<div class="dispatchrow"><strong>${e(s.name)}</strong><div>${events.join("") || `<span class="hint">この日の予定はありません。</span>`}</div></div>`;
    })
    .join("");
}
function mobileWeek(f) {
  const start = dateAdd(f.day, -((new Date(f.day + "T12:00Z").getUTCDay() + 6) % 7));
  return `<nav class="weekdaystrip" aria-label="週内の日付">${Array.from({ length: 7 }, (_, i) => {
    const day = dateAdd(start, i);
    return button(
      "mobile-day",
      e(dateLabel(day).replace(/^\d+\//, "")),
      day,
      "btn" + (day === f.day ? " current" : ""),
    );
  }).join("")}</nav>`;
}
clicks["mobile-day"] = (day) => {
  calendarFilters().day = day;
  app.render();
};
export function schedule() {
  const f = calendarFilters(),
    mode = app.parts[1];
  const view = ["dispatch", "open"].includes(mode) ? mode : "week";
  const week = tabs(
    [
      ["week", "週カレンダー", "#schedule"],
      ["dispatch", "日別の配車", "#schedule/dispatch"],
      ["open", "空き状況", "#schedule/open"],
    ],
    view,
  );
  const title = {
    week: "訪問カレンダー",
    dispatch: "担当者別の配車",
    open: "スタッフ・車両の空き時間",
  }[view];
  const filterHTML =
    field("スタッフ", select("staff", selectStaff(), f.staff, "すべてのスタッフ")) +
    field("車両", select("vehicle", selectCars(), f.vehicle, "すべての車両")) +
    (view === "open"
      ? field(
          "必要な時間",
          select(
            "length",
            [30, 60, 90, 120, 180].map((v) => [v, v + "分"]),
            f.length || 60,
          ),
        )
      : field("サービス", select("service", app.data.services, f.service, "すべてのサービス")));
  let body =
    view === "open"
      ? `<div class="pad" id="available">空き状況を確認中…</div>`
      : view === "dispatch"
        ? dispatch(f)
        : `<div class="calwrap"><div id="calendar"></div></div><div class="mobileagenda">${mobileWeek(f)}${dispatch(f)}</div>`;
  const crew = view === "dispatch" && f.day === app.data.today ? crewPanel() : "";
  return `<div class="pagehead">${week}${button("block-form", icon("plus") + " 社内予定を登録", "", "btn primary")}</div>${crew}${filters("schedule", filterHTML)}${panel(title, body, dayControls(f), "calendar-days")}<div class="legend">${Object.entries(
    stages,
  )
    .filter(([k]) => k !== "cancelled")
    .map(([k, v]) => `<span><i class="dot" style="background:${color[k]}"></i>${e(v[0])}</span>`)
    .join("")}</div>`;
}
export async function mountSchedule() {
  const section = document.querySelector("section.crew");
  if (section) await mountCrew(section);
  const f = calendarFilters(),
    cal = document.querySelector("#calendar"),
    slotbox = document.getElementById("available");
  const date = document.getElementById("schedule-date");
  if (date)
    flatpickr(date, {
      locale: "ja",
      defaultDate: f.day,
      disableMobile: true,
      onChange: (_, day) => {
        if (day) {
          f.day = day;
          app.render();
        }
      },
    });
  if (cal) {
    const events = calendarRows(f).map((b) => ({
      id: b.id,
      title: `${customer(b.customer)?.name} · ${b.service}`,
      start: b.date + "T" + b.start,
      end: b.date + "T" + ending(b),
      backgroundColor: color[b.status],
      borderColor: color[b.status],
      extendedProps: { sub: staffName(b.staff) + " · " + carName(b.vehicle) },
    }));
    for (const b of intervals(f))
      events.push({
        id: b.id,
        title: b.reason,
        start: b.date + "T" + b.start,
        end: b.date + "T" + b.end,
        backgroundColor: "#687572",
        borderColor: "#687572",
        extendedProps: { block: true, sub: staffName(b.staff) },
      });
    app.calendar = new FullCalendar.Calendar(cal, {
      initialView: "timeGridWeek",
      initialDate: f.day,
      locale: "ja",
      firstDay: 1,
      headerToolbar: false,
      allDaySlot: false,
      slotMinTime: "08:00:00",
      slotMaxTime: "18:00:00",
      height: 485,
      nowIndicator: true,
      expandRows: true,
      eventTimeFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
      slotLabelFormat: { hour: "2-digit", minute: "2-digit", hour12: false },
      dayHeaderFormat: { month: "numeric", day: "numeric", weekday: "short" },
      events,
      eventClick: ({ event }) => {
        if (event.extendedProps.block) clicks["remove-block"](event.id);
        else location.hash = hrefDetail("booking", event.id);
      },
      eventDidMount: ({ el, event }) => {
        el.title = event.title + " · " + event.extendedProps.sub;
        el.tabIndex = 0;
        el.addEventListener("keydown", (ev) => {
          if (ev.key === "Enter") el.click();
        });
      },
    });
    app.calendar.render();
  }
  if (slotbox) {
    try {
      const res = await api(
        "slots?office=1&date=" +
          encodeURIComponent(f.day) +
          "&length=" +
          encodeURIComponent(f.length || 60),
      );
      const rows = res.slots.filter(
        (x) =>
          (!f.staff || x.staff.includes(f.staff)) && (!f.vehicle || x.vehicles.includes(f.vehicle)),
      );
      slotbox.innerHTML = rows.length
        ? `<div class="slotgrid">${rows
            .map(
              (x) =>
                `<div class="slot"><b>${e(x.start)} – ${hhmm(minute(x.start) + Number(f.length || 60))}</b><small>${e(
                  x.staff
                    .filter((id) => !f.staff || id === f.staff)
                    .map(staffName)
                    .join("・"),
                )}</small><small>${e(
                  x.vehicles
                    .filter((id) => !f.vehicle || id === f.vehicle)
                    .map(carName)
                    .join("・"),
                )}</small></div>`,
            )
            .join("")}</div>`
        : empty(
            res.closed
              ? "この日は会社休業日です。"
              : "この条件でスタッフと車両が同時に空く枠はありません。",
          );
    } catch (err) {
      slotbox.textContent = err.message;
    }
  }
}
for (const [act, step] of [
  ["day-prev", -1],
  ["day-next", 1],
  ["today", 0],
])
  clicks[act] = () => {
    const f = calendarFilters();
    const days = app.parts[1] || innerWidth < 768 ? 1 : 7;
    f.day = step ? dateAdd(f.day, step * days) : app.data.today;
    app.render();
  };
clicks["block-form"] = (id) => {
  const f = calendarFilters(),
    b = app.data.bookings.find((item) => item.id === id);
  const start = b
    ? Math.max(480, Math.min(1035, Math.ceil(minute(app.data.now.slice(11, 16)) / 15) * 15))
    : 720;
  const form = editor(
    "社内予定を登録",
    `<div class="formgrid">${input("related", b?.id || "", "hidden")}${b ? `<p class="notice wide">${e(customer(b.customer).name)} 様の訪問中の予定 · ${e(b.id)}</p>` : ""}${field("予定の内容", input("reason", "帰社・荷下ろし", "text", "required"), true)}${field("日付", input("date", b?.date || f.day, "date", "required"))}${field("担当スタッフ", select("staff", selectStaff(), b?.staff || f.staff))}${field("開始", input("start", hhmm(start), "time", "required"))}${field("終了", input("end", hhmm(start + 45), "time", "required"))}${field("車両", select("vehicle", selectCars(), b?.vehicle || f.vehicle), true)}</div>`,
    "block",
    "登録する",
  );
  if (b) form.querySelector('[name="reason"]').focus();
};
submits.block = (f, d) => mutate({ action: "block", ...d }, "社内予定を登録しました。");
clicks["remove-block"] = (id) => {
  const b = app.data.blocks.find((x) => x.id === id);
  if (b)
    editor(
      b.reason,
      `<p>${e(dateLabel(b.date) + " " + b.start + "–" + b.end + "　" + staffName(b.staff) + "・" + carName(b.vehicle))}</p>${input("id", b.id, "hidden")}`,
      "unblock",
      "この予定を解除",
    );
};
submits.unblock = (f, d) => mutate({ action: "unblock", id: d.id }, "社内予定を解除しました。");

function cmatch(c, f) {
  const list = app.data.bookings.filter((b) => b.customer === c.id),
    use = paid(c);
  const subtotal = use.reduce((s, b) => s + b.final, 0);
  return (
    !c.deleted &&
    (!f.q ||
      [c.name, c.id, c.phone, c.phone.replace(/\D/g, ""), ...list.map((b) => b.id)].some((v) =>
        hit(v, f.q),
      )) &&
    (!f.area || hit(c.area, f.area)) &&
    (!f.gender || c.gender === f.gender) &&
    (!f.tag || c.tags.includes(f.tag)) &&
    (!f.used || (f.used === "yes") === !!use.length) &&
    (!f.method || use.some((b) => b.method === f.method)) &&
    (!f.memo ||
      [c.memo, c.name, c.address, ...list.map((b) => b.notes)].some((v) => hit(v, f.memo))) &&
    (!f.min || subtotal >= +f.min) &&
    (!f.count || use.length >= +f.count) &&
    (!f.day || use.some((b) => b.date === f.day))
  );
}
export function customers() {
  const f = app.filters.customers || {},
    s = app.data;
  return (
    `<form class="filterbox stack" data-form="customers"><div class="filters">${field("名前・電話番号・受付番号・ユーザーID", input("q", f.q, "search", 'placeholder="顧客を検索"'))}${field("お住まいのエリア", input("area", f.area))}${field(
      "利用実績",
      select(
        "used",
        [
          ["yes", "利用実績あり"],
          ["no", "利用実績なし"],
        ],
        f.used,
        "すべて",
      ),
    )}<div class="actions">${btnSearch}${button("reset-search", "解除", "customers")}</div></div>
 <details ${["gender", "tag", "method", "memo", "min", "count", "day"].some((k) => f[k]) ? "open" : ""}><summary>詳しい絞り込み</summary><div class="formgrid pad">${field("性別", select("gender", ["男性", "女性", "その他"], f.gender, "指定なし"))}${field(
   "サブステータス",
   select(
     "tag",
     s.tags.map((t) => [t.id, t.name]),
     f.tag,
     "すべて",
   ),
 )}${field("決済方法", select("method", ["現金", "カード", "その他"], f.method, "すべて"))}${field("利用日", input("day", f.day, "date"))}${field("支払回数の下限", input("count", f.count, "number", 'min="0"'))}${field("支払総額の下限（AUD）", input("min", f.min, "number", 'min="0"'))}${field("フリーワード・顧客メモ", input("memo", f.memo), true)}</div></details></form>` +
    panel(
      "顧客名簿",
      table(
        ["ユーザーID", "お客様", "居住エリア", "初回利用日", "ステータス", "利用回数"],
        s.customers
          .filter((c) => cmatch(c, f))
          .map((c) => {
            const uses = paid(c).sort(order);
            return [
              customerLink(c.id, e(c.id)),
              `${customerLink(c.id, e(c.name))}<span class="sub">${e(c.phone)}${contacts(c)}</span>`,
              e(c.area),
              e(uses[0]?.date || "―"),
              pill(uses.length ? "利用実績あり" : "利用実績なし", uses.length ? "blue" : "gray") +
                tagNames(c),
              uses.length + "回",
            ];
          }),
      ),
      pill(s.customers.filter((c) => cmatch(c, f)).length + "名", "gray"),
      "address-book",
    )
  );
}
export function tagNames(c) {
  return c.tags
    .map((id) => {
      const t = app.data.tags.find((x) => x.id === id);
      return t
        ? `<small class="sub" style="color:${/^#[\da-f]{6}$/i.test(t.color) ? t.color : "#a73338"}">${e(t.name)}</small>`
        : "";
    })
    .join("");
}
for (const page of ["bookings", "customers", "schedule", "fleet", "audit", "sales"])
  submits[page] = (form, d) => {
    app.filters[page] = { ...app.filters[page], ...d };
    app.render();
  };
clicks["reset-search"] = (page) => {
  if (page === "schedule") app.filters[page] = { day: calendarFilters().day };
  else delete app.filters[page];
  app.render();
};
