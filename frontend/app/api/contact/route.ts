import { NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { siteConfig } from '../../config/site';

// Rate limiting: 5 requests per IP per hour
const rateLimit = new LRUCache<string, number>({
    max: 500,
    ttl: 1000 * 60 * 60, // 1 hour
});

const MAILJET_API_KEY = process.env.MAILJET_API_KEY;
const MAILJET_SECRET_KEY = process.env.MAILJET_SECRET_KEY;
const SENDER_EMAIL = process.env.MAILJET_SENDER_EMAIL || 'sumanydv514@gmail.com'; // Ideally a verified sender in Mailjet
const RECIPIENT_EMAIL = 'sumanydv514@gmail.com';

const escapeHtml = (value: string) =>
    value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');

export async function POST(request: Request) {
    try {
        // 1. Rate Limiting
        const ip = request.headers.get('x-forwarded-for') || 'unknown';
        const currentUsage = rateLimit.get(ip) || 0;

        if (currentUsage >= 5) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }
        rateLimit.set(ip, currentUsage + 1);

        // 2. Parse Body
        const body = await request.json();
        const { name, email, subject, message, website } = body;

        // 3. Honeypot Check
        if (website) {
            // Silently fail for bots
            return NextResponse.json({ success: true });
        }

        // 4. Validation
        if (!name || !email || !subject || !message) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // 5. Mailjet Setup
        if (!MAILJET_API_KEY || !MAILJET_SECRET_KEY) {
            console.error('Mailjet credentials missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        const authHeader = Buffer.from(`${MAILJET_API_KEY}:${MAILJET_SECRET_KEY}`).toString('base64');

        // 6. Send Email
        const mailjetRes = await fetch('https://api.mailjet.com/v3.1/send', {
            method: 'POST',
            headers: {
                Authorization: `Basic ${authHeader}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                Messages: [
                    {
                        From: {
                            Email: SENDER_EMAIL,
                            Name: siteConfig.contactFormName,
                        },
                        To: [
                            {
                                Email: RECIPIENT_EMAIL,
                                Name: 'Admin',
                            },
                        ],
                        ReplyTo: {
                            Email: email,
                            Name: name,
                        },
                        Subject: `[Contact Form] ${subject}`,
                        TextPart: `Name: ${name}\nEmail: ${email}\n\nMessage:\n${message}`,
                        HTMLPart: `
            <h3>New Contact Form Submission</h3>
            <p><strong>Name:</strong> ${escapeHtml(name)}</p>
            <p><strong>Email:</strong> ${escapeHtml(email)}</p>
            <p><strong>Subject:</strong> ${escapeHtml(subject)}</p>
            <br/>
            <p><strong>Message:</strong></p>
            <p>${escapeHtml(message).replace(/\n/g, '<br>')}</p>
          `,
                    },
                ],
            }),
        });

        if (!mailjetRes.ok) {
            const body = await mailjetRes.text();
            console.error('Mailjet HTTP error:', mailjetRes.status, body);
            throw new Error('Mailjet request failed');
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Contact API error:', error);
        return NextResponse.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
    }
}
