import "server-only";
import { after } from "next/server";
import { getDb } from "./db";
import { getMailer, type MailResult } from "./mail";
import { securityNoticeEmail, type Rendered, type SecurityNotice } from "./mail-templates";

/** Sends a rendered message and records the OUTCOME in NotificationLog (never the body, so no code or link is stored). */
export async function deliver(templateKey: string, to: string, message: Rendered): Promise<MailResult> {
  const result = await getMailer().send({ to, subject: message.subject, text: message.text, html: message.html });
  try {
    await getDb().notificationLog.create({
      data: {
        templateKey, recipient: to, subject: message.subject, status: result.delivered ? "sent" : "failed",
        error: result.delivered ? null : result.error ?? "not delivered", attempts: 1,
        providerMessageId: result.providerMessageId ?? null, sentAt: result.delivered ? new Date() : null,
      },
    });
  } catch {
    /* logging must never break the flow */
  }
  return result;
}

/**
 * Runs an email send AFTER the response has been written. Public endpoints that must answer identically whether or not an
 * account exists use this so the (slow) SMTP exchange cannot be timed to tell the two cases apart.
 * Tests run it inline so assertions can see the message.
 */
export async function deferDelivery(task: () => Promise<unknown>): Promise<void> {
  if (process.env.NODE_ENV === "test") {
    await task();
    return;
  }
  const guarded = () => task().catch(() => undefined);
  try {
    after(guarded);
  } catch {
    void guarded(); // not inside a request scope (scripts): fire and forget
  }
}

/** Best-effort security notice; failures are recorded but never block the security action itself. */
export async function sendSecurityNotice(user: { name: string; email: string }, kind: SecurityNotice): Promise<void> {
  try {
    await deliver(`security_${kind}`, user.email, securityNoticeEmail(user.name, kind));
  } catch {
    /* ignore */
  }
}
