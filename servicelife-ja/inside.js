function startServiceLifeReference(config){
  const sourceOrigin="https://reference.invalid";
  const normalize=s=>String(s||"").trim().replace(/\s+/g," ").replace(/[’‘]/g,"'").toLowerCase();
  const terms=new Map(Object.entries(config.terms||{}).map(([key,value])=>[normalize(key),value]));
  const word=value=>terms.get(normalize(value))||value;
  const send=(type,extra={})=>parent.postMessage({application:"servicelife-jp",type,...extra},"*");
  let current=new URL(config.route+(config.query||"")+(config.fragment||""),sourceOrigin);
  const locationView={get href(){return current.href},set href(value){navigate(value)},get pathname(){return current.pathname},get search(){return current.search},get hash(){return current.hash},set hash(value){const url=new URL(current);url.hash=value;historyView.pushState(null,"",url.href)},origin:sourceOrigin,host:"reference.invalid",hostname:"reference.invalid",protocol:"https:",assign:value=>navigate(value),replace:value=>navigate(value,true),reload:()=>navigate(current.href,true),toString:()=>current.href};
  const historyView={state:null,pushState:(state,title,path)=>saveHistory(state,path,false),replaceState:(state,title,path)=>saveHistory(state,path,true),back:()=>history.back(),forward:()=>history.forward(),go:n=>history.go(n)};
  function saveHistory(state,path,replace){current=new URL(path||current.href,current);historyView.state=state;send("history",{url:current.pathname+current.search+current.hash,state,replace});}
  function navigate(value,replace=false){
    const url=new URL(value,current);
    const role=url.pathname.match(/^\/demo\/view\/(company_admin|csr|technician)\/$/);
    if(role){parent.postMessage({application:"reference-role",role:role[1]},"*");return;}
    if(url.origin!==sourceOrigin)return;
    send("route",{url:url.pathname+url.search+url.hash,replace});
  }
  const originalOpen=window.open.bind(window);
  function openView(value,target,features){
    const url=new URL(value,current);
    if(url.origin!==sourceOrigin){const local=new URL(config.publicBase);return (url.protocol==="blob:"||(url.origin===local.origin&&url.pathname.startsWith(new URL("./",local).pathname)))?originalOpen(url.href,target,features):null;}
    if(url.pathname.startsWith('/api/')){
      fetch(url.href).then(async result=>{if(result.ok)send('file',{blob:await result.blob(),filename:url.pathname.split('/').filter(Boolean).slice(-2).join('-')+'.pdf'});});
      return null;
    }
    const app=new URL(config.publicBase);app.hash=(config.role==='company_admin'?'':config.role)+url.pathname+url.search+url.hash;
    return originalOpen(app.href,target||'_blank',features);
  }
  Object.defineProperty(window,"open",{value:openView,writable:false,configurable:false});
  window.SL_VIEW={route:config.route,word,translate:async values=>values.map(word),location:locationView,history:historyView,navigate};
  // Keep the original marker/route UI and its recorded coordinates. Only the
  // map renderer is local, so no upstream Google API key is reused.
  if(["/dashboard/","/routes/","/travel-routes/"].includes(config.route)){
    const point=value=>[Number(typeof value.lat==="function"?value.lat():value.lat),Number(typeof value.lng==="function"?value.lng():value.lng)];
    class Bounds{constructor(){this.points=[]}extend(value){this.points.push(point(value));return this}isEmpty(){return !this.points.length}}
    class MapView{
      constructor(element,options={}){
        this.element=element;this.layer=L.map(element,{scrollWheelZoom:!!options.scrollwheel,zoomControl:options.zoomControl!==false});
        installReferenceMap(this.layer);
        if(options.center)this.layer.setView(point(options.center),options.zoom||11);
        element.dataset.referenceMap="recorded-coordinates";
      }
      setCenter(value){this.layer.panTo(point(value))}panTo(value){this.setCenter(value)}setZoom(value){this.layer.setZoom(value)}getZoom(){return this.layer.getZoom()}
      fitBounds(bounds,options={}){if(bounds.points.length)this.layer.fitBounds(bounds.points,{padding:[Number(options.padding)||40,Number(options.padding)||40]})}
      addListener(name,fn){return events.addListener(this,name,fn)}setOptions(){}
    }
    class Marker{
      constructor(options={}){
        this.position=options.position;this.title=options.title||"";
        this.layer=L.marker(point(this.position),{title:this.title,zIndexOffset:Number(options.zIndex)||0,icon:L.divIcon({className:"sl-map-pin",html:options.content||"",iconSize:[36,36],iconAnchor:[18,18]})});
        this.map=options.map;
      }
      get map(){return this._map}set map(value){this.layer.remove();this._map=value;if(value)this.layer.addTo(value.layer)}
      setMap(value){this.map=value}addListener(name,fn){this.layer.on(name,fn);return {remove:()=>this.layer.off(name,fn)}}
    }
    class InfoWindow{
      constructor(options={}){this.content=options.content||""}
      open(map,marker){if(map?.anchor){marker=map.anchor;map=map.map}if(marker)marker.layer.bindPopup(this.content).openPopup()}
      close(){}
    }
    class Polyline{
      constructor(options={}){this.layer=L.polyline((options.path||[]).map(point),{color:options.strokeColor,opacity:options.strokeOpacity,weight:options.strokeWeight});this.setMap(options.map)}
      setMap(map){this.layer.remove();if(map)this.layer.addTo(map.layer)}
    }
    const events={
      addListener:(map,name,fn)=>{if(name==="idle"){const id=setTimeout(fn,0);return {remove:()=>clearTimeout(id)}}map.layer.on(name,fn);return {remove:()=>map.layer.off(name,fn)}},
      addListenerOnce:(map,name,fn)=>events.addListener(map,name,fn),removeListener:listener=>listener?.remove()
    };
    window.google={maps:{Map:MapView,LatLngBounds:Bounds,InfoWindow,Polyline,marker:{AdvancedMarkerElement:Marker},event:events,SymbolPath:{FORWARD_CLOSED_ARROW:"arrow"}}};
  }
  // Give the sandbox the source page's URL semantics while retaining local navigation.
  const memory=()=>{const values=new Map();return {get length(){return values.size},getItem:k=>values.get(String(k))??null,setItem:(k,v)=>values.set(String(k),String(v)),removeItem:k=>values.delete(String(k)),clear:()=>values.clear(),key:i=>[...values.keys()][i]??null}};
  for(const key of ["localStorage","sessionStorage"])try{Object.defineProperty(window,key,{value:memory(),configurable:true})}catch{}
  try{Object.defineProperty(document,"cookie",{get:()=>"",set:()=>{},configurable:true})}catch{}
  const RealDate=Date,savedStamp=RealDate.parse(config.captured),began=performance.now();
  const clock=()=>savedStamp+performance.now()-began;
  if(Number.isFinite(savedStamp))window.Date=new Proxy(RealDate,{construct:(ctor,args)=>Reflect.construct(ctor,args.length?args:[clock()]),apply:()=>new RealDate(clock()).toString(),get:(ctor,key)=>key==="now"?clock:Reflect.get(ctor,key)});
  const data=config.fixtures||{},parsed=Object.entries(data).map(([key,value])=>[new URL(key,sourceOrigin),value]);
  const recorded=Object.entries(config.responses||{}).map(([key,value])=>[new URL(key,sourceOrigin),value]);
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
  const collectionCache=new Map();
  function completeCollection(variants){
    if(!variants.length)return null;
    const path=variants[0][0].pathname;
    if(collectionCache.has(path))return collectionCache.get(path);
    // Only unfiltered list responses can establish that every real row is present.
    const pages=variants.filter(([url,page])=>[...url.searchParams.keys()].every(key=>["ordering","page","page_size","_","ts","t","cache_bust"].includes(key))&&Array.isArray(page?.results)&&Number.isInteger(page.count));
    const total=pages[0]?.[1].count;
    if(total===undefined||pages.some(([,page])=>page.count!==total))return null;
    const rows=new Map();
    for(const [,page]of pages)for(const row of page.results)if(row.id)rows.set(String(row.id),row);
    if(rows.size!==total)return null;
    const first=pages.find(([url])=>!url.searchParams.has("page")||url.searchParams.get("page")==="1")||pages[0];
    const result={rows:[...rows.values()],template:first[1],pageSize:Number(first[0].searchParams.get("page_size"))||first[1].results.length||25};
    collectionCache.set(path,result);return result;
  }
  function knownQuery(url,keys){return [...url.searchParams.keys()].every(key=>[...keys,"page","page_size","_","ts","t","cache_bust"].includes(key));}
  function sortRows(rows,ordering,numeric=[]){
    const direction=ordering.startsWith("-")?-1:1,field=ordering.replace(/^-/,"");
    return rows.sort((a,b)=>{
      const left=a[field],right=b[field];
      let comparison;
      if(left==null||right==null)comparison=left==null?(right==null?0:1):-1;
      else if(numeric.includes(field))comparison=Number(left)-Number(right);
      else comparison=String(left)<String(right)?-1:String(left)>String(right)?1:0;
      // Native date sorts can return equal timestamps across page boundaries.
      // Fix only that tie so all captured IDs remain reachable exactly once.
      return direction*comparison||String(a.id).localeCompare(String(b.id),"en");
    });
  }
  function billingPage(variants,url){
    const kind=url.pathname==="/api/v1/billing/payments/"?"payments":url.pathname==="/api/v1/billing/invoices/"?"invoices":null;
    if(!kind)return null;
    const keys=kind==="payments"?["ordering","status","method","appointment__technician","search"]:["ordering","status","customer","search"];
    if(!knownQuery(url,keys))return null;
    const collection=completeCollection(variants);if(!collection)return null;
    const query=url.searchParams,ordering=query.get("ordering")||"-created_at",field=ordering.replace(/^-/,"");
    const fields=kind==="payments"?["created_at"]:["invoice_number","created_at","due_date","subtotal","tax_amount","total","amount_paid","balance_due","status"];
    if(!fields.includes(field))return null;
    const status=query.get("status"),method=query.get("method"),customer=query.get("customer"),tech=query.get("appointment__technician"),search=normalize(query.get("search"));
    let appointments;
    if(tech){
      const visits=completeCollection(parsed.filter(([key])=>key.pathname==="/api/v1/scheduling/appointments/"));
      if(!visits)return null;
      appointments=new Map(visits.rows.map(row=>[row.id,row]));
    }
    const matches=collection.rows.filter(row=>{
      if(status&&row.status!==status||method&&row.method!==method||customer&&row.customer!==customer)return false;
      if(tech&&appointments.get(row.appointment)?.technician!==tech)return false;
      // The payment search placeholder names customer/payment ID. UUIDs are not
      // searchable in the original; the gateway ID is its separate payment ID.
      if(kind==="payments"&&search&&!([row.customer_name,row.gateway_payment_id].some(value=>normalize(value).includes(search))))return false;
      // The original invoice API currently ignores its native search parameter.
      // Keep that observed behavior rather than inventing a working search.
      return true;
    });
    sortRows(matches,ordering,["subtotal","tax_amount","total","amount_paid","balance_due"]);
    return {...collection.template,...paginate(matches,url,collection.pageSize)};
  }
  let calendarRows;
  function calendarPage(url){
    if(config.route!=="/calendar/"||url.pathname!=="/api/v1/scheduling/calendar/"||!knownQuery(url,["start","end","technician"]))return null;
    const start=url.searchParams.get("start"),end=url.searchParams.get("end"),tech=url.searchParams.get("technician");
    if(!/^\d{4}-\d{2}-\d{2}$/.test(start||"")||!/^\d{4}-\d{2}-\d{2}$/.test(end||""))return null;
    if(!calendarRows){
      const visits=completeCollection(parsed.filter(([key])=>key.pathname==="/api/v1/scheduling/appointments/"));
      if(!visits||visits.rows.some(row=>!["scheduled","confirmed","completed","cancelled","en_route"].includes(row.status)))return null;
      const toEvent=row=>({id:row.id,title:row.title||row.customer_name+" - "+row.job_type_name,
        start:row.start_datetime.slice(0,19),end:row.end_datetime.slice(0,19),
        color:row.status==="completed"?"#4CAF50":row.technician_color,status:row.status,
        customer_name:row.customer_name,technician_name:row.technician_name,technician_id:row.technician,
        location:row.location,job_type:row.job_type_name});
      const mapped=visits.rows.filter(row=>row.status!=="cancelled").map(toEvent),byId=new Map(mapped.map(event=>[event.id,event]));
      const recordedEvents=parsed.filter(([key,value])=>key.pathname==="/api/v1/scheduling/calendar/"&&Array.isArray(value)).flatMap(([,events])=>events);
      // Verify the same-snapshot serializer against every original event before
      // using the documented mapping to render a different visible date range.
      if(!recordedEvents.length||recordedEvents.some(event=>!byId.has(event.id)||Object.keys(event).some(key=>event[key]!==byId.get(event.id)[key])))return null;
      calendarRows=mapped;
    }
    // The original endpoint includes its end date and excludes cancelled rows.
    return calendarRows.filter(event=>event.start.slice(0,10)>=start&&event.start.slice(0,10)<=end&&(!tech||event.technician_id===tech)).sort((a,b)=>a.start.localeCompare(b.start)||a.id.localeCompare(b.id));
  }
  let resourceView;
  function resourceDay(url){
    if(config.route!=="/calendar/"||url.pathname!=="/api/v1/scheduling/resource-day/"||[...url.searchParams.keys()].some(key=>!["date","_","ts","t","cache_bust"].includes(key)))return null;
    const date=url.searchParams.get("date");if(!/^\d{4}-\d{2}-\d{2}$/.test(date||""))return null;
    if(!resourceView){
      const visits=completeCollection(parsed.filter(([key])=>key.pathname==="/api/v1/scheduling/appointments/"));if(!visits)return null;
      const days=parsed.filter(([key,value])=>key.pathname==="/api/v1/scheduling/resource-day/"&&Array.isArray(value?.technicians)).map(([,value])=>value);
      const schedules=parsed.find(([key])=>key.pathname==="/api/v1/work-schedules/")?.[1];
      if(!days.length||!schedules||schedules.results?.length!==schedules.count)return null;
      const customers=new Map(parsed.filter(([key,value])=>/^\/api\/v1\/customers\/[^/]+\/$/.test(key.pathname)&&value?.id&&typeof value.do_not_call==="boolean"&&typeof value.sms_opted_out==="boolean").map(([,value])=>[value.id,value]));
      const weekday=value=>(new RealDate(value+"T12:00:00Z").getUTCDay()+6)%7;
      const metadata=day=>day.technicians.map(({appointments,...tech})=>tech);
      const same=(a,b)=>a===b||a!=null&&b!=null&&typeof a==="object"&&typeof b==="object"&&Object.keys(a).length===Object.keys(b).length&&Object.keys(a).every(key=>same(a[key],b[key]));
      const templates=new Map();
      for(const day of days){
        const number=weekday(day.date),meta=metadata(day);
        if(templates.has(number)&&!same(templates.get(number),meta))return null;
        for(const tech of meta){
          const schedule=schedules.results.find(row=>row.user===tech.user_id&&row.is_active);
          const work=schedule?.days.find(row=>row.day_of_week===number);
          // This captured prototype has complete weekly settings and no exception
          // bands/breaks. Do not extrapolate cyclic schedules or date exceptions.
          if(schedule?.schedule_type!=="weekly"||!work||tech.is_working!==work.is_working_day||tech.work_start!==work.start_time?.slice(0,5)||tech.work_end!==work.end_time?.slice(0,5)||tech.breaks.length||tech.off_bands.length||work.breaks.length)return null;
        }
        templates.set(number,meta);
      }
      if(templates.size!==7||visits.rows.some(row=>!customers.has(row.customer)||row.special_instructions!==row.job_notes||row.rep_notes!==row.job_notes))return null;
      const colors={scheduled:"#9C27B0",confirmed:"#4CAF50",completed:"#607D8B",en_route:"#00BCD4"};
      if(visits.rows.some(row=>row.status!=="cancelled"&&!colors[row.status]))return null;
      const time12=value=>{const [h,m]=value.split(":");return (Number(h)%12||12)+":"+m+(Number(h)>=12?" PM":" AM")};
      const build=value=>({date:value,day_name:new Intl.DateTimeFormat("en-US",{weekday:"long",month:"long",day:"2-digit",year:"numeric",timeZone:"UTC"}).format(new RealDate(value+"T12:00:00Z")),
        technicians:templates.get(weekday(value)).map(tech=>({...tech,appointments:visits.rows.filter(row=>row.status!=="cancelled"&&row.technician===tech.tech_id&&row.start_datetime.slice(0,10)===value).sort((a,b)=>a.start_datetime.localeCompare(b.start_datetime)||a.id.localeCompare(b.id)).map(row=>{
          const customer=customers.get(row.customer),start=row.start_datetime.slice(11,16),end=row.end_datetime.slice(11,16);
          return {id:row.id,start,start_12:time12(start),end,end_12:time12(end),title:row.title,
            customer_id:row.customer,customer_name:row.customer_name,customer_phone:customer.phone,
            do_not_call:customer.do_not_call,sms_opted_out:customer.sms_opted_out,job_type:row.job_type_name,
            location:row.location,location_short:row.location.split(",")[0],status:row.status,color:colors[row.status],
            duration:row.duration_minutes,notes:row.job_notes,technician_name:row.technician_name,technician_id:row.technician};
        })}))});
      // Every captured day, including both Thursdays, must match every field.
      if(days.some(day=>!same(day,build(day.date))))return null;
      resourceView=build;
    }
    return resourceView(date);
  }
  function appointmentPage(variants, url) {
    if(!knownQuery(url,["ordering","job_type_any","status","technician","date","search"]))return null;
    const collection=completeCollection(variants);if(!collection)return null;
    const query=url.searchParams;
    const ordering=query.get("ordering")||"-start_datetime";
    if(!["start_datetime","-start_datetime","id","-id"].includes(ordering))return null;
    const jobs=new Set(query.getAll("job_type_any").flatMap(value=>value.split(",")).filter(Boolean));
    const status=query.get("status"), tech=query.get("technician"), day=query.get("date");
    const search=normalize(query.get("search"));
    const matching=collection.rows.filter(row=>{
      if(jobs.size && !jobs.has(row.job_type) && !(row.job_types || []).some(job=>jobs.has(job.id || job)))return false;
      if(status && row.status!==status || tech && row.technician!==tech)return false;
      if(day && (row.start_datetime || "").slice(0,10)!==day)return false;
      return !search || Object.values(row).some(value=>typeof value==="string" && normalize(value).includes(search));
    });
    sortRows(matching,ordering);
    return {...collection.template,...paginate(matching,url,collection.pageSize)};
  }
  function paginate(matching,url,defaultSize=25) {
    const query=url.searchParams;
    const size=Math.max(1,Number(query.get("page_size")) || defaultSize);
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

  function capturedCollection(variants,url){
    const stable=params=>[...params.entries()].filter(([key])=>!["page","page_size","_","ts","t","cache_bust"].includes(key)).sort().map(x=>x.join("=")).join("&");
    const matching=variants.filter(([key,value])=>stable(key.searchParams)===stable(url.searchParams)&&Array.isArray(value?.results)&&Number.isFinite(value.count));
    if(!matching.length)return null;
    const total=matching[0][1].count;
    if(matching.some(([,value])=>value.count!==total))return null;
    const rows=new Map();
    for(const [,value] of matching)for(const row of value.results)rows.set(String(row.id??row.uuid??JSON.stringify(row)),row);
    if(rows.size!==total)return null;
    const page=Math.max(1,Number(url.searchParams.get("page")||1)),size=Math.max(1,Number(url.searchParams.get("page_size")||matching[0][1].results.length||25));
    const values=[...rows.values()];
    const link=number=>{if(number<1||number>Math.ceil(total/size))return null;const next=new URL(url);next.searchParams.set("page",number);return next.pathname+next.search};
    return {...matching[0][1],count:total,results:values.slice((page-1)*size,page*size),next:link(page+1),previous:link(page-1)};
  }
  let querySupport;
  window.fetch=async(input,options={})=>{
    const method=String(options.method||input?.method||"GET").toUpperCase();
    if(!["GET","HEAD"].includes(method))return response({detail:"This action is disabled in the read-only demo.",error:"This action is disabled in the read-only demo."},403);
    let url;try{url=new URL(typeof input==="string"?input:input.url||String(input),current)}catch{return response({detail:"Not found."},404)}
    if(url.origin!==sourceOrigin)return response({detail:"External connections are disabled."},403);
    const variants=parsed.filter(([key])=>key.pathname===url.pathname);
    const exactResponse=recorded.find(([key])=>key.pathname===url.pathname&&queryKey(key.searchParams)===queryKey(url.searchParams));
    // The three captured full lists use one stable set across every page/filter;
    // replaying overlapping upstream pages first would make real rows disappear.
    if(variants.length&&(!exactResponse||exactResponse[1].status<400)){
      const list=url.pathname==="/api/v1/scheduling/appointments/"&&config.route==="/appointments/"?appointmentPage(variants,url):billingPage(variants,url);
      if(list)return response(list);
    }
    if(exactResponse){
      const value=exactResponse[1],status=value.status||200;
      const body=[204,205,304].includes(status)||method==="HEAD"?null:(value.bodyBase64?Uint8Array.from(atob(value.bodyBase64),char=>char.charCodeAt(0)):(typeof value.body==="string"?value.body.replaceAll("@@FILES@@",new URL("./",config.publicBase).href):JSON.stringify(value.body??null)));
      return new Response(body,{status,headers:{"Content-Type":value.contentType||value.content_type||"application/json; charset=utf-8"}});
    }
    const exact=variants.find(([key])=>queryKey(key.searchParams)===queryKey(url.searchParams));
    if(exact)return response(exact[1]);
    const events=calendarPage(url);if(events)return response(events);
    const day=resourceDay(url);if(day)return response(day);
    if(config.route==="/customers/"&&url.pathname==="/api/v1/customers/"&&variants.length)return response(customerPage(variants,url));
    const page=capturedCollection(variants,url);if(page)return response(page);
    if(url.pathname==='/api/v1/customers/'&&variants.length&&knownQuery(url,['search','customer_type','ordering']))return response(customerPage(variants,url));
    if(['/api/v1/chat-rooms/channels/dm-candidates/'].includes(url.pathname)&&knownQuery(url,['q'])){
      const sets=variants.filter(([key])=>!key.searchParams.get('q'));
      if(sets.length)return response(searchIn(sets[0][1],url.searchParams));
    }
    if(url.pathname==='/api/v1/chat-rooms/messages/'&&knownQuery(url,['channel','before','after'])){
      const original=variants.find(([key])=>key.searchParams.get('channel')===url.searchParams.get('channel')&&!key.searchParams.has('after')&&!key.searchParams.has('before'));
      if(original){const value=original[1],after=url.searchParams.get('after'),before=url.searchParams.get('before');return response({...value,results:(value.results||[]).filter(row=>(!after||row.created_at>after)&&(!before||row.created_at<before))});}
    }
    if(window.createReferenceQueries){querySupport ||= createReferenceQueries(config);const result=await querySupport(url);if(result)return result;}
    // Missing captures remain visible as failures instead of fabricated records or modal contents.
    console.warn("Uncaptured ServiceLife GET",url.pathname+url.search);
    send("missing-get",{url:url.pathname+url.search});
    return response({detail:"This response was not captured from the public demo."},404);
  };
  Object.defineProperty(window,"fetch",{value:window.fetch,writable:false,configurable:false});
  addEventListener("click",event=>{
    const link=event.target.closest?.("a[href]");if(!link)return;
    const href=link.getAttribute("href");if(!href)return;
    if(href.startsWith("#")){event.preventDefault();return;}
    if(href.startsWith("javascript:"))return;
    let url;try{url=new URL(href,current)}catch{return;}
    if(url.origin!==sourceOrigin){event.preventDefault();event.stopImmediatePropagation();return;}
    if(url.origin===sourceOrigin&&url.pathname.startsWith("/api/")){
      event.preventDefault();event.stopImmediatePropagation();
      fetch(url.href).then(async result=>{
        if(!result.ok){alert(word('Unable to load document')+' ('+result.status+')');return;}
        const blob=await result.blob();
        const extension=blob.type.includes('pdf')?'pdf':blob.type.includes('spreadsheet')?'xlsx':blob.type.includes('csv')?'csv':'html';
        const label=blob.type.includes('pdf')&&url.pathname.includes('/contracts/contracts/')?'契約書.pdf':blob.type.includes('pdf')&&url.pathname==='/api/v1/billing/reports/revenue/'?'売上レポート.pdf':url.pathname.split('/').filter(Boolean).slice(-2).join('-')+'.'+extension;
        send('file',{blob,filename:link.download||label,download:link.hasAttribute('download')||['csv','xlsx'].includes(extension)});
      }).catch(error=>console.error(error));
      return;
    }
    if(url.origin===sourceOrigin&&!url.pathname.startsWith("/api/")&&!url.pathname.startsWith("/static/")){
      event.preventDefault();event.stopImmediatePropagation();navigate(url.href);
    }
  },true);
  addEventListener("submit",event=>{event.preventDefault()},true);
  document.addEventListener("DOMContentLoaded",()=>{
    document.documentElement.dataset.referenceMode="active";
    for(const element of document.querySelectorAll('[id^="slt-"],#aiFabRoot,#panel-ai-assistant'))element.remove();
    setTimeout(()=>{
      if(config.route==="/routes/")window.initMap?.();
      if(config.route==="/travel-routes/")window.initRouteMap?.();
      if(config.route==="/dashboard/")window.initGPSMap?.();
    },0);
    send("ready",{route:config.route});
  },{once:true});
}
