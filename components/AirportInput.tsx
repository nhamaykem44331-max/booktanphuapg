"use client";
import { Airport, searchAirport } from '@/lib/airports';
import { useMemo, useRef, useState, useEffect } from 'react';

export default function AirportInput({
  label, value, onChange,
}: { label: string; value: string; onChange: (v: string) => void }) {
  const [q, setQ] = useState(value);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const list = useMemo(() => searchAirport(q), [q]);

  const pick = (a: Airport) => {
    setQ(a.code);
    onChange(a.code);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div className="relative" ref={ref}>
      <label className="mb-1 block text-xs font-semibold text-slate-600">{label}</label>
      <input
        value={q}
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          const val = e.target.value.toUpperCase();
          setQ(val);
          onChange(val);
          setOpen(true);
        }}
        className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 outline-none ring-brand/40 focus:ring"
        placeholder="VD: HAN hoặc Hà Nội"
        maxLength={20}
      />
      {open && list.length > 0 && (
        <div className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-xl border bg-white shadow">
          {list.map((a) => (
            <button key={a.code} type="button" className="block w-full px-3 py-2 text-left hover:bg-slate-50" onClick={() => pick(a)}>
              <span className="font-semibold">{a.code}</span> — {a.city} ({a.name})
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
