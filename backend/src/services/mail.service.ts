import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { DEFAULT_APP_DOMAIN, getAppName, getAppUrl } from '../config/app-brand';

@Injectable()
export class MailService {
  constructor(
    @InjectQueue('onboarding-emails')
    private readonly onboardingEmailQueue: Queue,
  ) {}

  private readonly logger = new Logger(MailService.name);
  private readonly apiKey = process.env.MAILJET_API_KEY;
  private readonly apiSecret = process.env.MAILJET_API_SECRET;
  private readonly senderEmail =
    process.env.MAILJET_SENDER_EMAIL || `no-reply@${DEFAULT_APP_DOMAIN}`;
  private readonly senderName = process.env.MAILJET_SENDER_NAME || getAppName();
  private readonly appUrl = getAppUrl();
  private readonly appName = getAppName();

  private escapeHtml(value?: string | null): string {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  private formatDateTime(value?: Date | string | null): string {
    if (!value) return 'Not scheduled';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return 'Not scheduled';
    return date.toLocaleString();
  }

  async scheduleCreatorOnboardingSequence(orgId: string) {
    const normalizedOrgId = String(orgId || '').trim();
    if (!normalizedOrgId) {
      return;
    }

    const schedule = [
      { stage: 'day0', delayMs: 0 },
      { stage: 'day3', delayMs: 3 * 24 * 60 * 60 * 1000 },
      { stage: 'day7', delayMs: 7 * 24 * 60 * 60 * 1000 },
      { stage: 'day14', delayMs: 14 * 24 * 60 * 60 * 1000 },
    ] as const;

    for (const item of schedule) {
      await this.onboardingEmailQueue.add(
        'send-onboarding-email',
        { orgId: normalizedOrgId, stage: item.stage },
        {
          delay: item.delayMs,
          attempts: 3,
          backoff: { type: 'exponential', delay: 5000 },
          removeOnComplete: 200,
          removeOnFail: 200,
          jobId: `onboarding-email:${normalizedOrgId}:${item.stage}`,
        },
      );
    }
  }

  async sendCreatorOnboardingEmail(params: {
    stage: 'day0' | 'day3' | 'day7' | 'day14';
    recipient: { email: string; name?: string };
    organization: {
      id: string;
      name: string;
      domain?: string;
      primaryColor?: string;
      logo?: string;
      plan?: string;
      studentCount?: number;
      courseCount?: number;
      hasCourse?: boolean;
      hasExam?: boolean;
      hasActiveExam?: boolean;
    };
  }) {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Mailjet credentials not found. Skipping onboarding email.',
      );
      return;
    }

    const stage = params.stage;
    const recipientEmail = String(params.recipient?.email || '').trim();
    if (!recipientEmail) return;

    const recipientName = this.escapeHtml(params.recipient?.name || 'there');
    const orgName = this.escapeHtml(params.organization?.name || 'Your school');
    const primaryColor = params.organization?.primaryColor || '#008D98';
    const orgLogo = params.organization?.logo;
    const orgDomain = params.organization?.domain;

    const baseUrl =
      orgDomain && orgDomain.includes('.') && !orgDomain.includes('localhost')
        ? `https://${orgDomain}`
        : this.appUrl;

    const dashboardUrl = `${baseUrl.replace(/\/+$/, '')}/dashboard/creator`;
    const billingUrl = `${baseUrl.replace(/\/+$/, '')}/dashboard/creator/billing`;

    const hasCourse = Boolean(params.organization?.hasCourse);
    const hasExam = Boolean(params.organization?.hasExam);
    const hasActiveExam = Boolean(params.organization?.hasActiveExam);
    const studentCount = Number(params.organization?.studentCount || 0);
    const courseCount = Number(params.organization?.courseCount || 0);
    const planName = this.escapeHtml(
      String(params.organization?.plan || 'FREE'),
    );

    const logoHtml = orgLogo
      ? `<div style="text-align: center; margin-bottom: 12px;"><img src="${orgLogo}" alt="${orgName} Logo" style="max-height: 50px;" /></div>`
      : '';

