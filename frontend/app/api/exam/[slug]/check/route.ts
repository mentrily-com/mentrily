import { NextRequest, NextResponse } from 'next/server';

const BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/api';

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
    try {
        const { slug } = await params;
        const { searchParams } = new URL(request.url);
        const json = searchParams.get('json');

        if (!slug) {
            return NextResponse.json({ quiz: null, error: 'Slug is required' }, { status: 400 });
        }

        // Require ?json=1 parameter
        if (!json) {
            return NextResponse.json({ error: 'json=1 parameter required' }, { status: 400 });
        }

        // Call backend check endpoint with json parameter
        const res = await fetch(`${BASE_URL}/exam/${slug}/check?json=1`, {
            method: 'GET',
            cache: 'no-store',
            headers: {
                'x-forwarded-host': request.headers.get('host') || '',
            },
        });

        const data = await res.json();

        // Return the data as-is
        return NextResponse.json(data, { status: res.status });
    } catch (error) {
        console.error('[Exam Check API] Error:', error);
        return NextResponse.json({ quiz: null, error: 'Failed to check exam status' }, { status: 500 });
    }
}
