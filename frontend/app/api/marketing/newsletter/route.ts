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

        const LOGO_URL = new URL('/android-chrome-512x512.png', siteConfig.url).toString();
        const brandColor = '#008D98';

        const fromEmail = process.env.RESEND_SENDER_EMAIL?.includes('mentrily.com')
            ? `Mentrily <newsletter@mentrily.com>`
            : `Mentrily <newsletter@resend.dev>`;

        // 1. Add/Update contact with the Newsletter Topic
        // Note: This requires an API key with Audiences/Contacts permissions
        try {
            await resend.contacts.create({
                email: email,
                unsubscribed: false,
                topics: [
                    {
                        id: '69a48a75-5e0f-4035-be8a-51315032cd8b',
                        subscription: 'opt_in',
                    },
                ],
            });
        } catch (contactError: any) {
            console.error('Error managing contact:', contactError);
            return NextResponse.json(
                {
                    error: 'Failed to manage contact. Check API key permissions.',
                    details: contactError.message,
                },
                { status: 500 },
            );
        }

        // 2. Send the email - the placeholder {{{RESEND_UNSUBSCRIBE_URL}}} will now be
        // correctly replaced by Resend because the contact is tracked in an audience.
        const result = await resend.emails.send({
            from: fromEmail,
            to: email,
            subject: 'You’re on the list! Welcome to the Mentrily Newsletter',
            topicId: '69a48a75-5e0f-4035-be8a-51315032cd8b',
            html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Welcome to the Mentrily Newsletter</title>
</head>
<body style="margin:0;padding:0;background-color:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#1e293b;-webkit-font-smoothing:antialiased;">
  <table width="100%" border="0" cellspacing="0" cellpadding="0" style="background-color:#f8fafc;">
    <tr>
      <td align="center" style="padding:60px 20px;">
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;background-color:#ffffff;border-radius:32px;overflow:hidden;box-shadow:0 20px 25px -5px rgba(0,0,0,0.05);">
          <!-- Top Accent Bar -->
          <tr>
            <td style="height:8px;background:linear-gradient(90deg, #008D98, #10B981);"></td>
          </tr>
          
          <!-- Header -->
          <tr>
            <td align="center" style="padding:48px 40px 20px;">
              <img src="${LOGO_URL}" alt="Mentrily" width="56" height="56" style="display:block;max-width:56px;height:auto;border-radius:14px;" />
            </td>
          </tr>
          
          <!-- Content -->
          <tr>
            <td style="padding:20px 48px 48px;text-align:center;">
              <h1 style="margin:0 0 16px;font-size:28px;font-weight:900;line-height:1.2;color:#0f172a;letter-spacing:-0.01em;">
                You&rsquo;re officially <span style="color:${brandColor}; italic">subscribed.</span>
              </h1>
              
              <p style="margin:0 0 32px;font-size:16px;line-height:1.7;color:#64748b;font-weight:500;">
                Thanks for joining the Mentrily community! We&rsquo;ll send you occasional updates on product features, tips for educators, and insights on the future of technical education.
              </p>
              
              <div style="padding:32px;background-color:#f1f5f9;border-radius:24px;text-align:left;">
                <h4 style="margin:0 0 12px;font-size:14px;font-weight:800;color:#0f172a;text-transform:uppercase;letter-spacing:0.05em;">What to expect:</h4>
                <ul style="margin:0;padding:0;list-style:none;">
                  <li style="margin-bottom:12px;font-size:14px;color:#475569;display:flex;align-items:center;">
                    <span style="color:${brandColor};margin-right:10px;">&bull;</span> New feature announcements
                  </li>
                  <li style="margin-bottom:12px;font-size:14px;color:#475569;display:flex;align-items:center;">
                    <span style="color:${brandColor};margin-right:10px;">&bull;</span> Guides for scaling your online school
                  </li>
                  <li style="margin:0;font-size:14px;color:#475569;display:flex;align-items:center;">
                    <span style="color:${brandColor};margin-right:10px;">&bull;</span> Exclusive early access to beta tools
                  </li>
                </ul>
              </div>
              
              <div style="margin-top:40px;">
                <p style="margin:0 0 16px;font-size:14px;color:#94a3b8;font-weight:600;">Want to start building now?</p>
                <a href="${siteConfig.url}/signup" style="display:inline-block;padding:14px 32px;background-color:#0f172a;color:#ffffff;text-decoration:none;font-size:14px;font-weight:700;border-radius:12px;">
                  Explore the Platform
                </a>
              </div>
            </td>
          </tr>
        </table>
        
        <!-- Bottom Footer -->
        <table width="100%" border="0" cellspacing="0" cellpadding="0" style="max-width:600px;">
          <tr>
            <td style="padding:32px 40px;text-align:center;">
              <p style="margin:0;font-size:12px;color:#94a3b8;font-weight:500;">
                You received this because you subscribed on mentrily.com. 
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
        console.error('Newsletter API error:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