    const templates = {
      day0: {
        subject: 'Your school is ready 🎉',
        title: 'Your school is ready 🎉',
        body: `
          <p style="font-size: 15px; color: #334155;">Hi ${recipientName}, your school <strong>${orgName}</strong> is now live.</p>
          <p style="font-size: 15px; color: #334155;">Quick checklist: add logo, create your first course, add students, and launch your first exam.</p>
        `,
        ctaLabel: 'Open Dashboard',
        ctaUrl: dashboardUrl,
      },
      day3: hasCourse
        ? {
            subject: 'Quick question',
            title: 'Great start! Add students',
            body: `<p style="font-size: 15px; color: #334155;">You already created ${courseCount} course(s). Nice momentum. Next, invite students so classes can begin.</p>`,
            ctaLabel: 'Manage Users',
            ctaUrl: `${dashboardUrl}/users`,
          }
        : {
            subject: 'Quick question',
            title: 'Need help getting started?',
            body: `<p style="font-size: 15px; color: #334155;">Most schools launch faster after creating their first course in week one. We can help you get there.</p>`,
            ctaLabel: 'Create First Course',
            ctaUrl: `${dashboardUrl}/courses/create`,
          },
      day7: hasExam
        ? {
            subject: "How's it going?",
            title: hasActiveExam ? 'What Pro unlocks' : "How's it going?",
            body: hasActiveExam
              ? `<p style="font-size: 15px; color: #334155;">You already launched exams. Pro unlocks higher limits and advanced analytics for growing schools.</p>`
              : `<p style="font-size: 15px; color: #334155;">Great progress so far. Want more capacity and advanced controls? Pro can help as you scale.</p>`,
            ctaLabel: 'View Plans',
            ctaUrl: billingUrl,
          }
        : {
            subject: "How's it going?",
            title: 'Exams are powerful',
            body: `<p style="font-size: 15px; color: #334155;">You have courses in place. Turning them into exams helps you track outcomes and learner progress.</p>`,
            ctaLabel: 'Create Exam',
            ctaUrl: `${dashboardUrl}/exams/new`,
          },
      day14: {
        subject: '2 weeks in 🚀',
        title: '2 weeks in 🚀',
        body: `
          <p style="font-size: 15px; color: #334155;">Here’s your current snapshot:</p>
          <ul style="font-size: 14px; color: #334155; line-height: 1.8; padding-left: 20px;">
            <li><strong>Plan:</strong> ${planName}</li>
            <li><strong>Courses:</strong> ${courseCount}</li>
            <li><strong>Students:</strong> ${studentCount}</li>
            <li><strong>Exams:</strong> ${hasExam ? 'Created' : 'Not yet'}</li>
          </ul>
          <p style="font-size: 15px; color: #334155;">Ready for the next phase? Upgrade for more seats, storage, and advanced capabilities.</p>
        `,
        ctaLabel: 'Upgrade Plan',
        ctaUrl: billingUrl,
      },
    } as const;

    const selected = templates[stage];

