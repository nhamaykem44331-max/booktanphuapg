import { NextRequest, NextResponse } from 'next/server';
import { fetchAbayFareDetail } from '@/lib/abay';

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const detailUrl = String(body?.detailUrl || '');
    if (!detailUrl || !detailUrl.startsWith('https://www.abay.vn/')) {
      return NextResponse.json({ error: 'detailUrl không hợp lệ' }, { status: 400 });
    }

    const detail = await fetchAbayFareDetail(detailUrl);
    if (!detail) {
      return NextResponse.json({ error: 'Không lấy được breakdown giá từ Abay' }, { status: 404 });
    }

    return NextResponse.json({
      fareBreakdown: {
        baseAmount: detail.basePrice,
        taxesFees: detail.taxesFees,
        totalAmount: detail.totalPrice,
        currency: 'VND',
      },
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg || 'Lỗi fare detail' }, { status: 500 });
  }
}
