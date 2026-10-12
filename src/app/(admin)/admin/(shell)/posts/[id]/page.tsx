"use client";

import { useParams } from "next/navigation";
import { Card, CardHeader } from "@/components/ui/card";
import { NotFoundRecord, PageHeader } from "@/components/admin/page-parts";
import { StatusBadge } from "@/components/admin/status-badge";
import { DetailList } from "@/components/admin/detail-parts";
import { RecordActions } from "@/components/admin/record-actions";
import { SafeHtml } from "@/components/admin/safe-html";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { useRecord } from "@/hooks/use-resource";
import { postService } from "@/lib/services";
import { formatDate } from "@/lib/utils";

export default function PostDetailPage() {
  const { id } = useParams<{ id: string }>();
  const post = useRecord(postService, id);
  useBreadcrumbLabel(post?.title);
  if (!post) return <NotFoundRecord what="Post" backHref="/admin/posts" backLabel="Back to posts" service={postService} />;

  return (
    <>
      <PageHeader
        title={post.title}
        description={`${post.category} · by ${post.author}`}
        actions={
          <RecordActions service={postService} record={post} name={post.title} entityLabel="post" listHref="/admin/posts"
            editHref={`/admin/posts/${post.id}/edit`} status={post.status}
            transitions={[{ value: "published", label: "Publish" }, { value: "draft", label: "Move to draft" }]} />
        }
      />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          {post.coverImage && <img src={post.coverImage} alt="" className="aspect-[16/6] w-full rounded-t-xl object-cover" />}
          <div className="p-6">
            <p className="mb-4 text-base font-medium text-ink">{post.excerpt}</p>
            <SafeHtml html={post.content} />
          </div>
        </Card>
        <div className="space-y-6">
          <Card>
            <CardHeader title="Publishing" />
            <div className="p-5">
              <DetailList items={[
                { label: "Status", value: <StatusBadge status={post.status} /> },
                { label: "Published", value: formatDate(post.publishedAt) },
                { label: "Updated", value: formatDate(post.updatedAt, true) },
                { label: "Slug", value: <code className="text-xs">{post.slug}</code> },
                { label: "Tags", value: post.tags.join(", ") },
              ]} />
            </div>
          </Card>
          <Card>
            <CardHeader title="SEO" />
            <div className="p-5">
              <DetailList items={[
                { label: "Meta title", value: post.seo.metaTitle },
                { label: "Meta description", value: post.seo.metaDescription },
                { label: "Keywords", value: post.seo.keywords.join(", ") },
              ]} />
            </div>
          </Card>
        </div>
      </div>
    </>
  );
}
