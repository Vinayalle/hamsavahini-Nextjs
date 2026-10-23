import "server-only";

/** Branded transactional emails. Plain-text alternative included for every message. Passwords are never sent. */

const BRAND = "Hamsavahin Aarth Mines LLP";
const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

function layout(title: string, bodyHtml: string, footer = "If you did not expect this email, you can ignore it. No one at Hamsavahin will ever ask for your password or a code by phone or email."): string {
  return `<!doctype html><html><body style="margin:0;background:#f4f1ea;font-family:Segoe UI,Arial,sans-serif;color:#1c1710">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:10px;overflow:hidden;border:1px solid #e7e0d0">
<tr><td style="background:#1a130a;color:#debb66;padding:18px 24px;font-size:18px;font-weight:600">${esc(BRAND)}</td></tr>
<tr><td style="padding:28px 24px"><h1 style="margin:0 0 14px;font-size:20px">${esc(title)}</h1>${bodyHtml}</td></tr>
<tr><td style="padding:16px 24px;background:#faf8f3;color:#665d4e;font-size:12px;line-height:1.5">${esc(footer)}</td></tr>
</table></td></tr></table></body></html>`;
}

const p = (s: string) => `<p style="margin:0 0 14px;line-height:1.55;font-size:15px">${s}</p>`;
const button = (url: string, label: string) =>
  `<p style="margin:22px 0"><a href="${esc(url)}" style="background:#8f6418;color:#ffffff;text-decoration:none;padding:12px 20px;border-radius:6px;font-weight:600;display:inline-block">${esc(label)}</a></p>
<p style="margin:0 0 14px;font-size:12px;color:#665d4e;word-break:break-all">Or paste this link into your browser: ${esc(url)}</p>`;

export interface Rendered {
  subject: string;
  text: string;
  html: string;
}

