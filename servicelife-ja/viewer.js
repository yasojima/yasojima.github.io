/* ServiceLife public reference. Navigation remains in this browser tab. */
"use strict";
const base=new URL("./",document.baseURI);
const assetVersion=new URL(document.currentScript.src).search;
let frame=document.querySelector("#screen");
const emptyFrame=frame.cloneNode(false);
const notice=document.querySelector("#notice");
const viewportHud=document.getElementById("viewport-hud");
function updateViewportHud(){
  const width=window.innerWidth;
  const breakpoint=width < 768 ? "MOBILE" : width <= 1024 ? "TABLET" : "DESKTOP";
  viewportHud.textContent=`${width} × ${window.innerHeight} px · ${breakpoint}`;
}
updateViewportHud();
window.addEventListener("resize",updateViewportHud);

const inFlight=new Map();
async function read(name,type) {
  if(!inFlight.has(name)){
    const request=(async()=>{
      const url=new URL(name,base);
      url.search=assetVersion;
      const r=await fetch(url,{cache:"no-cache"});
      if(!r.ok)throw Error(name+" ("+r.status+")");
      if(type==="text")return r.text();
      if(type==="json")return r.json();
      const bytes=new Uint8Array(await r.arrayBuffer());
      if(bytes[0]===0x1f && bytes[1]===0x8b){
        const input=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
        return new Response(input).json();
      }
      return JSON.parse(new TextDecoder().decode(bytes));
    })().catch(e=>{inFlight.delete(name);throw e});
    inFlight.set(name,request);
  }
  return inFlight.get(name);
}
const safeJson=value=>JSON.stringify(value).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
const scriptText=s=>s.replace(/<\/script/gi,"<\\/script");
let catalog,active,account,seq=0;
let sidebarTop=null;
let pending=null;
const home = {company_admin:"/business-manager/",csr:"/csr-dashboard/",technician:"/my-day/"};
const sampleLogin = {company_admin:"demo_owner",csr:"demo_csr",technician:"demo_tech_kevin"};
const roleName = {company_admin:"会社管理者",csr:"受付担当",technician:"現場スタッフ"};
const grantPrefix = "servicelife-ja:staff-access:v1:";
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js","text"),read("tech-map.js","text"),read("brand.svg","text")]);
function grantedRole(login){
  const initial = catalog.accounts[login].role;
  try {
    const saved = localStorage.getItem(grantPrefix + login);
    return Object.hasOwn(roleName,saved) ? saved : initial;
  } catch { return initial; }
}
function staffList(){
  return Object.entries(catalog.accounts).map(([login,person])=>({login,name:person.name,role:grantedRole(login)}));
}
const expenseKey=value=>typeof value==="string" && /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(value)?value:null;
function routeHash(role,route,vehicle,expense){
  const detail=["/vehicles/","/expenses/"].includes(route) && Number.isSafeInteger(vehicle) && vehicle>0;
  const query=route==="/expenses/" && expenseKey(expense)?"?expense="+expense:detail?"?vehicle="+vehicle:"";
  return "#"+(role==="company_admin"?"":role)+route+query;
}
function requested(){
  const [path,query]=location.hash.slice(1).split("?");
  const match=path.match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
  const url = new URL(location.href);
  // Old bookmarks identify a sample account on entry. Subsequent routes use that account's grant.
  if(account===undefined){
    account=url.searchParams.get("account") ?? sampleLogin[match?.[1] || "company_admin"];
    if(!url.searchParams.has("account") && account===sampleLogin.company_admin && grantedRole(account)!=="company_admin"){
      account=staffList().find(person=>person.role==="company_admin")?.login ?? account;
    }
  }
  if (!Object.hasOwn(catalog.accounts,account)) return null;
  const role = grantedRole(account);
  const target = match?.[2];
  const route = catalog.files[role+"|"+target] ? target : home[role];
  if(account!==sampleLogin.company_admin || role!=="company_admin") url.searchParams.set("account",account);
  const params=new URLSearchParams(query);
  const vehicleKey=Number(params.get("vehicle"));
  const vehicle=["/vehicles/","/expenses/"].includes(route) && Number.isSafeInteger(vehicleKey) && vehicleKey>0 ? vehicleKey : null;
  const expense=route==="/expenses/"?expenseKey(params.get("expense")):null;
  url.hash=routeHash(role,route,vehicle,expense);
  if(url.href!==location.href) history.replaceState(null,"",url);
  return {role,route,vehicle,expense,account:{id:account,name:catalog.accounts[account].name}};
}
function change(role,route,{fromSidebar,backToCustomers,vehicle,expense}){
  if(!catalog.roles[role]||!catalog.files[role+"|"+route])return;
  const hash=routeHash(role,route,vehicle,expense);
  if(location.hash!==hash){
    const openingCustomer=active.route==="/customers/" && /^\/customers\/[\da-f-]{36}\/$/.test(route);
    const returningToList=backToCustomers && route==="/customers/";
    const query=(openingCustomer || returningToList) && history.state?.customerDirectoryQuery;
    location.hash=hash;
    if(query)history.replaceState({...history.state,customerDirectoryQuery:query},"");
  }
  else if(expenseKey(expense))frame.contentWindow.postMessage({application:"servicelife-jp",type:"expense-open",expense},"*");
  else if(!fromSidebar)openScreen();
}
function inline(parent,code,first=false){
  const script=parent.ownerDocument.createElement("script");
  script.textContent=scriptText(code);
  if(first)parent.prepend(script);else parent.append(script);
  return script;
}
async function reservationData(place, record) {
  if (!["/calendar/", "/appointments/"].includes(place.route)) return record;
  const fixtures = {};
  for (const route of ["/calendar/", "/appointments/", "/customers/"]) {
    if (route === place.route) continue;
    const groupId = catalog.files[place.role + "|" + route];
    if (!groupId) continue;
    const group = await read("screens/" + groupId + ".bin");
    for (const [url, data] of Object.entries(group[route].fx)) {
      if (/\/(?:customers|scheduling\/(?:calendar|resource-day|appointments))\/(?:\?|$)/.test(url)) fixtures[url] = data;
    }
  }
  return {...record, fx: {...fixtures, ...record.fx}};
}
function sectionMenu(doc,place){
  const nav=doc.querySelector(".sidebar-nav");
  if(!nav)return;
  const links=catalog.roles[place.role];
  const icons={"/vehicles/":"fa-truck","/expenses/":"fa-receipt","/compliance/audit-log/":"fa-folder-open"};
  for(const [index,item] of links.entries()){
    if(!Object.hasOwn(icons,item.route))continue;
    let link=nav.querySelector('a[href="'+item.route+'"]');
    if(!link){
      const previous=nav.querySelector('a[href="'+links[index-1].route+'"]');
      if(!previous)continue;
      link=doc.createElement("a");link.setAttribute("href",item.route);
      previous.after(link);
    }
    const icon=doc.createElement("i");icon.className="fas "+icons[item.route];
    link.replaceChildren(icon," "+item.label);
  }
  if(Object.hasOwn(icons,place.route)){
    for(const link of nav.querySelectorAll("a"))link.classList.toggle("active",link.getAttribute("href")===place.route);
  }
}
function styleSidebar(doc,brand,name){
  for(const header of doc.querySelectorAll(".sidebar-brand"))header.innerHTML=brand;
  for(const footer of doc.querySelectorAll(".sidebar-user")){
    const logout=footer.querySelector('a[href="/logout/"]');
    if(!logout)continue;
    const label=doc.createElement("span");
    label.className="sukimakun-login-name";
    label.textContent=name;
    logout.classList.add("sukimakun-logout");
    logout.title="ログアウト";
    logout.setAttribute("aria-label","ログアウト");
    for(const attribute of ["style","onmouseover","onmouseout"])logout.removeAttribute(attribute);
    footer.replaceChildren(label,logout);
  }
  const style=doc.createElement("style");
  style.textContent=`
    .sidebar-brand{height:105px;min-height:105px;padding:0;display:flex;align-items:center;justify-content:center;flex-shrink:0}
    .sidebar-brand svg{display:block;width:174.2px;height:19.5px;flex:none}
    .sidebar-user{height:93px;min-height:93px;box-sizing:border-box;padding:0 20px;gap:16px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}
    .sukimakun-login-name{font-size:17px;line-height:24px;font-weight:600;color:#fff;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}
    .sidebar-user .sukimakun-logout{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;border-radius:6px;color:#fff;font-size:22px;text-decoration:none}
    .sukimakun-logout:hover,.sukimakun-logout:focus-visible{background:#ffffff1f}
  `;
  doc.head.append(style);
}
function render(record,programs,language,inside,tech,brand,place){
  const mode=record.mode,raw=mode==="active"?record.raw:record.view;
  const doc=new DOMParser().parseFromString(raw.replaceAll("@@FILES@@",base.href),"text/html");
  const routes=Object.keys(catalog.files).filter(x=>x.startsWith(place.role+"|")).map(x=>x.split("|")[1]);
  sectionMenu(doc,place);
  const conf={fleet:place.fleet,fleetToken:place.fleetToken,vehicle:place.vehicle,office:place.office,officeToken:place.officeToken,
    expense:place.expense,corrections:place.corrections,route:place.route,role:place.role,mode,captured:record.captured,terms:language.terms,fixtures:record.fx,routes,sidebarTop};
  if(place.route==="/customers/")conf.directoryQuery=history.state?.customerDirectoryQuery || "";
  if(place.role==="company_admin" && place.route==="/settings/"){
    conf.staff=staffList();
    conf.openStaffPanel=new URLSearchParams(location.search).get("panel")==="users";
  }
  if(place.route==="/users/"){
    for(const row of doc.querySelectorAll("#tableBody tr")){
      const login=row.cells[0]?.querySelector("div")?.textContent.trim().replace(/^@/,"");
      const badge=row.cells[3]?.querySelector(".badge");
      if(badge && Object.hasOwn(catalog.accounts,login) && grantedRole(login)!==catalog.accounts[login].role){
        const role=grantedRole(login);
        badge.textContent=roleName[role];
        badge.className="badge "+({company_admin:"badge-blue",csr:"badge-green",technician:"badge-orange"}[role]);
      }
    }
  }
  const skip=new Set(programs.skip);
  if(mode==="snapshot"){
    const drawer=Object.entries(programs.scripts).find(([,code])=>code.includes("function cbpToggleSidebar") || (code.includes('t.closest("#cbpHamburger")') && code.includes("cbpToggleSidebar()")));
    if(drawer)inline(doc.body,drawer[1]);
    const bell=Object.values(programs.scripts).find(code=>code.includes("if (window.__cbpNotifBell) return;"));
    if(bell && doc.getElementById("cbpNotifBellBtn"))inline(doc.body,bell);
  }
  for(const style of doc.querySelectorAll("style[data-sl-style]")){
    style.textContent=programs.styles[style.dataset.slStyle]||"";
    style.removeAttribute("data-sl-style");
  }
  styleSidebar(doc,brand,place.account.name);
  for(const node of doc.querySelectorAll("script[data-sl-script]")){
    const h=node.dataset.slScript;let code=programs.scripts[h]||"";
    if(skip.has(h)||!code){node.remove();continue;}
    if(place.route==="/technicians/"&&code.includes("function renderCards()")&&code.includes("function focusTech(")){
      code=code.slice(0,code.indexOf("function focusTech("))+ "\n"+tech;
    }
    node.textContent=scriptText(code);node.removeAttribute("data-sl-script");
  }
  const resources=base.href+"lib/";
  const css=doc.createElement("style");
  css.textContent='@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url("'+resources+'webfonts/inter-latin.woff2") format("woff2")}html{font-family:Inter,system-ui,sans-serif}.sl-map-pin{background:transparent;border:none}.leaflet-container{background:#e8eee9}[hidden]{display:none!important}';
  doc.head.append(css);
  const solid=doc.createElement("link");solid.rel="stylesheet";solid.href=resources+"css/solid.min.css";doc.head.append(solid);
  const leaflet=doc.createElement("link");leaflet.rel="stylesheet";leaflet.href=resources+"leaflet/leaflet.css";doc.head.append(leaflet);
  const l=doc.createElement("script");l.src=resources+"leaflet/leaflet.js";doc.head.prepend(l);
  inline(doc.head,"("+inside+")("+safeJson(conf)+");",true);
  inline(doc.head,"(function(terms){"+language.charts+"})("+safeJson(language.terms)+");");
  inline(doc.body,"(function(terms){"+language.localizer+"})("+safeJson(language.terms)+");");
  const meta=doc.createElement("meta");meta.httpEquiv="Content-Security-Policy";
  meta.content="default-src 'none'; script-src 'unsafe-inline' "+resources+" "+base.href+"assets/; style-src 'unsafe-inline' "+resources+" "+base.href+"assets/; img-src data: blob: "+base.href+" https://tile.openstreetmap.org; font-src data: "+resources+"; connect-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
  doc.head.prepend(meta);
  doc.documentElement.lang="ja";
  return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
async function openScreen(navigation=false){
  const turn=++seq;
  if(pending){pending.frame.remove();pending=null;}
  try{
    const [c,programs,language,inside,tech,brand]=await common;
    if(turn!==seq)return;
    catalog=c;
    const place=requested();
    if(!place){
      active=null;frame.hidden=true;notice.hidden=false;
      notice.textContent="このデモアカウントは利用できません。";
      return;
    }
    if(active && place.role!==active.role){
      const preview=document.getElementById("office-pdf");
      if(preview.open)preview.close();
      sidebarTop=null;
      frame.hidden=true;frame.removeAttribute("srcdoc");delete frame.dataset.route;active=null;
    }
    if(navigation && active?.role===place.role && active.route===place.route && active.vehicle===place.vehicle && active.expense===place.expense){
      notice.hidden=true;
      return;
    }
    const id=c.files[place.role+"|"+place.route];
    if(c.files[place.role+"|/vehicles/"])place.fleetToken=crypto.randomUUID();
    if([OfficeStore.expenses,OfficeStore.documents].includes(place.route))place.officeToken=crypto.randomUUID();
    const [record,fleet,office,corrections]=await Promise.all([
      read("screens/"+id+".bin").then(group=>reservationData(place,group[place.route])),
      place.fleetToken?fleetSnapshot(place):undefined,
      place.officeToken?OfficeStore.snapshot(place).catch(()=>({records:[],cars:[],categories:[],statuses:[],
        error:"このブラウザで試用データを読み込めませんでした。再読み込みしてください。"})):undefined,
      c.files[place.role+"|/expenses/"]?OfficeStore.corrections(place).catch(()=>[]):[]
    ]);
    Object.assign(place,{fleet,office,corrections});
    if(turn!==seq)return;
    const label=c.roles[place.role].find(i=>i.route===place.route)?.label||record.title;
    // Prepare the next document at its final viewport size while the current one stays visible.
    const nextFrame=emptyFrame.cloneNode(false);
    nextFrame.removeAttribute("id");
    nextFrame.inert=true;
    nextFrame.title=(language.terms[label]||language.terms[record.title]||record.title)+"｜ServiceLife 日本語";
    nextFrame.srcdoc=render(record,programs,language,inside,tech,brand,place);
    pending={frame:nextFrame,place};
    frame.after(nextFrame);
  }catch(e){
    if(turn!==seq)return;
    console.error(e);notice.hidden=false;notice.textContent="画面を読み込めませんでした。再読み込みしてください。";
  }
}
function showPendingScreen(){
  const {frame:nextFrame,place}=pending;
  if(grantedRole(account)!==place.role){openScreen();return;}
  if(location.hash!==routeHash(place.role,place.route,place.vehicle,place.expense))return;
  const preview=document.getElementById("office-pdf");
  if(preview.open)preview.close();
  // Moving a connected iframe would reload it. Reveal it in place.
  frame.remove();
  frame=nextFrame;
  frame.id="screen";
  frame.inert=false;
  frame.dataset.route=place.route;
  frame.dataset.role=place.role;
  document.title=frame.title;
  active=place;
  const selection=pending.selection;
  pending=null;
  if(selection!==undefined)handleFleet(place,{action:"select",key:selection});
  notice.hidden=true;
}
function sendStaffUpdate(message=""){
  frame.contentWindow.postMessage({application:"servicelife-ja-grants",staff:staffList(),message},"*");
}
function canAssign(){
  return active?.route==="/settings/" && active.role==="company_admin" && grantedRole(account)==="company_admin";
}
async function saveGrant({login,role,previous}){
  if(!Object.hasOwn(catalog.accounts,login) || !Object.hasOwn(roleName,role))return;
  const save=()=>{
    if(!canAssign())return;
    if(grantedRole(login)!==previous){sendStaffUpdate("権限が更新されました。現在の内容を確認してください。");return;}
    if(role!=="company_admin" && !staffList().some(p=>p.login!==login && p.role==="company_admin")){
      sendStaffUpdate("先に別のスタッフに管理者権限を付与してください。");return;
    }
    try {localStorage.setItem(grantPrefix+login,role);}
    catch {sendStaffUpdate("このブラウザで変更を保存できませんでした。");return;}
    if(grantedRole(account)!==active.role){openScreen();return;}
    sendStaffUpdate(catalog.accounts[login].name+" の権限を保存しました。");
  };
  if(navigator.locks)await navigator.locks.request(grantPrefix,save);
  else save();
}
window.addEventListener("message",e=>{
  if(e.data?.application!=="servicelife-jp")return;
  if(pending && e.source===pending.frame.contentWindow){
    if(e.data.type==="ready" && e.data.route===pending.place.route)showPendingScreen();
    else if(e.data.type==="fleet-request" && pending.place.fleetToken && e.data.token===pending.place.fleetToken &&
            pending.place.route==="/vehicles/" && e.data.action==="select")pending.selection=e.data.key;
    return;
  }
  if(e.source!==frame.contentWindow || !active || grantedRole(account)!==active.role)return;
  if(e.data.type==="fleet-request" && active.fleetToken && e.data.token===active.fleetToken)handleFleet(active,e.data);
  if(e.data.type==="office-request" && active.officeToken && e.data.token===active.officeToken)handleOffice(active,e.data);
  if(e.data.type==="customer-directory-page" && active.route==="/customers/" &&
     location.hash===routeHash(active.role,active.route) && typeof e.data.query==="string"){
    history.replaceState({...history.state,customerDirectoryQuery:e.data.query},"");
  }
  if(e.data.type==="sidebar-position" && e.data.route===active.route && e.data.role===active.role && Number.isFinite(e.data.top)){
    sidebarTop=Math.max(0,e.data.top);
  }
  if(e.data.type==="route")change(active.role,e.data.route,e.data);
  if(e.data.type==="grant" && canAssign()) saveGrant(e.data);
  if(e.data.type==="view-account" && canAssign() && Object.hasOwn(catalog.accounts,e.data.login)){
    const url=new URL(location.href),role=grantedRole(e.data.login);
    url.searchParams.set("account",e.data.login);
    url.searchParams.delete("panel");
    url.hash=routeHash(role,home[role]);
    location.assign(url);
  }
});
window.addEventListener("storage",e=>{
  if(!active || (e.key!==null && !e.key.startsWith(grantPrefix)))return;
  if(grantedRole(account)!==active.role || active.route==="/users/")openScreen();
  else if(canAssign())sendStaffUpdate("最新の権限を表示しています。");
});
window.addEventListener("pageshow",e=>{if(e.persisted)openScreen();});
window.addEventListener("hashchange",()=>openScreen(true));
openScreen();

async function fleetSnapshot(place){
  try{return await FleetStore.snapshot(place.route==="/vehicles/");}
  catch{return {day:FleetStore.today(),alerts:[],vehicles:[],error:"このブラウザの試用データを読み込めませんでした。再読み込みしてください。"};}
}
const fleetChannel=typeof BroadcastChannel==="function" ? new BroadcastChannel("exops-servicelife-vehicles") : null;
async function handleFleet(place,request){
  const respond=(payload)=>{
    if(active!==place || grantedRole(account)!==place.role)return;
    frame.contentWindow.postMessage({application:"servicelife-jp",type:"fleet-result",token:place.fleetToken,
      requestId:request.requestId,...payload},"*");
  };
  try{
    let key;
    if(request.action==="save"){
      if(place.route!=="/vehicles/" || place.role!=="company_admin")throw Error("車両の登録・更新は会社管理者が行えます。");
      key=await FleetStore.save(request.draft);
      fleetChannel?.postMessage("changed");
    }else if(request.action==="select" && place.route==="/vehicles/"){
      const vehicle=Number(request.key);
      place.vehicle=Number.isSafeInteger(vehicle)&&vehicle>0?vehicle:null;
      history.replaceState(history.state,"",routeHash(place.role,place.route,place.vehicle));
      return;
    }else if(request.action!=="refresh")return;
    place.fleet=await fleetSnapshot(place);
    respond({state:place.fleet,key});
  }catch(error){respond({error:error.message});}
}
function refreshFleet(){
  if(active?.fleetToken)handleFleet(active,{action:"refresh"});
  refreshOffice();
}
if(fleetChannel)fleetChannel.onmessage=refreshFleet;
window.addEventListener("focus",refreshFleet);
setInterval(()=>{if(active?.fleet && active.fleet.day!==FleetStore.today())refreshFleet();},60000);

const officeChannel=typeof BroadcastChannel==="function" ? new BroadcastChannel("exops-servicelife-office") : null;
function refreshOffice(){
  if(active?.officeToken)handleOffice(active,{action:"refresh"});
  if(active && catalog.files[active.role+"|/expenses/"])refreshCorrections(active);
}
async function refreshCorrections(place){
  const generation=place.correctionRead=(place.correctionRead||0)+1;
  try{
    const corrections=await OfficeStore.corrections(place);
    if(active!==place || grantedRole(account)!==place.role || place.correctionRead!==generation)return;
    place.corrections=corrections;
    frame.contentWindow.postMessage({application:"servicelife-jp",type:"expense-alerts",corrections},"*");
  }catch{/* Keep the last visible count if this browser's storage is temporarily unavailable. */}
}
if(officeChannel)officeChannel.onmessage=refreshOffice;
let officeRead=0;
async function handleOffice(place,request){
  const reply=payload=>{
    if(active===place && grantedRole(account)===place.role)frame.contentWindow.postMessage({application:"servicelife-jp",type:"office-result",
      token:place.officeToken,requestId:request.requestId,...payload},"*");
  };
  try{
    let id;
    if(request.action==="pdf"){
      const file=await OfficeStore.attachment(place,request.fileId);
      if(active===place && grantedRole(account)===place.role)showOfficePdf(file);
      reply({});return;
    }
    if(request.action==="save"){
      id=await OfficeStore.save(place,request.draft);
      officeChannel?.postMessage("changed");
      if(active===place)refreshCorrections(place);
    }else if(request.action!=="refresh")return;
    const generation=++officeRead;
    const state=await OfficeStore.snapshot(place);
    reply(generation===officeRead?{state,id}:{id});
  }catch(error){reply({error:error.message});}
}
function showOfficePdf(file){
  const dialog=document.getElementById("office-pdf");
  if(dialog.open)dialog.close();
  const url=URL.createObjectURL(file.bytes), photo=dialog.querySelector("img");
  const embed=document.createElement("iframe");
  const isPhoto=file.bytes.type.startsWith("image/");
  dialog.setAttribute("aria-label",file.receipt?"経費の領収書":"書類の控え");
  embed.title=file.receipt?"領収書":"控えのPDF";
  dialog.querySelector("strong").textContent=file.name;
  const [open,download]=dialog.querySelectorAll("a");
  open.href=url;download.href=url;download.download=file.name;
  photo.hidden=!isPhoto;
  if(isPhoto){photo.alt=file.name;photo.src=url;}else{embed.src=url;dialog.append(embed);}
  dialog.querySelector("button").onclick=()=>dialog.close();
  dialog.addEventListener("close",()=>{
    embed.remove();
    if(!dialog.open)dialog.after(viewportHud);
    if(!dialog.open && open.href===url){
      photo.removeAttribute("src");open.removeAttribute("href");download.removeAttribute("href");
    }
    URL.revokeObjectURL(url);
  },{once:true});
  // A modal is in the browser's top layer, above the main page's HUD.
  dialog.append(viewportHud);
  dialog.showModal();
}
