"use client";
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import AirportInput from '@/components/AirportInput';
import PassengerCabin from '@/components/PassengerCabin';
import { POPULAR_ROUTES } from '@/lib/airports';
import type { Cabin } from '@/lib/types';

export default function SearchForm() {
  const router = useRouter();
  const [tripType, setTripType] = useState<'oneway' | 'roundtrip'>('oneway');
  const [from, setFrom] = useState('HAN');
  const [to, setTo] = useState('SGN');
  const d = new Date(); d.setDate(d.getDate() + 7);
  const [date, setDate] = useState(d.toISOString().slice(0, 10));
  const [returnDate, setReturnDate] = useState('');
  const [adults, setAdults] = useState(1);
  const [children, setChildren] = useState(0);
  const [infants, setInfants] = useState(0);
  const [cabin, setCabin] = useState<Cabin>('economy');

  const submit = () => {
    const q = new URLSearchParams({ from, to, date, adults: String(adults), children: String(children), infants: String(infants), cabin, tripType });
    if (tripType === 'roundtrip' && returnDate) q.set('returnDate', returnDate);
    router.push(`/search?${q.toString()}`);
  };

  return (
    <div className="rounded-3xl bg-white p-6 shadow-lg">
      <div className="mb-4 flex gap-2">
        <button className={`rounded-full px-4 py-2 ${tripType === 'oneway' ? 'bg-brand text-white' : 'border'}`} onClick={() => setTripType('oneway')}>Một chiều</button>
        <button className={`rounded-full px-4 py-2 ${tripType === 'roundtrip' ? 'bg-brand text-white' : 'border'}`} onClick={() => setTripType('roundtrip')}>Khứ hồi</button>
      </div>

      <div className="grid gap-3 md:grid-cols-5">
        <AirportInput label="Điểm đi" value={from} onChange={setFrom} />
        <div className="flex items-end justify-center pb-2">
          <button className="rounded-full border px-3 py-1" onClick={() => { setFrom(to); setTo(from); }}>⇄</button>
        </div>
        <AirportInput label="Điểm đến" value={to} onChange={setTo} />
        <div>
          <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày đi</label>
          <input type="date" min={new Date().toISOString().slice(0, 10)} value={date} onChange={(e) => setDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
        </div>
        {tripType === 'roundtrip' && (
          <div>
            <label className="mb-1 block text-xs font-semibold text-slate-600">Ngày về</label>
            <input type="date" min={date} value={returnDate} onChange={(e) => setReturnDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" />
          </div>
        )}
      </div>

      <div className="mt-3 grid gap-3 md:grid-cols-[1fr_auto]">
        <PassengerCabin adults={adults} children={children} infants={infants} cabin={cabin} onChange={(v) => { setAdults(v.adults); setChildren(v.children); setInfants(v.infants); setCabin(v.cabin); }} />
        <button className="rounded-xl bg-brand px-5 py-2 font-semibold text-white" onClick={submit}>TÌM CHUYẾN BAY</button>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {POPULAR_ROUTES.map((r) => (
          <button key={`${r.from}-${r.to}`} className="rounded-full border bg-slate-50 px-3 py-1 text-sm" onClick={() => { setFrom(r.from); setTo(r.to); }}>{r.from}→{r.to}</button>
        ))}
      </div>
    </div>
  );
}
