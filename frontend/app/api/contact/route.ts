import { NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { Resend } from 'resend';
import { siteConfig } from '../../config/site';

// Rate limiting: 5 requests per IP per hour
const rateLimit = new LRUCache<string, number>({
    max: 500,
    ttl: 1000 * 60 * 60, // 1 hour
});

const resend = new Resend(process.env.RESEND_API_KEY);
const SENDER_EMAIL = process.env.RESEND_SENDER_EMAIL || `contact@${siteConfig.domain}`;
const RECIPIENT_EMAIL = process.env.RESEND_CONTACT_RECIPIENT || siteConfig.contactEmail;
const LOGO_URL = new URL('/android-chrome-512x512.png', siteConfig.url).toString();

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
        const { name, email, subject, category, message, website } = body;
        const contactSubject = String(subject || category || 'General Inquiry').trim();

        // 3. Honeypot Check
        if (website) {
            // Silently fail for bots
            return NextResponse.json({ success: true });
        }

        // 4. Validation
        if (!name || !email || !message || !contactSubject) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        if (!/^\S+@\S+\.\S+$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        // 5. Resend Setup
        if (!process.env.RESEND_API_KEY) {
            console.error('Resend API key missing');
            return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
        }

        // 6. Send Email
        const { error } = await resend.emails.send({
            from: `${siteConfig.contactFormName} <${SENDER_EMAIL}>`,
            to: RECIPIENT_EMAIL,
            replyTo: `${name} <${email}>`,
            subject: `[Contact Form] ${contactSubject}`,
            text: `Name: ${name}\nEmail: ${email}\nCategory: ${contactSubject}\n\nMessage:\n${message}`,
            html: `
            <div style="margin:0;padding:24px;background:#f8fafc;font-family:Arial,sans-serif;color:#0f172a;">
              <div style="max-width:640px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;overflow:hidden;">
                <div style="padding:24px;border-bottom:1px solid #e2e8f0;">
                  <img src="${LOGO_URL}" alt="${escapeHtml(siteConfig.name)}" width="64" style="display:block;max-width:64px;height:auto;border-radius:12px;" />
                </div>
                <div style="padding:24px;">
                  <h2 style="margin:0 0 18px;font-size:20px;line-height:1.3;color:#0f172a;">New Contact Form Submission</h2>
                  <p style="margin:0 0 10px;"><strong>Name:</strong> ${escapeHtml(name)}</p>
                  <p style="margin:0 0 10px;"><strong>Email:</strong> ${escapeHtml(email)}</p>
                  <p style="margin:0 0 20px;"><strong>Category:</strong> ${escapeHtml(contactSubject)}</p>
                  <p style="margin:0 0 8px;"><strong>Message:</strong></p>
                  <div style="padding:16px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;line-height:1.6;">
                    ${escapeHtml(message).replace(/\n/g, '<br>')}
                  </div>
                </div>
              </div>
            </div>
          `,
        });

        if (error) {
            console.error('Resend email error:', error);
            throw new Error('Resend request failed');
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Contact API error:', error);
        return NextResponse.json({ error: 'Failed to send message. Please try again later.' }, { status: 500 });
    }
}
