/* ServiceLife public reference. Navigation remains in this browser tab. */
"use strict";
const base=new URL("./",document.baseURI);
const assetVersion=new URL(document.currentScript.src).search;
const frame=document.querySelector("#screen");
const notice=document.querySelector("#notice");
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
let catalog,active,seq=0;
const tourKey="servicelife-ja:sl_demo_tour_v1";
let tourSeen=false;
try{tourSeen=localStorage.getItem(tourKey)==="1";}catch{}
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js","text"),read("tech-map.js","text")]);
function initialRoute(role){return catalog.roles[role][0].route;}
function requested(){
  const match=location.hash.slice(1).match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
  const role=match?.[1]||"company_admin";
  const route=match?.[2]||initialRoute(role);
  return {role,route:catalog.files[role+"|"+route]?route:initialRoute(role)};
}
function change(role,route){
  if(!catalog.roles[role]||!catalog.files[role+"|"+route])return;
  const hash=(role==="company_admin"?"":role)+route;
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
  const conf={route:place.route,role:place.role,mode,captured:record.captured,terms:language.terms,fixtures:record.fx,routes,tourSeen};
  const skip=new Set(programs.skip);
  if(mode==="snapshot"){
    const drawer=Object.entries(programs.scripts).find(([,code])=>code.includes("function cbpToggleSidebar") || (code.includes('t.closest("#cbpHamburger")') && code.includes("cbpToggleSidebar()")));
    if(drawer)inline(doc.body,drawer[1]);
    const tour=Object.values(programs.scripts).find(code=>code.includes("sl_demo_tour_v1") && code.includes("slt-skip"));
    doc.getElementById("slt-root")?.classList.remove("on");
    if(tour)inline(doc.body,tour);
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
  if(e.data.type==="tour-seen"){
    tourSeen=true;
    try{localStorage.setItem(tourKey,"1");}catch{}
  }
  if(e.data.type==="route")change(active.role,e.data.route);
  if(e.data.type==="role"&&Object.hasOwn(catalog.roles,e.data.role)){
    const role=e.data.role;
    const home=role==="technician"?"/my-day/":role==="csr"?"/csr-dashboard/":"/business-manager/";
    change(role,catalog.files[role+"|"+home]?home:initialRoute(role));
  }
  if(e.data.type==="ready")frame.dataset.route=e.data.route;
});
window.addEventListener("hashchange",openScreen);
openScreen();
