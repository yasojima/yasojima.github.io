// The original staff cards and counters use the saved demonstration locations.
window.initTechMap = function () {
  const element = document.getElementById("techMap");
  if (!element || !window.L) return;
  map = L.map(element, {scrollWheelZoom:false});
  installReferenceMap(map);
  loadLive();
};
function focusTech(lat,lng) {
  const position=[Number(lat),Number(lng)];
  if (!map || !position.every(Number.isFinite)) return;
  map.setView(position,15);
  const point=markers.find(m=>Math.abs(m.getLatLng().lat-position[0])<0.00001 && Math.abs(m.getLatLng().lng-position[1])<0.00001);
  if (point) point.openPopup();
}
function renderMap() {
  if (!map) return;
  markers.forEach(m=>m.remove());markers=[];
  const bounds=[];
  for (const t of allTechs) {
    if (!t.latitude || !t.longitude) continue;
    const pos=[Number(t.latitude),Number(t.longitude)],s=t._status;
    if (!pos.every(Number.isFinite)) continue;
    bounds.push(pos);
    const badge=document.createElement("span");
    badge.textContent=t.initials||"?";
    const fill=s.key==="on_job"?"#e65100":s.key==="running_late"?"#c62828":s.key==="on_route"||s.key==="on_time"?"#1565c0":s.key==="off_duty"?"#9e9e9e":t.color||"#2196f3";
    badge.style.cssText="width:32px;height:32px;border-radius:50%;border:2px solid white;box-shadow:0 1px 3px #0006;display:grid;place-items:center;color:white;font:700 10px Inter,sans-serif";
    badge.style.backgroundColor=fill;
    const bubble=document.createElement("div"),title=document.createElement("strong");
    title.textContent=t.name;bubble.append(title);
    for (const line of [window.SL_VIEW.word(s.label),t.current_job&&("現在の訪問先　"+t.current_job.customer),t.next_job&&("次の訪問先　"+t.next_job.customer),t.completed_today!=null&&("本日の完了　"+t.completed_today+"件")]) {
      if(line){const d=document.createElement("div");d.textContent=line;bubble.append(d);}
    }
    const marker=L.marker(pos,{title:t.name,alt:t.name,icon:L.divIcon({className:"sl-map-pin",html:badge,iconSize:[36,36],iconAnchor:[18,18]})}).addTo(map).bindPopup(bubble);
    markers.push(marker);
  }
  if (bounds.length)map.fitBounds(bounds,{padding:[30,30],maxZoom:14});else map.setView([39.96,-75.20],11);
}
if(document.readyState==="loading")addEventListener("DOMContentLoaded",window.initTechMap,{once:true});else window.initTechMap();
