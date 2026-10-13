"use client";

import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuPlus as Plus, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input, Select, Switch, Textarea } from "@/components/ui/fields";
import { DocumentUploader, ImageUploader } from "@/components/forms/uploaders";
import { Field, FormActions, FormSection, TagInput } from "@/components/forms/form-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { useAll } from "@/hooks/use-resource";
import { categoryService, productService } from "@/lib/services";
import { slugify, uid } from "@/lib/utils";
import { ApiClientError, isApiMode } from "@/lib/api/client";
import type { Product } from "@/types/entities";

const schema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  code: z.string().trim().min(3, "Product code is required").regex(/^[A-Za-z0-9-]+$/, "Letters, numbers and hyphens only"),
  slug: z.string().trim().min(2, "Slug is required").regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens"),
  categoryId: z.string().min(1, "Choose a category"),
  shortDescription: z.string().trim().min(10, "Add a short summary (min 10 characters)").max(200, "Keep it under 200 characters"),
  description: z.string().trim().min(20, "Add a full description (min 20 characters)"),
  images: z.array(z.object({ id: z.string(), url: z.string(), alt: z.string(), isPrimary: z.boolean() })),
  specifications: z.array(z.object({
    id: z.string(),
    label: z.string().trim().min(1, "Required"),
    value: z.string().trim().min(1, "Required"),
    unit: z.string().optional(),
  })),
  documents: z.array(z.object({
    id: z.string(), name: z.string(), sizeBytes: z.number(),
    type: z.enum(["datasheet", "coa", "msds", "brochure", "other"]),
  })),
  seo: z.object({
    metaTitle: z.string().max(70, "Max 70 characters"),
    metaDescription: z.string().max(160, "Max 160 characters"),
    canonicalUrl: z.string().optional(),
    keywords: z.array(z.string()),
  }),
  status: z.enum(["draft", "published", "archived"]),
  featured: z.boolean(),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = {
  name: "", code: "", slug: "", categoryId: "", shortDescription: "", description: "",
  images: [], specifications: [], documents: [],
  seo: { metaTitle: "", metaDescription: "", canonicalUrl: "", keywords: [] },
  status: "draft", featured: false,
};

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const categories = useAll(categoryService);
  const products = useAll(productService);

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? {
          name: product.name, code: product.code, slug: product.slug, categoryId: product.categoryId,
          shortDescription: product.shortDescription, description: product.description,
          images: product.images, specifications: product.specifications, documents: product.documents,
          seo: { ...product.seo, canonicalUrl: product.seo.canonicalUrl ?? "" },
          status: product.status, featured: product.featured,
        }
      : EMPTY,
  });
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isDirty, isSubmitting } } = form;
  const specs = useFieldArray({ control, name: "specifications" });
  const { navigate, dialog } = useUnsavedChangesGuard(isDirty && !isSubmitting);
  const slugTouched = !!product;

  const onSubmit = async (v: Values) => {
    if (products.some((p) => p.id !== product?.id && p.code.toLowerCase() === v.code.toLowerCase())) {
      setError("code", { message: "Another product already uses this code" });
      return;
    }
    if (products.some((p) => p.id !== product?.id && p.slug === v.slug)) {
      setError("slug", { message: "Another product already uses this slug" });
      return;
    }
    const payload = {
      ...v,
      publishedAt: v.status === "published" ? product?.publishedAt ?? new Date().toISOString() : product?.publishedAt ?? null,
    };
    try {
      const saved = product ? await productService.update(product.id, payload) : await productService.create(payload);
      toast.success(product ? "Product updated" : "Product created", {
        description: isApiMode ? "Saved to the database." : "Saved to mock data — not persisted to a server.",
      });
      if (isApiMode && (v.images.length > 0 || v.documents.length > 0)) {
        toast.warning("Images and documents were not saved", { description: "File storage is not configured yet, so only the product details were stored." });
      }
      form.reset(v);
      router.push(`/admin/products/${saved.id}`);
    } catch (e) {
      // Surface the server's per-field validation (duplicate code/slug, bad category…) next to the inputs.
      if (e instanceof ApiClientError && e.fields) {
        const known = ["name", "code", "slug", "categoryId", "shortDescription", "description"] as const;
        let mapped = false;
        for (const k of known) if (e.fields[k]) { setError(k, { message: e.fields[k] }); mapped = true; }
        if (mapped) return void toast.error("Please fix the highlighted fields before saving.");
      }
      toast.error(e instanceof Error ? e.message : "Could not save product");
    }
  };

  const onInvalid = () => toast.error("Please fix the highlighted fields before saving.");
  const seoTitle = useWatch({ control, name: "seo.metaTitle" });
  const seoDesc = useWatch({ control, name: "seo.metaDescription" });

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      <FormSection title="1. Basic Information" description="Core product details shown on the catalogue.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" required error={errors.name?.message}>
            <Input
              id="name" aria-invalid={!!errors.name}
              {...register("name", {
                onChange: (e) => { if (!slugTouched && !form.getFieldState("slug").isDirty) setValue("slug", slugify(e.target.value), { shouldDirty: false }); },
              })}
            />
          </Field>
          <Field label="Product code" htmlFor="code" required error={errors.code?.message} hint="Unique SKU, e.g. HMV-MET-1005">
            <Input id="code" aria-invalid={!!errors.code} {...register("code")} />
          </Field>
          <Field label="URL slug" htmlFor="slug" required error={errors.slug?.message}>
            <Input id="slug" aria-invalid={!!errors.slug} {...register("slug")} />
          </Field>
          <Field label="Category" htmlFor="categoryId" required error={errors.categoryId?.message}>
            <Select id="categoryId" aria-invalid={!!errors.categoryId} {...register("categoryId")}>
              <option value="">Select category…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </Select>
          </Field>
        </div>
        <Field label="Short description" htmlFor="shortDescription" required error={errors.shortDescription?.message} hint="Shown on product cards. Max 200 characters.">
          <Textarea id="shortDescription" rows={2} aria-invalid={!!errors.shortDescription} {...register("shortDescription")} />
        </Field>
        <Field label="Full description" htmlFor="description" required error={errors.description?.message}>
          <Textarea id="description" rows={6} aria-invalid={!!errors.description} {...register("description")} />
        </Field>
      </FormSection>

      <FormSection title="2. Product Images & Gallery" description="The primary image is used in lists and cards.">
        <Controller control={control} name="images" render={({ field }) => (
          <ImageUploader images={field.value} onChange={(v) => setValue("images", v, { shouldDirty: true })} />
        )} />
      </FormSection>

      <FormSection title="3. Specifications" description="Technical attributes buyers compare on.">
        {specs.fields.length === 0 && <p className="text-sm text-muted">No specifications yet.</p>}
        <div className="space-y-3">
          {specs.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1fr_8rem_auto]">
              <Field label="Attribute" htmlFor={`spec-l-${i}`} error={errors.specifications?.[i]?.label?.message}>
                <Input id={`spec-l-${i}`} placeholder="Purity" aria-invalid={!!errors.specifications?.[i]?.label} {...register(`specifications.${i}.label`)} />
              </Field>
              <Field label="Value" htmlFor={`spec-v-${i}`} error={errors.specifications?.[i]?.value?.message}>
                <Input id={`spec-v-${i}`} placeholder="99.7" aria-invalid={!!errors.specifications?.[i]?.value} {...register(`specifications.${i}.value`)} />
              </Field>
              <Field label="Unit" htmlFor={`spec-u-${i}`}>
                <Input id={`spec-u-${i}`} placeholder="%" {...register(`specifications.${i}.unit`)} />
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" size="icon" aria-label={`Remove specification ${i + 1}`} onClick={() => specs.remove(i)}>
                  <Trash2 className="size-4 text-danger-600" />
                </Button>
              </div>
            </div>
          ))}
        </div>
        <Button variant="secondary" size="sm" onClick={() => specs.append({ id: uid("spec"), label: "", value: "", unit: "" })}>
          <Plus className="size-4" /> Add specification
        </Button>
      </FormSection>

      <FormSection title="4. Product Documents" description="Datasheets, certificates of analysis and brochures.">
        <Controller control={control} name="documents" render={({ field }) => (
          <DocumentUploader documents={field.value} onChange={(v) => setValue("documents", v, { shouldDirty: true })} />
        )} />
      </FormSection>

      <FormSection title="5. SEO Settings" description="Controls how the product appears in search results.">
        <Field label="Meta title" htmlFor="metaTitle" error={errors.seo?.metaTitle?.message} hint={`${seoTitle?.length ?? 0}/70 characters`}>
          <Input id="metaTitle" aria-invalid={!!errors.seo?.metaTitle} {...register("seo.metaTitle")} />
        </Field>
        <Field label="Meta description" htmlFor="metaDescription" error={errors.seo?.metaDescription?.message} hint={`${seoDesc?.length ?? 0}/160 characters`}>
          <Textarea id="metaDescription" rows={3} aria-invalid={!!errors.seo?.metaDescription} {...register("seo.metaDescription")} />
        </Field>
        <Field label="Canonical URL" htmlFor="canonicalUrl" hint="Leave empty to use the default product URL.">
          <Input id="canonicalUrl" {...register("seo.canonicalUrl")} />
        </Field>
        <Field label="Keywords" htmlFor="keywords">
          <Controller control={control} name="seo.keywords" render={({ field }) => (
            <TagInput id="keywords" value={field.value} onChange={(v) => setValue("seo.keywords", v, { shouldDirty: true })} />
          )} />
        </Field>
      </FormSection>

      <FormSection title="6. Publishing Settings" description="Control visibility on the public website.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Status" htmlFor="status" hint="Only published products appear on the website.">
            <Select id="status" {...register("status")}>
              <option value="draft">Draft</option>
              <option value="published">Published</option>
              <option value="archived">Archived</option>
            </Select>
          </Field>
          <div>
            <p className="mb-1.5 text-[13px] font-medium text-ink">Featured product</p>
            <Controller control={control} name="featured" render={({ field }) => (
              <div className="flex items-center gap-3 pt-1.5">
                <Switch checked={field.value} onChange={(v) => setValue("featured", v, { shouldDirty: true })} label="Featured product" />
                <span className="text-sm text-muted">{field.value ? "Highlighted on the homepage" : "Not featured"}</span>
              </div>
            )} />
          </div>
        </div>
      </FormSection>

      <FormActions>
        <Button variant="secondary" onClick={() => navigate(product ? `/admin/products/${product.id}` : "/admin/products")}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{product ? "Save changes" : "Create product"}</Button>
      </FormActions>
      {dialog}
    </form>
  );
}