export function otpEmail(name: string, code: string, minutes: number): Rendered {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${BRAND}: your verification code`,
    text: `Hello ${name},\n\nYour Hamsavahin verification code is ${spaced}.\nIt expires in ${minutes} minutes and can be used once.\n\nIf you did not request this, ignore this email.\n`,
    html: layout("Verify your email", p(`Hello ${esc(name)},`) + p("Use this code to verify your email address and activate your account:") +
      `<p style="margin:18px 0;font-size:32px;letter-spacing:6px;font-weight:700;font-family:Consolas,monospace">${esc(spaced)}</p>` +
      p(`It expires in <strong>${minutes} minutes</strong> and can be used only once.`)),
  };
}

export function loginCodeEmail(name: string, code: string, minutes: number): Rendered {
  const spaced = `${code.slice(0, 3)} ${code.slice(3)}`;
  return {
    subject: `${BRAND}: your sign-in code`,
    text: `Hello ${name},\n\nYour Hamsavahin sign-in code is ${spaced}.\nIt expires in ${minutes} minutes and can be used once.\n\nIf you did not try to sign in, change your password now and tell your administrator.\n`,
    html: layout("Your sign-in code", p(`Hello ${esc(name)},`) + p("Use this code to finish signing in to the Hamsavahin admin:") +
      `<p style="margin:18px 0;font-size:32px;letter-spacing:6px;font-weight:700;font-family:Consolas,monospace">${esc(spaced)}</p>` +
      p(`It expires in <strong>${minutes} minutes</strong> and can be used only once.`) + p("<strong>If you did not try to sign in, change your password now and tell your administrator.</strong>")),
  };
}

export function invitationEmail(name: string, activateUrl: string, days: number): Rendered {
  return {
    subject: `You have been invited to the ${BRAND} admin`,
    text: `Hello ${name},\n\nYou have been invited to the Hamsavahin admin.\nOpen the link below, confirm your email with a one-time code, and choose your password (the invitation is valid for ${days} days):\n${activateUrl}\n`,
    html: layout("You are invited", p(`Hello ${esc(name)},`) + p("An administrator has invited you to the Hamsavahin admin. Verify your email with a one-time code, then choose your password.") +
      button(activateUrl, "Activate my account") + p(`This invitation is valid for ${days} days.`)),
  };
}

export function passwordResetEmail(name: string, resetUrl: string, minutes: number): Rendered {
  return {
    subject: `Reset your ${BRAND} admin password`,
    text: `Hello ${name},\n\nUse this link to reset your password (valid for ${minutes} minutes, single use):\n${resetUrl}\n\nIf you did not request this, ignore this email; your password has not been changed.\n`,
    html: layout("Reset your password", p(`Hello ${esc(name)},`) + p("We received a request to reset your password.") + button(resetUrl, "Choose a new password") +
      p(`The link is valid for <strong>${minutes} minutes</strong> and works once. If you did not ask for this, your password has not been changed.`)),
  };
}

export type SecurityNotice = "password_changed" | "password_reset_done" | "account_activated";
const NOTICE: Record<SecurityNotice, { subject: string; line: string }> = {
  password_changed: { subject: "Your password was changed", line: "The password for your Hamsavahin admin account was changed." },
  password_reset_done: { subject: "Your password was reset", line: "Your password was reset and all your sessions were signed out." },
  account_activated: { subject: "Your account is active", line: "Your Hamsavahin admin account was activated and your password was set." },
};

export function securityNoticeEmail(name: string, kind: SecurityNotice): Rendered {
  const n = NOTICE[kind];
  return {
    subject: `${BRAND}: ${n.subject}`,
    text: `Hello ${name},\n\n${n.line}\n\nIf this was not you, contact your administrator immediately.\n`,
    html: layout(n.subject, p(`Hello ${esc(name)},`) + p(esc(n.line)) + p("<strong>If this was not you, contact your administrator immediately.</strong>")),
  };
}

/**
 * "We received your request" confirmations for the three public website forms. They only repeat what the visitor typed, escaped, and the
 * subject is fixed (never built from visitor text). The footer says why the email arrived, because the address was typed into a public form.
 */
const FORM_FOOTER = "You received this email because this address was entered on a form at our website. If that was not you, you can ignore it.";
const row = (label: string, value: string) => `<tr><td style="padding:6px 12px 6px 0;color:#665d4e;font-size:14px;vertical-align:top">${esc(label)}</td><td style="padding:6px 0;font-size:14px"><strong>${esc(value)}</strong></td></tr>`;
const summary = (rows: [string, string][]) => `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px">${rows.map(([l, v]) => row(l, v)).join("")}</table>`;
const textRows = (rows: [string, string][]) => rows.map(([l, v]) => `${l}: ${v}`).join("\n");

export function enquiryReceivedEmail(name: string, subject: string): Rendered {
  const rows: [string, string][] = [["Subject", subject]];
  return {
    subject: `We received your message | ${BRAND}`,
    text: `Hello ${name},\n\nThank you for contacting ${BRAND}. We have received your message and a member of our team will reply by email.\n\n${textRows(rows)}\n\n${FORM_FOOTER}\n`,
    html: layout("We received your message", p(`Hello ${esc(name)},`) + p(`Thank you for contacting ${esc(BRAND)}. We have received your message and a member of our team will reply by email.`) + summary(rows), FORM_FOOTER),
  };
}

export function rfqReceivedEmail(name: string, d: { reference: string; requirement: string; quantity: string; incoterm: string; deliveryPort: string }): Rendered {
  const rows: [string, string][] = [["Reference", d.reference], ["Material", d.requirement], ["Quantity", d.quantity], ["Incoterm", d.incoterm], ["Delivery port", d.deliveryPort]];
  return {
    subject: `We received your quotation request ${d.reference} | ${BRAND}`,
    text: `Hello ${name},\n\nThank you. We have received your request for a quotation. Please quote the reference below if you write to us about it.\n\n${textRows(rows)}\n\nOur team will review it and reply by email with availability and pricing.\n\n${FORM_FOOTER}\n`,
    html: layout("We received your quotation request", p(`Hello ${esc(name)},`) + p("Thank you. We have received your request for a quotation. Please quote the reference below if you write to us about it.") + summary(rows) +
      p("Our team will review it and reply by email with availability and pricing."), FORM_FOOTER),
  };
}

export function applicationReceivedEmail(name: string, position: string): Rendered {
  const rows: [string, string][] = [["Position", position]];
  return {
    subject: `We received your application | ${BRAND}`,
    text: `Hello ${name},\n\nThank you for applying to ${BRAND}. We have received your application and will contact you if your profile matches the role.\n\n${textRows(rows)}\n\n${FORM_FOOTER}\n`,
    html: layout("We received your application", p(`Hello ${esc(name)},`) + p(`Thank you for applying to ${esc(BRAND)}. We have received your application and will contact you if your profile matches the role.`) + summary(rows), FORM_FOOTER),
  };
}
