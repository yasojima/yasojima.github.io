/* Replay the public ServiceLife HTML and its own UI programs. */
"use strict";
const base=new URL("./",document.baseURI);
const assetVersion=new URL(document.currentScript.src).search;
let frame=document.querySelector("#screen"),catalog,active,sequence=0;
const notice=document.querySelector("#notice");
const referenceStatus=document.querySelector("#reference-status");
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

const home={company_admin:"/business-manager/",csr:"/csr-dashboard/",technician:"/my-day/"};
const samples={company_admin:"demo_owner",csr:"demo_csr",technician:"demo_tech_kevin"};
const safeJson=value=>JSON.stringify(value).replace(/</g,"\\u003c").replace(/\u2028/g,"\\u2028").replace(/\u2029/g,"\\u2029");
const scriptText=s=>s.replace(/<\/script/gi,"<\\/script");
const catalogRequest = read("catalog.json", "json");
const contractDocumentsRoute = "/contracts/documents/";
const workspaceFiles = {
  "/routes/": "route-workspace",
  "/csr-dashboard/": "service-workspace",
  [contractDocumentsRoute]: "contract-workspace"
};
function parseHash(){
  const hash=location.hash.slice(1),match=hash.match(/^(?:(company_admin|csr|technician))?(\/[^#]*)/);
  const url=new URL(location.href),person=catalog.accounts?.[url.searchParams.get("account")];
  const role=match?.[1] || person?.role || "company_admin";
  const target=new URL(match?.[2]||home[role],"https://demo.servicelife.app");
  const captureRoute=findRoute(role,target);
  if(!captureRoute)return {role,route:home[role],captureRoute:home[role],query:"",fragment:""};
  const fragmentIndex=hash.indexOf("#");
  return {role,route:target.pathname,captureRoute,query:target.search,fragment:fragmentIndex<0?"":hash.slice(fragmentIndex)};
}
function findRoute(role,url){
  if (role === "csr" && url.pathname === contractDocumentsRoute) return contractDocumentsRoute;
  return catalog.files[role+"|"+url.pathname+url.search]?url.pathname+url.search:catalog.files[role+"|"+url.pathname]?url.pathname:null;
}
function targetHash(role,url){return "#"+(role==="company_admin"?"":role)+url.pathname+url.search+url.hash;}
function navigate(role,path,{replace=false,reload=false}={}){
  let url;try{url=new URL(path,"https://demo.servicelife.app"+(active?.route||home[role]));}catch{return;}
  if(!findRoute(role,url)){showNotice("この原本ページはまだ取得されていません："+url.pathname);return;}
  const hash=targetHash(role,url);
  if(replace){history.replaceState(null,"",hash);openScreen();}
  else if(location.hash!==hash)location.hash=hash;
  else if(reload)openScreen();
}
function showNotice(text){
  notice.textContent=text;
  if(active){const close=document.createElement('button');close.type='button';close.textContent='元の画面へ戻る';close.onclick=()=>notice.hidden=true;notice.append(close);}
  notice.hidden=false;
}
let previewUrl;
async function previewFile(message){
  if(!(message.blob instanceof Blob))return;
  const dialog=document.getElementById('office-pdf');
  if(previewUrl)URL.revokeObjectURL(previewUrl);
  const nextUrl=URL.createObjectURL(message.blob);
  previewUrl=nextUrl;
  const links=dialog.querySelectorAll('a');
  dialog.querySelector('strong').textContent=message.filename;
  for(const link of links)link.href=previewUrl;
  links[1].download=message.filename;
  const preview=dialog.querySelector('iframe'),pages=dialog.querySelector('.pdf-pages');
  pages.replaceChildren();pages.hidden=true;preview.hidden=true;
  if(message.blob.type.includes('pdf')){
    let images=message.pageImages;
    if (!Array.isArray(images) || !images.length || !images.every(image =>
      typeof image === "string" && /^data:image\/png;base64,[a-z0-9+/=]+$/i.test(image)
    )) {
      const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await message.blob.arrayBuffer()))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
      images=(await read('pdf-previews.json','json'))[digest];
    }
    if (previewUrl !== nextUrl) return;
    if(images?.length){
      for(const [index,file]of images.entries()){const img=document.createElement('img');img.src=new URL(file,base);img.alt='PDF '+(index+1)+'ページ';pages.append(img);}
      pages.hidden=false;
    }else{preview.src=previewUrl;preview.hidden=false;}
  }else{preview.src=previewUrl;preview.hidden=false;}
  dialog.querySelector('button').onclick=()=>dialog.close();
  if(!dialog.open)dialog.showModal();
  if(message.download)links[1].click();
}
async function reservationData(place,record){
  if(!["/calendar/","/appointments/"].includes(place.route))return record;
  const fixtures={},responses={};
  for(const route of ["/calendar/","/appointments/","/customers/"]){
    const groupId=catalog.files[place.role+"|"+route];if(!groupId||route===place.route)continue;
    const group=await read("screens/"+groupId+".bin"),other=group[route];
    for(const [url,data] of Object.entries(other.fx||{}))if(/\/(?:customers|scheduling\/(?:calendar|resource-day|appointments))\/(?:\?|$)/.test(url))fixtures[url]=data;
    Object.assign(responses,other.responses||{});
  }
  return {...record,fx:{...fixtures,...record.fx},responses:{...responses,...record.responses}};
}
function inline(parent,code,first=false){const node=parent.ownerDocument.createElement("script");node.textContent=scriptText(code);if(first)parent.prepend(node);else parent.append(node);}

const escapeHtml = value => String(value ?? "").replace(/[&<>"']/g, character => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[character]);

function workspaceUrl(role, route) {
  const url = new URL(location.href);
  url.hash = (role === "company_admin" ? "" : role) + route;
  return url.href;
}

function renderWorkspace(place, record, language, brand) {
  const workspace = workspaceFiles[place.route];
  const routeView = place.route === "/routes/";
  const documentsView = place.route === contractDocumentsRoute;
  const title = documentsView ? "契約PDF・署名情報" : routeView ? "当日の訪問ルート" : "顧客対応ダッシュボード";
  const roleLabels = { company_admin: "会社管理者", csr: "顧客対応", technician: "担当スタッフ" };
  const current = new URL(location.href);
  const selectedAccount = catalog.accounts?.[current.searchParams.get("account")];
  const account = selectedAccount?.role === place.role ? selectedAccount : catalog.accounts?.[samples[place.role]];
  const viewerAsset = name => escapeHtml(new URL(name + assetVersion, base).href);
  const localGroups = new Map();
  const menuItems = catalog.roles[place.role].flatMap(item => {
    if (place.role === "csr" && item.route === "/contracts/") {
      return [item, { ...item, route: contractDocumentsRoute, label: "契約PDF・署名情報" }];
    }
    return [item];
  });
  for (const item of menuItems) {
    if (!localGroups.has(item.group)) localGroups.set(item.group, []);
    localGroups.get(item.group).push(item);
  }
  const links = Object.fromEntries([
    ...menuItems.map(item => item.route),
    ...catalog.extra[place.role],
  ].map(route => [route, workspaceUrl(place.role, route)]));
  const menus = [...localGroups].map(([group, items], index) => {
    const isOpen = index === 0 || items.some(item => item.route === place.route);
    const rows = items.map(item => {
      const label = language.terms[item.label] || item.label;
      const selection = item.route === place.route ? ' aria-current="page"' : "";
      return '<a href="' + escapeHtml(links[item.route]) + '"' + selection + ">" + escapeHtml(label) + "</a>";
    }).join("");
    return "<details" + (isOpen ? " open" : "") + "><summary>" + escapeHtml(language.terms[group] || group) + "</summary>" + rows + "</details>";
  }).join("");
  const roles = Object.entries(roleLabels).map(([key, label]) =>
    '<option value="' + key + '"' + (key === place.role ? " selected" : "") + ">" + label + "</option>"
  ).join("");
  const data = documentsView ? record : Object.fromEntries(Object.entries(record.fx).filter(([key]) =>
    /^\/api\/v1\/(scheduling|routing|customers|technicians|communications|tickets|job-types|users|work-schedules)(?:\/|\?|$)/.test(key)
  ));
  const config = { ...place, base: base.href, version: assetVersion, links, data, terms: language.terms };
  const vendor = base.href + "lib/";
  const csp = "default-src 'none'; script-src 'unsafe-inline' " + vendor + " " + base.href + workspace + ".js " +
    base.href + "workspace-shell.js; style-src 'unsafe-inline' " + vendor + " " + base.href + workspace + ".css " +
    base.href + "workspace-shell.css; img-src data: " + base.href + " https://tile.openstreetmap.org; font-src " +
    vendor + "; base-uri 'none'; form-action 'none'; frame-src 'none'";
  const maps = routeView
    ? '<link rel="stylesheet" href="' + viewerAsset("lib/leaflet/leaflet.css") + '"><script src="' + viewerAsset("lib/leaflet/leaflet.js") + '"></script>'
    : "";
  const font = '<style>@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url("' +
    vendor + 'webfonts/inter-latin.woff2") format("woff2")}</style>';

  return '<!doctype html><html lang="ja"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<meta http-equiv="Content-Security-Policy" content="' + escapeHtml(csp) + '"><title>' + title + '｜SUKIMAKUN</title>' +
    font + '<link rel="stylesheet" href="' + viewerAsset("lib/css/fontawesome.min.css") + '">' +
    '<link rel="stylesheet" href="' + viewerAsset("lib/css/solid.min.css") + '">' + maps +
    '<link rel="stylesheet" href="' + viewerAsset("workspace-shell.css") + '"><link rel="stylesheet" href="' + viewerAsset(workspace + ".css") + '">' +
    '</head><body><div class="sk-shell"><aside class="sk-shell-nav" id="sk-navigation">' +
    '<div class="sk-shell-brand">' + brand + '</div><nav class="sk-shell-menu" aria-label="管理メニュー">' + menus + '</nav>' +
    '<div class="sk-shell-account"><span class="sk-shell-account-name">' + escapeHtml(account?.name) + '</span>' +
    '<button class="sk-shell-signout" type="button" aria-label="ログアウト" title="ログアウト"><i class="fas fa-sign-out-alt" aria-hidden="true"></i></button></div>' +
    '</aside><button class="sk-shell-shade" type="button" aria-label="メニューを閉じる"></button>' +
    '<div class="sk-shell-stage"><header class="sk-shell-top"><button class="sk-shell-menu-button" type="button" aria-expanded="false" aria-controls="sk-navigation" aria-label="メニュー">' +
    '<i class="fas fa-bars" aria-hidden="true"></i>メニュー</button><span class="sk-shell-top-text">確認用デモ</span>' +
    '<label class="sk-shell-role"><span>表示する役割</span><select aria-label="表示する役割">' + roles + '</select></label></header>' +
    '<main class="sk-shell-main" data-sukimakun-workspace="' + workspace + '"></main></div></div>' +
    '<script src="' + viewerAsset(workspace + ".js") + '"></script>' +
    '<script src="' + viewerAsset("workspace-shell.js") + '"></script>' +
    "<script>startSukimakunWorkspace(" + safeJson(config) + ");</script></body></html>";
}

function restoreSidebar(doc,brand,place){
  for(const header of doc.querySelectorAll(".sidebar-brand"))header.innerHTML=brand;
  const selectedAccount=catalog.accounts?.[new URL(location.href).searchParams.get("account")];
  const account=selectedAccount?.role===place.role?selectedAccount:catalog.accounts?.[samples[place.role]];
  for(const footer of doc.querySelectorAll(".sidebar-user")){
    const name=account?.name||footer.querySelector(".name")?.textContent.trim()||"";
    const label=doc.createElement("span");label.className="sukimakun-login-name";label.textContent=name;
    const logout=doc.createElement("button");logout.type="button";logout.className="sukimakun-logout";logout.title="ログアウト";logout.setAttribute("aria-label","ログアウト");
    logout.innerHTML='<i class="fas fa-sign-out-alt" aria-hidden="true"></i>';
    logout.setAttribute("onclick","alert('確認用デモのため、実際のログアウトは行いません。')");
    footer.replaceChildren(label,logout);
  }
  const style=doc.createElement("style");style.id="sukimakun-sidebar";
  style.textContent='.sidebar-brand{height:105px!important;min-height:105px!important;padding:0!important;display:flex;align-items:center;justify-content:center;flex-shrink:0}.sidebar-brand svg{display:block;width:174.2px;height:19.5px;flex:none}.sidebar-user{height:93px!important;min-height:93px!important;box-sizing:border-box;padding:0 20px!important;gap:16px!important;display:flex;align-items:center;justify-content:space-between;flex-shrink:0}.sukimakun-login-name{font-size:17px;line-height:24px;font-weight:600;color:#fff;white-space:nowrap;min-width:0;overflow:hidden;text-overflow:ellipsis}.sukimakun-logout{width:44px;height:44px;flex:0 0 44px;display:flex;align-items:center;justify-content:center;background:transparent;border:0;border-radius:6px;color:#fff;font-size:22px;cursor:pointer}.sukimakun-logout:hover,.sukimakun-logout:focus-visible{background:rgba(255,255,255,.12)}';
  style.textContent+='@media(max-width:768px){body.demo-mode .sidebar{top:var(--sukimakun-demo-height,101px)!important}}';
  doc.head.append(style);
  inline(doc.body,"(()=>{const bar=document.getElementById('demoBar');if(!bar)return;const measure=()=>document.documentElement.style.setProperty('--sukimakun-demo-height',bar.getBoundingClientRect().height+'px');measure();if(window.ResizeObserver)new ResizeObserver(measure).observe(bar);addEventListener('resize',measure)})();");
}
function render(record,programs,language,inside,tech,place,brand){
  const doc=new DOMParser().parseFromString(record.raw.replaceAll("@@FILES@@",base.href),"text/html");
  const resources=base.href+"lib/",routes=Object.keys(catalog.files).filter(k=>k.startsWith(place.role+"|")).map(k=>k.split("|")[1]);
  for(const style of doc.querySelectorAll("style[data-sl-style]")){style.textContent=programs.styles[style.dataset.slStyle]||"";style.removeAttribute("data-sl-style");}
  const skip=new Set(programs.skip);
  for(const node of doc.querySelectorAll("script[data-sl-script]")){
    let code=programs.scripts[node.dataset.slScript];if(!code||skip.has(node.dataset.slScript)){node.remove();continue;}
    if(place.route==="/technicians/"&&code.includes("function renderCards()")&&code.includes("function focusTech("))code=code.slice(0,code.indexOf("function focusTech("))+"\n"+tech;
    node.textContent=scriptText(code);node.removeAttribute("data-sl-script");
  }
  const font=doc.createElement("style");font.textContent='@font-face{font-family:Inter;font-style:normal;font-weight:100 900;font-display:swap;src:url("'+resources+'webfonts/inter-latin.woff2") format("woff2")}';doc.head.append(font);
  const solid=doc.createElement("link");solid.rel="stylesheet";solid.href=resources+"css/solid.min.css";doc.head.append(solid);
  restoreSidebar(doc,brand,place);
  if (place.role === "csr" && place.route === "/contracts/") {
    const link = doc.createElement("a");
    link.href = contractDocumentsRoute;
    link.id = "sk-contract-documents-link";
    link.textContent = "契約PDF・署名情報を確認";
    link.style.cssText = "display:inline-flex;margin:16px 20px 0;padding:9px 13px;border:1px solid #adcabc;border-radius:8px;color:#174c3c;background:#edf6f0;font-weight:700;text-decoration:none";
    doc.querySelector("main")?.prepend(link);
  }
  if(["/technicians/","/dashboard/","/routes/","/travel-routes/"].includes(place.route)){
    const leaflet=doc.createElement("link");leaflet.rel="stylesheet";leaflet.href=resources+"leaflet/leaflet.css";doc.head.append(leaflet);
    const script=doc.createElement("script");script.src=resources+"leaflet/leaflet.js";doc.head.prepend(script);
  }
  const conf={...place,mode:"active",captured:record.captured,terms:language.terms,fixtures:record.fx,responses:record.responses||{},routes};
  inline(doc.head,"("+inside+")("+safeJson(conf)+");",true);
  inline(doc.head,"(function(terms){"+language.charts+"})("+safeJson(language.terms)+");");
  inline(doc.body,"(function(terms){"+language.localizer+"})("+safeJson(language.terms)+");");
  const meta=doc.createElement("meta");meta.httpEquiv="Content-Security-Policy";
  meta.content="default-src 'none'; script-src 'unsafe-inline' 'unsafe-eval' "+resources+" "+base.href+"assets/; style-src 'unsafe-inline' "+resources+" "+base.href+"assets/; img-src data: blob: "+base.href+" https://tile.openstreetmap.org; font-src data: "+resources+"; connect-src 'none'; object-src 'none'; form-action 'none'; frame-src 'none'; base-uri 'none'";
  doc.head.prepend(meta);doc.documentElement.lang="ja";
  return "<!doctype html>\n"+doc.documentElement.outerHTML;
}
async function openScreen(){
  const turn=++sequence;
  try{
    catalog = await catalogRequest;
    const place=parseHash(),groupId=catalog.files[place.role+"|"+place.captureRoute];
    const documentsView = place.role === "csr" && place.route === contractDocumentsRoute;
    if(!groupId && !documentsView)throw Error("原本の取得ページがありません："+place.route);
    const [language,brand]=await Promise.all([read("language.bin"), read("brand.svg", "text")]);
    let markup;
    if (documentsView) {
      markup = renderWorkspace(place, await read("contract-documents.bin"), language, brand);
    } else {
      const [group,roleApi]=await Promise.all([read("screens/"+groupId+".bin"), read("api/"+place.role+".bin")]);
      const source=group[place.captureRoute];
      const record = { ...source, fx: { ...roleApi.fx, ...source.fx }, responses: { ...roleApi.responses, ...source.responses } };
      if (workspaceFiles[place.route]) markup = renderWorkspace(place, record, language, brand);
      else {
        const [programs, inside, tech, enriched] = await Promise.all([
          read("programs.bin"), read("inside.js", "text"), read("tech-map.js", "text"), reservationData(place, record),
        ]);
        markup = render(enriched, programs, language, inside, tech, place, brand);
      }
    }
    if(turn!==sequence)return;
    const next=frame.cloneNode(false);next.hidden=true;next.srcdoc=markup;
    const old=frame;frame=next;active=place;old.after(next);old.remove();notice.hidden=true;referenceStatus.hidden=true;
    next.addEventListener("load",()=>{if(frame===next)next.hidden=false;},{once:true});
  }catch(error){if(turn===sequence)showNotice("表示できませんでした："+error.message);}
}
addEventListener("message",event=>{
  if(event.source!==frame.contentWindow||!active)return;
  const message=event.data;
  if(message?.application==="reference-role"){
    const role=message.role;if(!home[role])return;
    const url=new URL(location.href);url.searchParams.set("account",samples[role]);url.hash=targetHash(role,new URL(home[role],"https://demo.servicelife.app"));location.assign(url.href);return;
  }
  if(message?.application!=="servicelife-jp")return;
  if (message.type === "workspace-role" && workspaceFiles[active.route]) {
    const role = message.role;
    if (!Object.hasOwn(home, role)) return;
    const currentPath = active.route === contractDocumentsRoute && role !== "csr" ? "/contracts/" : active.route;
    const route = findRoute(role, new URL(currentPath, "https://demo.servicelife.app")) ? currentPath : home[role];
    const url = new URL(workspaceUrl(role, route));
    url.searchParams.set("account", samples[role]);
    location.assign(url.href);
    return;
  }
  if(message.type==="missing-get"){
    referenceStatus.querySelector('span').textContent='この条件のデータは、確認用ページに含まれていません。';
    referenceStatus.hidden=false;return;
  }
  if(message.type==="file"){previewFile(message);return;}
  if(message.type==="route")navigate(active.role,message.url,{replace:!!message.replace,reload:true});
  if(message.type==="history"){
    const url=new URL(message.url,"https://demo.servicelife.app");
    if(url.pathname!==active.route)return;
    const hash=targetHash(active.role,url);history[message.replace?"replaceState":"pushState"](message.state||null,"",hash);
    active.query=url.search;active.fragment=url.hash;
  }
});
addEventListener("hashchange",openScreen);
referenceStatus.querySelector('button').onclick=()=>referenceStatus.hidden=true;
openScreen();
