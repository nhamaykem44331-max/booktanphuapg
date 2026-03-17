/**
 * POST /api/n8n/price-alert
 * Quét giá và trả về thông báo nếu có chuyến rẻ hơn ngưỡng
 * Dùng cho n8n cron job chạy định kỳ
 *
 * Body:
 * {
 *   "routes": [
 *     { "from": "HAN", "to": "SGN", "date": "2026-04-01" },
 *     { "from": "HAN", to": "DAD", "date": "2026-04-05" }
 *   ],
 *   "adults": 1,
 *   "cabin": "economy",
 *   "thresholdVND": 1000000,   // thông báo khi giá <= ngưỡng này
 *   "topN": 3                  // lấy top N chuyến rẻ nhất mỗi route
 * }
 */

import { NextRequest, NextResponse } from 'next/server';
import { searchAbayFlights } from '@/lib/abay';
import { isValidIATA, isValidDate } from '@/lib/utils';
import { validateApiKey, unauthorizedResponse } from '@/lib/api-auth';

export const runtime = 'nodejs';
export const maxDuration = 60;

function fmt(n: number) { return Number(n).toLocaleString('vi-VN') + 'đ'; }
function hhmm(iso: string) { return iso?.slice(11, 16) || '--:--'; }

export async function POST(req: NextRequest) {
  if (!validateApiKey(req)) return unauthorizedResponse();

  let body: Record<string, unknown>;
  try { body = await req.json(); }
  catch { return NextResponse.json({ error: 'Body không hợp lệ' }, { status: 400 }); }

  const routes = Array.isArray(body.routes) ? body.routes as { from: string; to: string; date: string }[] : [];
  const adults       = Number(body.adults ?? 1);
  const cabin        = String(body.cabin || 'economy') as 'economy' | 'business';
  const thresholdVND = Number(body.thresholdVND ?? Infinity);
  const topN         = Math.min(Number(body.topN ?? 3), 10);

  if (routes.length === 0) return NextResponse.json({ error: '"routes" không được rỗng' }, { status: 400 });
  if (routes.length > 5)   return NextResponse.json({ error: 'Tối đa 5 tuyến mỗi lần quét' }, { status: 400 });

  // Validate routes
  for (const r of routes) {
    if (!isValidIATA(r.from) || !isValidIATA(r.to)) return NextResponse.json({ error: `Mã sân bay không hợp lệ: ${r.from}/${r.to}` }, { status: 400 });
    if (!isValidDate(r.date)) return NextResponse.json({ error: `Ngày không hợp lệ: ${r.date}` }, { status: 400 });
  }

  const started = Date.now();
  const results: Record<string, unknown>[] = [];
  const alerts:  Record<string, unknown>[] = [];

  for (const route of routes) {
    try {
      const raw = await searchAbayFlights({
        from: route.from, to: route.to, date: route.date,
        adults, cabin,
      });

      const sorted = raw
        .filter(f => (f.base_price || f.price) > 0)
        .sort((a, b) => (a.base_price || a.price) - (b.base_price || b.price))
        .slice(0, topN)
        .map(f => {
          const price = Number(f.base_price || f.price);
          return {
            route:        `${route.from} → ${route.to}`,
            date:         route.date,
            flightNumber: f.flight_number,
            airline:      f.airline,
            departure:    hhmm(f.scheduled_departure),
            arrival:      hhmm(f.scheduled_arrival),
            stops:        f.stops,
            price,
            priceFormatted: fmt(price),
            belowThreshold: price <= thresholdVND,
            // Text sẵn cho Telegram
            telegramText: `✈ *${f.flight_number}* ${route.from}→${route.to} ${route.date}\n⏰ ${hhmm(f.scheduled_departure)} → ${hhmm(f.scheduled_arrival)}\n💰 *${fmt(price)}*/người\n${price <= thresholdVND ? '🔥 GIÁ RẺ!' : ''}`,
          };
        });

      const cheapest = sorted[0];
      results.push({
        route:    `${route.from} → ${route.to}`,
        date:     route.date,
        found:    raw.length,
        cheapest: cheapest || null,
        top:      sorted,
        hasAlert: sorted.some(f => f.belowThreshold),
      });

      // Thu thập alert
      sorted.filter(f => f.belowThreshold).forEach(f => alerts.push(f));

    } catch (e: unknown) {
      results.push({
        route: `${route.from} → ${route.to}`,
        date:  route.date,
        error: e instanceof Error ? e.message : String(e),
      });
    }
  }

  // Tổng hợp Telegram message
  let telegramSummary = '';
  if (alerts.length > 0) {
    telegramSummary = `🚨 *CÓ ${alerts.length} CHUYẾN GIÁ RẺ!*\nNgưỡng: ${fmt(thresholdVND)}\n\n`;
    telegramSummary += alerts.map(a => a.telegramText).join('\n\n');
  } else {
    telegramSummary = `✅ Quét ${routes.length} tuyến — không có chuyến nào dưới ${fmt(thresholdVND)}`;
  }

  return NextResponse.json({
    success:         true,
    scannedRoutes:   routes.length,
    alertsFound:     alerts.length,
    hasAlerts:       alerts.length > 0,
    threshold:       thresholdVND,
    telegramMessage: telegramSummary,  // copy thẳng vào Telegram node
    alerts,
    results,
    scanTime: `${((Date.now() - started) / 1000).toFixed(2)}s`,
  });
}
