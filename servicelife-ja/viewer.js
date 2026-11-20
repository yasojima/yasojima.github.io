/* ServiceLife public reference. Navigation remains in this browser tab. */
"use strict";
const base=new URL("./",document.baseURI);
const frame=document.querySelector("#screen");
const notice=document.querySelector("#notice");
const inFlight=new Map();
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
let catalog,active,seq=0;
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js","text"),read("tech-map.js","text")]);
function initialRoute(role){return catalog.roles[role][0].route;}
function requested(){
  const match=location.hash.slice(1).split("?")[0].match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
  const role=match?.[1]||"company_admin";
  const route=match?.[2]||initialRoute(role);
  if(catalog.files[role+"|"+route]){
    const vehicle=Number(new URLSearchParams(location.hash.split("?")[1]).get("vehicle"));
    return {role,route,vehicle:route==="/maintenance/" && Number.isSafeInteger(vehicle) && vehicle>0 ? vehicle : null};
  }
  const home=initialRoute(role);
  history.replaceState(null,"","#"+(role==="company_admin"?"":role)+home);
  return {role,route:home};
}
function change(role,route,vehicle){
  if(!catalog.roles[role]||!catalog.files[role+"|"+route])return;
  const hash=(role==="company_admin"?"":role)+route+(route==="/maintenance/" && Number.isSafeInteger(vehicle) && vehicle>0 ? "?vehicle="+vehicle : "");
  if(location.hash!=="#"+hash)location.hash=hash;else openScreen();
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
    fleet:place.fleet, fleetToken:place.fleetToken, vehicle:place.vehicle};
  const skip=new Set(programs.skip);
  if(mode==="snapshot"){
    const drawer=Object.entries(programs.scripts).find(([,code])=>code.includes("function cbpToggleSidebar") || (code.includes('t.closest("#cbpHamburger")') && code.includes("cbpToggleSidebar()")));
    if(drawer)inline(doc.body,drawer[1]);
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
async function openScreen(){
  const turn=++seq;
  try{
    const [c,programs,language,inside,tech]=await common;catalog=c;
    const place=requested();const id=c.files[place.role+"|"+place.route];
    const group=await read("screens/"+id+".bin");
    if(turn!==seq)return;
    const record=await reservationData(place,group[place.route]);
    if(c.files[place.role+"|/maintenance/"]){
      place.fleetToken=crypto.randomUUID();
      place.fleet=await fleetSnapshot(place);
    }
    if(turn!==seq)return;
    const label=c.roles[place.role].find(i=>i.route===place.route)?.label||record.title;
    document.title=(language.terms[label]||language.terms[record.title]||record.title)+"｜ServiceLife 日本語";
    active=place;
    notice.hidden=true;
    frame.title=document.title;
    frame.srcdoc=render(record,programs,language,inside,tech,place);
  }catch(e){console.error(e);notice.hidden=false;notice.textContent="画面を読み込めませんでした。再読み込みしてください。";}
}
window.addEventListener("message",e=>{
  if(e.source!==frame.contentWindow||e.data?.application!=="servicelife-jp"||!active)return;
  if(e.data.type==="route")change(active.role,e.data.route,e.data.vehicle);
  if(e.data.type==="fleet-request" && active.fleetToken && e.data.token===active.fleetToken){
    handleFleet(active,e.data);
  }
  if(e.data.type==="role"&&Object.hasOwn(catalog.roles,e.data.role)){
    const role=e.data.role;
    const home=role==="technician"?"/my-day/":role==="csr"?"/csr-dashboard/":"/business-manager/";
    change(role,catalog.files[role+"|"+home]?home:initialRoute(role));
  }
  if(e.data.type==="ready")frame.dataset.route=e.data.route;
});
window.addEventListener("hashchange",openScreen);
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
      const prefix=place.role==="company_admin"?"":place.role;
      history.replaceState(null,"","#"+prefix+place.route+(Number.isSafeInteger(vehicle)&&vehicle>0?"?vehicle="+vehicle:""));
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
