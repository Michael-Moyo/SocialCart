import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001';

type BotMessage = {
  text: string;
  buttons?: Array<{ id: string; title: string }>;
  listRows?: Array<{ id: string; title: string; description?: string }>;
};

export async function POST(req: NextRequest) {
  const body = await req.json() as { phone: string; message: string; tenantId?: string };

  try {
    const response = await fetch(`${API_BASE}/api/v1/simulator/message`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tenantId: body.tenantId ?? 'default',
        phone: body.phone,
        message: body.message,
      }),
    });

    const data = await response.json() as { success: boolean; replies?: BotMessage[] };
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ success: false, error: 'Failed to reach API' }, { status: 502 });
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const tenantId = searchParams.get('tenantId') ?? 'default';
  const phone = searchParams.get('phone') ?? '';

  try {
    const response = await fetch(
      `${API_BASE}/api/v1/simulator/history?tenantId=${encodeURIComponent(tenantId)}&phone=${encodeURIComponent(phone)}`
    );
    const data = await response.json();
    return NextResponse.json(data, { status: response.ok ? 200 : response.status });
  } catch {
    return NextResponse.json({ success: true, messages: [] });
  }
}
