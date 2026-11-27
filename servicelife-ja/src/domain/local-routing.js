export function distanceKm(a,b){const rad=n=>n*Math.PI/180,lat=rad(b[0]-a[0]),lng=rad(b[1]-a[1]),h=Math.sin(lat/2)**2+Math.cos(rad(a[0]))*Math.cos(rad(b[0]))*Math.sin(lng/2)**2;return 6371*2*Math.atan2(Math.sqrt(h),Math.sqrt(Math.max(0,1-h)));}
export function routesForDate(data,source,date){
 if(date===data.date)return data.routes;
 return (source?.staff||[]).map((staff,i)=>{const old=data.routes.find(r=>r.id===staff.id),visits=(source.visits||[]).filter(v=>v.date===date&&v.staff===staff.id).sort((a,b)=>a.time.localeCompare(b.time));let km=0,minutes=0;
 const stops=visits.map((v,j)=>{const prev=visits[j-1],leg=prev&&v.point&&prev.point?distanceKm(prev.point,v.point):0,travelMinutes=Math.round(leg/30*60);km+=leg;minutes+=travelMinutes;return {...v,lat:v.point?.[0],lng:v.point?.[1],start:v.time,end:'—',status:'scheduled',travelMinutes,travelKm:leg}});
 return {id:staff.id,name:staff.name,initials:staff.name.split(' ').map(x=>x[0]).join(''),color:old?.color||'#1b5e20',count:stops.length,stops,km,minutes};}).filter(r=>r.count);
}
export function densityGroups(routes,miles){
 const visits=routes.flatMap(r=>r.stops.filter(s=>Number.isFinite(s.lat)&&Number.isFinite(s.lng)).map(s=>({...s,staff:r.name}))),remaining=new Set(visits.map((_,i)=>i)),groups=[];
 while(remaining.size){const pending=[remaining.values().next().value],indices=[];remaining.delete(pending[0]);while(pending.length){const i=pending.shift();indices.push(i);for(const j of remaining)if(distanceKm([visits[i].lat,visits[i].lng],[visits[j].lat,visits[j].lng])<=miles*1.609344){remaining.delete(j);pending.push(j)}}let sum=0,pairs=0;for(let i=0;i<indices.length;i++)for(let j=i+1;j<indices.length;j++){const a=visits[indices[i]],b=visits[indices[j]];sum+=distanceKm([a.lat,a.lng],[b.lat,b.lng])/1.609344;pairs++;}groups.push({size:indices.length,meanMiles:pairs?Number((sum/pairs).toFixed(3)):null,visits:indices.map(i=>{const s=visits[i];return {time:s.start,name:s.name,address:s.address,staff:s.staff,status:s.status==='confirmed'?'確認済み':'予約済み',recurrence:''}})});}
 return groups.sort((a,b)=>b.size-a.size);
}
