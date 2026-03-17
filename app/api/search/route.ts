import { NextRequest, NextResponse } from 'next/server';
import { v4 as uuidv4 } from 'uuid';
import { searchAbayFlights } from '@/lib/abay';
import { AIRPORT_NAME_MAP } from '@/lib/airports';
import { isValidIATA, isValidDate } from '@/lib/utils';
import type { SearchPayload, SearchResponse, FlightResult } from '@/lib/types';

export const runtime = 'nodejs';
export const maxDuration = 30;

const rlBucket = new Map<string, { count: number; resetAt: number }>();
let rlCalls = 0;

function checkRateLimit(ip: string, limit = 30): boolean {
  const now = Date.now();
  const hourMs = 3_600_000;
  const entry = rlBucket.get(ip);
  if (!entry || now > entry.resetAt) {
    rlBucket.set(ip, { count: 1, resetAt: now + hourMs });
    return true;
  }
  entry.count++;
  if (++rlCalls % 500 === 0) {
    for (const [k, v] of rlBucket) if (now > v.resetAt) rlBucket.delete(k);
  }
  return entry.count <= limit;
}

const memCache = new Map<string, { data: string; expires: number }>();
const MEM_TTL = 900_000;
const MEM_MAX = 200;

function memGet(key: string): string | null {
  const e = memCache.get(key);
  if (!e) return null;
  if (Date.now() > e.expires) { memCache.delete(key); return null; }
  return e.data;
}

function memSet(key: string, value: string) {
  if (memCache.size >= MEM_MAX) {
    let oldest = Infinity; let oldestKey = '';
    for (const [k, v] of memCache) { if (v.expires < oldest) { oldest = v.expires; oldestKey = k; } }
    if (oldestKey) memCache.delete(oldestKey);
  }
  memCache.set(key, { data: value, expires: Date.now() + MEM_TTL });
}

function airlineCodeFromName(name = ''): string {
  const t = name.toLowerCase();
  if (t.includes('vietnam airlines')) return 'VN';
  if (t.includes('vietjet')) return 'VJ';
  if (t.includes('bamboo')) return 'QH';
  if (t.includes('pacific airlines')) return 'BL';
  if (t.includes('vietravel')) return 'VU';
  if (t.includes('sun phu quoc') || t.includes('sun air') || t.includes('9g')) return '9G';
  if (t.includes('china southern')) return 'CZ';
  if (t.includes('shenzhen')) return 'ZH';
  if (t.includes('air china')) return 'CA';
  if (t.includes('china eastern')) return 'MU';
  if (t.includes('shanghai')) return 'FM';
  if (t.includes('sichuan')) return '3U';
  if (t.includes('loong')) return 'GJ';
  if (t.includes('tianjin')) return 'GS';
  if (t.includes('xiamen')) return 'MF';
  return (name.match(/\b[A-Z0-9]{2}\b/) || ['XX'])[0];
}

function validate(body: SearchPayload): string | null {
  if (!body.from || !isValidIATA(body.from)) return 'Mã sân bay đi không hợp lệ (VD: HAN)';
  if (!body.to || !isValidIATA(body.to)) return 'Mã sân bay đến không hợp lệ (VD: SGN)';
  if (body.from === body.to) return 'Điểm đi và điểm đến không được giống nhau';
  if (!body.date || !isValidDate(body.date)) return 'Ngày đi không hợp lệ (YYYY-MM-DD)';
  if (body.returnDate && !isValidDate(body.returnDate)) return 'Ngày về không hợp lệ';
  if (body.returnDate && body.returnDate < body.date) return 'Ngày về phải sau ngày đi';
  if ((body.adults ?? 1) < 1 || (body.adults ?? 1) > 9) return 'Số người lớn phải từ 1-9';
  if ((body.children ?? 0) < 0 || (body.children ?? 0) > 9) return 'Số trẻ em phải từ 0-9';
  if ((body.infants ?? 0) < 0 || (body.infants ?? 0) > 4) return 'Số em bé phải từ 0-4';
  if (!['economy', 'premium', 'business', 'first'].includes(body.cabin)) return 'Hạng vé không hợp lệ';
  return null;
}

