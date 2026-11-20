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
let catalog,active,preparing,seq=0;
const pendingMenuHashes=[];
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js?v=a7daf18789456248","text"),read("tech-map.js","text")]);
function initialRoute(role){return catalog.roles[role][0].route;}
function routeHash(role,route,vehicle){
  const detail=route==="/maintenance/" && Number.isSafeInteger(vehicle) && vehicle>0;
  return "#"+(role==="company_admin"?"":role)+route+(detail?"?vehicle="+vehicle:"");
}
function requested(hash){
  const [path,query]=hash.slice(1).split("?");
  const match=path.match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
  const role=match?.[1]||"company_admin";
  const route=match?.[2]||initialRoute(role);
  if(catalog.files[role+"|"+route]){
    const vehicle=Number(new URLSearchParams(query).get("vehicle"));
    return {role,route,vehicle:route==="/maintenance/" && Number.isSafeInteger(vehicle) && vehicle>0 ? vehicle : null};
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
    if(preparing){preparing.element.remove();preparing=null;}
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
    const group = await read("screens/" + groupId + ".bin");
    for (const [url, data] of Object.entries(group[route].fx)) {
      if (/\/(?:customers|scheduling\/(?:calendar|resource-day|appointments))\/(?:\?|$)/.test(url)) fixtures[url] = data;
    }
  }
  return {...record, fx: {...fixtures, ...record.fx}};
}
function render(record,programs,language,inside,tech,place){
  const mode=record.mode,raw=mode==="active"?record.raw:record.view;
  const doc=new DOMParser().parseFromString(raw.replaceAll("@@FILES@@",base.href),"text/html");
  const routes=Object.keys(catalog.files).filter(x=>x.startsWith(place.role+"|")).map(x=>x.split("|")[1]);
  const conf={route:place.route,role:place.role,mode,captured:record.captured,terms:language.terms,fixtures:record.fx,routes,
    fleet:place.fleet, fleetToken:place.fleetToken, vehicle:place.vehicle, menuTop:menuPositions.get(place.role)};
  const skip=new Set(programs.skip);
  if(mode==="snapshot"){
    const drawer=Object.entries(programs.scripts).find(([,code])=>code.includes("function cbpToggleSidebar") || (code.includes('t.closest("#cbpHamburger")') && code.includes("cbpToggleSidebar()")));
    if(drawer)inline(doc.body,drawer[1]);
    const tour=Object.values(programs.scripts).find(code=>code.includes("$('slt-fab').onclick = start;"));
    if(tour && doc.getElementById("slt-fab"))inline(doc.body,tour);
    if(place.fleet){
      const bell=Object.values(programs.scripts).find(code=>code.includes("window.cbpToggleNotifBell = function"));
      if(bell){
        for(const el of doc.querySelectorAll("#cbpNotifBellWrap [data-sl-click]")){
          el.setAttribute("onclick",el.getAttribute("data-sl-click"));el.removeAttribute("data-sl-click");
        }
        inline(doc.body,bell);
      }
    }
  }
  for(const style of doc.querySelectorAll("style[data-sl-style]")){
    style.textContent=programs.styles[style.dataset.slStyle]||"";
    style.removeAttribute("data-sl-style");
  }
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
  css.textContent+=':root{--sidebar-w:220px}@media(min-width:768px){html{scrollbar-gutter:stable}.sidebar{width:220px;transform:none}.main{margin-left:220px}#cbpHamburger{display:none}#cbp-topbar>.topbar{padding-left:28px}}';
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
  const meta=doc.createElement("meta");meta.httpEquiv="Content-Security-Policy";
  meta.content="default-src 'none'; script-src 'unsafe-inline' "+resources+" "+base.href+"assets/; style-src 'unsafe-inline' "+resources+" "+base.href+"assets/; img-src data: blob: "+base.href+" https://tile.openstreetmap.org; font-src data: "+resources+"; connect-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
  doc.head.prepend(meta);
  doc.documentElement.lang="ja";
  return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
async function openScreen(hash=location.hash){
  const turn=++seq;
  if(preparing){preparing.element.remove();preparing=null;}
  try{
    const [c,programs,language,inside,tech]=await common;catalog=c;
    if(turn!==seq)return;
    const place=requested(hash);const id=c.files[place.role+"|"+place.route];
    const hasFleet=Boolean(c.files[place.role+"|/maintenance/"]);
    if(hasFleet)place.fleetToken=crypto.randomUUID();
    const [record,fleet]=await Promise.all([
      read("screens/"+id+".bin").then(group=>reservationData(place,group[place.route])),
      hasFleet ? fleetSnapshot(place) : undefined
    ]);
    place.fleet=fleet;
    if(turn!==seq)return;
    const label=c.roles[place.role].find(i=>i.route===place.route)?.label||record.title;
    const element=document.createElement("iframe");
    element.className="screen";element.dataset.preparing="";element.inert=true;
    element.setAttribute("aria-hidden","true");element.setAttribute("sandbox",frame.getAttribute("sandbox"));
    element.referrerPolicy=frame.referrerPolicy;
    element.title=(language.terms[label]||language.terms[record.title]||record.title)+"｜ServiceLife 日本語";
    element.srcdoc=render(record,programs,language,inside,tech,place);
    preparing={element,place,turn};
    frame.after(element);
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
  frame=next.element;active=next.place;preparing=null;
  previous.remove();frame.id="screen";
  delete frame.dataset.preparing;frame.inert=false;frame.removeAttribute("aria-hidden");
  frame.dataset.route=active.route;document.title=frame.title;notice.hidden=true;
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
  if(id && !navigator.connection?.saveData && !inFlight.has("screens/"+id+".bin"))
    read("screens/"+id+".bin").catch(()=>{});
}
function presentAtMenuPosition(next,appliedTop){
  function present(){
    if(preparing!==next || next.turn!==seq)return;
    const latest=menuPositions.get(next.place.role);
    if(Number.isFinite(appliedTop) && Number.isFinite(latest) && latest!==appliedTop){
      next.element.contentWindow.postMessage({application:"servicelife-jp",type:"restore-menu",menuTop:latest},"*");
      return;
    }
    showPrepared(next);
  }
  if(document.hidden)present();else requestAnimationFrame(present);
}
window.addEventListener("message",e=>{
  if(e.data?.application!=="servicelife-jp")return;
  if(preparing && e.source===preparing.element.contentWindow){
    const next=preparing;
    if(e.data.type==="ready" && e.data.route===next.place.route){
      presentAtMenuPosition(next,e.data.menuTop);
    }else if(e.data.type==="fleet-request" && e.data.token===next.place.fleetToken && e.data.action==="select"){
      next.selection=e.data.key;
    }
    return;
  }
  if(e.source!==frame.contentWindow||!active)return;
  if(["menu-scroll","route"].includes(e.data.type) && Number.isFinite(e.data.menuTop))
    menuPositions.set(active.role,Math.max(0,e.data.menuTop));
  if(e.data.type==="route-hint")warmRoute(active.role,e.data.route);
  if(e.data.type==="route")change(active.role,e.data.route,e.data.vehicle);
  if(e.data.type==="fleet-request" && active.fleetToken && e.data.token===active.fleetToken){
    handleFleet(active,e.data);
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
  }catch(error){respond({error:error.message});}
}
function refreshFleet(){
  if(active?.fleetToken)handleFleet(active,{action:"refresh"});
}
if(fleetChannel)fleetChannel.onmessage=refreshFleet;
window.addEventListener("focus",refreshFleet);
setInterval(()=>{if(active?.fleet && active.fleet.day!==FleetStore.today())refreshFleet();},60000);
