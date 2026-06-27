import { NextRequest, NextResponse } from 'next/server';

const API_BASE = process.env['NEXT_PUBLIC_API_URL'] ?? 'http://localhost:3001/api/v1';

export async function POST(req: NextRequest) {
  const body = await req.json() as { phone: string; message: string; tenantId?: string };

  const tenantId = body.tenantId ?? 'default';

  const response = await fetch(`${API_BASE}/webhooks/whatsapp/webhook`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      object: 'whatsapp_business_account',
      entry: [
        {
          id: tenantId,
          changes: [
            {
              value: {
                messaging_product: 'whatsapp',
                metadata: { display_phone_number: body.phone, phone_number_id: tenantId },
                contacts: [{ profile: { name: 'Customer' }, wa_id: body.phone }],
                messages: [
                  {
                    from: body.phone,
                    id: `pwa_${Date.now()}`,
                    timestamp: Math.floor(Date.now() / 1000).toString(),
                    type: 'text',
                    text: { body: body.message },
                  },
                ],
              },
              field: 'messages',
            },
          ],
        },
      ],
    }),
  });

  if (!response.ok) {
    return NextResponse.json({ error: 'Failed to send message' }, { status: 502 });
  }

  return NextResponse.json({ success: true });
}
