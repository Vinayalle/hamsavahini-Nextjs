import "server-only";
import nodemailer from "nodemailer";
import { getSmtpConfig } from "./config";
import { SITE_URL, siteBaseUrl } from "@/lib/site-url";

/**
 * EMAIL BOUNDARY.
 *
 * `getMailer()` returns an SMTP mailer when SMTP_HOST (+ MAIL_FROM) is configured, otherwise a mailer that REPORTS
 * `delivered: false` (it never pretends to have sent anything). Works with the mailbox your hosting provider gives you
 * (Hostinger, cPanel ...) or any other SMTP server.
 *
 * Message bodies (which may contain one-time codes or links) are NEVER logged; only the outcome is.
 */
export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html?: string;
  /** Where a reply goes (for a message about a visitor's form: the visitor). */
  replyTo?: string;
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
  let cfg: ReturnType<typeof getSmtpConfig>;
  try {
    cfg = getSmtpConfig();
  } catch (e) {
    // The settings are incomplete: say which one (names only, never values) instead of crashing the request.
    const reason = e instanceof Error ? e.message : "Email settings are incomplete";
    return { async send() { return { delivered: false, error: reason }; } };
  }
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
        const info = await transport.sendMail({ from: cfg.from, to: m.to, subject: m.subject, text: m.text, html: m.html, ...(m.replyTo ? { replyTo: m.replyTo } : {}) });
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

/**
 * Public base URL used in links inside emails. In production it is always the fixed site address (src/lib/site-url.ts), never taken
 * from the request, because the Host header can be forged and would let someone point a reset link at another site. While developing
 * (no fixed address) it follows the address the request came in on, so a link opened on your own computer works.
 */
/**
 * The address the visitor is using right now (http://localhost:3000 on your computer, the live domain once hosted), for links to pages of
 * the site in form emails. Public form posts are only accepted when their Origin header matches the Host (see assertSameOrigin in http.ts),
 * so this is the site's own address. Without a usable Origin it falls back to the fixed address.
 */
export function visitorSiteUrl(request: Request): string {
  const origin = request.headers.get("origin");
  try {
    const u = new URL(origin ?? "");
    if (u.protocol === "http:" || u.protocol === "https:") return u.origin;
  } catch { /* no usable Origin */ }
  return siteBaseUrl();
}

export function appBaseUrl(request: Request): string {
  const configured = process.env.APP_BASE_URL?.trim().replace(/\/$/, "");
  if (configured) return configured;
  if (process.env.NODE_ENV === "production") return SITE_URL;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "localhost:3000";
  const proto = request.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