    const htmlPart = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 620px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden;">
        <div style="background: ${primaryColor}; color: white; padding: 26px 22px; text-align: center;">
          ${logoHtml}
          <h2 style="margin: 0; font-size: 24px; font-weight: 800;">${selected.title}</h2>
        </div>
        <div style="padding: 26px 24px;">
          ${selected.body}
          <div style="margin-top: 24px; text-align: center;">
            <a href="${selected.ctaUrl}" style="display: inline-block; background: ${primaryColor}; color: #fff; text-decoration: none; padding: 12px 18px; border-radius: 8px; font-weight: 700;">${selected.ctaLabel}</a>
          </div>
        </div>
      </div>
    `;

    const textPart = `${selected.title}\n\nOpen: ${selected.ctaUrl}`;

    await axios.post(
      'https://api.mailjet.com/v3.1/send',
      {
        Messages: [
          {
            From: { Email: this.senderEmail, Name: this.senderName },
            To: [
              {
                Email: recipientEmail,
                Name: String(params.recipient?.name || orgName),
              },
            ],
            Subject: selected.subject,
            HTMLPart: htmlPart,
            TextPart: textPart,
          },
        ],
      },
      {
        auth: { username: this.apiKey, password: this.apiSecret },
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  async sendExamInviteEmail(
    recipient: { email: string; name: string },
    exam: {
      id: string;
      title: string;
      slug: string;
      duration: number;
      testCode?: string | null;
      startTime?: Date | string | null;
      endTime?: Date | string | null;
    },
    organization: {
      name: string;
      primaryColor?: string;
      logo?: string;
      domain?: string;
    },
    customMessage?: string,
  ) {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Mailjet credentials not found. Skipping email sending.',
      );
      return;
    }

    const primaryColor = organization.primaryColor || '#008D98';
    const orgName = organization.name;
    const orgLogo = organization.logo;
    const orgDomain = organization.domain;

    const baseUrl =
      orgDomain && orgDomain.includes('.') && !orgDomain.includes('localhost')
        ? `https://${orgDomain}`
        : this.appUrl;

    const examUrl = `${baseUrl}/exam/${exam.slug}`;
    const safeCustomMessage = this.escapeHtml(customMessage);
    const customMessageHtml = safeCustomMessage
      ? `<div style="margin-top: 20px; background: #fff7ed; border: 1px solid #fed7aa; padding: 16px; border-radius: 8px;"><p style="margin: 0; font-size: 14px; color: #9a3412;"><strong>Message from your teacher:</strong></p><p style="margin: 8px 0 0 0; font-size: 14px; color: #9a3412; line-height: 1.5;">${safeCustomMessage.replace(/\n/g, '<br/>')}</p></div>`
      : '';

    const logoHtml = orgLogo
      ? `<div style="text-align: center; margin-bottom: 15px;"><img src="${orgLogo}" alt="${this.escapeHtml(orgName)} Logo" style="max-height: 50px;" /></div>`
      : '';

    const examTitle = this.escapeHtml(exam.title);
    const recipientName = this.escapeHtml(recipient.name || recipient.email);
    const startTime = this.formatDateTime(exam.startTime);
    const endTime = this.formatDateTime(exam.endTime);
    const durationText = Number.isFinite(Number(exam.duration))
      ? `${exam.duration} minutes`
      : 'N/A';
    const testCodeText = this.escapeHtml(exam.testCode || 'N/A');

    const htmlPart = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; background-color: #ffffff; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.05);">
        <div style="background-color: ${primaryColor}; padding: 30px 20px; text-align: center; color: white;">
          ${logoHtml}
          <h1 style="margin: 0; font-size: 26px; font-weight: 700; letter-spacing: 0.5px;">Exam Invitation</h1>
        </div>
        <div style="padding: 32px 30px;">
          <p style="font-size: 16px; color: #334155; margin-top: 0;">Hello <strong style="color: #0f172a;">${recipientName}</strong>,</p>
          <p style="font-size: 15px; color: #334155; line-height: 1.6;">You have been invited to take the exam <strong style="color: #0f172a;">${examTitle}</strong> at <strong style="color: #0f172a;">${this.escapeHtml(orgName)}</strong>.</p>

          <div style="margin: 24px 0; background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px;">
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #475569;"><strong>Start:</strong> ${this.escapeHtml(startTime)}</p>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #475569;"><strong>End:</strong> ${this.escapeHtml(endTime)}</p>
            <p style="margin: 0 0 10px 0; font-size: 14px; color: #475569;"><strong>Duration:</strong> ${this.escapeHtml(durationText)}</p>
            <p style="margin: 0; font-size: 14px; color: #475569;"><strong>Test Code:</strong> <span style="font-family: monospace; font-weight: 700; color: #0f172a;">${testCodeText}</span></p>
          </div>

          ${customMessageHtml}

