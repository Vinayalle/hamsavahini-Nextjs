import { ACTIONS, ACTION_LABEL, MODULES, QUICK_ACTIONS, RESOURCES, WIDGETS } from "@/lib/authz/catalog";
import { json, requireSession, route } from "@/server/http";

export const dynamic = "force-dynamic";

export const GET = route(async (request) => {
  await requireSession(request);
  return json({
    actions: ACTIONS.map((key) => ({ key, label: ACTION_LABEL[key] })),
    modules: MODULES,
    resources: RESOURCES,
    widgets: WIDGETS.map(({ key, label, requires, kind }) => ({ key, label, requires, kind })),
    quickActions: QUICK_ACTIONS.map(({ key, label, requires }) => ({ key, label, requires })),
  });
});
