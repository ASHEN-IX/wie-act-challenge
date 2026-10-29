import nodemailer, { SendMailOptions } from 'nodemailer';

interface MailTransport {
  sendMail(message: SendMailOptions): Promise<{ messageId: string }>;
}

let transporter: MailTransport | null = null;

function logEmail(...args: unknown[]): void {
  if (process.env.NODE_ENV !== 'test') {
    console.log(...args);
  }
}

async function getTransporter(): Promise<MailTransport> {
  if (transporter) return transporter;

  // Avoid network calls and async logs in test runs.
  if (process.env.NODE_ENV === 'test') {
    transporter = {
      sendMail: async () => ({ messageId: 'test-message-id' })
    };
    return transporter;
  }

  if (process.env.SMTP_HOST) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587'),
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    });
  } else {
    // Dev: use Ethereal fake SMTP
    const testAccount = await nodemailer.createTestAccount();
    transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass
      }
    });
    logEmail('[Email] Using Ethereal test account:', testAccount.user);
  }

  return transporter;
}

const FROM_ADDRESS = process.env.EMAIL_FROM || 'StudyPartner <noreply@studypartner.app>';
const APP_URL = process.env.APP_URL || 'http://localhost:3000';

export interface SendSubscriptionExpiryNoticeOptions {
  tier: string;
  endDate: Date | string | null | undefined;
  daysRemaining: number;
}

export async function sendSubscriptionExpiryNotice(
  to: string,
  { tier, endDate, daysRemaining }: SendSubscriptionExpiryNoticeOptions
): Promise<void> {
  const t = await getTransporter();
  const pricingLink = `${APP_URL}/pricing`;

  const info = await t.sendMail({
    from: FROM_ADDRESS,
    to,
    subject: 'Your StudyPartner subscription is ending soon',
    html: `
      <div style="font-family:sans-serif;max-width:520px;margin:auto;padding:24px;">
        <h2 style="color:#7c3aed;">Subscription Reminder</h2>
        <p>Your <strong>${tier}</strong> plan expires on <strong>${endDate ? new Date(endDate).toLocaleDateString() : 'N/A'}</strong>.</p>
        <p>You have <strong>${daysRemaining}</strong> day(s) left. You can change or renew your plan in the last 5 days of your cycle.</p>
        <a href="${pricingLink}" style="display:inline-block;background:#7c3aed;color:#fff;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Manage Plan</a>
      </div>
    `
  });

  logEmail('[Email] Subscription reminder sent to', to, '| MessageId:', info.messageId);
}
