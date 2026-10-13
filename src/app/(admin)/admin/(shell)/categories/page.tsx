"use client";

import { useState } from "react";
import { LuPencil as Pencil, LuPlus as Plus } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { EntityFormDialog, type SectionDef, type Values } from "@/components/forms/entity-form";
import { useAll } from "@/hooks/use-resource";
import { categoryService, productService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { Category } from "@/types/entities";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export default function CategoriesPage() {
  const products = useAll(productService);
  const categories = useAll(categoryService);
  const [editing, setEditing] = useState<Category | "new" | null>(null);
  const current = editing && editing !== "new" ? editing : undefined;

  // A category cannot be its own ancestor: exclude itself and every descendant from the parent choices.
  const descendantIds = (rootId: string): Set<string> => {
    const out = new Set<string>([rootId]);
    let grew = true;
    while (grew) {
      grew = false;
      for (const c of categories) if (c.parentId && out.has(c.parentId) && !out.has(c.id)) { out.add(c.id); grew = true; }
    }
    return out;
  };
  const blocked = current ? descendantIds(current.id) : new Set<string>();

  const sections: SectionDef[] = [{
    title: "Category",
    fields: [
      { name: "name", label: "Name", type: "text", required: true },
      { name: "slug", label: "URL slug", type: "slug", required: true, slugFrom: "name" },
      { name: "parentId", label: "Parent category", type: "select", placeholder: "None (top level)", options: categories.filter((c) => !blocked.has(c.id)).map((c) => ({ value: c.id, label: c.name })) },
      { name: "sortOrder", label: "Display order", type: "number", required: true, min: 1, max: 999 },
      { name: "status", label: "Status", type: "select", required: true, options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }] },
      { name: "description", label: "Description", type: "textarea", wide: true },
    ],
  }];

  const columns: Column<Category>[] = [
    { key: "name", header: "Category", sortKey: "name", cell: (c) => (<div><span className="font-medium text-ink">{c.name}</span><span className="block text-xs text-muted">/{c.slug}</span></div>) },
    { key: "desc", header: "Description", hideBelow: "lg", cell: (c) => <span className="line-clamp-1 max-w-sm text-muted">{c.description}</span> },
    { key: "products", header: "Products", hideBelow: "sm", cell: (c) => products.filter((p) => p.categoryId === c.id).length },
    { key: "order", header: "Order", sortKey: "sortOrder", hideBelow: "md", cell: (c) => c.sortOrder },
    { key: "status", header: "Status", sortKey: "status", cell: (c) => <StatusBadge status={c.status} /> },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (c) => <span className="text-muted">{formatDate(c.updatedAt)}</span> },
  ];

  const save = async (v: Values) => {
    const payload = {
      name: str(v.name), slug: str(v.slug), description: str(v.description), parentId: str(v.parentId) || null,
      sortOrder: typeof v.sortOrder === "number" ? v.sortOrder : 1, status: str(v.status) as Category["status"],
    };
    if (current) await categoryService.update(current.id, payload);
    else await categoryService.create(payload);
    toast.success(current ? "Category updated" : "Category created");
    setEditing(null);
  };

  const add = <Button onClick={() => setEditing("new")}><Plus className="size-4" /> Add category</Button>;

  return (
    <>
      <PageHeader title="Categories" description="Organise products into categories for navigation and filtering." actions={add} />
      <ResourceList
        service={categoryService} entityLabel="category" nameOf={(c) => c.name} columns={columns} selectable archivable
        defaultSort={{ by: "sortOrder", dir: "asc" }} searchPlaceholder="Search categories…"
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(c) => c.status} emptyAction={add}
        extraRowActions={(c) => [{ label: "Edit", icon: Pencil, onSelect: () => setEditing(c) }]}
        deleteGuard={(c) => {
          const n = products.filter((p) => p.categoryId === c.id).length;
          if (n) return `${n} product${n > 1 ? "s" : ""} still use this category. Reassign them first or archive the category.`;
          return categories.some((x) => x.parentId === c.id) ? "It has child categories." : null;
        }}
        filters={[{ key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] }]}
      />
      <EntityFormDialog
        open={editing !== null}
        onOpenChange={(o) => !o && setEditing(null)}
        title={current ? "Edit category" : "Add category"}
        sections={sections}
        defaultValues={current ? { ...current, parentId: current.parentId ?? "" } : { name: "", slug: "", parentId: "", sortOrder: categories.length + 1, status: "draft", description: "" }}
        validate={(v) => {
          const out: Record<string, string> = {};
          if (categories.some((c) => c.id !== current?.id && c.slug === v.slug)) out.slug = "Another category uses this slug";
          if (v.parentId && blocked.has(String(v.parentId))) out.parentId = "A category cannot be placed under itself or its own sub-category";
          return out;
        }}
        submitLabel={current ? "Save changes" : "Create category"}
        onSubmit={save}
      />
    </>
  );
}
