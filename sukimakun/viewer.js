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
const common=Promise.all([read("catalog.json","json"),read("programs.bin"),read("language.bin"),read("inside.js","text"),read("tech-map.js","text"),read("brand.svg","text")]);
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
function findRoute(role,url){return catalog.files[role+"|"+url.pathname+url.search]?url.pathname+url.search:catalog.files[role+"|"+url.pathname]?url.pathname:null;}
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
  previewUrl=URL.createObjectURL(message.blob);
  const links=dialog.querySelectorAll('a');
  dialog.querySelector('strong').textContent=message.filename;
  for(const link of links)link.href=previewUrl;
  links[1].download=message.filename;
  const preview=dialog.querySelector('iframe'),pages=dialog.querySelector('.pdf-pages');
  pages.replaceChildren();pages.hidden=true;preview.hidden=true;
  if(message.blob.type.includes('pdf')){
    const digest=[...new Uint8Array(await crypto.subtle.digest('SHA-256',await message.blob.arrayBuffer()))].map(byte=>byte.toString(16).padStart(2,'0')).join('');
    const images=(await read('pdf-previews.json','json'))[digest];
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
function restoreSidebar(doc,brand,place){
  for(const header of doc.querySelectorAll(".sidebar-brand"))header.innerHTML=brand;
  for(const footer of doc.querySelectorAll(".sidebar-user")){
    const name=footer.querySelector(".name")?.textContent.trim()||catalog.accounts?.[new URL(location.href).searchParams.get("account")]?.name||"";
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
    const [c,programs,language,inside,tech,brand]=await common;catalog=c;
    const place=parseHash(),groupId=c.files[place.role+"|"+place.captureRoute];
    if(!groupId)throw Error("原本の取得ページがありません："+place.route);
    const [group,roleApi]=await Promise.all([read("screens/"+groupId+".bin"),read("api/"+place.role+".bin")]);
    const source=group[place.captureRoute];
    const record=await reservationData(place,{...source,fx:{...roleApi.fx,...source.fx},responses:{...roleApi.responses,...source.responses}});
    if(turn!==sequence)return;
    const next=frame.cloneNode(false);next.hidden=true;next.srcdoc=render(record,programs,language,inside,tech,place,brand);
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
