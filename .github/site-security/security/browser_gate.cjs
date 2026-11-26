/* Runs the actual staged scripts in Chromium. All unexpected requests abort. */
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const stage = path.resolve(process.argv[2]);
const inventory = JSON.parse(fs.readFileSync(path.join(__dirname,'pages-inventory.json'))).files;
const policy = JSON.parse(fs.readFileSync(path.join(__dirname,'reviewed-distribution.json')));
const marker = 'SUKIMAKUN_GATE_FAKE_20261127';
const checks = [], attempts = [], requests = [];
function check(name, ok, extra={}) { checks.push({name,ok,...extra}); if(!ok) throw Error(name); }
const types={'.js':'text/javascript','.html':'text/html','.css':'text/css','.svg':'image/svg+xml','.json':'application/json','.png':'image/png','.woff2':'font/woff2','.bin':'application/octet-stream'};
async function serve() {
 const server=http.createServer((req,res)=>{
  const u=new URL(req.url,'http://local.invalid'),key=decodeURIComponent(u.pathname).replace(/^\//,'')+(u.pathname.endsWith('/')?'index.html':'');
  if(req.method!=='GET'||!Object.hasOwn(inventory,key)){res.writeHead(404);return res.end();}
  res.writeHead(200,{'Content-Type':types[path.extname(key)]||'application/octet-stream','Access-Control-Allow-Origin':'*','Cache-Control':'no-store'});
  res.end(fs.readFileSync(path.join(stage,key)));
 });
 await new Promise(r=>server.listen(0,'127.0.0.1',r)); return server;
}
async function main(){
 const server=process.env.BASE?null:await serve();
 const base=process.env.BASE||`http://127.0.0.1:${server.address().port}/servicelife-ja/`;
 const browser=await chromium.launch({headless:true,args:['--disable-http2']});
 const failures=[];
 try {
  const context=await browser.newContext({viewport:{width:1540,height:974},serviceWorkers:'block'});
  await context.route('**/*',route=>{
   const r=route.request(),u=new URL(r.url()),b=new URL(base),rel=u.pathname.slice(b.pathname.length);
   const safe=u.origin===b.origin&&u.pathname.startsWith(b.pathname)&&(rel===''||Object.hasOwn(policy.files,rel))&&/^(?:|\?v=[a-f0-9]+)$/.test(u.search)&&['GET','HEAD'].includes(r.method())&&!JSON.stringify({url:r.url(),body:r.postData(),headers:r.headers()}).includes(marker);
   if(!safe){attempts.push({url:r.url(),method:r.method()});return route.abort();}
   requests.push({url:r.url(),method:r.method()}); return route.continue();
  });
  const page=await context.newPage();page.on('dialog',d=>d.dismiss());
  const frame=()=>page.frameLocator('#screen:not([hidden]):not([inert])');
  for(const route of ['/customers/','/reminders/','csr/csr-inbox/','technician/my-day/','/routes/','/csr-dashboard/']){
   await page.goto('about:blank');await page.goto(base+'#'+route);await frame().locator('main').first().waitFor();
   const results=await frame().locator('body').evaluate(async()=>{
    const checks=[];const pass=(name,ok)=>checks.push({name,ok});
    const ext='https://audit.example.invalid/SUKIMAKUN_GATE_FAKE_20261127';
    pass('beacon',navigator.sendBeacon(ext,'SUKIMAKUN_GATE_FAKE_20261127')===false);
    pass('location',typeof navigator.geolocation==='undefined');
    pass('service worker',typeof navigator.serviceWorker==='undefined');
    for(const name of ['XMLHttpRequest','WebSocket','EventSource','WebTransport','RTCPeerConnection','Worker','SharedWorker']){
     let blocked=false;try{new window[name](ext)}catch(e){blocked=e.name==='SecurityError'}pass(name,blocked);
    }
    for(const url of [ext,'//audit.example.invalid/SUKIMAKUN_GATE_FAKE_20261127','https://github.com/SUKIMAKUN_GATE_FAKE_20261127']){
     let denied=false;try{denied=(await fetch(url)).status===403}catch(e){denied=e.name==='SecurityError'}pass('fetch '+url,denied);
    }
    let denied=false;try{denied=(await fetch('/api/v1/customers/',{method:'POST',body:'SUKIMAKUN_GATE_FAKE_20261127'})).status===403}catch(e){denied=e.name==='SecurityError'}pass('save',denied);
    pass('popup',window.open(ext)===null);
    const form=document.createElement('form');form.action=ext;document.body.append(form);let stopped=false;try{form.submit()}catch(e){stopped=e.name==='SecurityError'}pass('form',stopped);form.remove();
    const meta=document.head.querySelector('meta[http-equiv="Content-Security-Policy"]');
    pass('frame CSP',!!meta&&(meta.content.includes("connect-src 'none'")||(!/connect-src\s/.test(meta.content)&&meta.content.includes("default-src 'none'")))&&meta.content.includes("form-action 'none'"));
    const guard=document.head.querySelector('script[src*="privacy-guard.js"]');
    pass('guard before application scripts',!!guard&&document.head.querySelector('script')===guard);
    return checks;
   });
   for(const result of results)check(route+' '+result.name,result.ok);
  }
  await page.goto('about:blank');await page.goto(base+'#/customers/');await frame().locator('#search').waitFor();
  await frame().locator('#search').fill(marker);await page.waitForTimeout(700);
  await frame().locator('#search').fill('');
  await frame().locator('body').evaluate(async()=>{
   const targets=['https://audit.example.invalid/SUKIMAKUN_GATE_FAKE_20261127',location.ancestorOrigins[0]+'/contact/SUKIMAKUN_GATE_FAKE_20261127'];
   window.__gateCsp=[];document.addEventListener('securitypolicyviolation',e=>window.__gateCsp.push(e.blockedURI));
   for(const url of targets){const img=new Image();await new Promise(resolve=>{img.onload=resolve;img.onerror=resolve;img.src=url;document.body.append(img)});img.remove();}
  });
  check('CSP rejects external and same-host other-project images',(await frame().locator('body').evaluate(()=>window.__gateCsp.length))>=2);
  await page.reload();await frame().locator('#search').waitFor();check('reload clears search',(await frame().locator('#search').inputValue())==='');
  check('no cookies',(await context.cookies()).length===0);
  check('no forbidden network requests',attempts.length===0);
  check('no writes',requests.every(r=>['GET','HEAD'].includes(r.method)));
  await context.close();
  // Prove browser tests also catch comment-only guard, independently of hashes.
  if(!process.env.BASE){
   const broken=await browser.newContext();let blockedAttempts=0;
   await broken.route('**/*',r=>{
    const u=new URL(r.request().url());
    if(u.pathname.endsWith('/privacy-guard.js'))return r.fulfill({contentType:'text/javascript',body:'/* XMLHttpRequest sendBeacon serviceWorker WebSocket */'});
    if(u.origin!==new URL(base).origin||!u.pathname.startsWith('/servicelife-ja/')||!['GET','HEAD'].includes(r.request().method())){blockedAttempts++;return r.abort();}
    return r.continue();
   });
   const p=await broken.newPage();await p.goto(base+'#/customers/');const f=p.frameLocator('#screen:not([hidden]):not([inert])');await f.locator('main').waitFor();
   const missing=await f.locator('body').evaluate(()=>typeof navigator.geolocation!=='undefined'||!Object.getOwnPropertyDescriptor(window,'XMLHttpRequest')||Object.getOwnPropertyDescriptor(window,'XMLHttpRequest').writable!==false);
   check('comment-only guard fails real browser contract',missing);await broken.close();
  }
 } catch(e){failures.push(e.stack);process.exitCode=1;}
 finally{await browser.close();if(server)await new Promise(r=>server.close(r));}
 const result={base,checks,attempts,requests:requests.length,failures};
 console.log(JSON.stringify(result,null,2));if(failures.length)process.exitCode=1;
}
main().catch(e=>{console.error(e);process.exitCode=1});
