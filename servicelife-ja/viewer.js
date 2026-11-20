/* ServiceLife public reference. Navigation remains in this browser tab. */
"use strict";
const base=new URL("./",document.baseURI);
let frame=document.querySelector("#screen");
const notice=document.querySelector("#notice");
const inFlight=new Map();
const menuPositions=new Map();
async function read(name,type) {
  if(!inFlight.has(name)){
    const request=(async()=>{
      const r=await fetch(new URL(name,base),{cache:"no-cache"});
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
let catalog,active,preparing,navigation,seq=0;
const pendingMenuHashes=[];
const dataVersion="?v=322a061db6c88926";
const screenFile=id=>"screens/"+id+".bin"+dataVersion;
const common=Promise.all([read("catalog.json"+dataVersion,"json"),read("programs.bin"+dataVersion),read("language.bin"+dataVersion),read("inside.js?v=f37cac89f78a3aa4","text"),read("tech-map.js","text")]);
function initialRoute(role){return catalog.roles[role][0].route;}
function routeHash(role,route,vehicle){
  const detail=["/maintenance/","/expenses/"].includes(route) && Number.isSafeInteger(vehicle) && vehicle>0;
  return "#"+(role==="company_admin"?"":role)+route+(detail?"?vehicle="+vehicle:"");
}
function requested(hash){
  const [path,query]=hash.slice(1).split("?");
  const match=path.match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
  const role=match?.[1]||"company_admin";
  const route=match?.[2]||initialRoute(role);
  if(catalog.files[role+"|"+route]){
    const vehicle=Number(new URLSearchParams(query).get("vehicle"));
    return {role,route,vehicle:["/maintenance/","/expenses/"].includes(route) && Number.isSafeInteger(vehicle) && vehicle>0 ? vehicle : null};
  }
  const home=initialRoute(role);
  history.replaceState(null,"",routeHash(role,home));
  return {role,route:home};
}
function change(role,route,vehicle){
  if(!catalog.roles[role]||!catalog.files[role+"|"+route])return;
  const hash=routeHash(role,route,vehicle);
  if(pendingMenuHashes.at(-1)===hash)return;
  if(active && hash===routeHash(active.role,active.route,active.vehicle)){
    ++seq;
    pendingMenuHashes.length=0;
    discardPreparation();
    activateNavigation();
    if(location.hash!==hash)history.replaceState(null,"",hash);
    return;
  }
  pendingMenuHashes.push(hash);
  openScreen(hash);
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
    const group = await read(screenFile(groupId));
    for (const [url, data] of Object.entries(group[route].fx)) {
      if (/\/(?:customers|scheduling\/(?:calendar|resource-day|appointments))\/(?:\?|$)/.test(url)) fixtures[url] = data;
    }
  }
  return {...record, fx: {...fixtures, ...record.fx}};
}
function render(record,programs,language,inside,tech,place,surface){
  const mode=record.mode,raw=mode==="active"?record.raw:record.view;
  const doc=new DOMParser().parseFromString(raw.replaceAll("@@FILES@@",base.href),"text/html");
  const routes=Object.keys(catalog.files).filter(x=>x.startsWith(place.role+"|")).map(x=>x.split("|")[1]);
  const conf={route:place.route,role:place.role,mode,surface,captured:record.captured,terms:language.terms,fixtures:record.fx,routes,
    menuRoutes:catalog.roles[place.role].map(item=>item.route), fleet:surface==="navigation" ? fleetSummary(place.fleet) : place.fleet,
    fleetToken:place.fleetToken, vehicle:place.vehicle, menuTop:menuPositions.get(place.role),
    office:surface==="content"?place.office:undefined, officeToken:surface==="content"?place.officeToken:undefined};
  const skip=new Set(programs.skip);
  if(surface==="content"){
    for(const el of doc.querySelectorAll(".sidebar,#cbpNotifBellWrap,#cbpSidebarBackdrop,#cbpHamburger"))el.remove();
  }
  for(const style of doc.querySelectorAll("style[data-sl-style]")){
    style.textContent=programs.styles[style.dataset.slStyle]||"";
    style.removeAttribute("data-sl-style");
  }
  for(const node of doc.querySelectorAll("script[data-sl-script]")){
    const h=node.dataset.slScript;let code=programs.scripts[h]||"";
    if(skip.has(h)||!code){node.remove();continue;}
    if(surface==="content" && ["window.__cbpMobileNav","window.__cbpNotifBell"].some(marker=>code.includes(marker))){
      node.remove();continue;
    }
    if(place.route==="/technicians/"&&code.includes("function renderCards()")&&code.includes("function focusTech(")){
      code=code.slice(0,code.indexOf("function focusTech("))+ "\n"+tech;
    }
    node.textContent=scriptText(code);node.removeAttribute("data-sl-script");
  }
  const resources=base.href+"lib/";
  const css=doc.createElement("style");
  css.textContent='@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url("'+resources+'webfonts/inter-latin.woff2") format("woff2")}html{font-family:Inter,system-ui,sans-serif}.sl-map-pin{background:transparent;border:none}.leaflet-container{background:#e8eee9}[hidden]{display:none!important}';
  css.textContent+=':root{--sidebar-w:220px}@media (min-width: 768px){html{scrollbar-gutter:stable}.sidebar{width:220px;transform:none}.main{margin-left:220px}#cbpHamburger{display:none}#cbp-topbar>.topbar{padding-left:28px}}';
  css.textContent+='html,body{background:transparent}';
  if(surface==="navigation"){
    css.textContent+='html,body{height:100%;overflow:hidden}';
  }else{
    css.textContent+='.main{background:var(--bg,#f4f6fa)}';
  }
  doc.head.append(css);
  const solid=doc.createElement("link");solid.rel="stylesheet";solid.href=resources+"css/solid.min.css";doc.head.append(solid);
  if(doc.querySelector("[data-offline-map]")){
    const leaflet=doc.createElement("link");leaflet.rel="stylesheet";leaflet.href=resources+"leaflet/leaflet.css";doc.head.append(leaflet);
    const l=doc.createElement("script");l.src=resources+"leaflet/leaflet.js";doc.head.prepend(l);
  }
  css.textContent+=".sidebar-nav a[aria-busy=true]{cursor:progress}";
  inline(doc.head,"("+inside+")("+safeJson(conf)+");",true);
  inline(doc.head,"(function(terms){"+language.charts+"})(window.SL_VIEW.terms);");
  inline(doc.body,"(function(terms){"+language.localizer+"})(window.SL_VIEW.terms);");
  if(surface==="navigation")inline(doc.body,"("+programs.shellCode+")();");
  const meta=doc.createElement("meta");meta.httpEquiv="Content-Security-Policy";
  meta.content="default-src 'none'; script-src 'unsafe-inline' "+resources+" "+base.href+"assets/; style-src 'unsafe-inline' "+resources+" "+base.href+"assets/; img-src data: blob: "+base.href+" https://tile.openstreetmap.org; font-src data: "+resources+"; connect-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
  doc.head.prepend(meta);
  doc.documentElement.lang="ja";
  return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
function fleetSummary(state){
  if(!state)return undefined;
  return {day:state.day,alerts:state.alerts,error:state.error};
}
function activateNavigation(){
  if(!active||!navigation)return;
  navigation.element.contentWindow.postMessage({application:"servicelife-jp",type:"activate-shell",
    route:active.route,notifications:active.notifications,fleet:fleetSummary(active.fleet)},"*");
}
function discardPreparation(){
  if(!preparing)return;
  preparing.element.remove();
  preparing.newNavigation?.element.remove();
  preparing=null;
}
function makeFrame(kind,title,source){
  const el=document.createElement("iframe");
  el.className=kind;el.dataset.preparing="";el.inert=true;el.setAttribute("aria-hidden","true");
  el.setAttribute("sandbox","allow-scripts");el.referrerPolicy="strict-origin-when-cross-origin";
  el.title=title;el.srcdoc=source;
  return el;
}
function revealFrame(el,id){
  el.id=id;delete el.dataset.preparing;el.inert=false;el.removeAttribute("aria-hidden");
}
async function openScreen(hash=location.hash){
  const turn=++seq;
  discardPreparation();
  try{
    const [c,programs,language,inside,tech]=await common;catalog=c;
    if(turn!==seq)return;
    const place=requested(hash);const id=c.files[place.role+"|"+place.route];
    const hasFleet=Boolean(c.files[place.role+"|/maintenance/"]);
    if(hasFleet)place.fleetToken=crypto.randomUUID();
    if([OfficeStore.expenses,OfficeStore.documents].includes(place.route))place.officeToken=crypto.randomUUID();
    const [record,fleet,office]=await Promise.all([
      read(screenFile(id)).then(group=>reservationData(place,group[place.route])),
      hasFleet ? fleetSnapshot(place) : undefined,
      place.officeToken ? OfficeStore.snapshot(place).catch(()=>({records:[],cars:[],categories:[],statuses:[],
        error:"このブラウザで試用データを読み込めませんでした。再読み込みしてください。"})) : undefined
    ]);
    place.fleet=fleet;
    place.office=office;
    place.notifications=Object.fromEntries(Object.entries(record.fx || {}).filter(([url])=>url.includes("/notifications/")));
    if(turn!==seq)return;
    const label=c.roles[place.role].find(i=>i.route===place.route)?.label||record.title;
    const title=(language.terms[label]||language.terms[record.title]||record.title)+"｜ServiceLife 日本語";
    const element=makeFrame("screen",title,render(record,programs,language,inside,tech,place,"content"));
    let newNavigation;
    if(navigation?.role!==place.role){
      const nav=makeFrame("navigation","共通メニュー",render(programs.shells[place.role],programs,language,inside,tech,place,"navigation"));
      newNavigation={role:place.role,element:nav,ready:false};
    }
    preparing={element,place,turn,newNavigation,contentReady:false};
    frame.after(element);
    if(newNavigation)element.after(newNavigation.element);
  }catch(e){
    if(turn!==seq)return;
    pendingMenuHashes.length=0;
    console.error(e);notice.hidden=false;notice.textContent="画面を読み込めませんでした。再読み込みしてください。";
  }
}
function showPrepared(next){
  if(preparing!==next || next.turn!==seq)return;
  // Commit menu clicks and the visible page in the same frame, including rapid clicks.
  for(const hash of pendingMenuHashes){
    if(location.hash!==hash)history.pushState(null,"",hash);
  }
  pendingMenuHashes.length=0;
  const previous=frame;
  if(document.getElementById("office-pdf")?.open)document.getElementById("office-pdf").close();
  frame=next.element;active=next.place;preparing=null;
  previous.remove();revealFrame(frame,"screen");
  if(next.newNavigation){
    navigation?.element.remove();navigation=next.newNavigation;
    revealFrame(navigation.element,"navigation");
  }
  frame.dataset.route=active.route;frame.dataset.role=active.role;
  syncModalFocus();document.title=frame.title;notice.hidden=true;
  activateNavigation();
  if(next.selection!==undefined)handleFleet(active,{action:"select",key:next.selection});
  // The next menu item is often in the next data file. Warm that one file after paint.
  const items=catalog.roles[active.role];
  const index=items.findIndex(item=>item.route===active.route);
  if(index>=0 && items[index+1]){
    const warm=()=>{if(active===next.place)warmRoute(active.role,items[index+1].route);};
    if(window.requestIdleCallback)requestIdleCallback(warm,{timeout:800});else setTimeout(warm,0);
  }
}
function warmRoute(role,route){
  const id=catalog.files[role+"|"+route];
  if(id && !navigator.connection?.saveData && !inFlight.has(screenFile(id)))
    read(screenFile(id)).catch(()=>{});
}
function presentWhenReady(next){
  if(!next.contentReady || (next.newNavigation && !next.newNavigation.ready))return;
  const present=()=>showPrepared(next);
  if(document.hidden)present();else requestAnimationFrame(present);
}
function syncModalFocus(){
  if(!navigation || !active)return;
  navigation.element.inert=frame.hasAttribute("data-modal");
  frame.inert=!navigation.element.inert && navigation.overlay===true;
}
function updateRegions(el,rects){
  if(!Array.isArray(rects)||rects.length>20)return;
  const paths=[];
  for(const rect of rects){
    if(!Array.isArray(rect)||rect.length!==4||!rect.every(Number.isFinite))return;
    const [x,y,right,bottom]=rect;
    paths.push("M"+x+" "+y+" H"+right+" V"+bottom+" H"+x+" Z");
  }
  el.style.clipPath=paths.length?'path("'+paths.join(" ")+'")':"inset(100%)";
}
window.addEventListener("message",e=>{
  if(e.data?.application!=="servicelife-jp")return;
  const incoming=preparing?.newNavigation;
  const nav=incoming && e.source===incoming.element.contentWindow ? incoming :
    navigation && e.source===navigation.element.contentWindow ? navigation : null;
  if(nav){
    if(e.data.type==="shell-regions"){
      updateRegions(nav.element,e.data.rects);nav.overlay=e.data.overlay===true;
      if(nav===navigation)syncModalFocus();
    }
    if(e.data.type==="ready" && nav===incoming){nav.ready=true;presentWhenReady(preparing);}
    if(nav!==navigation || !active)return;
    if(["menu-scroll","route"].includes(e.data.type) && Number.isFinite(e.data.menuTop))
      menuPositions.set(nav.role,Math.max(0,e.data.menuTop));
    if(e.data.type==="route-hint")warmRoute(nav.role,e.data.route);
    if(e.data.type==="route")change(nav.role,e.data.route,e.data.vehicle);
    return;
  }
  if(preparing && e.source===preparing.element.contentWindow){
    const next=preparing;
    if(e.data.type==="ready" && e.data.route===next.place.route){
      next.contentReady=true;presentWhenReady(next);
    }else if(e.data.type==="content-modal"){
      next.element.toggleAttribute("data-modal",e.data.open===true);
    }else if(e.data.type==="fleet-request" && e.data.token===next.place.fleetToken && e.data.action==="select"){
      next.selection=e.data.key;
    }
    return;
  }
  if(e.source!==frame.contentWindow||!active)return;
  if(e.data.type==="content-modal"){frame.toggleAttribute("data-modal",e.data.open===true);syncModalFocus();}
  if(e.data.type==="content-pointer")navigation?.element.contentWindow.postMessage({application:"servicelife-jp",type:"content-pointer"},"*");
  if(e.data.type==="route")change(active.role,e.data.route,e.data.vehicle);
  if(e.data.type==="fleet-request" && active.fleetToken && e.data.token===active.fleetToken){
    handleFleet(active,e.data);
  }
  if(e.data.type==="office-request" && active.officeToken && e.data.token===active.officeToken){
    handleOffice(active,e.data);
  }
  if(e.data.type==="role"&&Object.hasOwn(catalog.roles,e.data.role)){
    const role=e.data.role;
    const home=role==="technician"?"/my-day/":role==="csr"?"/csr-dashboard/":"/business-manager/";
    change(role,catalog.files[role+"|"+home]?home:initialRoute(role));
  }
});
window.addEventListener("hashchange",()=>{
  pendingMenuHashes.length=0;
  openScreen();
});
openScreen();

async function fleetSnapshot(place){
  try{return await FleetStore.snapshot(place.route==="/maintenance/");}
  catch{return {day:FleetStore.today(),alerts:[],vehicles:[],error:"このブラウザの試用データを読み込めませんでした。再読み込みしてください。"};}
}
const fleetChannel=typeof BroadcastChannel==="function" ? new BroadcastChannel("exops-servicelife-vehicles") : null;
async function handleFleet(place,request){
  const respond=(payload)=>{
    if(active!==place)return;
    frame.contentWindow.postMessage({application:"servicelife-jp",type:"fleet-result",token:place.fleetToken,
      requestId:request.requestId,...payload},"*");
  };
  try{
    let key;
    if(request.action==="save"){
      if(place.route!=="/maintenance/" || place.role!=="company_admin")throw Error("車両の登録・更新は会社管理者が行えます。");
      key=await FleetStore.save(request.draft);
      fleetChannel?.postMessage("changed");
    }else if(request.action==="select" && place.route==="/maintenance/"){
      const vehicle=Number(request.key);
      place.vehicle=Number.isSafeInteger(vehicle)&&vehicle>0?vehicle:null;
      history.replaceState(null,"",routeHash(place.role,place.route,place.vehicle));
      return;
    }else if(request.action!=="refresh")return;
    place.fleet=await fleetSnapshot(place);
    respond({state:place.fleet,key});
    if(active===place && navigation)navigation.element.contentWindow.postMessage({application:"servicelife-jp",type:"shell-fleet",fleet:fleetSummary(place.fleet)},"*");
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
}
if(officeChannel)officeChannel.onmessage=refreshOffice;
let officeRead=0;
async function handleOffice(place,request){
  const reply=payload=>{
    if(active===place)frame.contentWindow.postMessage({application:"servicelife-jp",type:"office-result",
      token:place.officeToken,requestId:request.requestId,...payload},"*");
  };
  try{
    let id;
    if(request.action==="pdf"){
      const file=await OfficeStore.attachment(place,request.fileId);
      if(active===place)showOfficePdf(file);
      reply({});return;
    }
    if(request.action==="save"){
      id=await OfficeStore.save(place,request.draft);
      officeChannel?.postMessage("changed");
    }else if(request.action!=="refresh")return;
    const generation=++officeRead;
    const state=await OfficeStore.snapshot(place);
    reply(generation===officeRead?{state,id}:{id});
  }catch(error){reply({error:error.message});}
}
function showOfficePdf(file){
  const dialog=document.getElementById("office-pdf");
  if(dialog.open)dialog.close();
  const url=URL.createObjectURL(file.bytes), embed=dialog.querySelector("iframe");
  dialog.querySelector("strong").textContent=file.name;
  const [open,download]=dialog.querySelectorAll("a");
  open.href=url;download.href=url;download.download=file.name;
  embed.src=url;
  dialog.querySelector("button").onclick=()=>dialog.close();
  dialog.addEventListener("close",()=>{
    embed.removeAttribute("src");open.removeAttribute("href");download.removeAttribute("href");
    URL.revokeObjectURL(url);
  },{once:true});
  dialog.showModal();
}
