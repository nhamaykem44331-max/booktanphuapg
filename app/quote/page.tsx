"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { QuotePayload, FlightResult } from '@/lib/types';
import { fmtVND, hhmm, durationText } from '@/lib/utils';
import { AIRPORT_NAME_MAP } from '@/lib/airports';
import { getAirlineMeta } from '@/lib/airlines';

function longDate(d?: string) {
  if (!d) return '';
  const dt = new Date(d + (d.length===10?'T12:00:00':''));
  const days=['CN','T2','T3','T4','T5','T6','T7'];
  return `${days[dt.getDay()]} ${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
}
function cabinLabel(c:string){return{economy:'Phổ thông',premium:'PT Đặc biệt',business:'Thương gia',first:'Hạng nhất'}[c]??c;}
function airlineColor(code:string){const m:Record<string,string>={VN:'#004b8d',VJ:'#e3001b',QH:'#00873c',BL:'#0050a0',VU:'#f5a623','9G':'#ff6600',CZ:'#2563eb',MU:'#7c3aed',CA:'#dc2626',ZH:'#0ea5e9','3U':'#ef4444'};return m[code]??'#c8a96b';}
function parseHmToMinutes(hm?:string){if(!hm||!/^\d{1,2}:\d{2}$/.test(hm))return null;const[h,m]=hm.split(':').map(Number);return h*60+m;}
function formatMinutesShort(mins:number){const h=Math.floor(mins/60);const m=mins%60;return `${h}h${m?` ${String(m).padStart(2,'0')}m`:''}`;}
function airportLabel(iata:string){const meta=AIRPORT_NAME_MAP[iata]||{city:iata,airportName:iata};return `${meta.city} (${iata})`;}

type ParsedSegment={from:string;to:string;flightNumber:string;departHm:string;arriveHm:string;departDate:string;arriveDate:string;durationMinutes:number;};
function parseJourneySegments(detailUrl?:string|null):ParsedSegment[]{
  if(!detailUrl)return[];
  try{
    const url=new URL(detailUrl);
    const raw=url.searchParams.get('segoutbound')||url.searchParams.get('seginbound')||'';
    if(!raw)return[];
    return raw.split('|').map(seg=>{
      const p=seg.split('-');
      if(p.length<16)return null;
      const durRaw=(p[15]||'').replace(/^dur/i,'');
      const dur=/^\d{4}$/.test(durRaw)?(Number(durRaw.slice(0,2))*60+Number(durRaw.slice(2))):0;
      return {from:p[0],to:p[1],flightNumber:p[3],departHm:p[4],arriveHm:p[5],departDate:p[10],arriveDate:p[12],durationMinutes:dur};
    }).filter(Boolean) as ParsedSegment[];
  }catch{return[];}
}
function dateFromAbayText(s?:string){
  if(!s||!/^\d{1,2}[A-Za-z]{3}\d{4}$/.test(s))return null;
  const months:Record<string,number>={Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11};
  const day=Number(s.slice(0,s.length-7)); const mon=s.slice(s.length-7,s.length-4); const year=Number(s.slice(-4));
  if(!(mon in months))return null;
  return new Date(year,months[mon],day,12,0,0,0);
}
function longDateFromAbayText(s?:string){
  const d=dateFromAbayText(s); if(!d)return '';
  const days=['CN','T2','T3','T4','T5','T6','T7'];
  return `${days[d.getDay()]} ${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`;
}
function buildLayovers(detailUrl?:string|null){
  const segments=parseJourneySegments(detailUrl);
  if(segments.length<2)return[];
  const out=[] as {airport:string;durationText:string;fromSegment:ParsedSegment;toSegment:ParsedSegment}[];
  for(let i=0;i<segments.length-1;i++){
    const cur=segments[i], next=segments[i+1];
    const arr=parseHmToMinutes(cur.arriveHm), dep=parseHmToMinutes(next.departHm);
    if(arr==null||dep==null)continue;
    let diff=dep-arr;
    const curDate=dateFromAbayText(cur.arriveDate); const nextDate=dateFromAbayText(next.departDate);
    if(curDate&&nextDate){ diff += Math.round((nextDate.getTime()-curDate.getTime())/60000); }
    else if(diff<0){ diff += 24*60; }
    out.push({airport:next.from,durationText:formatMinutesShort(diff),fromSegment:cur,toSegment:next});
  }
  return out;
}

function AirlineLogo({code,airline,size=28}:{code?:string;airline?:string;size?:number}){
  const meta=getAirlineMeta(code,airline);
  const bg=airlineColor(code||'');
  if(meta.logo)return<img src={meta.logo} alt={code||''} width={size} height={size} className="rounded-lg border border-slate-100 bg-white object-contain p-0.5 shrink-0" referrerPolicy="no-referrer" onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>;
  return<div style={{width:size,height:size,backgroundColor:bg}} className="flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white">{code?.slice(0,2)||'✈'}</div>;
}

// ── Compact Flight Segment ───────────────────────────────────
function FlightSegment({label,flight,date,color}:{label:string;flight:FlightResult;date?:string;color:string}){
  const layovers=buildLayovers(flight.detailUrl);
  return(
    <div className="overflow-hidden rounded-lg" style={{border:'1px solid #e8dcc8'}}>
      <div className="flex items-center justify-between px-2.5 py-1.5" style={{backgroundColor:color}}>
        <span className="text-[10px] font-bold uppercase tracking-wide text-white/90">{label}</span>
        <span className="rounded-full border border-white/25 bg-white/20 px-2.5 py-1 text-[11px] font-extrabold tracking-wide text-white shadow-sm">{longDate(date)}</span>
      </div>
      <div className="px-3 py-3 flex items-center gap-2.5">
        <AirlineLogo code={flight.airlineCode} airline={flight.airline} size={28}/>
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1.5">
            <span className="text-lg font-black text-[#1a1a1a]">{hhmm(flight.departure.time)}</span>
            <span className="text-xs text-[#c8a96b]">→</span>
            <span className="text-lg font-black text-[#1a1a1a]">{hhmm(flight.arrival.time)}</span>
            <span className="ml-1 text-xs text-slate-400">{durationText(flight.duration)}</span>
          </div>
          <div className="text-[13px] text-slate-500">{flight.airline} · {flight.flightNumber} · {flight.stops===0?'Bay thẳng':`${flight.stops} dừng`}</div>
          <div className="text-[13px] text-slate-600">{flight.departure.airport}→{flight.arrival.airport}</div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-base font-black text-[#1a1a1a]">{fmtVND(flight.fareBreakdown?.totalAmount??flight.price.amount)}</div>
          <div className="text-[11px] text-slate-400">/người</div>
        </div>
      </div>
      {layovers.length>0&&(
        <div className="border-t border-[#f0ebe0] bg-[#fcfaf6] px-3 py-2.5">
          <div className="space-y-2">
            {layovers.map((stop,idx)=>(
              <div key={`${stop.airport}-${idx}`} className="rounded-lg border border-[#eee2cf] bg-white px-3 py-2.5">
                <div className="flex items-start justify-between gap-3 text-[12px]">
                  <div className="font-semibold text-[#1a1a1a]">{airportLabel(stop.fromSegment.from)} ➜ {airportLabel(stop.fromSegment.to)}</div>
                  <div className="text-right text-[11px] text-slate-500">{longDateFromAbayText(stop.fromSegment.departDate)}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <AirlineLogo code={flight.airlineCode} airline={flight.airline} size={22}/>
                  <div className="min-w-0 flex-1 text-[12px] text-slate-700">{stop.fromSegment.flightNumber}</div>
                  <div className="text-[12px] text-slate-600">{formatMinutesShort(stop.fromSegment.durationMinutes)}</div>
                  <div className="text-[13px] font-bold text-[#1a1a1a]">{stop.fromSegment.departHm} - {stop.fromSegment.arriveHm}</div>
                </div>
                <div className="my-2 flex items-center gap-2 pl-2">
                  <div className="flex h-4 w-4 items-center justify-center rounded-full border-2 border-[#f97316] bg-white"><div className="h-1.5 w-1.5 rounded-full bg-[#f97316]" /></div>
                  <div className="h-8 w-px bg-[#f1d9b5]" />
                  <div className="text-[13px] font-semibold text-[#ea580c]">Nối chuyến: {stop.durationText}</div>
                </div>
                <div className="flex items-start justify-between gap-3 text-[12px]">
                  <div className="font-semibold text-[#1a1a1a]">{airportLabel(stop.toSegment.from)} ➜ {airportLabel(stop.toSegment.to)}</div>
                  <div className="text-right text-[11px] text-slate-500">{longDateFromAbayText(stop.toSegment.departDate)}</div>
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <AirlineLogo code={flight.airlineCode} airline={flight.airline} size={22}/>
                  <div className="min-w-0 flex-1 text-[12px] text-slate-700">{stop.toSegment.flightNumber}</div>
                  <div className="text-[12px] text-slate-600">{formatMinutesShort(stop.toSegment.durationMinutes)}</div>
                  <div className="text-[13px] font-bold text-[#1a1a1a]">{stop.toSegment.departHm} - {stop.toSegment.arriveHm}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Ticket Modal ─────────────────────────────────────────────
const UNLOCK_PASSWORD='8888';
interface EditableTicket{outPrice:number;inPrice:number;taxPct:number;phone:string;website:string;email:string;note:string;}

function TicketModal({data,onClose}:{data:QuotePayload;onClose:()=>void}){
  const[locked,setLocked]=useState(true);
  const[pwInput,setPwInput]=useState('');
  const[pwError,setPwError]=useState('');
  const[exporting,setExporting]=useState<'pdf'|'jpg'|null>(null);
  const printRef=useRef<HTMLDivElement>(null);
  const isRT=data.tripType==='roundtrip'&&!!data.inbound;
  const outAmt=data.outbound.fareBreakdown?.totalAmount??data.outbound.price.amount;
  const inAmt=data.inbound?.fareBreakdown?.totalAmount??data.inbound?.price.amount??0;
  const[ed,setEd]=useState<EditableTicket>({outPrice:outAmt,inPrice:inAmt,taxPct:12,phone:'0918.752.686',website:'tanphuapg.com',email:'tkt.tanphu@gmail.com',note:'Giá tham khảo. Liên hệ TAN PHU APG để xác nhận.'});
  const farePerPax=ed.outPrice+ed.inPrice;
  const totalAdults=farePerPax*data.adults;
  const tax=Math.round(totalAdults*ed.taxPct/100);
  const grandTotal=Math.round(totalAdults+tax);

  async function captureCanvas(){
    if(!printRef.current)return null;
    const h2c=(await import('html2canvas')).default;
    return h2c(printRef.current,{scale:2,useCORS:true,backgroundColor:'#f5f0e8',logging:false});
  }
  async function handlePDF(){
    setExporting('pdf');
    try{const c=await captureCanvas();if(!c)return;const{jsPDF}=await import('jspdf');const w=210,h=(c.height*w)/c.width;const pdf=new jsPDF({orientation:h>w?'portrait':'landscape',unit:'mm',format:[w,h]});pdf.addImage(c.toDataURL('image/jpeg',0.95),'JPEG',0,0,w,h);pdf.save(`BaoGia-TanPhuAPG.pdf`);}
    catch(e){console.error(e);}finally{setExporting(null);}
  }
  async function handleJPEG(){
    setExporting('jpg');
    try{const c=await captureCanvas();if(!c)return;const a=document.createElement('a');a.download='BaoGia-TanPhuAPG.jpg';a.href=c.toDataURL('image/jpeg',0.95);a.click();}
    catch(e){console.error(e);}finally{setExporting(null);}
  }

  return(
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" onClick={e=>{if(e.target===e.currentTarget)onClose();}}>
      <div className="w-full max-w-lg rounded-t-2xl bg-white shadow-2xl max-h-[92vh] flex flex-col">
        {/* Modal header */}
        <div className="flex items-center justify-between border-b border-[#e8dcc8] px-4 py-3 shrink-0">
          <div>
            <div className="text-sm font-bold">Mặt vé báo giá</div>
            <div className="text-[10px] text-slate-400">Xem trước · Chỉnh sửa · Tải về</div>
          </div>
          <div className="flex items-center gap-2">
            {locked?(
              <div className="flex items-center gap-1.5">
                <input type="password" value={pwInput} onChange={e=>setPwInput(e.target.value)} onKeyDown={e=>e.key==='Enter'&&(pwInput===UNLOCK_PASSWORD?(setLocked(false),setPwError('')):(setPwError('Sai'),setPwInput('')))}
                  placeholder="Mật khẩu" className="w-24 rounded-lg border border-[#e8dcc8] px-2 py-1 text-xs"/>
                <button onClick={()=>pwInput===UNLOCK_PASSWORD?(setLocked(false),setPwError('')):(setPwError('Sai'),setPwInput(''))}
                  className="rounded-lg px-2 py-1 text-xs font-semibold text-white" style={{backgroundColor:'#c8a96b'}}>🔓</button>
                {pwError&&<span className="text-[10px] text-red-500">{pwError}</span>}
              </div>
            ):(
              <div className="flex items-center gap-1.5">
                <span className="rounded-lg bg-green-100 px-2 py-1 text-[10px] font-semibold text-green-700">✓ Đã mở</span>
                <button onClick={()=>setLocked(true)} className="text-[10px] text-slate-400">🔒</button>
              </div>
            )}
            <button onClick={onClose} className="flex h-7 w-7 items-center justify-center rounded-lg border border-[#e8dcc8] text-slate-400 text-xs">✕</button>
          </div>
        </div>

        {/* Edit fields */}
        {!locked&&(
          <div className="border-b border-[#e8dcc8] bg-amber-50 px-4 py-2 shrink-0">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div><label className="text-[10px] text-slate-500">Giá đi (VND)</label><input type="number" value={ed.outPrice} onChange={e=>setEd(p=>({...p,outPrice:Number(e.target.value)}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>
              {isRT&&<div><label className="text-[10px] text-slate-500">Giá về (VND)</label><input type="number" value={ed.inPrice} onChange={e=>setEd(p=>({...p,inPrice:Number(e.target.value)}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>}
              <div><label className="text-[10px] text-slate-500">Thuế %</label><input type="number" value={ed.taxPct} onChange={e=>setEd(p=>({...p,taxPct:Number(e.target.value)}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>
              <div><label className="text-[10px] text-slate-500">Hotline</label><input value={ed.phone} onChange={e=>setEd(p=>({...p,phone:e.target.value}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>
              <div><label className="text-[10px] text-slate-500">Website</label><input value={ed.website} onChange={e=>setEd(p=>({...p,website:e.target.value}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>
              <div><label className="text-[10px] text-slate-500">Email</label><input value={ed.email} onChange={e=>setEd(p=>({...p,email:e.target.value}))} className="w-full rounded border border-[#c8a96b] px-2 py-1 text-xs"/></div>
            </div>
          </div>
        )}

        {/* Preview */}
        <div className="flex-1 overflow-auto bg-[#f5f0e8] p-3">
          <div ref={printRef}>
            <div style={{fontFamily:"'Be Vietnam Pro',sans-serif",backgroundColor:'#f5f0e8',padding:'16px',maxWidth:'500px',margin:'0 auto'}}>
              {/* Header */}
              <div style={{background:'linear-gradient(135deg,#c8a96b,#e8d4a0)',borderRadius:'10px',padding:'12px 16px',marginBottom:'12px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                    <div style={{width:'40px',height:'40px',borderRadius:'10px',background:'rgba(255,255,255,0.25)',display:'flex',alignItems:'center',justifyContent:'center'}}>
                      <img src="/assets/tanphu-apg-logo.jpg" alt="Logo" style={{width:'34px',height:'34px',borderRadius:'7px',objectFit:'contain'}}/>
                    </div>
                    <div>
                      <div style={{color:'white',fontWeight:900,fontSize:'14px',letterSpacing:'0.05em'}}>TAN PHU APG</div>
                      <div style={{color:'rgba(255,255,255,0.8)',fontSize:'10px'}}>APG Flight Agent</div>
                    </div>
                  </div>
                  <div style={{textAlign:'right'}}>
                    <div style={{color:'rgba(255,255,255,0.7)',fontSize:'9px'}}>Mã báo giá</div>
                    <div style={{color:'white',fontWeight:800,fontSize:'11px',fontFamily:'monospace'}}>APG-{new Date(data.createdAt).getTime().toString(36).toUpperCase().slice(-6)}</div>
                  </div>
                </div>
                <div style={{marginTop:'8px',borderTop:'1px solid rgba(255,255,255,0.25)',paddingTop:'6px',display:'flex',justifyContent:'space-between',fontSize:'10px',color:'rgba(255,255,255,0.85)'}}>
                  <span>{isRT?'↔ Khứ hồi':'→ Một chiều'} · {cabinLabel(data.cabin)}</span>
                  <span>{data.adults} NL{data.children?` · ${data.children} TE`:''} · {data.outbound.departure.city}→{data.outbound.arrival.city}</span>
                </div>
              </div>

              {/* Flights */}
              {[
                {label:isRT?'✈ CHIỀU ĐI':'✈ CHUYẾN BAY',flight:data.outbound,date:data.search.date,price:ed.outPrice},
                ...(isRT&&data.inbound?[{label:'✈ CHIỀU VỀ',flight:data.inbound,date:data.search.returnDate,price:ed.inPrice}]:[]),
              ].map(({label,flight,date:d,price})=>{
                const col=airlineColor(flight.airlineCode);
                const meta=getAirlineMeta(flight.airlineCode,flight.airline);
                const layovers=buildLayovers(flight.detailUrl);
                return(
                  <div key={label} style={{background:'white',borderRadius:'8px',border:'1px solid #e8dcc8',marginBottom:'10px',overflow:'hidden'}}>
                    <div style={{background:col,padding:'6px 12px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{color:'white',fontWeight:700,fontSize:'10px',letterSpacing:'0.06em'}}>{label}</span>
                      <span style={{color:'#fff',fontSize:'11px',fontWeight:900,letterSpacing:'0.04em',padding:'4px 10px',borderRadius:'999px',background:'rgba(255,255,255,0.18)',border:'1px solid rgba(255,255,255,0.24)',boxShadow:'0 2px 6px rgba(0,0,0,0.08)'}}>{longDate(d)}</span>
                    </div>
                    <div style={{padding:'12px 14px',display:'flex',alignItems:'center',gap:'12px'}}>
                      {meta.logo&&<img src={meta.logo} alt={flight.airline} style={{width:'28px',height:'28px',borderRadius:'6px',objectFit:'contain',border:'1px solid #eee',background:'white',padding:'2px'}}/>}
                      <div style={{flex:1}}>
                        <div style={{display:'flex',alignItems:'baseline',gap:'6px'}}>
                          <span style={{fontSize:'22px',fontWeight:900,color:'#1a1a1a'}}>{hhmm(flight.departure.time)}</span>
                          <span style={{color:'#c8a96b',fontSize:'13px'}}>→</span>
                          <span style={{fontSize:'22px',fontWeight:900,color:'#1a1a1a'}}>{hhmm(flight.arrival.time)}</span>
                          <span style={{fontSize:'12px',color:'#aaa'}}>{durationText(flight.duration)}</span>
                        </div>
                        <div style={{fontSize:'13px',color:'#777'}}>{flight.airline} · {flight.flightNumber} · {flight.stops===0?'Bay thẳng':`${flight.stops} dừng`}</div>
                        <div style={{fontSize:'13px',color:'#888'}}>{flight.departure.airport} → {flight.arrival.airport}</div>
                      </div>
                      <div style={{textAlign:'right'}}>
                        <div style={{fontSize:'18px',fontWeight:900,color:'#1a1a1a'}}>{Number(price).toLocaleString('vi-VN')}đ</div>
                        <div style={{fontSize:'11px',color:'#bbb'}}>/người</div>
                      </div>
                    </div>
                    {layovers.length>0&&(
                      <div style={{borderTop:'1px solid #f0ebe0',background:'#fcfaf6',padding:'10px 14px'}}>
                        {layovers.map((stop,idx)=>(
                          <div key={`${stop.airport}-${idx}`} style={{background:'white',border:'1px solid #eee2cf',borderRadius:'8px',padding:'10px 12px',marginBottom:idx<layovers.length-1?'8px':'0'}}>
                            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',fontSize:'13px'}}>
                              <div style={{fontWeight:700,color:'#1a1a1a'}}>{airportLabel(stop.fromSegment.from)} ➜ {airportLabel(stop.fromSegment.to)}</div>
                              <div style={{fontSize:'11px',color:'#777'}}>{longDateFromAbayText(stop.fromSegment.departDate)}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px'}}>
                              {meta.logo&&<img src={meta.logo} alt={flight.airline} style={{width:'22px',height:'22px',borderRadius:'5px',objectFit:'contain',border:'1px solid #eee',background:'white',padding:'2px'}}/>}
                              <div style={{flex:1,fontSize:'12px',color:'#555'}}>{stop.fromSegment.flightNumber}</div>
                              <div style={{fontSize:'12px',color:'#666'}}>{formatMinutesShort(stop.fromSegment.durationMinutes)}</div>
                              <div style={{fontSize:'13px',fontWeight:800,color:'#1a1a1a'}}>{stop.fromSegment.departHm} - {stop.fromSegment.arriveHm}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',margin:'10px 0 8px 2px'}}>
                              <div style={{width:'14px',height:'14px',borderRadius:'999px',border:'2px solid #f97316',display:'flex',alignItems:'center',justifyContent:'center',background:'#fff'}}><div style={{width:'6px',height:'6px',borderRadius:'999px',background:'#f97316'}}/></div>
                              <div style={{width:'1px',height:'28px',background:'#f1d9b5'}}/>
                              <div style={{fontSize:'13px',fontWeight:700,color:'#ea580c'}}>Nối chuyến: {stop.durationText}</div>
                            </div>
                            <div style={{display:'flex',justifyContent:'space-between',gap:'12px',fontSize:'13px'}}>
                              <div style={{fontWeight:700,color:'#1a1a1a'}}>{airportLabel(stop.toSegment.from)} ➜ {airportLabel(stop.toSegment.to)}</div>
                              <div style={{fontSize:'11px',color:'#777'}}>{longDateFromAbayText(stop.toSegment.departDate)}</div>
                            </div>
                            <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'8px'}}>
                              {meta.logo&&<img src={meta.logo} alt={flight.airline} style={{width:'22px',height:'22px',borderRadius:'5px',objectFit:'contain',border:'1px solid #eee',background:'white',padding:'2px'}}/>}
                              <div style={{flex:1,fontSize:'12px',color:'#555'}}>{stop.toSegment.flightNumber}</div>
                              <div style={{fontSize:'12px',color:'#666'}}>{formatMinutesShort(stop.toSegment.durationMinutes)}</div>
                              <div style={{fontSize:'13px',fontWeight:800,color:'#1a1a1a'}}>{stop.toSegment.departHm} - {stop.toSegment.arriveHm}</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}

              {/* Price */}
              <div style={{background:'white',borderRadius:'8px',border:'1px solid #e8dcc8',marginBottom:'10px',overflow:'hidden'}}>
                <div style={{background:'#faf7f2',borderBottom:'1px solid #e8dcc8',padding:'6px 12px'}}>
                  <span style={{fontSize:'10px',fontWeight:700,color:'#7a6a52',textTransform:'uppercase',letterSpacing:'0.06em'}}>Chi tiết giá vé</span>
                </div>
                <div style={{padding:'10px 12px'}}>
                  {[
                    [`NL × ${data.adults}`,Math.round(farePerPax*data.adults)],
                    [`Thuế ~${ed.taxPct}%`,tax],
                  ].map(([l,v])=>(
                    <div key={String(l)} style={{display:'flex',justifyContent:'space-between',fontSize:'11px',color:'#555',marginBottom:'5px'}}>
                      <span>{l}</span><span style={{fontWeight:600,color:'#333'}}>{Number(v).toLocaleString('vi-VN')}đ</span>
                    </div>
                  ))}
                  <div style={{borderTop:'1px solid #e8dcc8',marginTop:'6px',paddingTop:'8px',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <div><div style={{fontSize:'11px',fontWeight:700,color:'#4a3b28'}}>Tổng giá vé</div><div style={{fontSize:'9px',color:'#aaa'}}>* Tham khảo</div></div>
                    <div style={{textAlign:'right'}}>
                      <div style={{fontSize:'18px',fontWeight:900,color:'#1a1a1a'}}>{Number(grandTotal).toLocaleString('vi-VN')}đ</div>
                      <div style={{fontSize:'9px',color:'#bbb'}}>≈${Math.round(grandTotal/25000)} USD</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Contact compact */}
              <div style={{background:'white',borderRadius:'8px',border:'1px solid #e8dcc8',padding:'10px 12px',marginBottom:'8px',display:'flex',justifyContent:'space-around',textAlign:'center'}}>
                {[{icon:'📞',val:ed.phone,sub:'Hotline'},{icon:'🌐',val:ed.website,sub:'Web'},{icon:'📧',val:ed.email.split('@')[0],sub:'Email'}].map(({icon,val,sub})=>(
                  <div key={sub}><div style={{fontSize:'14px'}}>{icon}</div><div style={{fontSize:'10px',fontWeight:600,color:'#333'}}>{val}</div><div style={{fontSize:'9px',color:'#aaa'}}>{sub}</div></div>
                ))}
              </div>
              <div style={{fontSize:'9px',color:'#aaa',textAlign:'center'}}>* {ed.note}</div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 border-t border-[#e8dcc8] px-4 py-3 shrink-0">
          <button onClick={handleJPEG} disabled={!!exporting}
            className="flex-1 rounded-lg border border-[#c8a96b] py-2 text-xs font-semibold text-[#c8a96b] disabled:opacity-60">
            {exporting==='jpg'?'Đang xuất…':'🖼 Tải JPEG'}
          </button>
          <button onClick={handlePDF} disabled={!!exporting}
            className="flex-1 rounded-lg py-2 text-xs font-bold text-white disabled:opacity-60" style={{backgroundColor:'#c8a96b'}}>
            {exporting==='pdf'?'Đang xuất…':'📄 Tải PDF'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Quote Page ───────────────────────────────────────────────
export default function QuotePage(){
  const router=useRouter();
  const[data,setData]=useState<QuotePayload|null>(null);
  const[showTicket,setShowTicket]=useState(false);
  useEffect(()=>{const raw=localStorage.getItem('apg_quote_selection');if(!raw)return;try{setData(JSON.parse(raw));}catch{/**/ }},[]);

  const calc=useMemo(()=>{
    if(!data)return null;
    const outAmt=data.outbound.fareBreakdown?.totalAmount??data.outbound.price.amount;
    const inAmt=data.inbound?.fareBreakdown?.totalAmount??data.inbound?.price.amount??0;
    const farePerPax=outAmt+inAmt;
    const totalAdults=farePerPax*data.adults;
    const taxAdults=(data.outbound.fareBreakdown?.taxesFees??0)*data.adults+(data.inbound?.fareBreakdown?.taxesFees??0)*data.adults;
    const baseAdults=(data.outbound.fareBreakdown?.baseAmount??outAmt)*data.adults+(data.inbound?.fareBreakdown?.baseAmount??inAmt)*data.adults;
    return{farePerPax,baseAdults,taxAdults,total:Math.round(totalAdults)};
  },[data]);

  if(!data||!calc)return(
    <main className="flex min-h-screen items-center justify-center" style={{backgroundColor:'#f5f0e8'}}>
      <div className="rounded-xl bg-white p-6 shadow-md text-center max-w-xs">
        <div className="mb-2 text-3xl">✈️</div>
        <p className="mb-4 text-sm text-[#666]">Chưa có dữ liệu báo giá.</p>
        <button className="rounded-lg px-4 py-2 text-sm font-semibold text-white" style={{backgroundColor:'#c8a96b'}} onClick={()=>router.push('/')}>Quay lại tìm vé</button>
      </div>
    </main>
  );

  const isRT=data.tripType==='roundtrip'&&!!data.inbound;
  const quoteId=`APG-${new Date(data.createdAt).getTime().toString(36).toUpperCase().slice(-6)}`;

  return(
    <main className="min-h-screen" style={{backgroundColor:'#f5f0e8',fontFamily:"'Be Vietnam Pro','Inter',sans-serif"}}>
      <div className="mx-auto max-w-lg">

        {/* Header — compact */}
        <div style={{background:'linear-gradient(135deg,#c8a96b,#e8d4a0)'}}>
          <div className="flex items-center justify-between px-4 py-3">
            <button type="button" onClick={()=>router.push('/')} className="flex items-center gap-2.5 text-left">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/25">
                <img src="/assets/tanphu-apg-logo.jpg" alt="Logo" className="h-8 w-8 rounded-lg object-contain"
                  onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
              </div>
              <div>
                <div className="text-sm font-black tracking-wide text-white">TAN PHU APG</div>
                <div className="text-[10px] text-white/80">APG Flight Agent</div>
              </div>
            </button>
            <div className="text-right">
              <div className="text-[9px] text-white/70">Mã báo giá</div>
              <div className="font-mono text-xs font-black text-white">{quoteId}</div>
            </div>
          </div>
          <div className="border-t border-white/20 bg-white/10 px-4 py-1.5 flex justify-between text-[10px] text-white/80">
            <span>{isRT?'↔ Khứ hồi':'→ Một chiều'} · {cabinLabel(data.cabin)}</span>
            <span>{new Date(data.createdAt).toLocaleString('vi-VN',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})}</span>
          </div>
        </div>

        {/* Route summary — tên đầy đủ */}
        <div className="px-4 py-2.5 bg-white" style={{borderBottom:'1px solid #e8dcc8'}}>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="text-center">
              <div className="text-lg font-black text-[#1a1a1a] leading-tight">{data.outbound.departure.city}</div>
              <div className="text-[10px] text-slate-400 font-semibold">{data.outbound.departure.airport}</div>
            </div>
            <span className="text-base" style={{color:'#c8a96b'}}>{isRT?'⇄':'→'}</span>
            <div className="text-center">
              <div className="text-lg font-black text-[#1a1a1a] leading-tight">{data.outbound.arrival.city}</div>
              <div className="text-[10px] text-slate-400 font-semibold">{data.outbound.arrival.airport}</div>
            </div>
            <span className="mx-1 text-[#ddd]">|</span>
            <span className="text-xs text-[#666]">
              {data.adults} người lớn{data.children?` · ${data.children} trẻ em`:''}
              {data.infants?` · ${data.infants} em bé`:''}
            </span>
          </div>
        </div>

        {/* Flight segments — compact */}
        <div className="px-3 py-2.5 space-y-2 bg-white" style={{borderBottom:'1px solid #e8dcc8'}}>
          <FlightSegment label={isRT?'✈ CHIỀU ĐI':'✈ CHUYẾN BAY'} flight={data.outbound} date={data.search.date} color={airlineColor(data.outbound.airlineCode)}/>
          {isRT&&data.inbound&&<FlightSegment label="✈ CHIỀU VỀ" flight={data.inbound} date={data.search.returnDate} color={airlineColor(data.inbound.airlineCode)}/>}
        </div>

        {/* Price breakdown — compact */}
        <div className="px-3 py-2.5 bg-white" style={{borderBottom:'1px solid #e8dcc8'}}>
          <div className="mb-1.5 text-[10px] font-bold uppercase tracking-wide text-[#7a6a52]">Chi tiết giá vé</div>
          <div className="space-y-1 text-xs">
            <div className="flex justify-between text-[#555]"><span>Người lớn × {data.adults}</span><span className="font-semibold text-[#333]">{fmtVND(calc.baseAdults)}</span></div>
            <div className="flex justify-between text-[#555]"><span>Thuế + phí</span><span className="font-semibold">{fmtVND(calc.taxAdults)}</span></div>
            {data.children>0&&<div className="flex justify-between text-[#555]"><span>Trẻ em × {data.children}</span><span className="font-semibold">{fmtVND(Math.round(calc.farePerPax*0.75*data.children))}</span></div>}
            {data.infants>0&&<div className="flex justify-between text-[#555]"><span>Em bé × {data.infants}</span><span className="font-semibold">{fmtVND(Math.round(calc.farePerPax*0.1*data.infants))}</span></div>}
          </div>
          {/* Total */}
          <div className="mt-2 flex items-center justify-between rounded-lg px-3 py-2" style={{background:'linear-gradient(to right,#fdf6eb,#faf0e0)',border:'1px solid #e8dcc8'}}>
            <div>
              <div className="text-xs font-bold text-[#4a3b28]">Tổng giá vé</div>
              <div className="text-[9px] text-[#aaa]">* Tham khảo</div>
            </div>
            <div className="text-right">
              <div className="text-lg font-bold text-[#1a1a1a]">{fmtVND(calc.total)}</div>
              <div className="text-[9px] text-[#bbb]">≈${Math.round(calc.total/25000)} USD</div>
            </div>
          </div>
        </div>

        {/* Contact — compact row */}
        <div className="flex justify-around bg-white px-2 py-2.5 text-center" style={{borderBottom:'1px solid #e8dcc8'}}>
          {[{icon:'📞',val:'0918.752.686',sub:'Hotline',href:'tel:0918752686'},{icon:'🌐',val:'tanphuapg.com',sub:'Web',href:'https://tanphuapg.com'},{icon:'📧',val:'tkt.tanphu@gmail.com',sub:'Email',href:'mailto:tkt.tanphu@gmail.com'}].map(({icon,val,sub,href})=>(
            <a key={sub} href={href} target="_blank" rel="noreferrer" className="flex flex-col items-center gap-0.5 rounded-lg px-2 py-1.5 hover:bg-[#faf7f2]" style={{border:'1px solid #e8dcc8'}}>
              <span className="text-base">{icon}</span>
              <span className="text-[10px] font-semibold text-[#333] leading-tight max-w-[80px] truncate">{val}</span>
              <span className="text-[9px] text-[#aaa]">{sub}</span>
            </a>
          ))}
        </div>

        <p className="py-1.5 text-center text-[9px] text-[#aaa] px-4 bg-white" style={{borderBottom:'1px solid #e8dcc8'}}>
          * Giá tham khảo. Liên hệ TAN PHU APG để xác nhận chính xác.
        </p>

        {/* Actions */}
        <div className="flex gap-2 px-3 py-3 bg-white">
          <button className="flex-1 rounded-lg border py-2.5 text-sm font-semibold hover:bg-[#faf7f2]"
            style={{borderColor:'#c8a96b',color:'#c8a96b',backgroundColor:'white'}}
            onClick={()=>router.push('/')}>← Đổi chuyến</button>
          <button className="flex-1 rounded-lg py-2.5 text-sm font-bold text-white hover:opacity-90"
            style={{backgroundColor:'#c8a96b'}}
            onClick={()=>setShowTicket(true)}>⬇ Download mặt vé</button>
        </div>

        <div className="py-2 text-center text-[9px] text-white" style={{background:'linear-gradient(to right,#c8a96b,#e8d4a0)'}}>
          © 2026 TAN PHU APG
        </div>
      </div>
      {showTicket&&<TicketModal data={data} onClose={()=>setShowTicket(false)}/>}
    </main>
  );
}
