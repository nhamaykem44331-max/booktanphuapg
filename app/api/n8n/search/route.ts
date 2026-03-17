/**
 * POST /api/n8n/search
 * Endpoint tìm chuyến bay tối ưu cho n8n
 * Header: x-api-key: YOUR_SECRET_KEY
 *
 * Body ví dụ:
 * {
 *   "from": "HAN", "to": "SGN", "date": "2026-03-25",
 *   "adults": 1, "children": 0, "infants": 0, "cabin": "economy",
 *   "limit": 5,          // số chuyến trả về tối đa (mặc định 10)
 *   "sortBy": "price",   // "price" | "time"
 *   "airlinesOnly": ["VJ","VN"]  // lọc hãng (tuỳ chọn)
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { searchAbayFlights } from '@/lib/abay';
import { AIRPORT_NAME_MAP } from '@/lib/airports';
import { isValidIATA, isValidDate } from '@/lib/utils';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 30;

function airlineCode(name = '') {
  const t = name.toLowerCase();
  if (t.includes('vietnam airlines')) return 'VN';
  if (t.includes('vietjet'))          return 'VJ';
  if (t.includes('bamboo'))           return 'QH';
  if (t.includes('pacific airlines')) return 'BL';
  if (t.includes('vietravel'))        return 'VU';
  if (t.includes('sun phu quoc'))     return '9G';
  if (t.includes('china southern'))   return 'CZ';
  if (t.includes('shenzhen'))         return 'ZH';
  if (t.includes('air china'))        return 'CA';
  if (t.includes('china eastern'))    return 'MU';
  return (name.match(/\b[A-Z0-9]{2}\b/) || ['XX'])[0];
}

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }

  const from   = String(body.from || '').toUpperCase();
  const to     = String(body.to   || '').toUpperCase();
  const date   = String(body.date || '');
  const adults = Number(body.adults ?? 1);
  const children = Number(body.children ?? 0);
  const infants  = Number(body.infants  ?? 0);
  const cabin  = String(body.cabin || 'economy') as 'economy' | 'business';
  const limit  = Math.min(Number(body.limit ?? 10), 20);
  const sortBy = String(body.sortBy || 'price');
  const airlinesOnly = Array.isArray(body.airlinesOnly) ? body.airlinesOnly as string[] : [];

  if (!isValidIATA(from)) return NextResponse.json({ error: 'Mã sân bay "from" không hợp lệ' }, { status: 400 });
  if (!isValidIATA(to))   return NextResponse.json({ error: 'Mã sân bay "to" không hợp lệ' }, { status: 400 });
  if (from === to)        return NextResponse.json({ error: 'Điểm đi và đến không được giống nhau' }, { status: 400 });
  if (!isValidDate(date)) return NextResponse.json({ error: 'Ngày không hợp lệ (YYYY-MM-DD)' }, { status: 400 });

  const started = Date.now();
  try {
    const raw = await searchAbayFlights({ from, to, date, adults, children, infants, cabin });

    let flights = raw
      .filter(f => (f.base_price || f.price) > 0)
      .map(f => {
        const fromMeta = AIRPORT_NAME_MAP[f.origin_iata]      || { city: f.origin_iata,      airportName: f.origin_iata };
        const toMeta   = AIRPORT_NAME_MAP[f.destination_iata] || { city: f.destination_iata, airportName: f.destination_iata };
        const code     = airlineCode(f.airline);
        const price    = Number(f.base_price || f.price);
        return {
          id:           uuidv4(),
          airline:      f.airline,
          airlineCode:  code,
          flightNumber: f.flight_number,
          from:         f.origin_iata,
          fromCity:     fromMeta.city,
          to:           f.destination_iata,
          toCity:       toMeta.city,
          departureTime: f.scheduled_departure,
          arrivalTime:   f.scheduled_arrival,
          durationMinutes: f.duration_minutes,
          stops:        f.stops,
          price,        // giá cơ bản (VND)
          priceUSD:     Math.round(price / 25000),
          detailUrl:    f.detail_url || null,
          // Báo cáo nhanh dạng text cho Telegram
          summary: `${f.flight_number} | ${f.scheduled_departure?.slice(11,16) || '--:--'} → ${f.scheduled_arrival?.slice(11,16) || '--:--'} | ${Number(price).toLocaleString('vi-VN')}đ`,
        };
      });

    // Lọc theo hãng nếu có
    if (airlinesOnly.length > 0) {
      flights = flights.filter(f => airlinesOnly.includes(f.airlineCode));
    }

    // Sắp xếp
    if (sortBy === 'time') flights.sort((a, b) => a.departureTime.localeCompare(b.departureTime));
    else                   flights.sort((a, b) => a.price - b.price);

    // Giới hạn số lượng
    const limited = flights.slice(0, limit);

    return NextResponse.json({
      success: true,
      route:      `${from} → ${to}`,
      date,
      passengers: { adults, children, infants },
      totalFound: flights.length,
      returned:   limited.length,
      cheapest:   limited[0] || null,
      flights:    limited,
      searchTime: `${((Date.now() - started) / 1000).toFixed(2)}s`,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
