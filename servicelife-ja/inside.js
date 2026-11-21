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
  window.SL_VIEW={route:config.route,word,translate:async values=>values.map(word),note};
  let expenseAlerts=config.corrections || [];
  addEventListener("message",event=>{
    const message=event.data;
    if(event.source!==parent || message?.application!=="servicelife-jp" || message.type!=="expense-alerts")return;
    expenseAlerts=message.corrections;
    document.dispatchEvent(new Event("expense-alerts-updated"));
  });
  document.addEventListener("DOMContentLoaded",()=>{
    const menu=document.querySelector('.sidebar-nav a[href="/expenses/"]');
    const dropdown=document.getElementById("cbpNotifDropdown");
    if(!menu || !dropdown)return;
    const badge=document.createElement("span"), section=document.createElement("section");
    badge.id="expense-badge";badge.className="notranslate";menu.append(badge);
    section.id="expense-bell-requests";section.className="notranslate";
    dropdown.insertBefore(section,document.getElementById("cbpNotifList"));
    const css=document.createElement("style");
    css.textContent="#expense-badge{margin-inline-start:auto;padding:1px 7px;background:#b42328;color:white;border-radius:12px;font:600 12px/1.5 system-ui}#expense-bell-requests{padding:10px 14px;max-height:32vh;overflow:auto;border-bottom:1px solid #dce5df}#expense-bell-requests a{display:block;color:#234c32;padding:7px 0;overflow-wrap:anywhere}#expense-bell-requests small{display:block;color:#48544b}";
    document.head.append(css);
    function update(){
      const count=expenseAlerts.length;
      badge.hidden=!count;badge.textContent=String(count);
      badge.setAttribute("aria-label","修正が必要な経費 "+count+"件");
      section.hidden=!count;
      const title=document.createElement("strong");title.textContent="経費の修正依頼";
      section.replaceChildren(title);
      for(const row of expenseAlerts){
        const link=document.createElement("a"), reason=document.createElement("small");
        link.href="/expenses/?expense="+encodeURIComponent(row.id);
        link.append(row.date+"　"+row.category);
        reason.textContent=row.reason||"明細を確認してください。";
        link.append(reason);section.append(link);
      }
      window.cbpRefreshNotifBell?.();
    }
    update();document.addEventListener("expense-alerts-updated",update);
  },{once:true});
  const fleetPage = config.route === "/vehicles/";
  if(config.office){
    const pending=new Map();let sequence=0;
    function request(action,data={}){
      return new Promise((resolve,reject)=>{
        const requestId=++sequence;pending.set(requestId,{resolve,reject});
        send("office-request",{action,requestId,token:config.officeToken,...data});
      });
    }
    const office=window.SL_VIEW.office={state:config.office,save:draft=>request("save",{draft}),
      pdf:fileId=>request("pdf",{fileId}),refresh:()=>request("refresh"),selectedExpense:config.expense,canOpenFleet:config.routes.includes("/vehicles/")};
    addEventListener("message",e=>{
      const reply=e.data;
      if(e.source===parent && reply?.application==="servicelife-jp" && reply.type==="expense-open"){
        document.dispatchEvent(new CustomEvent("expense-open",{detail:reply.expense}));return;
      }
      if(e.source!==parent || reply?.type!=="office-result" || reply.token!==config.officeToken)return;
      if(reply.state){office.state=reply.state;document.dispatchEvent(new Event("office-updated"));}
      const task=pending.get(reply.requestId);
      if(task){pending.delete(reply.requestId);if(reply.error)task.reject(Error(reply.error));else task.resolve(reply.id);}
    });
  }
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
        a.href="/vehicles/?vehicle="+item.key;
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
      const pageSection=config.route==="/notifications/"?section.cloneNode(false):null;
      if(pageSection)document.querySelector("main .content")?.prepend(pageSection);
      function update(){
        if(pageSection)fillAlerts(pageSection);
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
      setItem:(k,v)=>{values.set(String(k),String(v));},
      removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null};
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
  const data=config.fixtures||{}, parsed=Object.entries(data).map(([k,v])=>[new URL(k,"https://reference.invalid"),v]);
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
  function appointmentPage(variants, url) {
    const query=url.searchParams;
    const jobs=new Set(query.getAll("job_type_any").flatMap(value=>value.split(",")).filter(Boolean));
    const status=query.get("status"), tech=query.get("technician"), day=query.get("date");
    const search=normalize(query.get("search"));
    const appointments=new Map();
    for(const [,page] of variants) {
      for(const row of page.results || []) appointments.set(row.id,row);
    }
    const matching=[...appointments.values()].filter(row=>{
      if(jobs.size && !jobs.has(row.job_type) && !(row.job_types || []).some(job=>jobs.has(job.id || job)))return false;
      if(status && row.status!==status || tech && row.technician!==tech)return false;
      if(day && (row.start_datetime || "").slice(0,10)!==day)return false;
      return !search || Object.values(row).some(value=>typeof value==="string" && normalize(value).includes(search));
    });
    matching.sort((a,b)=>RealDate.parse(b.start_datetime)-RealDate.parse(a.start_datetime));
    return paginate(matching,url);
  }
  function paginate(matching,url) {
    const query=url.searchParams;
    const size=Math.max(1,Number(query.get("page_size")) || 25);
    const page=Math.max(1,Number(query.get("page")) || 1);
    const offset=(page-1)*size;
    function link(number) {
      const target=new URL(url);
      target.searchParams.set("page",number);
      return target.pathname+target.search;
    }
    return {count:matching.length,results:matching.slice(offset,offset+size),
      next:offset+size<matching.length?link(page+1):null,previous:page>1?link(page-1):null};
  }
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
  function customerPage(variants,url) {
    const query=url.searchParams,type=query.get("customer_type");
    const byId=new Map();
    for(const [,page] of variants)for(const row of page.results || [])byId.set(row.id,row);
    const matches=searchIn([...byId.values()].filter(row=>!type || row.customer_type===type),query);
    const order=query.get("ordering") || "-created_at",field=order.replace(/^-/,"");
    if(["created_at","last_name"].includes(field)){
      const direction=order.startsWith("-")?-1:1;
      matches.sort((a,b)=>direction*String(a[field] || "").localeCompare(String(b[field] || ""),"en"));
    }
    return paginate(matches,url);
  }
  window.fetch=async (input,options={})=>{
    const method=String(options.method||input?.method||"GET").toUpperCase();
    if(method!=="GET" && method!=="HEAD"){
      note("閲覧用の見本です。変更や送信は記録されません。");
      return response({detail:"閲覧用の見本です。",error:"閲覧用の見本です。"},405);
    }
    let u;try{u=new URL(typeof input==="string"?input:input.url||String(input),"https://reference.invalid"+config.route);}catch{return response({},404);}
    const p=u.pathname;
    const variants=parsed.filter(([k])=>k.pathname===p);
    const exact=variants.find(([k])=>queryKey(k.searchParams)===queryKey(u.searchParams));
    if(config.route==="/appointments/" && p==="/api/v1/scheduling/appointments/" && variants.length){
      return response(appointmentPage(variants,u));
    }
    if((config.fleet || expenseAlerts.length) && /\/notifications\/unread-count\/$/.test(p)){
      const old=exact?.[1] || variants[0]?.[1] || {};
      const count=Number(old.count || old.unread_count || 0)+(window.SL_VIEW.fleet?.state.alerts.length||0)+expenseAlerts.length;
      return response({...old,count,unread_count:count});
    }
    if(exact)return response(exact[1]);
    if(config.route==="/customers/" && p==="/api/v1/customers/" && variants.length)return response(customerPage(variants,u));
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
  if(config.route==="/customers/"){
    window.SL_VIEW.directoryQuery=config.directoryQuery;
    const filters={search:"search",customer_type:"filterType"};
    document.addEventListener("DOMContentLoaded",()=>{
      const params=new URLSearchParams(config.directoryQuery);
      for(const [key,id] of Object.entries(filters))document.getElementById(id).value=params.get(key) || "";
    },{once:true});
    window.SL_VIEW.saveDirectoryQuery=query=>{
      const params=new URLSearchParams(query);
      for(const [key,id] of Object.entries(filters)){
        const value=document.getElementById(id).value;
        if(value!==(params.get(key) || ""))params.delete("page");
        if(value)params.set(key,value);else params.delete(key);
      }
      window.SL_VIEW.directoryQuery=params.toString();
      send("customer-directory-page",{query:window.SL_VIEW.directoryQuery});
    };
  }
  function rememberSidebar(){
    const nav=document.querySelector(".sidebar-nav");
    if(nav)send("sidebar-position",{role:config.role,route:config.route,top:nav.scrollTop});
  }
  function restoreSidebar(){
    const nav=document.querySelector(".sidebar-nav");
    if(!nav)return;
    // Keep the restored position when the browser swaps in the menu fonts.
    nav.style.overflowAnchor="none";
    if(config.sidebarTop!==null){
      nav.scrollTop=config.sidebarTop;
    }else{
      const selected=nav.querySelector("a.active");
      if(selected)nav.scrollTop=Math.max(0,selected.getBoundingClientRect().bottom-nav.getBoundingClientRect().bottom);
    }
    nav.addEventListener("scroll",rememberSidebar,{passive:true});
  }
  // Reveal only after the document listeners have translated the menu and initialized the page.
  addEventListener("DOMContentLoaded",()=>{
    restoreSidebar();
    send("ready",{route:config.route});
  },{once:true});
  function go(path,element){
    if(!path)return false;
    let u;try{u=new URL(path,"https://reference.invalid"+config.route);}catch{return false}
    if(routes.has(u.pathname)){
      const sidebar=element.closest(".sidebar-nav");
      // A row can be opened before the directory's debounced search runs.
      if(config.route==="/customers/" && u.pathname!==config.route)window.SL_VIEW.saveDirectoryQuery(window.SL_VIEW.directoryQuery);
      rememberSidebar();
      if(sidebar?.closest(".sidebar.cbp-open"))window.cbpToggleSidebar?.();
      send("route",{route:u.pathname,vehicle:Number(u.searchParams.get("vehicle")),expense:u.searchParams.get("expense"),fromSidebar:!!sidebar,backToCustomers:element.matches("a.cd-back")});
      return true;
    }
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
  function bindStaffPermissions(){
    const panel=document.getElementById("staffPermissions");
    if(!panel || !config.staff)return;
    const staff=panel.querySelector("#grantStaff"), role=panel.querySelector("#grantRole");
    const save=panel.querySelector("#grantSave"), preview=panel.querySelector("#grantPreview");
    const status=panel.querySelector("#grantStatus");
    let people=config.staff;
    for(const person of people)staff.add(new Option(person.name+"（"+person.login+"）",person.login));
    staff.value=people.find(person=>person.role!=="company_admin")?.login || people[0].login;
    const selected=()=>people.find(person=>person.login===staff.value);
    function buttons(){
      const changed=role.value!==selected().role;
      save.disabled=!changed;
      preview.disabled=changed;
    }
    function show(){role.value=selected().role;buttons();}
    show();
    staff.addEventListener("change",()=>{show();status.textContent="";});
    role.addEventListener("change",()=>{buttons();status.textContent="";});
    save.addEventListener("click",()=>{
      save.disabled=true;
      send("grant",{login:staff.value,role:role.value,previous:selected().role});
    });
    preview.addEventListener("click",()=>send("view-account",{login:staff.value}));
    addEventListener("message",event=>{
      if(event.source!==parent || event.data?.application!=="servicelife-ja-grants")return;
      people=event.data.staff;show();status.textContent=event.data.message;
    });
    if(config.openStaffPanel)document.querySelector('a[href="#users"]')?.click();
  }
  function previewAction(el) {
    const spec=el.getAttribute("data-sl-click")||"",label=el.textContent.trim();
    const root=el.closest("#cdRoot");
    if(root && config.route==="/customers/"+root.dataset.customerId+"/" &&
       el.matches(".cd-tab") && ["overview","documents","invoices","payments"].includes(el.dataset.pane)){
      const name=el.dataset.pane,target=root.querySelector("#pane"+name[0].toUpperCase()+name.slice(1));
      if(target){
        for(const tab of root.querySelectorAll(".cd-tab"))tab.classList.toggle("active",tab===el);
        for(const pane of root.querySelectorAll(".cd-pane"))pane.classList.toggle("active",pane===target);
        return;
      }
    }
    if(spec==="openLogCall()" && openPanel(document.getElementById("callModal")))return;
    if(/close|dismiss|hideModal/i.test(spec)||/^(閉じる|キャンセル|×|✕|Close|Cancel)$/i.test(label)){if(closePanel(el))return;}
    if(/send|delete|remove|save|submit|payNow|charge|signup|purchase|confirmPayment/i.test(spec) ||
       el.closest("#paneInvoices") && spec.startsWith("openTakePay(")){note("閲覧用の見本です。変更や送信は記録されません。");return;}
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
    if(fleetPage && ev.target.closest("#fleet") || config.office && ev.target.closest("#office"))return;
    ev.preventDefault();ev.stopImmediatePropagation();note("閲覧用の見本です。変更や送信は記録されません。");},true);
  addEventListener("click",ev=>{
    const el=ev.target.closest?.("a,button,[onclick],[data-sl-click],input[type=submit]");if(!el)return;
    if(el.closest(".leaflet-control-attribution"))return;
    const a=el.closest("a[href]");
    const h=a?.getAttribute("href")||"";
    const action=el.getAttribute("onclick")||el.getAttribute("data-sl-click")||"";
    const nav=action.match(/(?:location(?:\.href)?\s*=|location\.(?:assign|replace)\()\s*['"](\/[^'"]*)['"]/);
    if(nav&&go(nav[1],el) || (h.startsWith("/")&&go(h,el))){ev.preventDefault();ev.stopImmediatePropagation();return;}
    if(a?.matches("[data-sl-external]")||/^(?:https?:|mailto:|tel:|\/logout\/)/.test(h)){
      ev.preventDefault();ev.stopImmediatePropagation();note("公開見本の外部リンクです。");return;
    }
    if(h.startsWith("/")&&!routes.has(h.split("?")[0])){
      ev.preventDefault();ev.stopImmediatePropagation();note("このリンクは元のデモのサーバーに接続する機能です。");return;
    }
    if(config.mode==="snapshot" && el.id==="cbpNotifBellBtn" && window.cbpToggleNotifBell){
      ev.preventDefault();ev.stopImmediatePropagation();window.cbpToggleNotifBell();return;
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
    bindStaffPermissions();
    if(config.mode==="snapshot"){
      document.querySelectorAll("[data-offline-map]").forEach(element=>{
        if(!window.L || !element.clientWidth || !element.clientHeight)return;
        const map=L.map(element,{scrollWheelZoom:false}).setView([39.966,-75.26],11);
        L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png",{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
      });
    }
  },{once:true});
}
