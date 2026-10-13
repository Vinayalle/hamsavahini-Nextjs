"use client";

import Link from "next/link";
import { useId, useRef, useState, type FormEvent, type ReactNode } from "react";
import { LuCircleCheck, LuLoaderCircle, LuSend } from "react-icons/lu";

/**
 * The public forms. They post to /api/public/* (see src/server/services/submissions.ts for the rules), show the server's per-field messages,
 * block double submits, and include the hidden "website" field that only bots fill in.
 */
type Errors = Record<string, string>;
type Phase = { kind: "idle" } | { kind: "sending" } | { kind: "done"; reference?: string };

const input = "w-full rounded-xl border border-neutral-300 bg-white px-4 text-base text-neutral-900 placeholder:text-neutral-400 transition focus:border-[var(--brand-red)] focus:outline-none focus:ring-4 focus:ring-red-500/15 aria-[invalid=true]:border-red-600 disabled:bg-neutral-100";

function Field({ label, error, required, hint, children }: { label: string; name?: string; error?: string; required?: boolean; hint?: string; children: (p: { id: string; describedBy?: string; invalid: boolean }) => ReactNode }) {
  const id = useId();
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-bold text-neutral-800">{label}{required && <span className="text-[var(--brand-red)]" aria-hidden> *</span>}</label>
      {children({ id, describedBy, invalid: !!error })}
      {error ? <p id={`${id}-error`} role="alert" className="mt-1.5 text-sm text-red-700">{error}</p> : hint ? <p id={`${id}-hint`} className="mt-1.5 text-sm text-neutral-500">{hint}</p> : null}
    </div>
  );
}

function Honeypot() {
  return (
    <div aria-hidden className="absolute -left-[9999px] top-auto h-px w-px overflow-hidden">
      <label>Leave this field empty<input type="text" name="website" tabIndex={-1} autoComplete="off" /></label>
    </div>
  );
}

function Consent({ error }: { error?: string }) {
  const id = useId();
  return (
    <div>
      <label htmlFor={id} className="flex cursor-pointer items-start gap-3 text-sm leading-6 text-neutral-700">
        <input id={id} type="checkbox" name="consent" required aria-invalid={!!error} className="mt-1 size-5 shrink-0 cursor-pointer rounded border-neutral-300 accent-[var(--brand-red)]" />
        <span>I agree that my details are used to reply to this request, as described in the <Link href="/privacy-policy" className="font-bold text-[var(--brand-red)] underline">privacy policy</Link>.</span>
      </label>
      {error && <p role="alert" className="mt-1.5 text-sm text-red-700">{error}</p>}
    </div>
  );
}

function SubmitButton({ sending, disabled, children }: { sending: boolean; disabled?: boolean; children: ReactNode }) {
  return (
    <button type="submit" disabled={sending || disabled} aria-busy={sending || undefined} className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--brand-red)] px-8 py-4 text-base font-bold text-white shadow-lg shadow-red-500/25 transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-70">
      {sending ? <LuLoaderCircle className="size-5 animate-spin" aria-hidden /> : <LuSend className="size-5" aria-hidden />}
      {sending ? "Sending…" : children}
    </button>
  );
}

function Success({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div role="status" className="rounded-3xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <span className="mx-auto mb-4 flex size-14 items-center justify-center rounded-full bg-emerald-600 text-white"><LuCircleCheck className="size-8" aria-hidden /></span>
      <h3 className="text-2xl font-bold text-emerald-900">{title}</h3>
      <div className="mx-auto mt-2 max-w-md text-emerald-900/80">{children}</div>
    </div>
  );
}

/** Shared submit logic: posts, maps every kind of failure to a clear message, never leaves the button stuck. */
function useSubmit(endpoint: string) {
  const [phase, setPhase] = useState<Phase>({ kind: "idle" });
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState("");
  const busy = useRef(false);

  async function submit(e: FormEvent<HTMLFormElement>, build: (form: HTMLFormElement) => { body: BodyInit; json: boolean }) {
    e.preventDefault();
    if (busy.current) return;
    busy.current = true;
    setErrors({});
    setFormError("");
    setPhase({ kind: "sending" });
    try {
      const { body, json } = build(e.currentTarget);
      const res = await fetch(endpoint, { method: "POST", headers: json ? { "Content-Type": "application/json" } : undefined, body, credentials: "same-origin" });
      const data = (await res.json().catch(() => null)) as { reference?: string; error?: { message?: string; fields?: Errors } } | null;
      if (res.ok) {
        setPhase({ kind: "done", reference: data?.reference });
        return;
      }
      setPhase({ kind: "idle" });
      if (res.status === 422 && data?.error?.fields) {
        setErrors(data.error.fields);
        setFormError("Please check the highlighted fields.");
      } else if (res.status === 429) {
        setFormError("You have sent several messages in a short time. Please wait a little and try again.");
      } else {
        setFormError(data?.error?.message ?? "Something went wrong. Please try again.");
      }
    } catch {
      setPhase({ kind: "idle" });
      setFormError("We could not reach the server. Please check your connection and try again.");
    } finally {
      busy.current = false;
    }
  }
  return { phase, errors, formError, submit };
}

