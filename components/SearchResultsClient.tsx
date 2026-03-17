"use client";
import ContactModal from '@/components/ContactModal';
import FilterSidebar from '@/components/FilterSidebar';
import FlightCard from '@/components/FlightCard';
import LoadingSkeleton from '@/components/LoadingSkeleton';
import SortBar from '@/components/SortBar';
import { FlightResult, SearchPayload, SearchResponse, Cabin } from '@/lib/types';
import { useSearchParams } from 'next/navigation';
import { useEffect, useMemo, useState } from 'react';

function sortFlights(items: FlightResult[], mode: string) {
  const arr = [...items];
  if (mode === 'fastest') arr.sort((a, b) => a.duration - b.duration);
  else if (mode === 'earliest') arr.sort((a, b) => +new Date(a.departure.time) - +new Date(b.departure.time));
  else arr.sort((a, b) => a.price.amount - b.price.amount);
  return arr;
}

export default function SearchResultsClient() {
  const sp = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<SearchResponse | null>(null);
  const [sort, setSort] = useState('price');
  const [stopFilter, setStopFilter] = useState(new Set<string>(['nonstop', 'one']));
  const [airlineFilter, setAirlineFilter] = useState(new Set<string>());
  const [openContact, setOpenContact] = useState(false);

  const payload: SearchPayload = {
    from: sp.get('from') || 'HAN',
    to: sp.get('to') || 'SGN',
    date: sp.get('date') || new Date().toISOString().slice(0, 10),
    returnDate: sp.get('returnDate') || undefined,
    adults: Number(sp.get('adults') || 1),
    children: Number(sp.get('children') || 0),
    infants: Number(sp.get('infants') || 0),
    cabin: (sp.get('cabin') as Cabin) || 'economy',
    tripType: (sp.get('tripType') as 'oneway' | 'roundtrip') || 'oneway',
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError('');
      try {
        const r = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Lỗi tìm kiếm');
        if (!cancelled) {
          setData(j);
          setAirlineFilter(new Set(j.results.map((x: FlightResult) => x.airline)));
        }
      } catch (e: unknown) {
        if (!cancelled) setError(e instanceof Error ? e.message : 'Đã có lỗi');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sp.toString()]);

  const filtered = useMemo(() => {
    const base = data?.results || [];
    const byStop = base.filter((f) => {
      if (f.stops === 0 && stopFilter.has('nonstop')) return true;
      if (f.stops === 1 && stopFilter.has('one')) return true;
      if (f.stops >= 2 && stopFilter.has('two')) return true;
      return false;
    });
    const byAirline = byStop.filter((f) => airlineFilter.has(f.airline));
    return sortFlights(byAirline, sort);
  }, [data, sort, stopFilter, airlineFilter]);

  return (
    <main className="mx-auto max-w-6xl px-4 py-8">
      <div className="mb-4 rounded-2xl border bg-white p-4">
        <div className="font-bold">
          {payload.from} → {payload.to} | {payload.date} | {payload.adults} người lớn{' '}
          <button className="ml-2 text-brand underline" onClick={() => history.back()}>Sửa</button>
        </div>
      </div>

      {loading && <LoadingSkeleton />}
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-red-700">
          {error}{' '}
          <button className="underline" onClick={() => location.reload()}>Thử lại</button>
        </div>
      )}

      {!loading && !error && data && (
        <div className="grid gap-4 md:grid-cols-[250px_1fr]">
          <FilterSidebar
            flights={data.results}
            stopFilter={stopFilter}
            setStopFilter={setStopFilter}
            airlineFilter={airlineFilter}
            setAirlineFilter={setAirlineFilter}
          />
          <div>
            <SortBar sort={sort} setSort={setSort} />
            <div className="space-y-3">
              {filtered.length === 0 ? (
                <div className="rounded-2xl border bg-white p-4">Không có kết quả phù hợp. Hãy đổi ngày/điểm đến.</div>
              ) : (
                filtered.map((f) => <FlightCard key={f.id} f={f} onContact={() => setOpenContact(true)} />)
              )}
            </div>
          </div>
        </div>
      )}

      <ContactModal open={openContact} onClose={() => setOpenContact(false)} />
    </main>
  );
}
