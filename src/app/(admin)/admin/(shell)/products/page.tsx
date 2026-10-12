"use client";

import Link from "next/link";
import { Archive, CheckCircle2, FileEdit, Package, Plus, Star } from "lucide-react";
import { LinkButton } from "@/components/ui/button";
import { PageHeader, StatCard } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { useAll } from "@/hooks/use-resource";
import { categoryService, productService } from "@/lib/services";
import { formatDate } from "@/lib/utils";
import type { Product } from "@/types/entities";

export default function ProductsPage() {
  const products = useAll(productService);
  const categories = useAll(categoryService);
  const catName = (id: string) => categories.find((c) => c.id === id)?.name ?? "—";

  const columns: Column<Product>[] = [
    {
      key: "name", header: "Product", sortKey: "name",
      cell: (p) => (
        <div className="flex items-center gap-3">
          { }
          <img src={p.images.find((i) => i.isPrimary)?.url ?? p.images[0]?.url} alt="" className="size-10 shrink-0 rounded-md border border-line bg-canvas object-cover" />
          <div className="min-w-0">
            <Link href={`/admin/products/${p.id}`} className="block truncate font-medium text-ink hover:text-brand-600">{p.name}</Link>
            <span className="block truncate text-xs text-muted sm:hidden">{p.code}</span>
          </div>
        </div>
      ),
    },
    { key: "code", header: "Code", sortKey: "code", hideBelow: "sm", cell: (p) => <span className="font-mono text-xs text-muted">{p.code}</span> },
    { key: "category", header: "Category", hideBelow: "md", cell: (p) => catName(p.categoryId) },
    { key: "status", header: "Status", sortKey: "status", cell: (p) => <StatusBadge status={p.status} /> },
    {
      key: "featured", header: "Featured", sortKey: "featured", hideBelow: "lg",
      cell: (p) => p.featured ? <Star className="size-4 fill-amber-400 text-amber-400" aria-label="Featured" /> : <span className="text-faint">—</span>,
    },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (p) => <span className="text-muted">{formatDate(p.updatedAt)}</span> },
  ];

  const addButton = (
    <LinkButton href="/admin/products/new"><Plus className="size-4" /> Add product</LinkButton>
  );

  return (
    <>
      <PageHeader title="All Products" description="Manage the product catalogue shown on the public website." actions={addButton} />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
        <StatCard label="Total products" value={products.length} icon={Package} />
        <StatCard label="Published" value={products.filter((p) => p.status === "published").length} icon={CheckCircle2} tone="success" />
        <StatCard label="Draft" value={products.filter((p) => p.status === "draft").length} icon={FileEdit} tone="warn" />
        <StatCard label="Featured" value={products.filter((p) => p.featured).length} icon={Star} tone="info" />
        <StatCard label="Archived" value={products.filter((p) => p.status === "archived").length} icon={Archive} tone="neutral" />
      </div>

      <ResourceList
        service={productService}
        entityLabel="product"
        nameOf={(p) => p.name}
        columns={columns}
        selectable
        archivable
        defaultSort={{ by: "updatedAt", dir: "desc" }}
        searchPlaceholder="Search by name or code…"
        viewHref={(p) => `/admin/products/${p.id}`}
        editHref={(p) => `/admin/products/${p.id}/edit`}
        statuses={[{ value: "published" }, { value: "draft" }]}
        currentStatus={(p) => p.status}
        emptyAction={addButton}
        filters={[
          { key: "categoryId", label: "Category", options: categories.map((c) => ({ value: c.id, label: c.name })) },
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "featured", label: "Featured", options: [{ value: "true", label: "Featured" }, { value: "false", label: "Not featured" }] },
        ]}
      />
    </>
  );
}
