"use client";
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import type { FlightResult, SearchResponse, Cabin } from '@/lib/types';
import { fmtVND, toYmd, hhmm, durationText } from '@/lib/utils';
import { AIRPORTS, resolveAirportCode } from '@/lib/airports';
import { getAirlineMeta } from '@/lib/airlines';

const LOADING_HINTS = [
  'Đang kết nối với Tanphuapg.com',
  'Đang tìm chuyến bay giá tốt',
  'Đang so sánh và lọc kết quả',
  'Sắp xong rồi, vui lòng chờ',
];
const SEARCH_STATE_KEY = 'apg_search_page_state';

function removeAccents(s: string) {
  return s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}

// ── Smart Airport Input ──────────────────────────────────────
function AirportInput({ label, value, onChange, onSelect, placeholder }: {
  label: string; value: string;
  onChange: (v: string) => void;
  onSelect: (code: string, label: string) => void;
  placeholder?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const filtered = useMemo(() => {
    const q = removeAccents(value.trim());
    if (!q) return AIRPORTS.slice(0, 8);
    return AIRPORTS.filter(a => a.tags.some(t => removeAccents(t).includes(q)) || removeAccents(a.label).includes(q)).slice(0, 8);
  }, [value]);
  useEffect(() => {
    const fn = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', fn);
    return () => document.removeEventListener('mousedown', fn);
  }, []);
  return (
    <div ref={ref} className="relative">
      <label className="mb-1 block text-xs font-semibold text-[#7a6a52]">{label}</label>
      <input
        className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#c8a96b]/40"
        style={{ border: '1px solid #e8dcc8' }}
        value={value} placeholder={placeholder}
        onChange={e => { onChange(e.target.value); setOpen(true); }}
        onFocus={e => { e.target.select(); setOpen(true); }}
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 overflow-hidden rounded-xl border border-[#e8dcc8] bg-white shadow-xl">
          {filtered.map(a => (
            <button key={a.code} className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#faf7f2]"
              onMouseDown={e => { e.preventDefault(); onSelect(a.code, a.label); setOpen(false); }}>
              <span className="text-sm text-[#c8a96b]">✈</span>
              <div>
                <div className="text-xs font-bold text-[#1a1a1a]">{a.city} <span className="text-[#c8a96b]">({a.code})</span></div>
                <div className="text-[10px] text-slate-400">{a.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Airline Logo ─────────────────────────────────────────────
function AirlineLogo({ code, airline, size = 32 }: { code?: string; airline?: string; size?: number }) {
  const meta = getAirlineMeta(code, airline);
  const colors: Record<string, string> = { VN:'#004b8d',VJ:'#e3001b',QH:'#00873c',BL:'#0050a0',VU:'#f5a623','9G':'#ff6600',CZ:'#2563eb',MU:'#7c3aed',CA:'#dc2626',ZH:'#0ea5e9','3U':'#ef4444' };
  const bg = colors[code||'']||'#c8a96b';
  if (meta.logo) return <img src={meta.logo} alt={code||''} width={size} height={size} className="rounded-lg border border-slate-100 bg-white object-contain p-0.5 shadow-sm shrink-0" referrerPolicy="no-referrer" onError={e=>{(e.target as HTMLImageElement).style.display='none';}} />;
  return <div style={{ width:size, height:size, backgroundColor:bg }} className="flex shrink-0 items-center justify-center rounded-lg text-[9px] font-black text-white">{code?.slice(0,2)||'✈'}</div>;
}

type FareBreakdown = { baseAmount:number; taxesFees:number; totalAmount:number; currency:'VND' };
type StopFilter = 'all'|'0'|'1'|'2+';
type FilterState = { airlines:string[]; stops:StopFilter };

// ── Compact Flight Row (mobile-first, abay style) ────────────
function FlightRow({ f, selected, onSelect, onDeselect, btnColor='gold' }: {
  f: FlightResult; selected: boolean;
  onSelect: () => void; onDeselect?: () => void;
  btnColor?: 'gold'|'blue';
}) {
  const btnBg = btnColor==='gold' ? '#c8a96b' : '#1570ef';
  const isLoading = false;
  return (
    <div className={`border-b border-[#f0ebe0] px-2.5 py-2 transition-colors ${selected?'bg-amber-50':'hover:bg-[#faf8f4]'}`}>
      <div className="flex items-center gap-2">
        {/* Logo */}
        <AirlineLogo code={f.airlineCode} airline={f.airline} size={28} />
        {/* Times + info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-1">
            <span className="text-sm font-bold text-[#1a1a1a]">{hhmm(f.departure.time)}</span>
            <span className="text-[10px] text-[#c8a96b]">→</span>
            <span className="text-sm font-bold text-[#1a1a1a]">{hhmm(f.arrival.time)}</span>
            <span className="ml-1 text-[10px] text-slate-400">{durationText(f.duration)}</span>
          </div>
          <div className="text-[10px] text-slate-400 truncate">{f.flightNumber} · {f.stops===0?'Thẳng':`${f.stops} dừng`}</div>
        </div>
        {/* Price + button */}
        <div className="flex items-center gap-1.5 shrink-0">
          <div className="text-right">
            <div className="text-sm font-bold text-[#1a1a1a]">{Number(f.fareBreakdown?.totalAmount??f.price.amount).toLocaleString('vi-VN')}</div>
            <div className="text-[9px] text-slate-400">≈${f.priceUSD}</div>
          </div>
          {selected ? (
            <div className="flex items-center gap-0.5">
              <div className="rounded-md bg-green-600 px-2 py-1 text-[10px] font-bold text-white">✓</div>
              {onDeselect && <button onClick={onDeselect} className="flex h-6 w-6 items-center justify-center rounded-md border border-red-200 bg-red-50 text-red-500 text-[9px]">✕</button>}
            </div>
          ) : (
            <button onClick={onSelect} className="rounded-md px-2.5 py-1.5 text-xs font-bold text-white" style={{ backgroundColor: btnBg }}>
              Chọn
            </button>
          )}
        </div>
      </div>
      {/* Breakdown when selected */}
      {selected && f.fareBreakdown && (
        <div className="mt-1.5 rounded border border-[#eadfcf] bg-white px-2 py-1.5 text-[10px]">
          <div className="flex justify-between text-slate-500"><span>Cơ bản</span><span className="font-medium">{fmtVND(f.fareBreakdown.baseAmount)}</span></div>
          <div className="flex justify-between text-slate-500"><span>Thuế+phí</span><span className="font-medium">{fmtVND(f.fareBreakdown.taxesFees)}</span></div>
          <div className="mt-0.5 flex justify-between border-t border-[#eadfcf] pt-0.5 font-semibold"><span>Tổng</span><span>{fmtVND(f.fareBreakdown.totalAmount)}</span></div>
        </div>
      )}
    </div>
  );
}

// ── Filter Bar ───────────────────────────────────────────────
function FilterBar({ flights, filter, onChange }: { flights:FlightResult[]; filter:FilterState; onChange:(f:FilterState)=>void }) {
  const airlines = useMemo(() => {
    const seen = new Map<string,string>();
    flights.forEach(f => { if (!seen.has(f.airlineCode)) seen.set(f.airlineCode, f.airline); });
    return [...seen.entries()].map(([code,name])=>({code,name})).sort((a,b)=>a.name.localeCompare(b.name));
  }, [flights]);
  if (!flights.length) return null;
  const chip = (active:boolean, onClick:()=>void, label:React.ReactNode) => (
    <button onClick={onClick} className={`flex items-center gap-1 rounded px-2 py-0.5 text-[10px] font-semibold transition-all ${active?'text-white':'border text-[#7a6a52]'}`}
      style={active?{backgroundColor:'#c8a96b'}:{border:'1px solid #e8dcc8',backgroundColor:'white'}}>
      {label}
    </button>
  );
  return (
    <div className="border-b border-[#f0ebe0] bg-[#fdfaf6] px-2.5 py-2 space-y-1.5">
      <div className="flex flex-wrap gap-1">
        {chip(filter.airlines.length===0, ()=>onChange({...filter,airlines:[]}), 'Tất cả HB')}
        {airlines.map(({code,name})=>{
          const active = filter.airlines.includes(code);
          const meta = getAirlineMeta(code,name);
          return chip(active, ()=>{
            const next = active ? filter.airlines.filter(c=>c!==code) : [...filter.airlines,code];
            onChange({...filter,airlines:next});
          }, <>{meta.logo&&<img src={meta.logo} alt={code} className="h-3 w-3 rounded object-contain" referrerPolicy="no-referrer"/>}{name.split(' ')[0]}</>);
        })}
      </div>
      <div className="flex flex-wrap gap-1">
        {([['all','Tất cả'],['0','Thẳng'],['1','1 dừng'],['2+','2+ dừng']] as [StopFilter,string][]).map(([val,label])=>
          chip(filter.stops===val, ()=>onChange({...filter,stops:val}), label)
        )}
      </div>
    </div>
  );
}

function applyFilter(flights:FlightResult[], f:FilterState) {
  return flights.filter(fl => {
    if (f.airlines.length>0 && !f.airlines.includes(fl.airlineCode)) return false;
    if (f.stops==='0' && fl.stops!==0) return false;
    if (f.stops==='1' && fl.stops!==1) return false;
    if (f.stops==='2+' && fl.stops<2) return false;
    return true;
  });
}

// ── Main ─────────────────────────────────────────────────────
export default function HomePage() {
  const router = useRouter();
  const [fromInput, setFromInput] = useState('Hà Nội (HAN) — Nội Bài');
  const [toInput, setToInput]     = useState('TP.HCM (SGN) — Tân Sơn Nhất');
  const [from, setFrom] = useState('HAN');
  const [to, setTo]     = useState('SGN');
  const [date, setDate] = useState(toYmd(7));
  const [returnDate, setReturnDate] = useState('');
  const [tripType, setTripType]     = useState<'oneway'|'roundtrip'>('oneway');
  const [adults, setAdults]     = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants]   = useState(0);
  const [cabin, setCabin]       = useState<Cabin>('economy');
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');
  const [results, setResults]   = useState<FlightResult[]>([]);
  const [meta, setMeta]         = useState<{totalResults:number;searchTime:number}|null>(null);
  const [outboundResults, setOutboundResults] = useState<FlightResult[]>([]);
  const [inboundResults, setInboundResults]   = useState<FlightResult[]>([]);
  const [selectedOutbound, setSelectedOutbound] = useState<FlightResult|null>(null);
  const [selectedInbound, setSelectedInbound]   = useState<FlightResult|null>(null);
  const [sortMode, setSortMode] = useState<'price'|'time'>('price');
  const [detailLoadingId, setDetailLoadingId] = useState<string|null>(null);
  const [loadingHintIdx, setLoadingHintIdx] = useState(0);
  const [loadingDots, setLoadingDots]       = useState('');
  const [hydrated, setHydrated] = useState(false);
  const emptyFilter: FilterState = {airlines:[],stops:'all'};
  const [filterOneway,   setFilterOneway]   = useState<FilterState>(emptyFilter);
  const [filterOutbound, setFilterOutbound] = useState<FilterState>(emptyFilter);
  const [filterInbound,  setFilterInbound]  = useState<FilterState>(emptyFilter);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(SEARCH_STATE_KEY);
      if (raw) {
        const s = JSON.parse(raw);
        setFromInput(s.fromInput??'Hà Nội (HAN) — Nội Bài'); setToInput(s.toInput??'TP.HCM (SGN) — Tân Sơn Nhất');
        setFrom(s.from??'HAN'); setTo(s.to??'SGN'); setDate(s.date??toYmd(7)); setReturnDate(s.returnDate??'');
        setTripType(s.tripType??'oneway'); setAdults(s.adults??1); setChildren(s.children??0); setInfants(s.infants??0); setCabin(s.cabin??'economy');
        setResults(s.results??[]); setMeta(s.meta??null);
        setOutboundResults(s.outboundResults??[]); setInboundResults(s.inboundResults??[]);
        setSelectedOutbound(s.selectedOutbound??null); setSelectedInbound(s.selectedInbound??null);
        setSortMode(s.sortMode??'price');
      }
    } catch {/**/ }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    try { localStorage.setItem(SEARCH_STATE_KEY, JSON.stringify({ fromInput,toInput,from,to,date,returnDate,tripType,adults,children,infants,cabin,results,meta,outboundResults,inboundResults,selectedOutbound,selectedInbound,sortMode })); } catch {/**/ }
  }, [hydrated,fromInput,toInput,from,to,date,returnDate,tripType,adults,children,infants,cabin,results,meta,outboundResults,inboundResults,selectedOutbound,selectedInbound,sortMode]);

  useEffect(() => {
    if (!loading) { setLoadingHintIdx(0); setLoadingDots(''); return; }
    const dot  = setInterval(()=>setLoadingDots(d=>d.length>=3?'':d+'.'),350);
    const hint = setInterval(()=>setLoadingHintIdx(i=>(i+1)%LOADING_HINTS.length),1800);
    return ()=>{ clearInterval(dot); clearInterval(hint); };
  }, [loading]);

  function sortFlights(arr:FlightResult[], selId?:string|null) {
    const copy=[...arr];
    if (sortMode==='time') copy.sort((a,b)=>+new Date(a.departure.time)-+new Date(b.departure.time));
    else copy.sort((a,b)=>a.price.amount-b.price.amount);
    if (selId) { const i=copy.findIndex(f=>f.id===selId); if(i>0){const[s]=copy.splice(i,1);copy.unshift(s);} }
    return copy;
  }

  const sortedOneway   = useMemo(()=>applyFilter(sortFlights(results),filterOneway),[results,sortMode,filterOneway]);
  const sortedOutbound = useMemo(()=>applyFilter(sortFlights(outboundResults,selectedOutbound?.id),filterOutbound),[outboundResults,sortMode,selectedOutbound?.id,filterOutbound]);
  const sortedInbound  = useMemo(()=>applyFilter(sortFlights(inboundResults,selectedInbound?.id),filterInbound),[inboundResults,sortMode,selectedInbound?.id,filterInbound]);
  const totalRoundtrip = useMemo(()=>(selectedOutbound?.fareBreakdown?.totalAmount??selectedOutbound?.price.amount??0)+(selectedInbound?.fareBreakdown?.totalAmount??selectedInbound?.price.amount??0),[selectedOutbound,selectedInbound]);

  function goQuote(outbound:FlightResult, inbound?:FlightResult) {
    localStorage.setItem('apg_quote_selection', JSON.stringify({ tripType:inbound?'roundtrip':'oneway',outbound,inbound,adults,children,infants,cabin,search:{from,to,date,returnDate:returnDate||toYmd(10)},createdAt:new Date().toISOString() }));
    router.push('/quote');
  }

  async function selectFlight(flight:FlightResult, dir:'outbound'|'inbound'|'oneway') {
    setDetailLoadingId(flight.id);
    try {
      let e={...flight};
      if (!e.fareBreakdown && e.detailUrl) {
        try {
          const r=await fetch('/api/fare-detail',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({detailUrl:e.detailUrl})});
          const j=await r.json();
          if(r.ok&&j.fareBreakdown){const fb=j.fareBreakdown as FareBreakdown;e={...e,fareBreakdown:fb,price:{...e.price,amount:fb.totalAmount}};}
        } catch {/**/ }
      }
      if (!e.fareBreakdown) e={...e,fareBreakdown:{baseAmount:e.price.amount,taxesFees:0,totalAmount:e.price.amount,currency:'VND'}};
      if (dir==='outbound'){setOutboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedOutbound(e);if(selectedInbound?.fareBreakdown)goQuote(e,selectedInbound);}
      else if(dir==='inbound'){setInboundResults(p=>p.map(f=>f.id===flight.id?e:f));setSelectedInbound(e);if(selectedOutbound?.fareBreakdown)goQuote(selectedOutbound,e);}
      else goQuote(e);
    } catch(ex:unknown){setError(ex instanceof Error?ex.message:'Lỗi');}
    finally{setDetailLoadingId(null);}
  }

  async function callSearch(payload:Record<string,unknown>):Promise<SearchResponse> {
    const r=await fetch('/api/search',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(payload)});
    const j=await r.json();
    if(!r.ok)throw new Error(j.error||'Lỗi');
    return j as SearchResponse;
  }

  async function search() {
    const fc=resolveAirportCode(fromInput)||from, tc=resolveAirportCode(toInput)||to;
    setFrom(fc);setTo(tc);setLoading(true);setError('');setResults([]);setMeta(null);
    setOutboundResults([]);setInboundResults([]);setSelectedOutbound(null);setSelectedInbound(null);
    setFilterOneway(emptyFilter);setFilterOutbound(emptyFilter);setFilterInbound(emptyFilter);
    try {
      const base={adults,children,infants,cabin};
      if (tripType==='roundtrip') {
        const eff=returnDate||toYmd(10);
        const[go,back]=await Promise.all([callSearch({...base,from:fc,to:tc,date,tripType:'oneway'}),callSearch({...base,from:tc,to:fc,date:eff,tripType:'oneway'})]);
        setOutboundResults(go.results||[]);setInboundResults(back.results||[]);
        setMeta({totalResults:(go.results?.length||0)+(back.results?.length||0),searchTime:+(((go.metadata?.searchTime||0)+(back.metadata?.searchTime||0))).toFixed(1)});
      } else {
        const one=await callSearch({...base,from:fc,to:tc,date,tripType:'oneway'});
        setResults(one.results||[]);setMeta(one.metadata?{totalResults:one.metadata.totalResults,searchTime:one.metadata.searchTime}:null);
      }
    } catch(ex:unknown){setError(ex instanceof Error?ex.message:'Lỗi tìm kiếm.');}
    finally{setLoading(false);}
  }

  const hasResults = tripType==='oneway'?results.length>0:(outboundResults.length>0||inboundResults.length>0);

  return (
    <main className="min-h-screen" style={{backgroundColor:'#f5f0e8'}}>
      <div className="mx-auto max-w-2xl">

        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 shadow-sm" style={{background:'linear-gradient(to right,#c8a96b,#e8d4a0)'}}>
          <img src="/assets/tanphu-apg-logo.jpg" alt="Logo" className="h-8 w-8 rounded-lg object-contain"
            onError={e=>{(e.target as HTMLImageElement).style.display='none';}}/>
          <div>
            <div className="text-sm font-black tracking-wide text-white">TAN PHU APG</div>
            <div className="text-[10px] text-white/80">APG Flight Agent</div>
          </div>
          {meta && !loading && (
            <div className="ml-auto text-right">
              <div className="text-[10px] text-white/80">Tìm thấy</div>
              <div className="text-sm font-bold text-white">{meta.totalResults} chuyến</div>
            </div>
          )}
        </div>

        {/* Search form — compact */}
        <div className="bg-white px-3 py-3 shadow-sm" style={{borderBottom:'1px solid #e8dcc8'}}>

          {/* Trip type + Sort */}
          <div className="mb-2 flex items-center justify-between">
            <div className="flex gap-1.5">
              {(['oneway','roundtrip'] as const).map(t=>(
                <button key={t} onClick={()=>setTripType(t)}
                  className={`rounded px-3 py-1 text-xs font-semibold transition-all`}
                  style={tripType===t?{backgroundColor:'#c8a96b',color:'white'}:{border:'1px solid #e8dcc8',backgroundColor:'white',color:'#7a6a52'}}>
                  {t==='oneway'?'Một chiều':'Khứ hồi'}
                </button>
              ))}
            </div>
            {hasResults && (
              <div className="flex items-center gap-2 text-[10px] text-slate-500">
                <span>Sắp xếp:</span>
                {(['price','time'] as const).map(m=>(
                  <label key={m} className="flex cursor-pointer items-center gap-0.5">
                    <input type="radio" checked={sortMode===m} onChange={()=>setSortMode(m)} className="accent-[#c8a96b] h-3 w-3"/>
                    <span>{m==='price'?'Giá':'Giờ'}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Route */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-1.5 mb-2">
            <AirportInput label="Từ" value={fromInput} placeholder="Điểm đi" onChange={setFromInput} onSelect={(c,l)=>{setFrom(c);setFromInput(l);}}/>
            <button className="mt-5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-[#c8a96b]"
              style={{border:'1px solid #e8dcc8'}}
              onClick={()=>{const fi=fromInput,ti=toInput,fc=from,tc=to;setFromInput(ti);setToInput(fi);setFrom(tc);setTo(fc);}}>⇄</button>
            <AirportInput label="Đến" value={toInput} placeholder="Điểm đến" onChange={setToInput} onSelect={(c,l)=>{setTo(c);setToInput(l);}}/>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-2 gap-1.5 mb-2">
            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-[#7a6a52]">Ngày đi</label>
              <input className="w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none" style={{border:'1px solid #e8dcc8'}} type="date" value={date} onChange={e=>setDate(e.target.value)} onFocus={e=>{try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}/>
            </div>
            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-[#7a6a52]">Ngày về</label>
              <input className={`w-full rounded-lg px-2 py-1.5 text-xs focus:outline-none ${tripType==='oneway'?'bg-slate-50 text-slate-300':''}`}
                style={{border:'1px solid #e8dcc8'}} type="date" value={returnDate} min={date} onChange={e=>setReturnDate(e.target.value)} disabled={tripType==='oneway'} onFocus={e=>{if(tripType!=='oneway')try{(e.target as HTMLInputElement).showPicker();}catch{/**/ }}}/>
            </div>
          </div>

          {/* Passengers + Cabin + Search */}
          <div className="grid grid-cols-[1fr_1fr_1fr_1fr_auto] gap-1.5">
            {[{l:'NL',v:adults,s:setAdults,min:1,max:9},{l:'TE',v:children,s:setChildren,min:0,max:9},{l:'EB',v:infants,s:setInfants,min:0,max:4}].map(({l,v,s,min,max})=>(
              <div key={l}>
                <label className="mb-0.5 block text-[10px] font-semibold text-[#7a6a52]">{l}</label>
                <input className="w-full rounded-lg px-1 py-1.5 text-xs text-center focus:outline-none" style={{border:'1px solid #e8dcc8'}} type="number" min={min} max={max} value={v} onChange={e=>s(Math.max(min,Math.min(max,Number(e.target.value||min))))}/>
              </div>
            ))}
            <div>
              <label className="mb-0.5 block text-[10px] font-semibold text-[#7a6a52]">Hạng</label>
              <select className="w-full rounded-lg px-1 py-1.5 text-[10px] focus:outline-none" style={{border:'1px solid #e8dcc8'}} value={cabin} onChange={e=>setCabin(e.target.value as Cabin)}>
                <option value="economy">PT</option>
                <option value="premium">PT+</option>
                <option value="business">TG</option>
                <option value="first">HN</option>
              </select>
            </div>
            <div className="flex items-end">
              <button className="w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                style={{backgroundColor:'#c8a96b'}} onClick={search} disabled={loading}>
                {loading?'…':'Tìm'}
              </button>
            </div>
          </div>

          {/* Quick routes */}
          <div className="mt-2 flex flex-wrap gap-1">
            {[['HAN','SGN'],['HAN','DAD'],['SGN','HAN'],['HAN','PQC'],['SGN','DAD']].map(([f,t])=>(
              <button key={`${f}-${t}`} onClick={()=>{const fa=AIRPORTS.find(a=>a.code===f),ta=AIRPORTS.find(a=>a.code===t);if(fa){setFromInput(fa.label);setFrom(f);}if(ta){setToInput(ta.label);setTo(t);}}}
                className="rounded px-2 py-0.5 text-[10px] text-[#7a6a52] hover:bg-[#faf7f2]" style={{border:'1px solid #e8dcc8',backgroundColor:'white'}}>
                {f}—{t}
              </button>
            ))}
          </div>

          {loading && (
            <div className="mt-2 flex items-center gap-2 rounded-lg px-3 py-2 text-xs" style={{backgroundColor:'#faf7f2'}}>
              <span className="h-1.5 w-1.5 animate-pulse rounded-full" style={{backgroundColor:'#c8a96b'}}/>
              <span className="text-[#7a6a52]">{LOADING_HINTS[loadingHintIdx]}{loadingDots}</span>
            </div>
          )}
          {error && <div className="mt-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">⚠ {error}</div>}
        </div>

        {/* ── ONE-WAY results ── */}
        {tripType==='oneway' && results.length>0 && (
          <div className="overflow-hidden bg-white shadow-sm" style={{border:'1px solid #e8dcc8'}}>
            <div className="flex items-center justify-between px-3 py-2 text-xs font-bold text-white" style={{backgroundColor:'#c8a96b'}}>
              <span>✈ {from} → {to} · {date}</span>
              <span className="text-white/70 font-normal">{sortedOneway.length}/{results.length}</span>
            </div>
            <FilterBar flights={results} filter={filterOneway} onChange={setFilterOneway}/>
            <div className="max-h-[60vh] overflow-auto">
              {sortedOneway.length>0 ? sortedOneway.map(f=>(
                <FlightRow key={f.id} f={f} selected={false} onSelect={()=>selectFlight(f,'oneway')} btnColor="gold"/>
              )) : <div className="p-3 text-xs text-slate-500 text-center">Không có chuyến phù hợp.</div>}
            </div>
          </div>
        )}

        {/* ── ROUNDTRIP — 2 cột như abay ── */}
        {tripType==='roundtrip' && (outboundResults.length>0||inboundResults.length>0) && (
          <div>
            {/* 2-column flight lists */}
            <div className="grid grid-cols-2 gap-0 bg-white" style={{border:'1px solid #e8dcc8'}}>
              {/* Outbound */}
              <div style={{borderRight:'1px solid #e8dcc8'}}>
                <div className="px-2 py-2 text-[11px] font-bold text-white text-center" style={{backgroundColor:'#c8a96b'}}>
                  Đi: {from}→{to}<br/><span className="font-normal text-[10px] text-white/80">{date}</span>
                  <span className="ml-1 text-[9px] text-white/60">{sortedOutbound.length}/{outboundResults.length}</span>
                </div>
                <FilterBar flights={outboundResults} filter={filterOutbound} onChange={setFilterOutbound}/>
                <div className="max-h-[55vh] overflow-auto">
                  {sortedOutbound.length>0 ? sortedOutbound.map(f=>(
                    <FlightRow key={f.id} f={f} selected={selectedOutbound?.id===f.id}
                      onSelect={()=>selectFlight(f,'outbound')}
                      onDeselect={selectedOutbound?.id===f.id?()=>setSelectedOutbound(null):undefined}
                      btnColor="gold"/>
                  )) : <div className="p-3 text-[10px] text-slate-400 text-center">Không có.</div>}
                </div>
              </div>

              {/* Inbound */}
              <div>
                <div className="px-2 py-2 text-[11px] font-bold text-white text-center" style={{backgroundColor:'#1570ef'}}>
                  Về: {to}→{from}<br/><span className="font-normal text-[10px] text-white/80">{returnDate||toYmd(10)}</span>
                  <span className="ml-1 text-[9px] text-white/60">{sortedInbound.length}/{inboundResults.length}</span>
                </div>
                <FilterBar flights={inboundResults} filter={filterInbound} onChange={setFilterInbound}/>
                <div className="max-h-[55vh] overflow-auto">
                  {sortedInbound.length>0 ? sortedInbound.map(f=>(
                    <FlightRow key={f.id} f={f} selected={selectedInbound?.id===f.id}
                      onSelect={()=>selectFlight(f,'inbound')}
                      onDeselect={selectedInbound?.id===f.id?()=>setSelectedInbound(null):undefined}
                      btnColor="blue"/>
                  )) : <div className="p-3 text-[10px] text-slate-400 text-center">Không có.</div>}
                </div>
              </div>
            </div>

            {/* Summary bar */}
            {selectedOutbound && selectedInbound && (
              <div className="bg-white px-3 py-3 shadow-sm" style={{borderTop:'1px solid #e8dcc8'}}>
                <div className="grid grid-cols-2 gap-2 text-xs mb-2">
                  {[{label:'Đi',f:selectedOutbound},{label:'Về',f:selectedInbound}].map(({label,f})=>(
                    <div key={label} className="flex items-center gap-1.5">
                      <AirlineLogo code={f.airlineCode} airline={f.airline} size={20}/>
                      <div>
                        <div className="font-semibold text-[#1a1a1a] text-[11px]">{f.flightNumber} · {hhmm(f.departure.time)}→{hhmm(f.arrival.time)}</div>
                        <div className="text-[10px] text-slate-400">{fmtVND(f.fareBreakdown?.totalAmount??f.price.amount)}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-[10px] text-slate-400">Tổng × {adults} NL</div>
                    <div className="text-base font-bold text-[#1a1a1a]">{fmtVND(totalRoundtrip*adults)}</div>
                  </div>
                  <button className="rounded-lg px-4 py-2 text-sm font-bold text-white" style={{backgroundColor:'#c8a96b'}}
                    onClick={()=>goQuote(selectedOutbound,selectedInbound)}>
                    Báo giá →
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Footer */}
        <div className="px-4 py-2 text-center text-[10px] text-white" style={{background:'linear-gradient(to right,#c8a96b,#e8d4a0)'}}>
          © 2026 TAN PHU APG · 0918.752.686 · tanphuapg.com
        </div>
      </div>
    </main>
  );
}
