import { NextResponse } from 'next/server';
import { Resend } from 'resend';
import { siteConfig } from '../../../config/site';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: Request) {
    try {
        const { email } = await request.json();

        if (!email || !/^\S+@\S+\.\S+$/.test(String(email).trim())) {
            return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
        }

        // Use the smaller square logo as requested
        const LOGO_URL = new URL('/android-chrome-512x512.png', siteConfig.url).toString();
        const brandColor = '#008D98';

        const fromEmail = process.env.RESEND_SENDER_EMAIL?.includes('mentrily.com')
            ? `Mentrily <noreply@mentrily.com>`
            : `Mentrily <onboarding@resend.dev>`;

        const result = await resend.emails.send({
            from: fromEmail,
            to: email,
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
            return NextResponse.json({ error: result.error.message }, { status: 500 });
        }

        return NextResponse.json({ success: true, data: result.data });
    } catch (error: any) {
        console.error('Marketing API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
