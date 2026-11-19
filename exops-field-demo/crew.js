import {api, booking, carName, customer, e, hrefDetail, icon, stamp} from "./ui.js";

const colors = ["#236f9f", "#a65a1e", "#5f7c36", "#7957a0", "#147a77"];
const states = ["現場対応中", "移動中", "待機中", "片付け・移動準備中", "開始確認待ち", "社内予定", "勤務外"];
let activeMap, refreshTimer;

export function disposeCrew() {
  clearInterval(refreshTimer);
  activeMap?.remove();
  activeMap = null;
}

export function crewPanel() {
  return `<section class="crew" aria-label="現場スタッフの稼働状況">
    <div class="sectionline"><h2>${icon("tower-broadcast")} 現場スタッフの稼働状況</h2></div>
    <div class="crew-totals" data-totals></div>
    <div class="crew-tools"><span class="hint">位置はシドニーのサンプルです</span>
      <label>稼働状況 <select aria-label="稼働状況で絞り込み"><option value="">すべてのスタッフ</option>
      ${["手配可能", ...states].map(s => `<option>${e(s)}</option>`).join("")}</select></label></div>
    <div class="crew-layout"><div class="crew-list" aria-label="スタッフ一覧">スタッフを読み込み中…</div>
      <div class="crew-map" aria-label="スタッフの位置を示す地図"></div></div>
    </section>`;
}

function visitLabel(job) {
  return job ? `${job.start} ${customer(job.customer)?.name || ""} · ${job.service}` : "なし";
}

function staffCard(row, color, selected) {
  const current = booking(row.current), next = booking(row.next), assigned = current || next;
  return `<button class="crew-card" type="button" data-crew="${e(row.id)}" aria-pressed="${selected}">
    <span class="crew-line"><span class="crew-avatar" style="background:${color}">${e(row.nick.slice(0,1))}</span>
    <strong>${e(row.name)}</strong><span class="crew-status">${e(row.status)}</span></span>
    ${current ? `<span class="crew-detail">現在　${e(visitLabel(current))}</span>` : ""}
    <span class="crew-detail">次の予約　${e(visitLabel(next))}</span>
    <span class="crew-bottom">${icon("truck")} ${e(assigned ? carName(assigned.vehicle) : "車両の割当なし")}
    ${row.ready ? '<b>手配可能</b>' : ""}</span>
    ${row.position ? "" : '<span class="crew-detail">位置情報なし</span>'}</button>`;
}

function popup(row) {
  const job = booking(row.current) || booking(row.next);
  return `<strong>${e(row.name)}</strong> · ${e(row.status)}
    <div>${e(row.position.area)}</div><small>見本位置の記録　${e(stamp(row.position.at))}</small>
    ${job ? `<div><a href="${e(hrefDetail("booking", job.id))}">予約の詳細を開く</a></div>` : ""}`;
}

export async function mountCrew(section) {
  const box = section.querySelector(".crew-map"), list = section.querySelector(".crew-list");
  const filter = section.querySelector("select");
  const map = L.map(box, {scrollWheelZoom:false});
  activeMap = map;
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom:19, attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
  }).addTo(map);
  const layer = L.layerGroup().addTo(map), markers = new Map();
  let data, chosen = "", loading = false;

  function selectStaff(id, fromMap) {
    chosen = id;
    for (const card of list.querySelectorAll("[data-crew]"))
      card.setAttribute("aria-pressed", String(card.dataset.crew === id));
    const marker = markers.get(id);
    if (!marker) return;
    if (!fromMap) map.setView(marker.getLatLng(), Math.max(map.getZoom(), 14));
    marker.openPopup();
  }

  function paint(fit) {
    const rows = data.staff.filter(row => !filter.value ||
      (filter.value === "手配可能" ? row.ready : row.status === filter.value));
    if (!rows.some(row => row.id === chosen)) chosen = "";
    const bounds = [];
    layer.clearLayers();
    markers.clear();
    list.innerHTML = rows.map(row => {
      const color = colors[data.staff.indexOf(row) % colors.length];
      if (row.position) {
        const point = [row.position.lat, row.position.lng];
        const badge = L.divIcon({className:"crew-marker-wrap", iconSize:[36,36], iconAnchor:[18,18],
          html:`<span class="crew-marker" style="background:${color}">${e(row.nick.slice(0,1))}</span>`});
        const marker = L.marker(point, {icon:badge, title:row.name + " · " + row.status, alt:row.name})
          .bindPopup(popup(row)).on("click", () => selectStaff(row.id, true)).addTo(layer);
        markers.set(row.id, marker);
        bounds.push(point);
      }
      return staffCard(row, color, chosen === row.id);
    }).join("") || '<p class="empty">該当するスタッフはいません。</p>';
    if (fit && bounds.length) map.fitBounds(bounds, {padding:[35,35], maxZoom:14});
    else if (map.getZoom() === undefined) map.setView([-33.882,151.199], 13);
    if (chosen) markers.get(chosen)?.openPopup();
  }

  async function update() {
    if (loading || !section.isConnected) return;
    loading = true;
    try {
      const next = await api("crew");
      if (!section.isConnected || activeMap !== map) return;
      const first = !data;
      if (!first && JSON.stringify(data) === JSON.stringify(next)) return;
      data = next;
      const counts = [["本日の予約",data.reservations,"件"],["本日の出勤予定",data.scheduled,"人"],
        ["現場対応中",data.onSite,"人"],["今から手配可能",data.ready,"人"]];
      section.querySelector("[data-totals]").innerHTML = counts.map(([label,n,unit]) =>
        `<div class="crew-total" ${label === "今から手配可能" ? 'title="スタッフと車両が今から60分空いている候補"' : ""}>
        <strong>${n}<small>${unit}</small></strong><span>${e(label)}</span></div>`).join("");
      paint(first);
    } finally { loading = false; }
  }
  filter.addEventListener("change", () => { if (data) paint(true); });
  list.addEventListener("click", ev => {
    const card = ev.target.closest("[data-crew]");
    if (card) selectStaff(card.dataset.crew, false);
  });
  await update();
  if (section.isConnected && activeMap === map)
    refreshTimer = setInterval(() => { if (!document.hidden) update().catch(() => {}); }, 60000);
}