function mapRow(f: ReturnType<typeof Object.assign>): FlightResult {
  const fromMeta = AIRPORT_NAME_MAP[f.origin_iata] || { city: f.origin_iata, airportName: f.origin_iata };
  const toMeta = AIRPORT_NAME_MAP[f.destination_iata] || { city: f.destination_iata, airportName: f.destination_iata };
  return {
    id: uuidv4(),
    airline: f.airline || 'N/A',
    airlineCode: airlineCodeFromName(f.airline || ''),
    flightNumber: f.flight_number || 'N/A',
    departure: {
      airport: f.origin_iata,
      airportName: fromMeta.airportName,
      city: fromMeta.city,
      time: f.scheduled_departure,
    },
    arrival: {
      airport: f.destination_iata,
      airportName: toMeta.airportName,
      city: toMeta.city,
      time: f.scheduled_arrival,
    },
    duration: Number(f.duration_minutes || 0),
    stops: Number(f.stops || 0),
    price: {
      amount: Number(f.base_price || f.price || 0),
      currency: 'VND',
      source: 'abay.vn',
    },
    detailUrl: f.detail_url || null,
    fareBreakdown: (f.total_price || f.taxes_fees)
      ? {
          baseAmount: Number(f.base_price || f.price || 0),
          taxesFees: Number(f.taxes_fees || 0),
          totalAmount: Number(f.total_price || f.price || 0),
          currency: 'VND',
        }
      : undefined,
    priceUSD: Math.round(Number(f.base_price || f.price || 0) / 25000),
    sources: ['abay'],
  };
}

export async function POST(req: NextRequest) {
  const started = Date.now();
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'local';
  if (!checkRateLimit(ip, 30)) {
    return NextResponse.json({ error: 'Quá nhiều yêu cầu. Vui lòng thử lại sau ít phút.' }, { status: 429 });
  }

  let body: SearchPayload;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Request body không hợp lệ' }, { status: 400 }); }

  const validErr = validate(body);
  if (validErr) return NextResponse.json({ error: validErr }, { status: 400 });

  const cacheKey = `abay:${body.from}:${body.to}:${body.date}:${body.cabin}:${body.adults}:${body.children || 0}:${body.infants || 0}`;
  const cached = memGet(cacheKey);
  if (cached) {
    const parsed = JSON.parse(cached) as SearchResponse;
    parsed.metadata.cached = true;
    return NextResponse.json(parsed, { headers: { 'X-Cache': 'HIT', 'X-Engine': 'Abay' } });
  }

  try {
    const raw = await searchAbayFlights({
      from: body.from,
      to: body.to,
      date: body.date,
      adults: body.adults,
      children: body.children,
      infants: body.infants,
      cabin: body.cabin === 'premium' ? 'economy' : body.cabin,
    });

    const results = raw.map(mapRow).filter(f => f.price.amount > 0).sort((a, b) => a.price.amount - b.price.amount);
    const payload: SearchResponse = {
      searchId: uuidv4(),
      results,
      metadata: {
        totalResults: results.length,
        searchTime: Number(((Date.now() - started) / 1000).toFixed(2)),
        cached: false,
        sourceUsed: 'abay',
        engine: 'AbayEngine',
      },
    };

    if (results.length > 0) memSet(cacheKey, JSON.stringify(payload));
    return NextResponse.json(payload, {
      headers: { 'X-Cache': 'MISS', 'X-Engine': 'Abay', 'X-Results': String(results.length) }
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    console.error('[search/route] Error:', msg);
    return NextResponse.json({
      error: 'Lỗi tìm chuyến bay. Vui lòng thử lại.',
      details: process.env.NODE_ENV === 'development' ? msg : undefined,
    }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ status: 'ok', engine: 'AbayEngine', version: '2.3', timestamp: new Date().toISOString() });
}
