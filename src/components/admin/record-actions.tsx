"use client";

import { useRouter } from "next/navigation";
import { Archive, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button, LinkButton } from "@/components/ui/button";
import type { CrudService } from "@/lib/mock/collection";
import type { BaseEntity } from "@/types/common";
import { useConfirm } from "./dialogs";
import { statusLabel } from "./status-badge";

/**
 * Standard header actions for a detail page: status transitions, archive, delete, edit.
 * Every destructive or visibility-changing action goes through a confirmation dialog.
 */
export function RecordActions<T extends BaseEntity>({
  service, record, name, entityLabel, listHref, editHref, status, transitions, archivable = true,
}: {
  service: CrudService<T>; record: T; name: string; entityLabel: string; listHref: string; editHref: string;
  status: string; transitions: { value: string; label: string }[]; archivable?: boolean;
}) {
  const confirm = useConfirm();
  const router = useRouter();

  const change = async (value: string, label: string) => {
    if (!(await confirm({ title: `${label}?`, description: `“${name}” will be marked as ${statusLabel(value).toLowerCase()}.`, confirmLabel: label }))) return;
    await service.setStatus(record.id, value);
    toast.success(`Status updated to ${statusLabel(value)}`);
  };
  const archive = async () => {
    if (!(await confirm({ title: `Archive ${entityLabel}?`, description: `“${name}” will be hidden from the website.`, confirmLabel: "Archive" }))) return;
    await service.archive(record.id);
    toast.success(`${name} archived`);
  };
  const remove = async () => {
    if (!(await confirm({ title: `Delete ${entityLabel}?`, description: `“${name}” will be permanently deleted. This cannot be undone.`, confirmLabel: "Delete", destructive: true }))) return;
    await service.remove(record.id);
    toast.success(`${name} deleted`);
    router.replace(listHref);
  };

  return (
    <>
      {transitions.filter((t) => t.value !== status).map((t) => (
        <Button key={t.value} variant="secondary" onClick={() => void change(t.value, t.label)}>{t.label}</Button>
      ))}
      {archivable && status !== "archived" && <Button variant="secondary" onClick={() => void archive()}><Archive className="size-4" /> Archive</Button>}
      <Button variant="secondary" onClick={() => void remove()}><Trash2 className="size-4 text-danger-600" /> Delete</Button>
      <LinkButton href={editHref}><Pencil className="size-4" /> Edit</LinkButton>
    </>
  );
}