const val = (f: FormData, k: string) => (typeof f.get(k) === "string" ? (f.get(k) as string) : "");

/* ───────────── contact ───────────── */
export function ContactForm({ source = "contact_page", defaultSubject = "" }: { source?: "contact_page" | "footer_form" | "product_page"; defaultSubject?: string }) {
  const { phase, errors, formError, submit } = useSubmit("/api/public/enquiries");
  if (phase.kind === "done") return <Success title="Thank you, we have your message">We will read it and reply by email as soon as we can.</Success>;
  const sending = phase.kind === "sending";
  return (
    <form noValidate onSubmit={(e) => submit(e, (form) => { const f = new FormData(form); return { json: true, body: JSON.stringify({ name: val(f, "name"), email: val(f, "email"), phone: val(f, "phone"), company: val(f, "company"), subject: val(f, "subject"), message: val(f, "message"), source, consent: f.get("consent") === "on", website: val(f, "website") }) }; })} className="relative space-y-5" aria-label="Contact form">
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="name" required error={errors.name}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="name" type="text" autoComplete="name" required maxLength={100} className={`${input} h-12`} />}</Field>
        <Field label="Email" name="email" required error={errors.email}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="email" type="email" autoComplete="email" required maxLength={160} className={`${input} h-12`} />}</Field>
        <Field label="Phone" name="phone" error={errors.phone}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="phone" type="tel" autoComplete="tel" maxLength={30} className={`${input} h-12`} />}</Field>
        <Field label="Company" name="company" error={errors.company}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="company" type="text" autoComplete="organization" maxLength={120} className={`${input} h-12`} />}</Field>
      </div>
      <Field label="Subject" name="subject" required error={errors.subject}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="subject" type="text" required maxLength={150} defaultValue={defaultSubject} className={`${input} h-12`} />}</Field>
      <Field label="Message" name="message" required error={errors.message} hint="Tell us the mineral, quantity and where it needs to go, if you know.">{(p) => <textarea {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="message" required rows={6} maxLength={4000} className={`${input} py-3 leading-7`} />}</Field>
      <Consent error={errors.consent} />
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{formError}</p>}
      <SubmitButton sending={sending}>Send message</SubmitButton>
    </form>
  );
}

/* ───────────── request for quotation ───────────── */
const UNITS = ["MT", "DMT", "kg", "pcs"];
const INCOTERMS = ["EXW", "FCA", "FOB", "CFR", "CIF", "CIP", "DAP", "DDP"];
export function RfqForm({ defaultRequirement = "" }: { defaultRequirement?: string }) {
  const { phase, errors, formError, submit } = useSubmit("/api/public/rfqs");
  if (phase.kind === "done") {
    return (
      <Success title="Your request has been received">
        <p>Our team will review it and come back with a quotation.</p>
        {phase.reference && <p className="mt-4">Your reference: <strong className="rounded-lg bg-white px-3 py-1 font-mono text-emerald-900">{phase.reference}</strong></p>}
        <p className="mt-3 text-sm">Please keep this reference if you contact us about this request.</p>
      </Success>
    );
  }
  const sending = phase.kind === "sending";
  const select = (name: string, label: string, options: string[], error?: string, required = true) => (
    <Field label={label} name={name} required={required} error={error}>{(p) => (
      <select {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name={name} required={required} defaultValue="" className={`${input} h-12 cursor-pointer`}>
        <option value="" disabled>Choose…</option>
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    )}</Field>
  );
  const text = (name: string, label: string, error?: string, extra: { type?: string; required?: boolean; auto?: string; defaultValue?: string; hint?: string; max?: number } = {}) => (
    <Field label={label} name={name} required={extra.required ?? true} error={error} hint={extra.hint}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name={name} type={extra.type ?? "text"} required={extra.required ?? true} autoComplete={extra.auto} defaultValue={extra.defaultValue} maxLength={extra.max ?? 150} className={`${input} h-12`} />}</Field>
  );
  return (
    <form noValidate onSubmit={(e) => submit(e, (form) => { const f = new FormData(form); return { json: true, body: JSON.stringify({ companyName: val(f, "companyName"), contactName: val(f, "contactName"), email: val(f, "email"), phone: val(f, "phone"), country: val(f, "country"), requirement: val(f, "requirement"), quantity: val(f, "quantity"), quantityUnit: val(f, "quantityUnit"), targetPrice: val(f, "targetPrice"), incoterm: val(f, "incoterm"), deliveryPort: val(f, "deliveryPort"), message: val(f, "message"), consent: f.get("consent") === "on", website: val(f, "website") }) }; })} className="relative space-y-6" aria-label="Request a quotation">
      <Honeypot />
      <fieldset className="space-y-5"><legend className="mb-1 text-lg font-bold text-neutral-900">About you</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("companyName", "Company name", errors.companyName, { auto: "organization" })}
          {text("contactName", "Your name", errors.contactName, { auto: "name", max: 100 })}
          {text("email", "Email", errors.email, { type: "email", auto: "email", max: 160 })}
          {text("phone", "Phone", errors.phone, { type: "tel", auto: "tel", max: 30 })}
          {text("country", "Country", errors.country, { auto: "country-name", max: 80 })}
        </div>
      </fieldset>
      <fieldset className="space-y-5"><legend className="mb-1 text-lg font-bold text-neutral-900">What you need</legend>
        <div className="grid gap-5 sm:grid-cols-2">
          {text("requirement", "Mineral / product", errors.requirement, { defaultValue: defaultRequirement, max: 300 })}
          <div className="grid grid-cols-[1fr_7rem] gap-3">
            {text("quantity", "Quantity", errors.quantity, { type: "number", max: 20 })}
            {select("quantityUnit", "Unit", UNITS, errors.quantityUnit)}
          </div>
          {select("incoterm", "Incoterm", INCOTERMS, errors.incoterm)}
          {text("deliveryPort", "Delivery port", errors.deliveryPort, { max: 120 })}
          {text("targetPrice", "Target price (optional)", errors.targetPrice, { required: false, max: 60, hint: "For example: USD 95 per MT" })}
        </div>
        <Field label="Specification and other details" name="message" error={errors.message} hint="Grade, size, moisture, packaging, shipment schedule and anything else that matters.">{(p) => <textarea {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="message" rows={5} maxLength={4000} className={`${input} py-3 leading-7`} />}</Field>
      </fieldset>
      <Consent error={errors.consent} />
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{formError}</p>}
      <SubmitButton sending={sending}>Request quotation</SubmitButton>
    </form>
  );
}

