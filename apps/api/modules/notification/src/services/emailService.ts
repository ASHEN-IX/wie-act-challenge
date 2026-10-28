import moduleClient from '@study-partner/shared/moduleClient';
import nodemailer from 'nodemailer';
import type { Request } from 'express';
import type { INotification } from '../models/Notification';

let transporter: ReturnType<typeof nodemailer.createTransport> | null = null;
let mailerDisabled = false;

export const isEmailEnabled = (): boolean => {
  return process.env.EMAIL_NOTIFICATIONS_ENABLED === 'true';
};

export const getTransporter = (): ReturnType<typeof nodemailer.createTransport> | null => {
  if (mailerDisabled || !isEmailEnabled()) {
    return null;
  }

  if (transporter) {
    return transporter;
  }

  try {
    const host = process.env.SMTP_HOST;
    const port = Number(process.env.SMTP_PORT || 587);
    const user = process.env.SMTP_USER;
    const pass = process.env.SMTP_PASS;

    if (!host || !user || !pass) {
      mailerDisabled = true;
      return null;
    }

    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass }
    });
    return transporter;
  } catch {
    mailerDisabled = true;
    return null;
  }
};

const escapeHtml = (value: unknown): string =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

export const resolveUserEmail = async ({ req }: { req: Request }): Promise<string | null> => {
  const authHeader = req.headers.cookie;
  if (!authHeader) {
    return null;
  }

  const AUTH_SERVICE_URL = 'module://auth';
  try {
    const meRes: { data?: { user?: { email?: unknown } } } = await moduleClient.get(
      `${AUTH_SERVICE_URL}/api/v1/auth/me`,
      {
        headers: { Cookie: authHeader },
        timeout: 5000
      }
    );
    const email = meRes.data?.user?.email;
    return typeof email === 'string' ? email || null : null;
  } catch {
    return null;
  }
};

export interface BuildEmailTemplateArgs {
  title: string;
  message: string;
  type: string;
  metadata?: Record<string, unknown>;
}

export const buildEmailTemplate = ({
  title,
  message,
  type,
  metadata = {}
}: BuildEmailTemplateArgs): { subject: string; html: string } => {
  const emojiByType: Record<string, string> = {
    achievement: '🏆',
    level_up: '🚀',
    study_reminder: '⏰',
    session_start: '📚',
    plan_generated: '🧠'
  };

  const emoji = emojiByType[type] || '🔔';
  const rawActionUrl = metadata.actionUrl;
  let actionUrl: string | null = null;
  if (typeof rawActionUrl === 'string') {
    try {
      const parsed = new URL(rawActionUrl);
      if (parsed.protocol === 'http:' || parsed.protocol === 'https:') {
        actionUrl = parsed.toString();
      }
    } catch {
      actionUrl = null;
    }
  }
  const action = actionUrl
    ? `<p style="margin-top:24px"><a href="${escapeHtml(actionUrl)}" style="background:#ff4655;color:#fff;padding:10px 14px;border-radius:8px;text-decoration:none;font-weight:700">Open Study Partner</a></p>`
    : '';

  return {
    subject: `${emoji} ${escapeHtml(title)}`,
    html: `
      <div style="font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;background:#f7fafc;padding:24px;">
        <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:24px;">
          <h2 style="margin:0 0 10px;color:#0f172a;">${emoji} ${escapeHtml(title)}</h2>
          <p style="margin:0;color:#334155;line-height:1.6;">${escapeHtml(message)}</p>
          ${action}
          <p style="margin-top:24px;color:#64748b;font-size:12px;">This email was sent by Study Partner notifications.</p>
        </div>
      </div>
    `
  };
};

export const sendNotificationEmail = async ({
  req,
  notification
}: {
  req: Request;
  notification: Pick<INotification, 'title' | 'message' | 'type' | 'metadata'>;
}): Promise<{ sent: boolean; reason?: string }> => {
  const t = getTransporter();
  if (!t) return { sent: false, reason: 'email_disabled' };

  const to = await resolveUserEmail({ req });
  if (!to) return { sent: false, reason: 'email_not_available' };

  const template = buildEmailTemplate({
    title: notification.title,
    message: notification.message,
    type: notification.type,
    metadata: notification.metadata
  });

  const from = process.env.SMTP_FROM || 'Study Partner <no-reply@study-partner.local>';
  await t.sendMail({
    from,
    to,
    subject: template.subject,
    html: template.html
  });

  return { sent: true };
};