          <div style="text-align: center; margin-top: 30px;">
            <a href="${examUrl}" style="background-color: ${primaryColor}; color: white; padding: 14px 30px; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; display: inline-block;">Open Exam</a>
          </div>
          <p style="margin-top: 16px; font-size: 12px; color: #94a3b8; text-align: center; word-break: break-all;">Direct link: ${this.escapeHtml(examUrl)}</p>
        </div>
        <div style="background-color: #f8fafc; border-top: 1px solid #eef2f6; padding: 18px; text-align: center;">
          <p style="margin: 0; font-size: 12px; color: #64748b;">&copy; ${new Date().getFullYear()} ${this.escapeHtml(orgName)}. Powered by ${this.escapeHtml(this.appName)}.</p>
        </div>
      </div>
    `;

    const textPart = [
      `Exam Invitation - ${orgName}`,
      `Hello ${recipient.name || recipient.email},`,
      `You have been invited to take: ${exam.title}`,
      `Start: ${startTime}`,
      `End: ${endTime}`,
      `Duration: ${durationText}`,
      `Test Code: ${exam.testCode || 'N/A'}`,
      customMessage ? `Message from your teacher: ${customMessage}` : '',
      `Exam Link: ${examUrl}`,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      const response = await axios.post(
        'https://api.mailjet.com/v3.1/send',
        {
          Messages: [
            {
              From: {
                Email: this.senderEmail,
                Name: orgName || this.senderName,
              },
              To: [
                {
                  Email: recipient.email,
                  Name: recipient.name || recipient.email,
                },
              ],
              Subject: `Exam Invite: ${exam.title}`,
              HTMLPart: htmlPart,
              TextPart: textPart,
            },
          ],
        },
        {
          auth: {
            username: this.apiKey,
            password: this.apiSecret,
          },
          headers: {
            'Content-Type': 'application/json',
          },
        },
      );

      this.logger.log(
        `Exam invite email sent to ${recipient.email} for exam ${exam.id}`,
      );
      return response.data;
    } catch (error: any) {
      this.logger.error(
        `Failed to send exam invite email to ${recipient.email}: ${error.message}`,
        error.response?.data,
      );
      throw error;
    }
  }

  async sendStorageQuotaAlertEmail(params: {
    toEmail?: string;
    orgName: string;
    usedMb: number;
    limitMb: number;
  }) {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Mailjet credentials not found. Skipping storage alert email.',
      );
      return;
    }

    const email = String(params.toEmail || '').trim();
    if (!email) {
      this.logger.warn('Storage alert skipped: missing billing email.');
      return;
    }

    const orgName = this.escapeHtml(params.orgName || 'Your organization');
    const used = Number(params.usedMb || 0).toFixed(1);
    const limit = Number(params.limitMb || 0).toFixed(1);
    const billingUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard/creator/billing`;

    const htmlPart = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden;">
        <div style="background: #008D98; color: white; padding: 22px 24px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Storage Usage Alert</h2>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
          <p style="margin-top: 0;">${orgName} has used over 90% of available storage.</p>
          <p><strong>Current usage:</strong> ${used} MB / ${limit} MB</p>
          <p>You've used 90% of your storage. Upgrade to get more space.</p>
          <a href="${billingUrl}" style="display:inline-block; margin-top:8px; background:#008D98; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:700;">Open Billing</a>
        </div>
      </div>
    `;

    await axios.post(
      'https://api.mailjet.com/v3.1/send',
      {
        Messages: [
          {
            From: { Email: this.senderEmail, Name: this.senderName },
            To: [{ Email: email, Name: orgName }],
            Subject: `${params.orgName}: 90% storage usage reached`,
            HTMLPart: htmlPart,
            TextPart: `${params.orgName} has used over 90% of storage (${used} MB / ${limit} MB). Upgrade to get more space: ${billingUrl}`,
          },
        ],
      },
      {
        auth: { username: this.apiKey, password: this.apiSecret },
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  async sendStudentQuotaAlertEmail(params: {
    toEmail?: string;
    orgName: string;
    studentCount: number;
    limit: number;
  }) {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Mailjet credentials not found. Skipping student alert email.',
      );
      return;
    }

    const email = String(params.toEmail || '').trim();
    if (!email) {
      this.logger.warn('Student alert skipped: missing billing email.');
      return;
    }

    const orgName = this.escapeHtml(params.orgName || 'Your organization');
    const billingUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard/creator/billing`;

