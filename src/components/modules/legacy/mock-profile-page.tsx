"use client";

import { LuShieldCheck as ShieldCheck } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/admin/page-parts";
import { ActivityTimeline, DetailList } from "@/components/admin/detail-parts";
import { EntityForm } from "@/components/forms/entity-form";
import { useAll } from "@/hooks/use-resource";
import { useAuth } from "@/lib/auth";
import { activityService, roleService, userService } from "@/lib/services";
import { formatDate, initials } from "@/lib/utils";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function MockProfilePage() {
  const { user } = useAuth();
  const users = useAll(userService);
  const roles = useAll(roleService);
  const activity = useAll(activityService);
  const me = users.find((u) => u.id === user?.id);
  if (!user || !me) return null;

  const mine = activity
    .filter((a) => a.actor === me.name)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6)
    .map((a) => ({ id: a.id, title: `${a.action.replace("_", " ")} ${a.entityType.toLowerCase()} · ${a.entityLabel}`, at: a.createdAt }));

  return (
    <>
      <PageHeader title="My Profile" description="Your account details within the admin." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <EntityForm
            key={me.updatedAt}
            sections={[{ title: "Profile Details", description: "Changing your email may require re-verification once real authentication is connected.", fields: [
              { name: "name", label: "Full name", type: "text", required: true },
              { name: "email", label: "Email", type: "email", required: true },
            ] }]}
            defaultValues={{ name: me.name, email: me.email }}
            validate={(v) => users.some((u) => u.id !== me.id && u.email.toLowerCase() === str(v.email).toLowerCase()) ? { email: "Another admin uses this email" } : null}
            submitLabel="Save profile"
            onSubmit={async (v) => {
              await userService.update(me.id, { name: str(v.name), email: str(v.email) });
              toast.success("Profile updated", { description: "Mock data only." });
            }}
          />
        </div>
        <div className="space-y-6">
          <Card>
            <div className="flex flex-col items-center p-6 text-center">
              <span className="flex size-16 items-center justify-center rounded-full bg-bark-800 text-xl font-semibold text-white">{initials(me.name)}</span>
              <p className="mt-3 font-semibold text-ink">{me.name}</p>
              <p className="inline-flex items-center gap-1 text-sm text-muted"><ShieldCheck className="size-4 text-brand-600" aria-hidden /> {roles.find((r) => r.id === me.roleId)?.name}</p>
            </div>
            <div className="border-t border-line p-5">
              <DetailList items={[
                { label: "Last login", value: formatDate(me.lastLoginAt, true) },
                { label: "Member since", value: formatDate(me.createdAt) },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Your recent activity" />
            <ActivityTimeline entries={mine} />
          </Card>
        </div>
      </div>
    </>
  );
}
