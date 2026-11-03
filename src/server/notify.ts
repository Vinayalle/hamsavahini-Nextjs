import "server-only";
import { after } from "next/server";
import { getDb } from "./db";
import { getMailer, type MailResult } from "./mail";
import { getNotificationAddress } from "./config";
import { securityNoticeEmail, type Rendered, type SecurityNotice } from "./mail-templates";

/** Sends a rendered message and records the OUTCOME in NotificationLog (never the body, so no code or link is stored). */
export async function deliver(templateKey: string, to: string, message: Rendered, replyTo?: string): Promise<MailResult> {
  const result = await getMailer().send({ to, subject: message.subject, text: message.text, html: message.html, ...(replyTo ? { replyTo } : {}) });
  // Say WHY a message was not sent, so a wrong mail setting is easy to find. Only the reason is printed: no address, no body, no password.
  if (!result.delivered && process.env.NODE_ENV !== "test") console.error(`[mail] "${templateKey}" was not delivered: ${result.error ?? "unknown reason"}`);
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

/**
 * Confirmation email to the person who filled in a public form. Sent after the response is written, so it never slows the form down,
 * and it can never make the form fail: a send problem is recorded in NotificationLog and nothing else happens.
 */
export async function sendFormConfirmation(templateKey: string, to: string, message: Rendered): Promise<void> {
  await deferDelivery(async () => {
    try {
      await deliver(templateKey, to, message);
    } catch {
      /* the submission is already saved; an email problem is not the visitor's problem */
    }
  });
}

/**
 * Tells the company mailbox (SMTP_USER) about something a visitor just submitted. Sent after the response, so it never slows the form,
 * and it can never make the form fail. Reply-To is the visitor, so answering the email answers them. Nothing is sent when no mailbox is configured.
 */
export async function sendStaffNotification(templateKey: string, message: Rendered, replyTo: string): Promise<void> {
  let to: string | null = null;
  try {
    to = getNotificationAddress();
  } catch {
    to = null;
  }
  if (!to) return;
  const address = to;
  await deferDelivery(async () => {
    try {
      await deliver(templateKey, address, message, replyTo);
    } catch {
      /* the submission is already saved */
    }
  });
}
