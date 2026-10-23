import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "./config";

/**
 * EMAIL BOUNDARY.
 *
 * `getMailer()` returns an SMTP mailer when SMTP_HOST (+ MAIL_FROM) is configured, otherwise a mailer that REPORTS
 * `delivered: false` (it never pretends to have sent anything). Works with any SMTP relay or a transactional
 * provider's SMTP endpoint (SES, SendGrid, Postmark, Mailgun ...).
 *
 * Message bodies (which may contain one-time codes or links) are NEVER logged; only the outcome is.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
}
export interface MailResult {
  delivered: boolean;
  providerMessageId?: string;
  /** Why it was not delivered (never contains secrets). */
  error?: string;
}
export interface Mailer {
  send(message: MailMessage): Promise<MailResult>;
}

const notConfigured: Mailer = {
  async send() {
    return { delivered: false, error: "Email delivery is not configured" };
  },
};

function smtpMailer(): Mailer | null {
  const cfg = getSmtpConfig();
  if (!cfg) return null;
  const transport = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    // Without implicit TLS, require the server to upgrade the connection (STARTTLS) before any credentials or content are sent.
    requireTLS: !cfg.secure && process.env.SMTP_REQUIRE_TLS !== "false",
    auth: cfg.user ? { user: cfg.user, pass: cfg.password } : undefined,
    connectionTimeout: 10_000,
    greetingTimeout: 10_000,
    socketTimeout: 20_000,
  });
  return {
    async send(m) {
      try {
        const info = await transport.sendMail({ from: cfg.from, to: m.to, subject: m.subject, text: m.text, html: m.html });
        return { delivered: info.accepted.length > 0, providerMessageId: info.messageId, error: info.accepted.length ? undefined : "Recipient was rejected" };
      } catch (e) {
        // Only the error CLASS/code is kept: SMTP errors can echo envelope details.
        const code = (e as { code?: string }).code;
        return { delivered: false, error: `SMTP delivery failed${code ? ` (${code})` : ""}` };
      }
    },
  };
}

let override: Mailer | null = null;
let smtp: Mailer | null | undefined;
/** Test hook / composition root. */
export function setMailer(mailer: Mailer | null) {
  override = mailer;
  smtp = undefined;
}

/** Test hook: the mailer a suite installed with setMailer (or null), so a helper can wrap it without replacing it for good. */
export function getMailerOverride(): Mailer | null {
  return override;
}

export function getMailer(): Mailer {
  if (override) return override;
  if (smtp === undefined) smtp = smtpMailer();
  return smtp ?? notConfigured;
}

/** Public base URL used in links inside emails (from APP_BASE_URL, falling back to the request origin). */
export function appBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.replace(/\/$/, "");
  if (configured) return configured;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