    const htmlPart = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden;">
        <div style="background: #008D98; color: white; padding: 22px 24px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Student Capacity Alert</h2>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
          <p style="margin-top: 0;">${orgName} has reached over 80% of student capacity.</p>
          <p><strong>Current students:</strong> ${params.studentCount} / ${params.limit}</p>
          <p>You have ${params.studentCount} students. Your plan allows ${params.limit}. Upgrade for more.</p>
          <a href="${billingUrl}" style="display:inline-block; margin-top:8px; background:#008D98; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:700;">Open Billing</a>
        </div>
      </div>
    `;

    await axios.post(
      'https://api.mailjet.com/v3.1/send',
      {
        Messages: [
          {
            From: { Email: this.senderEmail, Name: this.senderName },
            To: [{ Email: email, Name: orgName }],
            Subject: `${params.orgName}: 80% student capacity reached`,
            HTMLPart: htmlPart,
            TextPart: `${params.orgName} has ${params.studentCount} students out of ${params.limit}. Upgrade for more capacity: ${billingUrl}`,
          },
        ],
      },
      {
        auth: { username: this.apiKey, password: this.apiSecret },
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  async sendPaymentFailedRecoveryEmail(params: {
    toEmail?: string;
    orgName: string;
  }) {
    if (!this.apiKey || !this.apiSecret) {
      this.logger.warn(
        'Mailjet credentials not found. Skipping payment failed email.',
      );
      return;
    }

    const email = String(params.toEmail || '').trim();
    if (!email) {
      this.logger.warn('Payment failed email skipped: missing billing email.');
      return;
    }

    const orgName = this.escapeHtml(params.orgName || 'Your organization');
    const billingUrl = `${this.appUrl.replace(/\/+$/, '')}/dashboard/creator/billing`;

    const htmlPart = `
      <div style="font-family: 'Segoe UI', sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #fee2e2; border-radius: 12px; overflow: hidden;">
        <div style="background: #dc2626; color: white; padding: 22px 24px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">Payment Failed</h2>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
          <p style="margin-top: 0;">We couldn't process your latest payment for <strong>${orgName}</strong>.</p>
          <p>Please update your payment method to avoid plan restrictions or service interruption.</p>
          <a href="${billingUrl}" style="display:inline-block; margin-top:8px; background:#dc2626; color:#fff; text-decoration:none; padding:10px 16px; border-radius:8px; font-weight:700;">Fix Billing</a>
        </div>
      </div>
    `;

    await axios.post(
      'https://api.mailjet.com/v3.1/send',
      {
        Messages: [
          {
            From: { Email: this.senderEmail, Name: this.senderName },
            To: [{ Email: email, Name: orgName }],
            Subject: `${params.orgName}: payment failed`,
            HTMLPart: htmlPart,
            TextPart: `Payment failed for ${params.orgName}. Update your payment method: ${billingUrl}`,
          },
        ],
      },
      {
        auth: { username: this.apiKey, password: this.apiSecret },
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }

  /**
   * Beta upgrade-by-request flow: instead of a live Stripe checkout, a
   * plan-upgrade click sends this notification so the team can decide
   * whether/how to grant it manually. Reply-To is the requester so the
   * team can just hit reply, same as the marketing contact form.
   */
  async sendUpgradeRequestEmail(params: {
    requesterName: string;
    requesterEmail: string;
    orgName?: string | null;
    currentPlan: string;
    requestedPlan: string;
    billingInterval?: string | null;
    message?: string | null;
  }) {
    const resendApiKey = process.env.RESEND_API_KEY;
    const mailjetHasKeys = Boolean(this.apiKey && this.apiSecret);

    if (!resendApiKey && !mailjetHasKeys) {
      this.logger.warn(
        'Neither Resend nor Mailjet credentials found. Skipping upgrade request email.',
      );
      return;
    }

    const recipient = String(
      process.env.UPGRADE_REQUEST_RECIPIENT_EMAIL ||
        process.env.RESEND_CONTACT_RECIPIENT ||
        'admin@mentrily.com',
    ).trim();

    const name = this.escapeHtml(params.requesterName || params.requesterEmail);
    const email = this.escapeHtml(params.requesterEmail);
    const orgName = this.escapeHtml(params.orgName || 'No organization');
    const currentPlan = this.escapeHtml(params.currentPlan);
    const requestedPlan = this.escapeHtml(params.requestedPlan);
    const billingInterval = this.escapeHtml(params.billingInterval || 'monthly');
    const message = params.message?.trim()
      ? this.escapeHtml(params.message).replace(/\n/g, '<br>')
      : '<em>(no message provided)</em>';

    const htmlPart = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 640px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 12px; overflow: hidden;">
        <div style="background: #008D98; color: white; padding: 24px;">
          <h2 style="margin: 0; font-size: 20px; font-weight: 800;">New Upgrade Request (Beta)</h2>
        </div>
        <div style="padding: 24px; color: #334155; font-size: 14px; line-height: 1.6;">
          <p style="margin: 0 0 10px;"><strong>Name:</strong> ${name}</p>
          <p style="margin: 0 0 10px;"><strong>Email:</strong> ${email}</p>
          <p style="margin: 0 0 10px;"><strong>Organization:</strong> ${orgName}</p>
          <p style="margin: 0 0 10px;"><strong>Current plan:</strong> ${currentPlan}</p>
          <p style="margin: 0 0 20px;"><strong>Requested plan:</strong> ${requestedPlan} (${billingInterval})</p>
          <p style="margin: 0 0 8px;"><strong>Message:</strong></p>
          <div style="padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px;">
            ${message}
          </div>
        </div>
      </div>
    `;

