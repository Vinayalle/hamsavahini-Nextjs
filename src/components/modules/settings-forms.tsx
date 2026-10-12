"use client";

import { toast } from "sonner";
import { PageHeader } from "@/components/admin/page-parts";
import { EntityForm, type SectionDef, type Values } from "@/components/forms/entity-form";
import { useSettings } from "@/hooks/use-resource";
import { settingsService } from "@/lib/services/settings";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const saved = () => toast.success("Settings saved", { description: "Stored in mock data for this session only." });

export function GeneralSettingsPage() {
  const { general } = useSettings();
  const sections: SectionDef[] = [
    { title: "Site Identity", description: "Basic information used across the public website.", fields: [
      { name: "siteName", label: "Site name", type: "text", required: true, maxLength: 60 },
      { name: "tagline", label: "Tagline", type: "text", maxLength: 120 },
      { name: "defaultLanguage", label: "Default language", type: "select", required: true, options: [{ value: "en", label: "English" }, { value: "hi", label: "Hindi" }, { value: "ar", label: "Arabic" }] },
      { name: "timezone", label: "Timezone", type: "select", required: true, options: ["Asia/Kolkata", "Asia/Dubai", "Europe/Amsterdam", "Asia/Singapore", "UTC"].map((v) => ({ value: v, label: v })) },
    ] },
    { title: "Availability", fields: [
      { name: "maintenanceMode", label: "Maintenance mode", type: "switch", wide: true, hint: "When on, visitors see a maintenance page instead of the website.", switchText: ["On — public site is offline", "Off — public site is live"] },
    ] },
  ];
  return (
    <>
      <PageHeader title="General Settings" description="Core website configuration." />
      <EntityForm
        key={JSON.stringify(general)} sections={sections} defaultValues={{ ...general }} submitLabel="Save settings"
        onSubmit={async (v: Values) => {
          await settingsService.updateSection("general", { siteName: str(v.siteName), tagline: str(v.tagline), defaultLanguage: str(v.defaultLanguage), timezone: str(v.timezone), maintenanceMode: !!v.maintenanceMode });
          saved();
        }}
      />
    </>
  );
}

export function SeoSettingsPage() {
  const { seo } = useSettings();
  const sections: SectionDef[] = [
    { title: "Search Defaults", description: "Fallbacks used when a page has no SEO of its own.", fields: [
      { name: "titleTemplate", label: "Title template", type: "text", required: true, hint: "Use %s where the page title goes, e.g. “%s | Hamsavahin”." },
      { name: "defaultDescription", label: "Default meta description", type: "textarea", required: true, maxLength: 160, wide: true, hint: "Up to 160 characters." },
      { name: "defaultOgImage", label: "Default social share image", type: "image" },
    ] },
    { title: "Indexing & Verification", fields: [
      { name: "robotsIndex", label: "Allow search engines to index the site", type: "switch", wide: true, switchText: ["Indexing allowed", "Hidden from search engines (noindex)"] },
      { name: "googleSiteVerification", label: "Google site verification code", type: "text" },
    ] },
  ];
  return (
    <>
      <PageHeader title="SEO Settings" description="Default metadata and indexing for the public website." />
      <EntityForm
        key={JSON.stringify(seo)} sections={sections} defaultValues={{ ...seo }} submitLabel="Save settings"
        validate={(v) => (str(v.titleTemplate).includes("%s") ? null : { titleTemplate: "Template must contain %s" })}
        onSubmit={async (v) => {
          await settingsService.updateSection("seo", { titleTemplate: str(v.titleTemplate), defaultDescription: str(v.defaultDescription), defaultOgImage: str(v.defaultOgImage), robotsIndex: !!v.robotsIndex, googleSiteVerification: str(v.googleSiteVerification) });
          saved();
        }}
      />
    </>
  );
}

export function ContactSettingsPage() {
  const { contact } = useSettings();
  const sections: SectionDef[] = [
    { title: "Contact Details", description: "Shown in the website header, footer and contact page.", fields: [
      { name: "primaryEmail", label: "Primary email", type: "email", required: true },
      { name: "primaryPhone", label: "Primary phone", type: "tel", required: true },
      { name: "address", label: "Registered address", type: "textarea", required: true, wide: true },
    ] },
    { title: "Social Links", description: "Leave blank to hide an icon.", fields: [
      { name: "linkedin", label: "LinkedIn", type: "url", placeholder: "https://linkedin.com/company/…" },
      { name: "twitter", label: "X / Twitter", type: "url" },
      { name: "facebook", label: "Facebook", type: "url" },
      { name: "youtube", label: "YouTube", type: "url" },
    ] },
  ];
  return (
    <>
      <PageHeader title="Contact Details & Social Links" description="How visitors reach and follow Hamsavahin." />
      <EntityForm
        key={JSON.stringify(contact)} sections={sections}
        defaultValues={{ primaryEmail: contact.primaryEmail, primaryPhone: contact.primaryPhone, address: contact.address, ...contact.socials }}
        submitLabel="Save settings"
        onSubmit={async (v) => {
          await settingsService.updateSection("contact", {
            primaryEmail: str(v.primaryEmail), primaryPhone: str(v.primaryPhone), address: str(v.address),
            socials: { linkedin: str(v.linkedin), twitter: str(v.twitter), facebook: str(v.facebook), youtube: str(v.youtube) },
          });
          saved();
        }}
      />
    </>
  );
}
