import { NextResponse } from 'next/server';
import { authorizeUser } from '../util';

export async function POST(request: Request) {
  try {
    const auth = await authorizeUser(request);
    if (auth.error) return auth.error;

    const draft = await request.json();

    const ktUrl = process.env.KARATETECH_API_URL || process.env.NEXT_PUBLIC_KARATETECH_API_URL;
    const ktKey = process.env.KARATETECH_API_KEY;

    if (!ktUrl || !ktKey) {
      return NextResponse.json({ success: false, error: 'KarateTech registration is not configured. Your draft has not been submitted.' }, { status: 503 });
    }

    const response = await fetch(`${ktUrl}/api/integration/scms/registration`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ktKey}`,
      },
      body: JSON.stringify(draft),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.message || `KarateTech API returned ${response.status}`);
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error: any) {
    console.error('KarateTech registration submission failed:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Internal Server Error' },
      { status: 500 }
    );
  }
}
