/**
 * Quick smoke-test for the upgrade-request email flow.
 * Mirrors exactly what billing.service.ts → mail.service.ts does.
 * Run with: node scripts/test-upgrade-email.mjs
 */
import axios from 'axios';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, '../.env') });

const resendApiKey = process.env.RESEND_API_KEY;
const senderEmail = process.env.RESEND_SENDER_EMAIL || 'no-reply@mentrily.com';
const recipient = process.env.RESEND_CONTACT_RECIPIENT || 'sumanydv514@gmail.com';
const appName = process.env.APP_NAME || 'Mentrily';

if (!resendApiKey || resendApiKey === 're_your_api_key_here') {
  console.error('❌ RESEND_API_KEY is missing or still a placeholder in .env');
  process.exit(1);
}

// ── Mock data (mirrors what a real user would submit) ──────────────────────
const params = {
  requesterName: 'Test Admin (Mock)',
  requesterEmail: 'test@mentrily.com',
  orgName: 'Mentrily Demo Org',
  currentPlan: 'FREE',
  requestedPlan: 'PRO',
  billingInterval: 'monthly',
  message: 'This is a mock upgrade request sent from the test script to verify the email flow works end-to-end.',
};

const subject = `[Upgrade Request] ${params.requestedPlan} — ${params.orgName || params.requesterName}`;

const htmlPart = `
  <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden;">
    <div style="background: #008D98; color: white; padding: 24px;">
      <h2 style="margin: 0; font-size: 20px; font-weight: 800;">New Upgrade Request (Beta) — TEST</h2>
    </div>
    <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
      <p style="margin: 0 0 10px;"><strong>Name:</strong> ${params.requesterName}</p>
      <p style="margin: 0 0 10px;"><strong>Email:</strong> ${params.requesterEmail}</p>
      <p style="margin: 0 0 10px;"><strong>Organization:</strong> ${params.orgName}</p>
      <p style="margin: 0 0 10px;"><strong>Current plan:</strong> ${params.currentPlan}</p>
      <p style="margin: 0 0 20px;"><strong>Requested plan:</strong> ${params.requestedPlan} (${params.billingInterval})</p>
      <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
      <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
        ${params.message}
      </div>
      <p style="margin-top: 20px; color: #94a3b8; font-size: 12px;">⚠️ This is a TEST email sent via scripts/test-upgrade-email.mjs</p>
    </div>
  </div>
`;

console.log('📧 Sending test upgrade request email via Resend...');
console.log(`   From    : ${appName} <${senderEmail}>`);
console.log(`   To      : ${recipient}`);
console.log(`   Subject : ${subject}`);
console.log(`   Plan    : ${params.requestedPlan} (${params.billingInterval})`);
console.log('');

try {
  const response = await axios.post(
    'https://api.resend.com/emails',
    {
      from: `${appName} <${senderEmail}>`,
      to: [recipient],
      reply_to: `${params.requesterName} <${params.requesterEmail}>`,
      subject,
      html: htmlPart,
      text: `[TEST] Upgrade request: ${params.requestedPlan} from ${params.requesterName} (${params.requesterEmail})`,
    },
    {
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
    },
  );

  console.log('✅ Email sent successfully!');
  console.log(`   Resend ID : ${response.data?.id}`);
  console.log(`   Check inbox: ${recipient}`);
} catch (err) {
  console.error('❌ Email failed to send:');
  console.error('   Status :', err?.response?.status);
  console.error('   Error  :', JSON.stringify(err?.response?.data || err?.message));
  process.exit(1);
}
