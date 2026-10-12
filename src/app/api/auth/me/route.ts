import { json, requireSession, route } from "@/server/http";
import { mfaStatus } from "@/server/mfa";

export const dynamic = "force-dynamic";

/**
 * Identity + effective permissions for the UI. The UI uses these only to shape navigation and controls;
 * the server re-checks every request, so tampering with this response gains nothing. No tokens or secrets are returned.
 */
export const GET = route(async (request) => {
  const s = await requireSession(request);
  const permissions: string[] = [];
  const scopes: Record<string, "assigned"> = {};
  for (const [key, grant] of s.access.grants) {
    permissions.push(key);
    if (grant.scope === "assigned") scopes[key] = "assigned";
  }
  return json({
    user: { id: s.user.id, name: s.user.name, email: s.user.email, employeeId: s.user.employeeId, role: s.roles.map((r) => r.name).join(", ") },
    roles: s.roles.map((r) => ({ id: r.id, name: r.name, code: r.code, status: r.status })),
    isSuperAdmin: s.access.isSuperAdmin,
    permissions,
    scopes,
    mfa: await mfaStatus(s.user.id),
    reauthWindowSeconds: Number(process.env.AUTH_REAUTH_WINDOW_SECONDS) || 300,
    authenticatedAt: s.authenticatedAt.toISOString(),
  });
});