/* ───────────── job application ───────────── */
const MAX_RESUME = 5 * 1024 * 1024;
export function ApplyForm({ slug, title }: { slug: string; title: string }) {
  const { phase, errors, formError, submit } = useSubmit("/api/public/applications");
  const [fileError, setFileError] = useState("");
  if (phase.kind === "done") return <Success title="Application received">Thank you for applying for {title}. Our team will review it and get in touch if your profile fits.</Success>;
  const sending = phase.kind === "sending";
  return (
    <form noValidate onSubmit={(e) => submit(e, (form) => {
      const f = new FormData(form);
      f.set("careerSlug", slug);
      f.set("consent", f.get("consent") === "on" ? "true" : "false");
      const file = f.get("resume");
      if (file instanceof File && file.size === 0) f.delete("resume");
      return { json: false, body: f };
    })} className="relative space-y-5" aria-label={`Apply for ${title}`}>
      <Honeypot />
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Your name" name="applicantName" required error={errors.applicantName}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="applicantName" type="text" autoComplete="name" required maxLength={100} className={`${input} h-12`} />}</Field>
        <Field label="Email" name="email" required error={errors.email}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="email" type="email" autoComplete="email" required maxLength={160} className={`${input} h-12`} />}</Field>
        <Field label="Phone" name="phone" required error={errors.phone}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="phone" type="tel" autoComplete="tel" required maxLength={30} className={`${input} h-12`} />}</Field>
        <Field label="Years of experience" name="experienceYears" required error={errors.experienceYears}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="experienceYears" type="number" min={0} max={60} step={1} required className={`${input} h-12`} />}</Field>
        <Field label="Current company" name="currentCompany" error={errors.currentCompany}>{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="currentCompany" type="text" autoComplete="organization" maxLength={120} className={`${input} h-12`} />}</Field>
        <Field label="Resume (optional)" name="resume" error={fileError || errors.resume} hint="PDF or Word document, up to 5 MB.">{(p) => <input {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="resume" type="file" accept=".pdf,.doc,.docx,application/pdf" onChange={(e) => setFileError((e.target.files?.[0]?.size ?? 0) > MAX_RESUME ? "This file is larger than 5 MB." : "")} className={`${input} cursor-pointer py-2.5 file:mr-4 file:cursor-pointer file:rounded-lg file:border-0 file:bg-red-50 file:px-4 file:py-2 file:font-bold file:text-red-700`} />}</Field>
      </div>
      <Field label="Cover note" name="coverNote" error={errors.coverNote} hint="A few lines about why you are a good fit.">{(p) => <textarea {...p} aria-describedby={p.describedBy} aria-invalid={p.invalid} name="coverNote" rows={5} maxLength={4000} className={`${input} py-3 leading-7`} />}</Field>
      <Consent error={errors.consent} />
      {formError && <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm font-medium text-red-800">{formError}</p>}
      <SubmitButton sending={sending} disabled={!!fileError}>Submit application</SubmitButton>
    </form>
  );
}
