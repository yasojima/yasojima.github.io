(() => {
  "use strict";

  const api = {
    calendar: "/api/v1/scheduling/calendar/",
    scheduledCallbacks: "/api/v1/communications/call-logs/?outcome=callback_scheduled&ordering=-call_datetime&page_size=8",
    allCalls: "/api/v1/communications/call-logs/?ordering=-call_datetime",
    recentCalls: "/api/v1/communications/call-logs/?ordering=-call_datetime&page_size=8",
    callStats: "/api/v1/communications/stats/",
    tickets: "/api/v1/tickets/tickets/?status=open&status=in_progress&ordering=priority,-created_at&page_size=10",
    ticketStats: "/api/v1/tickets/stats/",
    inbox: "/api/v1/communications/inbox/?status=open&limit=100&offset=0",
    inboxStats: "/api/v1/scheduling/csr-inbox/stats/"
  };

  // Both public demo roles returned these aggregate values at 22:27 JST.
  // The current demo session has different record IDs from the saved schedule.
  const officialOutcomeReference = {
    dateLabel: "2026年11月26日 22:27（日本時間）",
    roles: ["company_admin", "csr"],
    stats: {
      inbox_bookings: {today: 0, last_7d: 0},
      inbox_conversion: {last_7d_pct: null, bookings_7d: 0, suggest_calls_7d: 0},
      suggest_to_book_latency: {p50_seconds: null, p95_seconds: null, sample_size: 0},
      override_usage: {last_7d_pct: null, count_7d: 0},
      reschedule_rate: {last_7d_pct: null, count_7d: 0},
      cancel_by_reason: {last_7d_total: 0, top_reasons: []},
      notes_per_appt: {last_7d_avg: null, events_7d: 0},
      top_csrs: {last_7d: []}
    }
  };

  const sampleCallbacks = [
    {
      id: "sample-callback-a",
      customer_name: "サンプル顧客 A",
      callback_due_at: "2026-11-26T10:15:00",
      assigned_to_name: "受付スタッフ A",
      notes: "訪問時間の変更希望。候補時間を伝え、希望する時間帯を確認する。"
    },
    {
      id: "sample-callback-b",
      customer_name: "サンプル顧客 B",
      callback_due_at: "2026-11-26T14:30:00",
      assigned_to_name: "受付スタッフ B",
      notes: "折り返し希望あり。見積もりの訪問日を確認する。"
    }
  ];

  const sampleIntakes = [
    {day: "2026-11-21", staff: "受付スタッフ A", booked: true, minutes: 9, notes: 1},
    {day: "2026-11-23", staff: "受付スタッフ B", booked: true, minutes: 7, override: true, notes: 2},
    {day: "2026-11-24", staff: "受付スタッフ A", booked: false, notes: 0},
    {day: "2026-11-25", staff: "受付スタッフ B", booked: true, minutes: 14, canceled: "日時の都合", notes: 1},
    {day: "2026-11-26", staff: "受付スタッフ A", booked: true, minutes: 5, rescheduled: true, notes: 2},
    {day: "2026-11-26", staff: "受付スタッフ B", booked: true, minutes: 11, notes: 1}
  ];

  const scheduleStatus = {
    scheduled: "予定",
    confirmed: "確定",
    completed: "完了",
    cancelled: "キャンセル",
    canceled: "キャンセル"
  };
  const priority = {low: "低", medium: "中", high: "高", urgent: "緊急"};

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  }

  function link(links, path, label) {
    const href = links[path];
    if (!href) return null;
    const anchor = element("a", "sk-desk__link", label);
    anchor.href = href;
    return anchor;
  }

  function section(title, description, action) {
    const node = element("section", "sk-desk__panel");
    const heading = element("header", "sk-desk__section-head");
    const text = element("div");
    text.append(element("h2", "", title));
    if (description) text.append(element("p", "sk-desk__muted", description));
    heading.append(text);
    if (action) heading.append(action);
    node.append(heading);
    return node;
  }

  function readRows(body) {
    if (Array.isArray(body)) return body;
    return Array.isArray(body?.results) ? body.results : null;
  }

  function number(value, suffix = "件") {
    return Number.isFinite(value) ? value + suffix : "未取得";
  }

  function clock(timestamp) {
    return typeof timestamp === "string" ? timestamp.match(/T(\d{2}:\d{2})/)?.[1] || "" : "";
  }

  function dateLabel(date) {
    const parts = date?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    return parts ? Number(parts[1]) + "年" + Number(parts[2]) + "月" + Number(parts[3]) + "日" : "";
  }

  function collectSchedule(data) {
    const records = Object.entries(data).flatMap(([key, body]) => {
      if (!key.startsWith(api.calendar + "?")) return [];
      const params = new URLSearchParams(key.slice(key.indexOf("?") + 1));
      const date = params.get("start");
      const items = readRows(body);
      return /^\d{4}-\d{2}-\d{2}$/.test(date) && items ? [{date, items}] : [];
    });
    records.sort((a, b) => a.date.localeCompare(b.date));
    const reference = records[0];
    if (!reference) return {date: null, rows: null};
    const rows = reference.items.filter(item =>
      item.start?.slice(0, 10) === reference.date && !["canceled", "cancelled"].includes(item.status)
    );
    rows.sort((a, b) => a.start.localeCompare(b.start) ||
      (a.technician_name || "").localeCompare(b.technician_name || ""));
    return {date: reference.date, rows};
  }

  function callRecords(data) {
    const allBody = data[api.allCalls];
    const all = readRows(allBody);
    const totals = data[api.callStats];
    const callbackBody = data[api.scheduledCallbacks];
    const scheduled = readRows(callbackBody);
    // Only a complete, unfiltered response can certify that filtered records are absent.
    const complete = all && Number.isFinite(allBody.count) && all.length === allBody.count && !allBody.next;
    const callbacks = scheduled || (complete ? all.filter(call => call.outcome === "callback_scheduled") : null);
    return {
      callbacks,
      recent: readRows(data[api.recentCalls]) || all,
      callbacksDue: Number.isFinite(callbackBody?.count) ? callbackBody.count : callbacks?.length ?? totals?.callbacks_due,
      callsToday: totals?.calls_today
    };
  }

  function formatSeconds(value) {
    if (!Number.isFinite(value)) return "集計対象なし";
    if (value < 60) return Math.round(value) + "秒";
    const seconds = Math.round(value);
    return Math.floor(seconds / 60) + "分" + (seconds % 60 ? seconds % 60 + "秒" : "");
  }

  function percent(value) {
    return Number.isFinite(value) ? Number(value.toFixed(1)) + "%" : "集計対象なし";
  }

  function quantitativeSummary(values) {
    const node = element("dl", "sk-desk__summary");
    for (const [label, value] of values) {
      const item = element("div");
      item.append(element("dt", "", label), element("dd", "", value));
      node.append(item);
    }
    return node;
  }

  function empty(message) {
    return element("p", "sk-desk__empty", message);
  }

  function schedulePanel(schedule, links, term) {
    const {rows} = schedule;
    const staffCount = new Set(rows?.map(row => row.technician_id || row.technician_name).filter(Boolean)).size;
    const count = rows ? number(rows.length) + "の予定" + (staffCount ? " · 担当 " + staffCount + "人" : "") : "";
    const panel = section("今日の予定", count, link(links, "/calendar/", "カレンダーへ"));
    panel.classList.add("sk-desk__schedule");
    if (!rows?.length) {
      panel.append(empty(rows ? "この日の予約はありません。" : "予定データは未取得です。"));
      return panel;
    }

    const list = element("div", "sk-desk__schedule-list");
    list.setAttribute("aria-label", "予定明細");
    list.setAttribute("role", "region");
    list.tabIndex = 0;
    for (const [label, visits] of [
      ["午前", rows.filter(row => clock(row.start) < "12:00")],
      ["午後", rows.filter(row => clock(row.start) >= "12:00")]
    ]) {
      if (!visits.length) continue;
      const group = element("div", "sk-desk__time-group");
      group.append(element("h3", "sk-desk__time-heading", label + " · " + number(visits.length)));
      const items = element("ol", "sk-desk__visit-list");
      for (const visit of visits) {
        const row = element("li", "sk-desk__visit");
        const time = element("time", "sk-desk__time", clock(visit.start) || "未定");
        time.dateTime = visit.start;
        const details = element("div");
        details.append(element("strong", "", visit.customer_name || visit.title || "予約"));
        const description = [term(visit.job_type), visit.location].filter(Boolean).join(" · ");
        if (description) details.append(element("p", "sk-desk__muted", description));
        const assignment = element("div", "sk-desk__assignment");
        assignment.append(element("span", "", visit.technician_name || "担当未定"));
        if (visit.status) assignment.append(element("span", "sk-desk__state", scheduleStatus[visit.status] || visit.status));
        row.append(time, details, assignment);
        items.append(row);
      }
      group.append(items);
      list.append(group);
    }
    panel.append(list);
    return panel;
  }

  function ticketsPanel(tickets, links, term) {
    const panel = section("対応中の依頼", tickets ? "表示対象 " + number(tickets.length) : "", link(links, "/tickets/", "依頼一覧へ"));
    if (!tickets?.length) {
      panel.append(empty(tickets ? "表示対象の依頼はありません。" : "対応依頼は未取得です。"));
      return panel;
    }
    const items = element("ul", "sk-desk__tickets");
    for (const ticket of tickets) {
      const item = element("li");
      const subject = term(ticket.subject) || "対応依頼";
      const jump = link(links, "/tickets/", subject);
      item.append(jump || element("strong", "", subject));
      const description = [ticket.customer_name, priority[ticket.priority] && "優先度 " + priority[ticket.priority]]
        .filter(Boolean).join(" · ");
      if (description) item.append(element("p", "sk-desk__muted", description));
      items.append(item);
    }
    panel.append(items);
    return panel;
  }

  function callbackList(rows, sample) {
    if (!rows?.length) return empty(rows ? "折り返しの記録はありません。" : "折り返しの明細は未取得です。");
    const list = element("div", "sk-desk__callbacks");
    for (const callback of rows) {
      const name = callback.customer_name || callback.phone_number || "連絡先未登録";
      const time = clock(callback.callback_due_at || callback.scheduled_at || callback.callback_at);
      const detail = element("details", "sk-desk__callback");
      const summary = element("summary");
      const description = element("span");
      description.append(element("strong", "", name));
      if (time) description.append(element("span", "sk-desk__muted", time));
      summary.append(description);
      detail.append(summary);
      const content = element("div", "sk-desk__callback-text");
      if (callback.assigned_to_name) content.append(element("p", "sk-desk__muted", callback.assigned_to_name));
      content.append(element("p", "", callback.notes || "記録メモなし"));
      if (!sample && callback.phone_number && callback.customer_name) {
        content.append(element("p", "sk-desk__muted", callback.phone_number));
      }
      detail.append(content);
      list.append(detail);
    }
    return list;
  }

  function compactCalls(rows) {
    if (!rows?.length) return empty(rows ? "通話記録はありません。" : "通話明細は未取得です。");
    const list = element("ul", "sk-desk__tickets");
    for (const entry of rows.slice(0, 5)) {
      const item = element("li", "", entry.customer_name || entry.phone_number || "通話");
      item.append(element("span", "sk-desk__muted", clock(entry.call_datetime)));
      list.append(item);
    }
    return list;
  }

  function sampleStats(date) {
    const records = sampleIntakes.filter(row => !date || row.day <= date);
    const bookings = records.filter(row => row.booked);
    const latencies = bookings.map(row => row.minutes * 60).sort((a, b) => a - b);
    const adjustments = bookings.filter(row => row.override).length;
    const rescheduled = bookings.filter(row => row.rescheduled).length;
    const noteCount = bookings.reduce((total, row) => total + row.notes, 0);
    const canceled = bookings.filter(row => row.canceled);
    const byReason = new Map();
    const byStaff = new Map();
    for (const row of canceled) byReason.set(row.canceled, (byReason.get(row.canceled) || 0) + 1);
    for (const row of bookings) byStaff.set(row.staff, (byStaff.get(row.staff) || 0) + 1);
    const topStaff = [...byStaff.entries()].sort((a, b) => b[1] - a[1]);
    return {
      inbox_bookings: {today: bookings.filter(row => row.day === date).length, last_7d: bookings.length},
      inbox_conversion: {last_7d_pct: records.length ? 100 * bookings.length / records.length : null, bookings_7d: bookings.length, suggest_calls_7d: records.length},
      suggest_to_book_latency: {p50_seconds: latencies.at(Math.ceil(latencies.length / 2) - 1), p95_seconds: latencies.at(Math.ceil(latencies.length * 0.95) - 1), sample_size: latencies.length},
      override_usage: {last_7d_pct: bookings.length ? 100 * adjustments / bookings.length : null, count_7d: adjustments},
      reschedule_rate: {last_7d_pct: bookings.length ? 100 * rescheduled / bookings.length : null, count_7d: rescheduled},
      cancel_by_reason: {last_7d_total: canceled.length, top_reasons: [...byReason].map(([reason, count]) => ({reason, count}))},
      notes_per_appt: {last_7d_avg: bookings.length ? noteCount / bookings.length : null, events_7d: noteCount},
      top_csrs: {last_7d: topStaff.map(([name, count]) => ({name, count}))}
    };
  }

  function describeRows(rows, kind) {
    return rows?.length ? rows.map(row => {
      const label = kind === "reason" ? row.reason || row.label : row.name || row.staff_name || row.csr_name;
      const qty = row.count ?? row.bookings ?? row.bookings_count;
      return [label, Number.isFinite(qty) && number(qty)].filter(Boolean).join(" ");
    }).filter(Boolean).join(" / ") : "集計対象なし";
  }

  function performanceTable(stats) {
    if (!stats) return empty("受信箱の予約実績は未取得です。");
    const bookings = stats.inbox_bookings || {};
    const conversion = stats.inbox_conversion || {};
    const latency = stats.suggest_to_book_latency || {};
    const override = stats.override_usage || {};
    const change = stats.reschedule_rate || {};
    const cancellations = stats.cancel_by_reason || {};
    const notes = stats.notes_per_appt || {};
    const top = stats.top_csrs || {};
    const values = [
      ["受信箱から成立した予約", number(bookings.last_7d), "当日 " + number(bookings.today)],
      ["提案からの成立率", percent(conversion.last_7d_pct), "提案 " + number(conversion.suggest_calls_7d) + " · 成立 " + number(conversion.bookings_7d)],
      ["成立までの時間（中央値）", formatSeconds(latency.p50_seconds), Number.isFinite(latency.p95_seconds) ? "95パーセンタイル " + formatSeconds(latency.p95_seconds) + " · 対象 " + number(latency.sample_size) : "対象 " + number(latency.sample_size)],
      ["標準条件からの手動調整", number(override.count_7d), percent(override.last_7d_pct)],
      ["日程変更", number(change.count_7d), percent(change.last_7d_pct)],
      ["キャンセル", number(cancellations.last_7d_total), describeRows(cancellations.top_reasons, "reason")],
      ["予約メモ", number(notes.events_7d), Number.isFinite(notes.last_7d_avg) ? "1件あたり " + Number(notes.last_7d_avg.toFixed(1)) + "件" : "集計対象なし"],
      ["受付担当者別の成立件数", describeRows(top.last_7d, "staff"), ""]
    ];
    const table = element("table", "sk-desk__metrics");
    const header = element("thead");
    const columns = element("tr");
    for (const label of ["指標", "直近7日", "内訳"]) {
      const column = element("th", "", label);
      column.scope = "col";
      columns.append(column);
    }
    header.append(columns);
    const body = element("tbody");
    for (const [label, value, details] of values) {
      const tr = element("tr");
      const rowTitle = element("th", "", label);
      rowTitle.scope = "row";
      tr.append(rowTitle, element("td", "", value), element("td", "sk-desk__muted", details));
      body.append(tr);
    }
    table.append(header, body);
    return table;
  }

  window.mountServiceWorkspace = (root, {data, links = {}, terms = {}, role} = {}) => {
    const term = value => typeof terms?.[value] === "string" ? terms[value] : value;
    const schedule = collectSchedule(data || {});
    const calls = callRecords(data || {});
    const tickets = readRows(data?.[api.tickets]);
    const ticketStats = data?.[api.ticketStats];
    const counts = data?.[api.inbox]?.counts;
    const reference = officialOutcomeReference.roles.includes(role) ? officialOutcomeReference : null;

    const screen = element("div", "sk-desk");
    const intro = element("header", "sk-desk__intro");
    const heading = element("div");
    heading.append(element("h1", "", "顧客対応ダッシュボード"));
    if (schedule.date) heading.append(element("p", "", dateLabel(schedule.date) + "のデモ記録"));
    const toggle = element("button", "sk-desk__toggle", "操作例を表示");
    toggle.type = "button";
    toggle.setAttribute("aria-pressed", "false");
    intro.append(heading, toggle);
    screen.append(intro);

    const panels = element("div", "sk-desk__panels");
    panels.append(schedulePanel(schedule, links, term));
    const rail = element("div", "sk-desk__rail");
    const callbackPanel = section("折り返しが必要な電話", "", link(links, "/call-log/", "通話履歴へ"));
    const callbackContent = element("div");
    callbackContent.dataset.role = "callback-content";
    callbackContent.setAttribute("aria-live", "polite");
    callbackPanel.append(callbackContent);
    rail.append(callbackPanel, ticketsPanel(tickets, links, term));
    panels.append(rail);
    screen.append(panels);

    const activity = element("div", "sk-desk__activity");
    const activityPanel = section("対応の記録", "", link(links, "/csr-inbox/", "受信箱へ"));
    activityPanel.append(quantitativeSummary([
      ["当日の通話", number(calls.callsToday)],
      ["当日に解決した依頼", number(ticketStats?.resolved_today)],
      ["受信箱の未対応", number(counts?.open)],
      ["受信箱の返答待ち", number(counts?.waiting)],
      ["受信箱の対応済み", number(counts?.closed)]
    ]));
    const latest = element("details", "sk-desk__recent");
    latest.append(element("summary", "", "最近の通話"), compactCalls(calls.recent));
    activityPanel.append(latest);
    activity.append(activityPanel);

    const results = section("受信箱の予約実績");
    const outcomeContent = element("div");
    outcomeContent.dataset.role = "inbox-performance";
    outcomeContent.setAttribute("aria-live", "polite");
    results.append(outcomeContent);
    activity.append(results);
    screen.append(activity);
    root.replaceChildren(screen);

    function showMode(sample) {
      toggle.setAttribute("aria-pressed", String(sample));
      toggle.textContent = sample ? "操作例を閉じる" : "操作例を表示";
      const shownCallbacks = sample ? sampleCallbacks : calls.callbacks;
      const callbackTag = sample ? "操作例・架空データ" : "保存済み通話記録";
      const shownCount = sample ? sampleCallbacks.length : calls.callbacksDue;
      callbackContent.replaceChildren(
        element("p", sample ? "sk-desk__sample" : "sk-desk__source", callbackTag + " · " + number(shownCount)),
        callbackList(shownCallbacks, sample)
      );
      const primary = data?.[api.inboxStats];
      let provenance = "同じデモの保存済み集計";
      if (sample) provenance = "操作例・架空の予約記録から集計";
      else if (!primary && reference) provenance = reference.dateLabel + "に別のデモ環境で取得した参考集計";
      else if (!primary) provenance = "集計データは未取得";
      outcomeContent.replaceChildren(
        element("p", sample ? "sk-desk__sample" : "sk-desk__source", provenance),
        performanceTable(sample ? sampleStats(schedule.date) : primary || reference?.stats)
      );
    }
    toggle.addEventListener("click", () => showMode(toggle.getAttribute("aria-pressed") !== "true"));
    showMode(false);
  };
})();
