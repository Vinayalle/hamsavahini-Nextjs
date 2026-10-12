"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { EntityForm, defaultsFor, type SectionDef, type Values } from "@/components/forms/entity-form";
import { NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { useRecord } from "@/hooks/use-resource";
import { isApiMode } from "@/lib/api/client";
import type { CrudService } from "@/lib/mock/collection";
import type { BaseEntity } from "@/types/common";

export interface RecordFormConfig<T extends BaseEntity> {
  service: CrudService<T>;
  entityLabel: string; // "post"
  listHref: string;
  listLabel: string;
  /** Where to go after saving. Defaults to the list. */
  afterSaveHref?: (saved: T) => string;
  sections: SectionDef[];
  nameOf: (r: T) => string;
  toValues: (r: T) => Values;
  toPayload: (v: Values, existing?: T) => Omit<T, keyof BaseEntity>;
  validate?: (v: Values, existing?: T) => Record<string, string> | null;
  createDescription?: string;
}

export function RecordFormPage<T extends BaseEntity>({ id, config }: { id?: string; config: RecordFormConfig<T> }) {
  const router = useRouter();
  const existing = useRecord(config.service, id ?? "");
  useBreadcrumbLabel(existing ? config.nameOf(existing) : undefined);

  if (id && !existing) {
    return <NotFoundRecord what={config.entityLabel[0].toUpperCase() + config.entityLabel.slice(1)} backHref={config.listHref} backLabel={`Back to ${config.listLabel}`} service={config.service} />;
  }

  const label = config.entityLabel;
  return (
    <>
      <PageHeader
        title={existing ? `Edit ${config.nameOf(existing)}` : `Add ${label}`}
        description={existing ? undefined : config.createDescription ?? `Fill in the details below to create a new ${label}.`}
      />
      <EntityForm
        key={existing?.id ?? "new"}
        sections={config.sections}
        defaultValues={existing ? config.toValues(existing) : defaultsFor(config.sections)}
        validate={(v) => config.validate?.(v, existing) ?? null}
        submitLabel={existing ? "Save changes" : `Create ${label}`}
        cancelHref={existing && config.afterSaveHref ? config.afterSaveHref(existing) : config.listHref}
        onSubmit={async (values) => {
          const payload = config.toPayload(values, existing);
          // Errors (including the server's field errors) propagate to EntityForm, which shows them and keeps the form as typed.
          const saved = existing ? await config.service.update(existing.id, payload as never) : await config.service.create(payload);
          toast.success(existing ? `${config.nameOf(saved)} updated` : `${config.nameOf(saved)} created`, {
            description: isApiMode ? "Saved to the database." : "Saved to mock data — not persisted to a server.",
          });
          router.push(config.afterSaveHref ? config.afterSaveHref(saved) : config.listHref);
        }}
      />
    </>
  );
}
