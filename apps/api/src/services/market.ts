export class MarketUnavailable extends Error {}
export type MarketQuote={state:string;district:string;market:string;commodity:string;variety:string;date:string;minPerQuintal:number;maxPerQuintal:number;modalPerQuintal:number;modalPerKg:number;ageDays:number;stale:boolean};
const cache=new Map<string,{until:number;data:{provider:string;fetchedAt:string;records:MarketQuote[];partial:boolean}}>();
export async function marketPrices(state:string,crop:string){
 if(!process.env.AGMARKNET_API_KEY)throw new MarketUnavailable('Mandi prices are not configured. Add AGMARKNET_API_KEY to apps/api/.env. No sample prices are shown.');
 const key=JSON.stringify([state.toLowerCase(),crop]),hit=cache.get(key);if(hit&&hit.until>Date.now())return hit.data;
 const params=new URLSearchParams({'api-key':process.env.AGMARKNET_API_KEY,format:'json',limit:'100','filters[state]':state,'filters[commodity]':crop});
 const resource=process.env.AGMARKNET_RESOURCE_ID||'9ef84268-d588-465a-a308-a864a43d0070';
 if(!/^[a-f0-9-]{36}$/i.test(resource))throw new MarketUnavailable('The mandi resource ID is invalid.');
 let raw:any;try{const response=await fetch(`https://api.data.gov.in/resource/${resource}?${params}`,{signal:AbortSignal.timeout(15000)});if(!response.ok)throw new Error();raw=await response.json();}catch{throw new MarketUnavailable('Mandi provider unavailable or the key was rejected. No substitute prices were generated.');}
 if(!Array.isArray(raw.records))throw new MarketUnavailable('Mandi provider did not return valid price records.');
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Kolkata',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const records:MarketQuote[]=[];
 for(const r of raw.records){if(String(r.state).toLowerCase()!==state.toLowerCase()||String(r.commodity).toLowerCase()!==crop.toLowerCase())continue;
  const parts=String(r.arrival_date).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);if(!parts)continue;const date=`${parts[3]}-${parts[2]}-${parts[1]}`,stamp=Date.parse(date);if(!Number.isFinite(stamp)||new Date(stamp).toISOString().slice(0,10)!==date||date>today)continue;
  const min=Number(r.min_price),max=Number(r.max_price),modal=Number(r.modal_price);if(![min,max,modal].every(Number.isFinite)||min<=0||min>modal||modal>max)continue;
  const ageDays=Math.floor((Date.parse(today)-stamp)/86400000);records.push({state:String(r.state),district:String(r.district),market:String(r.market),commodity:String(r.commodity),variety:String(r.variety||''),date,minPerQuintal:min,maxPerQuintal:max,modalPerQuintal:modal,modalPerKg:modal/100,ageDays,stale:ageDays>2});
 }
 records.sort((a,b)=>b.date.localeCompare(a.date));const data={provider:'AGMARKNET via data.gov.in',fetchedAt:new Date().toISOString(),records,partial:Number(raw.total)>raw.records.length};
 if(cache.size>100)cache.clear();cache.set(key,{until:Date.now()+15*60*1000,data});return data;
}
