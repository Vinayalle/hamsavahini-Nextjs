"use client";

import Link from "next/link";
import { LuCircleCheck as CheckCircle2, LuEyeOff as EyeOff, LuPackage as Package, LuPlus as Plus } from "react-icons/lu";
import { LinkButton } from "@/components/ui/button";
import { Switch } from "@/components/ui/fields";
import { toast } from "@/lib/toast";
import { PageHeader, StatCard } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
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
    {
      key: "onWebsite", header: "On website", sortKey: "status",
      cell: (p) => (
        <div className="flex items-center gap-2.5">
          <Switch
            checked={p.status === "published"}
            label={`Show ${p.name} on the website`}
            onChange={async (on) => {
              try {
                await productService.update(p.id, { status: on ? "published" : "draft" });
                toast.success(on ? `${p.name} is now on the website` : `${p.name} is hidden from the website`);
              } catch (e) {
                toast.error("Could not change it", { description: e instanceof Error ? e.message : "Something went wrong" });
              }
            }}
          />
          <span className="hidden text-xs text-muted sm:inline">{p.status === "published" ? "Shown" : "Hidden"}</span>
        </div>
      ),
    },
    { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (p) => <span className="text-muted">{formatDate(p.updatedAt)}</span> },
  ];

  const addButton = (
    <LinkButton href="/admin/products/new"><Plus className="size-4" /> Add product</LinkButton>
  );

  return (
    <>
      <PageHeader title="All Products" description="Use the switch to show a product on the website or hide it. New products are shown straight away." actions={addButton} />

      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total products" value={products.length} icon={Package} />
        <StatCard label="On the website" value={products.filter((p) => p.status === "published").length} icon={CheckCircle2} tone="success" />
        <StatCard label="Hidden" value={products.filter((p) => p.status !== "published").length} icon={EyeOff} tone="warn" />
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
          { key: "status", label: "On website", options: [{ value: "published", label: "Shown" }, { value: "draft", label: "Hidden" }] },
        ]}
      />
    </>
  );
}
