/* ServiceLife public reference. Navigation remains in this browser tab. */
"use strict";
const base=new URL("./",document.baseURI);
const assetVersion=new URL(document.currentScript.src).search;
let frame=document.querySelector("#screen");
const emptyFrame=frame.cloneNode(false);
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
let catalog,active,account,seq=0;
let sidebarTop=null;
let pending=null;
const home = {company_admin:"/business-manager/",csr:"/csr-dashboard/",technician:"/my-day/"};
const sampleLogin = {company_admin:"demo_owner",csr:"demo_csr",technician:"demo_tech_kevin"};
const roleName = {company_admin:"会社管理者",csr:"受付担当",technician:"現場スタッフ"};
const grantPrefix = "servicelife-ja:staff-access:v1:";
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js","text"),read("tech-map.js","text")]);
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
function routeHash(role,route){return "#"+(role==="company_admin"?"":role)+route;}
function requested(){
  const match=location.hash.slice(1).match(/^(?:(company_admin|csr|technician))?(\/[A-Za-z0-9/_-]*\/)$/);
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
  url.hash=routeHash(role,route);
  if(url.href!==location.href) history.replaceState(null,"",url);
  return {role,route};
}
function change(role,route,fromSidebar,backToCustomers){
  if(!catalog.roles[role]||!catalog.files[role+"|"+route])return;
  const hash=routeHash(role,route);
  if(location.hash!==hash){
    const openingCustomer=active.route==="/customers/" && /^\/customers\/[\da-f-]{36}\/$/.test(route);
    const returningToList=backToCustomers && route==="/customers/";
    const query=(openingCustomer || returningToList) && history.state?.customerDirectoryQuery;
    location.hash=hash;
    if(query)history.replaceState({...history.state,customerDirectoryQuery:query},"");
  }
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
function render(record,programs,language,inside,tech,place){
  const mode=record.mode,raw=mode==="active"?record.raw:record.view;
  const doc=new DOMParser().parseFromString(raw.replaceAll("@@FILES@@",base.href),"text/html");
  const routes=Object.keys(catalog.files).filter(x=>x.startsWith(place.role+"|")).map(x=>x.split("|")[1]);
  const conf={route:place.route,role:place.role,mode,captured:record.captured,terms:language.terms,fixtures:record.fx,routes,sidebarTop};
  if(place.route==="/customers/")conf.directoryQuery=history.state?.customerDirectoryQuery || "";
  const person=catalog.accounts[account];
  const profile=doc.querySelector(".sidebar-user");
  if(profile){
    profile.querySelector(".name").textContent=person.name;
    profile.querySelector(".role").textContent=roleName[place.role];
    profile.querySelector(".avatar").textContent=person.name.split(/\s+/).map(n=>n[0]).slice(0,2).join("");
  }
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
async function openScreen(navigation=false){
  const turn=++seq;
  if(pending){pending.frame.remove();pending=null;}
  try{
    const [c,programs,language,inside,tech]=await common;
    if(turn!==seq)return;
    catalog=c;
    const place=requested();
    if(!place){
      active=null;frame.hidden=true;notice.hidden=false;
      notice.textContent="このデモアカウントは利用できません。";
      return;
    }
    if(active && place.role!==active.role){
      sidebarTop=null;
      frame.hidden=true;frame.removeAttribute("srcdoc");delete frame.dataset.route;active=null;
    }
    if(navigation && active?.role===place.role && active.route===place.route){
      notice.hidden=true;
      return;
    }
    const id=c.files[place.role+"|"+place.route];
    const group=await read("screens/"+id+".bin");
    if(turn!==seq)return;
    const record=await reservationData(place,group[place.route]);
    if(turn!==seq)return;
    const label=c.roles[place.role].find(i=>i.route===place.route)?.label||record.title;
    // Prepare the next document at its final viewport size while the current one stays visible.
    const nextFrame=emptyFrame.cloneNode(false);
    nextFrame.removeAttribute("id");
    nextFrame.inert=true;
    nextFrame.title=(language.terms[label]||language.terms[record.title]||record.title)+"｜ServiceLife 日本語";
    nextFrame.srcdoc=render(record,programs,language,inside,tech,place);
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
  if(location.hash!==routeHash(place.role,place.route))return;
  // Moving a connected iframe would reload it. Reveal it in place.
  frame.remove();
  frame=nextFrame;
  frame.id="screen";
  frame.inert=false;
  frame.dataset.route=place.route;
  frame.dataset.role=place.role;
  document.title=frame.title;
  active=place;
  pending=null;
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
    return;
  }
  if(e.source!==frame.contentWindow||!active)return;
  if(e.data.type==="customer-directory-page" && active.route==="/customers/" &&
     location.hash===routeHash(active.role,active.route) && typeof e.data.query==="string"){
    history.replaceState({...history.state,customerDirectoryQuery:e.data.query},"");
  }
  if(e.data.type==="sidebar-position" && e.data.route===active.route && e.data.role===active.role && Number.isFinite(e.data.top)){
    sidebarTop=Math.max(0,e.data.top);
  }
  if(e.data.type==="route")change(active.role,e.data.route,e.data.fromSidebar,e.data.backToCustomers);
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
