import { NextResponse } from 'next/server';
import { LRUCache } from 'lru-cache';
import { Resend } from 'resend';
import { siteConfig } from '../../../config/site';

// Rate limiting: 3 requests per IP per hour, 1 email per recipient per day.
// shortcut: in-memory per instance and IP comes from x-forwarded-for, so this
// only slows abuse; add a captcha + shared (Redis) limiter if it gets abused.
const rateLimit = new LRUCache<string, number>({
    max: 500,
    ttl: 1000 * 60 * 60, // 1 hour
});
const recipientLimit = new LRUCache<string, true>({
    max: 5000,
    ttl: 1000 * 60 * 60 * 24, // 1 day
});

// Browsers always send Origin on cross-site POSTs; require it to be this app,
// so other sites can't use this endpoint to mail arbitrary addresses.
function isSameOrigin(request: Request): boolean {
    const origin = request.headers.get('origin');
    if (!origin) return false;
    try {
        const host = new URL(origin).host.toLowerCase();
        const domain = siteConfig.domain.toLowerCase();
        return (
            host === (request.headers.get('host') || '').toLowerCase() || host === domain || host.endsWith(`.${domain}`)
        );
    } catch {
        return false;
    }
}

const resend = new Resend(process.env.RESEND_API_KEY || 're_placeholder');

export async function POST(request: Request) {
    try {
        if (!isSameOrigin(request)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        const rawIp = request.headers.get('x-forwarded-for') || request.headers.get('cf-connecting-ip') || 'unknown';
        const ip = rawIp.split(',')[0].trim();
        const currentUsage = rateLimit.get(ip) || 0;
        if (currentUsage >= 3) {
            return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429 });
        }
        rateLimit.set(ip, currentUsage + 1);

        const { email, website } = await request.json();

        // Honeypot: a hidden "website" field real users never fill. Pretend success for bots.
        if (website) {
            return NextResponse.json({ success: true });
        }

        if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        const recipient = String(email).trim().toLowerCase();
        if (recipientLimit.has(recipient)) {
            return NextResponse.json({ success: true }); // don't reveal or re-send
        }
        recipientLimit.set(recipient, true);

        // Use the smaller square logo as requested
        const LOGO_URL = new URL('/android-chrome-512x512.png', siteConfig.url).toString();
        const brandColor = '#008D98';

        const fromEmail = process.env.RESEND_SENDER_EMAIL?.includes('mentrily.com')
            ? `Mentrily <noreply@mentrily.com>`
            : `Mentrily <onboarding@resend.dev>`;

        const result = await resend.emails.send({
            from: fromEmail,
            to: recipient,
            subject: 'Launch your branded school today with Mentrily',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to Mentrily</title>
</head>
<body style="margin:0;padding:0;background-color:#ffffff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#ffffff;">
    <tr>
      <td align="center" style="padding:40px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border:1px solid #f1f5f9;border-radius:24px;overflow:hidden;box-shadow:0 10px 15px -3px rgba(0,0,0,0.05);">
          <!-- Header -->
          <tr>
            <td align="center" style="padding:40px 40px 10px;">
              <img src="${LOGO_URL}" alt="Mentrily" width="64" height="64" style="display:block;max-width:64px;height:auto;border-radius:12px;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:20px 40px 40px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:32px;font-weight:900;line-height:1.1;color:#0f172a;letter-spacing:-0.02em;">
                Your school. Your brand.<br/>
                <span style="color:${brandColor};">Launch today.</span>
              </h1>
              
              <p style="margin:0 0 32px;font-size:18px;line-height:1.6;color:#64748b;font-weight:500;">
                Join educators who chose ownership over renting.
              </p>
              
              <div style="margin-bottom:32px;">
                <a href="${siteConfig.url}/signup" style="display:inline-block;padding:16px 36px;background-color:${brandColor};color:#ffffff;text-decoration:none;font-size:16px;font-weight:900;border-radius:14px;box-shadow:0 4px 14px 0 rgba(0,141,152,0.39);">
                  Start Your Free Platform
                </a>
              </div>
              
              <!-- Benefits -->
              <table width="100%" border="0" cellspacing="0" cellpadding="0">
                <tr>
                  <td align="center">
                    <table border="0" cellspacing="0" cellpadding="0">
                      <tr>
                        <td style="padding:0 10px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">
                          No credit card required
                        </td>
                        <td style="color:#e2e8f0;">&bull;</td>
                        <td style="padding:0 10px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">
                          Free forever plan
                        </td>
                        <td style="color:#e2e8f0;">&bull;</td>
                        <td style="padding:0 10px;font-size:12px;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.05em;">
                          Cancel anytime
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
        
        <!-- Bottom Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:13px;color:#94a3b8;font-weight:500;">
                &copy; ${new Date().getFullYear()} ${siteConfig.name}. All rights reserved.
              </p>
              <div style="margin-top:12px;">
                <a href="${siteConfig.url}/privacy" style="font-size:12px;color:${brandColor};text-decoration:none;font-weight:600;margin:0 8px;">Privacy Policy</a>
                <a href="{{{RESEND_UNSUBSCRIBE_URL}}}" style="font-size:12px;color:${brandColor};text-decoration:none;font-weight:600;margin:0 8px;">Unsubscribe</a>
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
          `,
        });

        if (result.error) {
            console.error('Marketing send failed:', result.error);
            return NextResponse.json({ error: 'Failed to send email' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error: any) {
        console.error('Marketing API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
