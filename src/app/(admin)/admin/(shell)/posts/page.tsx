"use client";

import Link from "next/link";
import { LuPlus as Plus } from "react-icons/lu";
import { LinkButton } from "@/components/ui/button";
import { PageHeader } from "@/components/admin/page-parts";
import { ResourceList } from "@/components/admin/resource-list";
import { StatusBadge } from "@/components/admin/status-badge";
import type { Column } from "@/components/admin/data-table";
import { formatDate } from "@/lib/utils";
import { postService } from "@/lib/services";
import type { Post } from "@/types/entities";

const columns: Column<Post>[] = [
  { key: "title", header: "Title", sortKey: "title", cell: (p) => (<div className="min-w-0"><Link href={`/admin/posts/${p.id}`} className="block max-w-md truncate font-medium text-ink hover:text-brand-600">{p.title}</Link><span className="text-xs text-muted">{p.author}</span></div>) },
  { key: "category", header: "Category", sortKey: "category", hideBelow: "md", cell: (p) => p.category },
  { key: "status", header: "Status", sortKey: "status", cell: (p) => <StatusBadge status={p.status} /> },
  { key: "published", header: "Published", sortKey: "publishedAt", hideBelow: "lg", cell: (p) => <span className="text-muted">{formatDate(p.publishedAt)}</span> },
  { key: "updated", header: "Updated", sortKey: "updatedAt", hideBelow: "lg", cell: (p) => <span className="text-muted">{formatDate(p.updatedAt)}</span> },
];

export default function PostsPage() {
  const add = <LinkButton href="/admin/posts/new"><Plus className="size-4" /> Create post</LinkButton>;
  return (
    <>
      <PageHeader title="Posts / Insights" description="Articles, market insights and company news for the website." actions={add} />
      <ResourceList service={postService} entityLabel="post" nameOf={(p) => p.title} columns={columns} selectable archivable
        defaultSort={{ by: "updatedAt", dir: "desc" }} searchPlaceholder="Search title, author or tag…"
        viewHref={(p) => `/admin/posts/${p.id}`} editHref={(p) => `/admin/posts/${p.id}/edit`}
        statuses={[{ value: "published" }, { value: "draft" }]} currentStatus={(p) => p.status} emptyAction={add}
        filters={[
          { key: "status", label: "Status", options: [{ value: "published", label: "Published" }, { value: "draft", label: "Draft" }, { value: "archived", label: "Archived" }] },
          { key: "category", label: "Category", options: ["Market Insight", "Company News", "Sustainability", "Industry Report"].map((v) => ({ value: v, label: v })) },
        ]} />
    </>
  );
}