    const textPart = [
      'New upgrade request (beta)',
      `Name: ${params.requesterName || params.requesterEmail}`,
      `Email: ${params.requesterEmail}`,
      `Organization: ${params.orgName || 'No organization'}`,
      `Current plan: ${params.currentPlan}`,
      `Requested plan: ${params.requestedPlan} (${params.billingInterval || 'monthly'})`,
      '',
      'Message:',
      params.message?.trim() || '(no message provided)',
    ].join('\n');

    const subject = `[Upgrade Request] ${params.requestedPlan} — ${params.orgName || params.requesterName}`;

    try {
      if (resendApiKey) {
        const sender = process.env.RESEND_SENDER_EMAIL || this.senderEmail;
        await axios.post(
          'https://api.resend.com/emails',
          {
            from: `${this.appName} <${sender}>`,
            to: [recipient],
            reply_to: `${params.requesterName || params.requesterEmail} <${params.requesterEmail}>`,
            subject: subject,
            html: htmlPart,
            text: textPart,
          },
          {
            headers: {
              Authorization: `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json',
            },
          }
        );
      } else if (mailjetHasKeys) {
        await axios.post(
          'https://api.mailjet.com/v3.1/send',
          {
            Messages: [
              {
                From: { Email: this.senderEmail, Name: this.senderName },
                To: [{ Email: recipient, Name: this.appName }],
                ReplyTo: {
                  Email: params.requesterEmail,
                  Name: params.requesterName || params.requesterEmail,
                },
                Subject: subject,
                HTMLPart: htmlPart,
                TextPart: textPart,
              },
            ],
          },
          {
            auth: { username: this.apiKey!, password: this.apiSecret! },
            headers: { 'Content-Type': 'application/json' },
          },
        );
      }
    } catch (error: any) {
      this.logger.error('Failed to send upgrade request email — request was still received', error?.response?.data || error.message);
      // Do not re-throw: the upgrade request was received successfully.
      // A mail delivery failure should not surface as a 500 to the user.
    }
  }

  /**
   * Org-branded invitation email, used instead of Clerk's own invite email
   * for orgs flagged features.resendInvites (the beta/tester org). The
   * inviteUrl is Clerk's ticket URL, so accepting still flows through the
   * exact same PendingInvite/provisioning pipeline. THROWS on delivery
   * failure — the caller rolls the invite back, since no other email will
   * ever reach the invitee.
   */
  /**
   * Hero graphic for the beta-tester invite (designed in Canva, on-brand:
   * real Mentrily wordmark, Fraunces-style editorial serif headline, teal
   * #008D98 accent — see project memory for the design session). Hosted
   * permanently on the app's own CDN (not a Canva export link, which
   * expires), same S3 bucket org logos use. 1200x1698 source, displayed at
   * a contained width so it doesn't dominate the inbox.
   */
  private readonly betaTesterPosterUrl =
    'https://dyp4wnn9yf27t.cloudfront.net/email-assets/beta-tester-invite-poster.png';

  async sendOrgInviteEmail(params: {
    to: string;
    inviteUrl: string;
    orgName: string;
    orgLogo?: string | null;
    orgPrimaryColor?: string | null;
    role: string;
    inviteeName?: string | null;
    expiresInDays: number;
  }): Promise<void> {
    const resendApiKey = process.env.RESEND_API_KEY;
    const mailjetHasKeys = Boolean(this.apiKey && this.apiSecret);

    if (!resendApiKey && !mailjetHasKeys) {
      throw new Error(
        'No email provider configured (RESEND_API_KEY / Mailjet) for org invite email',
      );
    }

    const brandColor = /^#[0-9a-fA-F]{3,8}$/.test(params.orgPrimaryColor || '')
      ? params.orgPrimaryColor!
      : '#008D98';
    const inviteUrl = params.inviteUrl;

    // The poster itself carries the "Accept Invitation" call to action and
    // is the ONLY click target — no separate greeting/button block, so
    // there's a single unambiguous thing to click.
    const htmlPart = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 560px; margin: 0 auto; border: 1px solid #eef2f6; border-radius: 16px; overflow: hidden; background: #ffffff;">
        <a href="${inviteUrl}" style="display: block; text-decoration: none;">
          <img src="${this.betaTesterPosterUrl}" width="560" alt="You're invited to build early — Mentrily Beta Tester Program. Click to accept your invitation." style="display: block; width: 100%; max-width: 560px; height: auto; border: 0;" />
        </a>
        <div style="padding: 20px 28px 26px; text-align: center;">
          <p style="margin: 0 0 8px; color: #94a3b8; font-size: 12px;">
            This invitation expires in ${Number(params.expiresInDays) || 7} days.
            If the button doesn't work, copy this link into your browser:
          </p>
          <p style="margin: 0; word-break: break-all; font-size: 12px;">
            <a href="${inviteUrl}" style="color: ${brandColor};">${this.escapeHtml(inviteUrl)}</a>
          </p>
        </div>
      </div>
    `;

    const textPart = [
      `You're invited to build early — Mentrily Beta Tester Program.`,
      '',
      `Accept the invitation: ${params.inviteUrl}`,
      '',
      `This invitation expires in ${Number(params.expiresInDays) || 7} days.`,
    ].join('\n');

    const subject = `You're invited to join ${params.orgName}`;

    if (resendApiKey) {
      const sender = process.env.RESEND_SENDER_EMAIL || this.senderEmail;
      await axios.post(
        'https://api.resend.com/emails',
        {
          from: `Mentrily <${sender}>`,
          to: [params.to],
          subject,
          html: htmlPart,
          text: textPart,
        },
        {
          headers: {
            Authorization: `Bearer ${resendApiKey}`,
            'Content-Type': 'application/json',
          },
        },
      );
      return;
    }

    await axios.post(
      'https://api.mailjet.com/v3.1/send',
      {
        Messages: [
          {
            From: { Email: this.senderEmail, Name: 'Mentrily' },
            To: [{ Email: params.to, Name: params.inviteeName || params.to }],
            Subject: subject,
            HTMLPart: htmlPart,
            TextPart: textPart,
          },
        ],
      },
      {
        auth: { username: this.apiKey!, password: this.apiSecret! },
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
