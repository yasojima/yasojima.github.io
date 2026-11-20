// Runs inside an opaque-origin iframe that contains only the exported demo.
function startServiceLifeReference(config) {
  const normalize=s=>String(s||"").trim().replace(/\s+/g," ").replace(/[’‘]/g,"'").toLowerCase();
  const terms=new Map(Object.entries(config.terms).map(([k,v])=>[normalize(k),v]));
  const word=s=>terms.get(normalize(s))||s;
  function note(message) {
    if(!document.body)return;
    let box=document.getElementById("sl-reference-note");
    if(!box){box=document.createElement("div");box.id="sl-reference-note";box.setAttribute("role","status");
      box.style.cssText="position:fixed;bottom:24px;left:50%;transform:translateX(-50%);z-index:2147483646;border-radius:7px;padding:10px 17px;background:#233628;color:#fff;font:14px/1.5 system-ui;max-width:85vw;text-align:center";
      document.body.append(box);}
    box.textContent=message;clearTimeout(note.timer);note.timer=setTimeout(()=>box.remove(),3100);
  }
  window.SL_VIEW={route:config.route,terms:config.terms,word,translate:async values=>values.map(word),note,menuRoutes:config.menuRoutes,go};
  const fixtureRows = data => Object.entries(data || {}).map(([k,v])=>[new URL(k,"https://reference.invalid"),v]);
  let notificationRows=fixtureRows(config.fixtures);
  if(config.surface==="navigation"){
    window.SL_VIEW.updateShell=(route,state,notifications)=>{
      if(notifications)notificationRows=fixtureRows(notifications);
      config.route=route;window.SL_VIEW.route=route;
      if(state && window.SL_VIEW.fleet)window.SL_VIEW.fleet.state=state;
      document.dispatchEvent(new Event("fleet-updated"));
    };
    addEventListener("message",event=>{
      const m=event.data;
      if(event.source===parent && m?.application==="servicelife-jp" && m.type==="shell-fleet")
        window.SL_VIEW.updateShell(config.route,m.fleet);
    });
  }
  const fleetPage = config.route === "/maintenance/";
  if (config.fleet) {
    const pending = new Map();
    let sequence = 0;
    function request(action, draft) {
      return new Promise((resolve, reject) => {
        const requestId = ++sequence;
        pending.set(requestId, {resolve, reject});
        send("fleet-request", {token:config.fleetToken, requestId, action, draft});
      });
    }
    const fleet = window.SL_VIEW.fleet = {state:config.fleet, vehicle:config.vehicle, canEdit:config.role==="company_admin",
      refresh:()=>request("refresh"), save:draft=>request("save",draft),
      select:key=>send("fleet-request",{token:config.fleetToken,action:"select",key})};
    window.addEventListener("message", event => {
      const reply=event.data;
      if(event.source!==parent || reply?.type!=="fleet-result" || reply.token!==config.fleetToken)return;
      if(reply.state){
        fleet.state=reply.state;
        document.dispatchEvent(new Event("fleet-updated"));
      }
      const task=pending.get(reply.requestId);
      if(task){
        pending.delete(reply.requestId);
        if(reply.error)task.reject(Error(reply.error));else task.resolve(reply.key);
      }
    });
    function fillAlerts(container) {
      const title = document.createElement("strong");
      title.textContent = "車両の期限";
      container.replaceChildren(title);
      if(!fleet.state.alerts.length){
        const empty=document.createElement("span");
        empty.textContent=fleet.state.error || "お知らせする期限はありません。";
        container.append(empty);
      }
      for(const item of fleet.state.alerts){
        const a=document.createElement("a");
        a.href="/maintenance/?vehicle="+item.key;
        const heading=document.createElement("b"), sub=document.createElement("span");
        heading.textContent=item.plate+"　"+item.model;
        const stage={overdue:"期限超過",m1:"1か月以内",m3:"3か月以内",m6:"6か月以内"}[item.bucket];
        sub.textContent=item.kind+"　"+item.due+"　"+stage;
        if(item.bucket==="overdue")sub.className="sl-fleet-overdue";
        a.append(heading,sub);container.append(a);
      }
    }
    function mountAlerts(){
      const dropdown=document.getElementById("cbpNotifDropdown");
      if(!dropdown && config.route!=="/notifications/")return;
      const css=document.createElement("style");
      css.textContent=".sl-fleet-alerts{padding:10px 14px;display:grid;gap:4px;max-height:36vh;overflow:auto;background:white;border-bottom:1px solid #dce5df}.sl-fleet-alerts>strong{font-size:13px;color:#294f34}.sl-fleet-alerts a{display:grid;gap:3px;padding:7px 2px;color:#23362b;text-decoration:none;border-bottom:1px solid #e9eeeb;font-size:13px}.sl-fleet-alerts a:hover,.sl-fleet-alerts a:focus{background:#f0f6f0}.sl-fleet-alerts span{font-size:12px;color:#57635d}.sl-fleet-alerts .sl-fleet-overdue{color:#ad271d}";
      document.head.append(css);
      const section=document.createElement("section");
      section.className="sl-fleet-alerts notranslate";
      const list=document.getElementById("cbpNotifList");
      if(dropdown)dropdown.insertBefore(section,list);
      else document.querySelector("main .content")?.prepend(section);
      function update(){
        for(const el of dropdown?.querySelectorAll(".head,.footer,#cbpNotifList")||[])
          el.hidden=config.route==="/maintenance/";
        fillAlerts(section);
        window.cbpRefreshNotifBell?.();
      }
      update();document.addEventListener("fleet-updated",update);
    }
    document.addEventListener("DOMContentLoaded",mountAlerts,{once:true});
  }
  function localMemory() {
    const values=new Map();
    return {get length(){return values.size;},getItem:k=>values.has(String(k))?values.get(String(k)):null,
      setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null};
  }
  for(const id of ["localStorage","sessionStorage"]) {
    try{Object.defineProperty(window,id,{value:localMemory(),configurable:true});}catch{}
  }
  try{Object.defineProperty(document,"cookie",{get:()=>"",set:()=>{},configurable:true});}catch{}
  const RealDate=Date, savedStamp=RealDate.parse(config.captured), began=performance.now();
  const clock=()=>savedStamp+performance.now()-began;
  if(Number.isFinite(savedStamp)) {
    window.Date=new Proxy(RealDate,{construct:(ctor,args)=>Reflect.construct(ctor,args.length?args:[clock()]),
      apply:()=>new RealDate(clock()).toString(),get:(ctor,k)=>k==="now"?clock:Reflect.get(ctor,k)});
  }
  const parsed=fixtureRows(config.fixtures);
  const response=(obj,code=200)=>new Response(JSON.stringify(obj),{status:code,headers:{"Content-Type":"application/json; charset=utf-8"}});
  function localVisitDate(stamp, zone) {
    if (!stamp || !zone || /(?:Z|[+-]\d\d:\d\d)$/.test(stamp)) return stamp;
    const midday = new RealDate(stamp.slice(0,10) + "T12:00:00Z");
    const parts = new Intl.DateTimeFormat("en-US",{timeZone:zone,timeZoneName:"longOffset"}).formatToParts(midday);
    const offset = parts.find(p=>p.type==="timeZoneName")?.value.replace("GMT","");
    return stamp + (offset || "Z");
  }
  function calendarEntity(kind, id) {
    const events = parsed.find(([u])=>u.pathname.endsWith("/scheduling/calendar/"))?.[1] || [];
    const types = parsed.find(([u])=>u.pathname.endsWith("/job-types/"))?.[1]?.results || [];
    for (const [url, day] of parsed) {
      if (!url.pathname.endsWith("/resource-day/")) continue;
      for (const tech of day.technicians || []) {
        const visit = (tech.appointments || []).find(a=>(kind==="customers"?a.customer_id:a.id)===id);
        if (!visit) continue;
        if (kind==="customers") return {id,first_name:visit.customer_name,phone:visit.customer_phone,service_address:visit.location};
        const event = events.find(e=>e.id===id) || {};
        const job = types.find(t=>t.name===visit.job_type);
        return {...event, ...visit, customer:visit.customer_id, technician:visit.technician_id,
          job_type:job?.id, job_types:job?[job.id]:[], duration_minutes:visit.duration,
          start_datetime:localVisitDate(event.start || day.date+"T"+visit.start,tech.timezone),
          end_datetime:localVisitDate(event.end || day.date+"T"+visit.end,tech.timezone)};
      }
    }
    return null;
  }
  function queryKey(q){return [...q.entries()].filter(([k])=>!["_","ts","t","cache_bust"].includes(k)).sort().map(x=>x.join("=")).join("&");}
  function searchIn(value,query) {
    const rows=Array.isArray(value)?value:["results","customers","appointments","items","data"].map(k=>value&&value[k]).find(Array.isArray);
    if(!rows)return value;
    const text=query.get("search")||query.get("q")||query.get("query")||"";
    const filtered=text?rows.filter(r=>Object.values(r).some(x=>typeof x==="string" && normalize(x).includes(normalize(text)))):rows;
    if(Array.isArray(value))return filtered;
    const out={...value};
    for(const k of ["results","customers","appointments","items","data"])if(value[k]===rows)out[k]=filtered;
    if(text && "count" in out)out.count=filtered.length;
    return out;
  }
  window.fetch=async (input,options={})=>{
    const method=String(options.method||input?.method||"GET").toUpperCase();
    if(method!=="GET" && method!=="HEAD"){
      note("閲覧用の見本です。変更や送信は記録されません。");
      return response({detail:"閲覧用の見本です。",error:"閲覧用の見本です。"},405);
    }
    let u;try{u=new URL(typeof input==="string"?input:input.url||String(input),"https://reference.invalid"+config.route);}catch{return response({},404);}
    const p=u.pathname;
    const rows=config.surface==="navigation" && p.includes("/notifications/") ? notificationRows : parsed;
    const variants=rows.filter(([k])=>k.pathname===p);
    const exact=variants.find(([k])=>queryKey(k.searchParams)===queryKey(u.searchParams));
    if(config.fleet && /\/notifications\/unread-count\/$/.test(p)){
      const old=exact?.[1] || variants[0]?.[1] || {};
      const count=Number(old.count || old.unread_count || 0)+window.SL_VIEW.fleet.state.alerts.length;
      return response({...old,count,unread_count:count});
    }
    if(exact)return response(exact[1]);
    if(variants.length){
      const best=variants.map(([k,v])=>[v,[...u.searchParams].filter(([a,b])=>k.searchParams.get(a)===b).length]).sort((a,b)=>b[1]-a[1])[0][0];
      if(/\/customers\/$|\/appointments\/$/.test(p))return response(searchIn(best,u.searchParams));
      if(/\/scheduling\/(?:calendar|resource-day)\/$/.test(p) && variants.every(([k])=>[...u.searchParams].some(([a,b])=>/^(?:date|day|start|end|from|to)$/.test(a)&&k.searchParams.has(a)&&k.searchParams.get(a)!==b))){
        if(Array.isArray(best))return response([]);
        const blank={...best};for(const k of ["events","appointments","bookings","slots","results"])if(Array.isArray(blank[k]))blank[k]=[];return response(blank);
      }
      return response(best);
    }
    if(/\/notifications\/unread-count\/$/.test(p))return response({count:0,unread_count:0});
    if(/\/notifications\/$/.test(p))return response({results:[],notifications:[],count:0});
    const entity=p.match(/\/(customers|appointments)\/([A-Za-z0-9-]+)\/$/);
    if(entity){
      for(const [url,value] of parsed){
        if(!url.pathname.endsWith("/"+entity[1]+"/"))continue;
        const rows=Array.isArray(value)?value:Object.values(value||{}).find(Array.isArray)||[];
        const record=rows.find(v=>[v.id,v.uuid,v.customer_id,v.appointment_id].includes(entity[2]));
        if(record)return response(record);
      }
      const visit = calendarEntity(entity[1],entity[2]);
      if(visit)return response(visit);
    }
    return response({detail:"この表示用データには含まれていません。",results:[],items:[],count:0},404);
  };
  const routes=new Set(config.routes);
  const send=(type,extra={})=>parent.postMessage({application:"servicelife-jp",type,...extra},"*");
  const menuPosition=()=>document.querySelector(".sidebar-nav")?.scrollTop || 0;
  function go(path){
    if(!path)return false;
    let u;try{u=new URL(path,"https://reference.invalid"+config.route);}catch{return false}
    const choice=u.pathname.match(/^\/demo\/view\/(company_admin|csr|technician)\/$/);
    if(choice){send("role",{role:choice[1]});return true;}
    if(routes.has(u.pathname)){send("route",{route:u.pathname,vehicle:Number(u.searchParams.get("vehicle")),menuTop:menuPosition()});return true;}
    return false;
  }
  function openPanel(panel) {
    if(!panel)return false;
    panel.hidden=false;panel.removeAttribute("aria-hidden");
    if(panel.tagName==="DIALOG"){if(!panel.open)panel.showModal();}
    else{panel.style.display="flex";panel.classList.add("show","active","open");}
    panel.dataset.slOpened="true";return true;
  }
  function closePanel(el) {
    const panel=el?.closest('[data-sl-opened="true"],dialog[open],.modal-overlay.show,.modal-backdrop.show,.modal.show,[role="dialog"]');
    if(!panel)return false;
    if(panel.tagName==="DIALOG")panel.close();
    else{panel.style.display="none";panel.classList.remove("show","active","open");}
    delete panel.dataset.slOpened;return true;
  }
  function previewAction(el) {
    const spec=el.getAttribute("data-sl-click")||"",label=el.textContent.trim();
    if(spec==="openLogCall()")return openPanel(document.getElementById("callModal"));
    if(/close|dismiss|hideModal/i.test(spec)||/^(閉じる|キャンセル|×|✕|Close|Cancel)$/i.test(label)){if(closePanel(el))return;}
    if(/send|delete|remove|save|submit|payNow|charge|signup|purchase|confirmPayment/i.test(spec)){note("閲覧用の見本です。変更や送信は記録されません。");return;}
    const key=spec.match(/['"]([A-Za-z][\w-]+)['"]/);
    if(key){
      const names=[key[1],"tab-"+key[1],"panel-"+key[1],"pane-"+key[1],key[1]+"Modal"];
      const target=names.map(id=>document.getElementById(id)).find(Boolean);
      if(target && /modal|dialog|overlay/i.test(target.id+" "+target.className)){openPanel(target);return;}
      if(target&&/tab|view|switch|show/i.test(spec)){
        for(const sib of target.parentElement.children)if(sib!==target && /pane|tab-content|tab-pane/.test(String(sib.className)))sib.style.display="none";
        target.hidden=false;target.style.display="block";target.classList.add("active");return;
      }
    }
    if(/open|detail|edit|new|create|add|modal/i.test(spec)){
      const panels=[...document.querySelectorAll('main dialog,main [role="dialog"],main [id*="Modal"],main [id*="modal"],main .modal-overlay')].filter(n=>n.id||n.matches("dialog,.modal-overlay"));
      const wanted=(/new|create|add/i.test(spec)?/new|add|create|edit/i:/detail|view|edit|modal/i);
      if(openPanel(panels.find(n=>wanted.test(n.id))||panels[0]))return;
    }
    if(spec)note("この操作は元のデモのサーバーに接続する機能です。");
  }
  addEventListener("submit",ev=>{
    if(fleetPage && ev.target.closest("#fleet"))return;
    ev.preventDefault();ev.stopImmediatePropagation();note("閲覧用の見本です。変更や送信は記録されません。");
  },true);
  addEventListener("click",ev=>{
    const el=ev.target.closest?.("a,button,[onclick],[data-sl-click],input[type=submit]");if(!el)return;
    if(config.mode==="snapshot" && config.fleet && el.closest("#cbpNotifBellWrap") && el.hasAttribute("onclick"))return;
    if(el.closest(".leaflet-control-attribution"))return;
    const a=el.closest("a[href]");
    const h=a?.getAttribute("href")||"";
    const action=el.getAttribute("onclick")||el.getAttribute("data-sl-click")||"";
    const nav=action.match(/(?:location(?:\.href)?\s*=|location\.(?:assign|replace)\()\s*['"](\/[^'"]*)['"]/);
    if(nav&&go(nav[1]) || (h.startsWith("/")&&go(h))){
      const menu=a?.closest(".sidebar-nav");
      if(menu){
        menu.querySelector("a[aria-busy]")?.removeAttribute("aria-busy");
        if(h!==config.route)a.setAttribute("aria-busy","true");
      }
      ev.preventDefault();ev.stopImmediatePropagation();return;
    }
    if(a?.matches("[data-sl-external]")||/^(?:https?:|mailto:|tel:|\/logout\/)/.test(h)){
      ev.preventDefault();ev.stopImmediatePropagation();note("公開見本の外部リンクです。");return;
    }
    if(h.startsWith("/")&&!routes.has(h.split("?")[0])){
      ev.preventDefault();ev.stopImmediatePropagation();note("このリンクは元のデモのサーバーに接続する機能です。");return;
    }
    if(config.mode==="snapshot"&&action){ev.preventDefault();ev.stopImmediatePropagation();previewAction(el);}
  },true);
  document.addEventListener("input",ev=>{
    const el=ev.target;
    if(config.mode!=="snapshot" || !el.matches('input:not([type]),input[type=text],input[type=search]') ||
       !/search|検索|絞り込/i.test([el.placeholder,el.id,el.name].join(" ")))return;
    const q=normalize(el.value);
    document.querySelectorAll("main tbody tr,main .tech-card,main .kanban-card").forEach(row=>{row.hidden=!!q&&!normalize(row.textContent).includes(q);});
  },true);
  addEventListener("keydown",ev=>{if(ev.key==="Escape")closePanel(document.querySelector('[data-sl-opened="true"]'));});
  document.addEventListener("DOMContentLoaded",()=>{
    document.documentElement.dataset.referenceMode=config.mode;
    for(const el of document.querySelectorAll('a[href^="/demo/view/"]'))el.removeAttribute("target");
    if(config.mode==="snapshot"){
      document.querySelectorAll("[data-offline-map]").forEach(element=>{
        if(!window.L || !element.clientWidth || !element.clientHeight)return;
        const map=L.map(element,{scrollWheelZoom:false}).setView([39.966,-75.26],11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
      });
    }
    if(config.surface==="content"){
      let previous=false,queued=false;
      function checkModal(){
        queued=false;
        // The navigation is a sibling document. Let the page's own modal/backdrop cover it.
        const modal=[...document.querySelectorAll('dialog[open],[aria-modal=true],.modal-overlay,.modal-backdrop,.modal.show,.modal.open,[role=dialog]')]
          .some(el=>{
            const r=el.getBoundingClientRect(),s=getComputedStyle(el);
            return r.width>0 && r.height>0 && s.visibility!=="hidden" && (el.matches("dialog:modal,[aria-modal=true]") || s.position==="fixed");
          });
        if(modal!==previous){previous=modal;send("content-modal",{open:modal});}
      }
      const queue=()=>{if(!queued){queued=true;requestAnimationFrame(checkModal);}};
      new MutationObserver(queue).observe(document.body,{subtree:true,childList:true,attributes:true,
        attributeFilter:["open","class","style","hidden","aria-modal"]});
      document.addEventListener("pointerdown",()=>send("content-pointer"),true);
      document.addEventListener("transitionend",queue,true);
      checkModal();
    }
    const menu=document.querySelector(".sidebar-nav");
    menu?.addEventListener("scroll",()=>send("menu-scroll",{menuTop:menu.scrollTop}),{passive:true});
    function hint(event){
      const link=event.target.closest?.("a[href]");
      if(link && !link.contains(event.relatedTarget))send("route-hint",{route:link.getAttribute("href")});
    }
    menu?.addEventListener("pointerover",hint);
    menu?.addEventListener("focusin",hint);
    function restoreMenu(top){
      if(menu)menu.scrollTop=top;
      send("ready",{route:config.route,menuTop:top});
    }
    // Measure after translation so the used text and icon fonts are known to the browser.
    setTimeout(async()=>{
      document.documentElement.getBoundingClientRect();
      await document.fonts.ready;
      restoreMenu(Number.isFinite(config.menuTop)?config.menuTop:0);
    },0);
  },{once:true});
}
