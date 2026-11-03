"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { LuPlus as Plus, LuTrash2 as Trash2 } from "react-icons/lu";
import { toast } from "@/lib/toast";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/fields";
import { ImageUploader } from "@/components/forms/uploaders";
import { CategoryPicker } from "@/components/forms/category-picker";
import { useAuth } from "@/lib/auth";
import { Field, FormActions, FormSection, TagInput } from "@/components/forms/form-parts";
import { useUnsavedChangesGuard } from "@/components/admin/dialogs";
import { useAll } from "@/hooks/use-resource";
import { categoryService, productService } from "@/lib/services";
import { slugify, uid } from "@/lib/utils";
import { ApiClientError, isApiMode } from "@/lib/api/client";
import type { Product } from "@/types/entities";

/**
 * The product form is deliberately short: the name, the category, what it is used for, where it comes from, a few specifications, the full details and the pictures.
 * The code, the web address and the short summary are made automatically, and a new product is shown on the website straight away
 * (it can be hidden or shown again with the switch on the products list).
 */
const schema = z.object({
  name: z.string().trim().min(2, "Product name is required").max(120),
  category: z.string().trim().min(2, "Choose a category or type a new one").max(120),
  applications: z.array(z.string()),
  origin: z.string().trim().max(120),
  specifications: z.array(z.object({ id: z.string(), label: z.string().trim().min(1, "Required").max(80), value: z.string().trim().min(1, "Required").max(120) })).max(8),
  description: z.string().trim().min(20, "Add the product details (min 20 characters)"),
  images: z.array(z.object({ id: z.string(), fileId: z.string().optional(), url: z.string(), alt: z.string(), isPrimary: z.boolean() })),
});
type Values = z.infer<typeof schema>;

const EMPTY: Values = { name: "", category: "", applications: [], origin: "", specifications: [], description: "", images: [] };

export function ProductForm({ product }: { product?: Product }) {
  const router = useRouter();
  const categories = useAll(categoryService);
  const { can } = useAuth();

  const form = useForm<Values>({
    resolver: zodResolver(schema),
    defaultValues: product
      ? { name: product.name, category: "", applications: product.applications ?? [], origin: product.origin ?? "", specifications: product.specifications.map((x) => ({ id: x.id, label: x.label, value: x.unit ? `${x.value} ${x.unit}` : x.value })), description: product.description, images: product.images }
      : EMPTY,
  });
  const { register, control, handleSubmit, setValue, setError, formState: { errors, isDirty, isSubmitting } } = form;
  const specs = useFieldArray({ control, name: "specifications" });
  const { navigate, dialog } = useUnsavedChangesGuard(isDirty && !isSubmitting);
  // Editing: show the product's current category as soon as the categories have loaded.
  const currentCategory = product ? categories.find((c) => c.id === product.categoryId)?.name : undefined;
  useEffect(() => {
    if (currentCategory && !form.getValues("category")) form.reset({ ...form.getValues(), category: currentCategory });
  }, [currentCategory, form]);

  const onSubmit = async (v: Values) => {
    try {
      // The category is a name: an existing one is used as it is, a new one is created now (on the website it appears with its first product).
      const typed = v.category.trim();
      let target = categories.find((c) => c.name.trim().toLowerCase() === typed.toLowerCase());
      if (!target) {
        if (!can("categories", "create")) return void setError("category", { message: "You can only choose an existing category." });
        const taken = new Set(categories.map((c) => c.slug));
        let slug = slugify(typed) || "category";
        for (let n = 2; taken.has(slug); n++) slug = `${slugify(typed) || "category"}-${n}`;
        target = await categoryService.create({ name: typed, slug, description: "", parentId: null, sortOrder: 0, status: "published" } as unknown as Parameters<typeof categoryService.create>[0]);
      }
      const { category: _category, ...rest } = v;
      void _category;
      const base = { ...rest, specifications: rest.specifications.map(({ label, value }) => ({ label, value, unit: null })), origin: rest.origin || null, categoryId: target.id };
      let saved: Product;
      if (product) {
        saved = await productService.update(product.id, base as unknown as Parameters<typeof productService.update>[1]); // the code, web address and status stay as they were
      } else {
        // Database mode: the server makes the code, address and summary and publishes the product. The preview mode has no server, so it fills them in here.
        const flat = v.description.replace(/\s+/g, " ").trim();
        const preview = isApiMode ? {} : { code: `P-${uid("p").slice(-8).toUpperCase()}`, slug: slugify(v.name), shortDescription: flat.slice(0, 200), documents: [], status: "published", featured: false, publishedAt: new Date().toISOString() };
        saved = await productService.create({ ...base, ...preview } as unknown as Parameters<typeof productService.create>[0]);
      }
      toast.success(product ? "Product updated" : "Product added", {
        description: product ? (isApiMode ? "Saved to the database." : "Saved to mock data, not persisted to a server.") : isApiMode ? "It is shown on the website. Use the switch on the products list to hide it." : "Saved to mock data, not persisted to a server.",
      });
      form.reset(v);
      router.push(`/admin/products/${saved.id}`);
    } catch (e) {
      if (e instanceof ApiClientError && e.fields) {
        let mapped = false;
        for (const k of ["name", "description"] as const) if (e.fields[k]) { setError(k, { message: e.fields[k] }); mapped = true; }
        if (e.fields.categoryId) { setError("category", { message: e.fields.categoryId }); mapped = true; }
        if (e.fields.applications) { toast.error(e.fields.applications); return; }
        if (e.fields.images) { toast.error(e.fields.images); return; }
        if (mapped) return void toast.error("Please fix the highlighted fields before saving.");
      }
      toast.error(e instanceof Error ? e.message : "Could not save product");
    }
  };

  const onInvalid = () => toast.error("Please fix the highlighted fields before saving.");

  return (
    <form onSubmit={handleSubmit(onSubmit, onInvalid)} noValidate className="space-y-6">
      <FormSection title="1. Product" description="What visitors see on the product card and the product page.">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Product name" htmlFor="name" required error={errors.name?.message}>
            <Input id="name" aria-invalid={!!errors.name} {...register("name")} />
          </Field>
          <Field label="Category" htmlFor="category" required error={errors.category?.message} hint="Pick one, or type a new name to add it.">
            <Controller control={control} name="category" render={({ field }) => (
              <CategoryPicker id="category" value={field.value} onChange={(v) => setValue("category", v, { shouldDirty: true, shouldValidate: !!errors.category })} options={categories.map((c) => c.name)} canCreate={can("categories", "create")} invalid={!!errors.category} />
            )} />
          </Field>
        </div>
        <Field label="Used for" htmlFor="applications" hint="The industries and uses, for example Steel making. Press Enter after each one. Shown on the product card.">
          <Controller control={control} name="applications" render={({ field }) => (
            <TagInput id="applications" value={field.value} onChange={(v) => setValue("applications", v, { shouldDirty: true })} placeholder="Steel making, Construction…" />
          )} />
        </Field>
        <Field label="Location" htmlFor="origin" hint="Where it comes from, for example India / Brazil. Shown with a pin on the product card.">
          <Input id="origin" maxLength={120} {...register("origin")} />
        </Field>
        <Field label="Product details" htmlFor="description" required error={errors.description?.message} hint="The full description shown on the product page.">
          <Textarea id="description" rows={9} aria-invalid={!!errors.description} {...register("description")} />
        </Field>
      </FormSection>

      <FormSection title="2. Specifications" description="Optional. A few facts shown on the product card (the first four) and the product page, for example Purity, Grade, MOQ.">
        <div className="space-y-3">
          {specs.fields.map((f, i) => (
            <div key={f.id} className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_1.4fr_auto]">
              <Field label="Name" htmlFor={`spec-l-${i}`} error={errors.specifications?.[i]?.label?.message}>
                <Input id={`spec-l-${i}`} placeholder="Purity" aria-invalid={!!errors.specifications?.[i]?.label} {...register(`specifications.${i}.label`)} />
              </Field>
              <Field label="Value" htmlFor={`spec-v-${i}`} error={errors.specifications?.[i]?.value?.message}>
                <Input id={`spec-v-${i}`} placeholder="Fe 57-65%" aria-invalid={!!errors.specifications?.[i]?.value} {...register(`specifications.${i}.value`)} />
              </Field>
              <div className="flex items-end">
                <Button variant="ghost" size="icon" aria-label={`Remove specification ${i + 1}`} onClick={() => specs.remove(i)}><Trash2 className="size-4 text-danger-600" /></Button>
              </div>
            </div>
          ))}
        </div>
        {specs.fields.length < 8 && (
          <Button variant="secondary" size="sm" onClick={() => specs.append({ id: uid("spec"), label: "", value: "" })}><Plus className="size-4" /> Add specification</Button>
        )}
      </FormSection>

      <FormSection title="3. Pictures" description="The first picture is used on the product card.">
        <Controller control={control} name="images" render={({ field }) => (
          <ImageUploader images={field.value} onChange={(v) => setValue("images", v, { shouldDirty: true })} />
        )} />
      </FormSection>

      <FormActions>
        <Button variant="secondary" onClick={() => navigate(product ? `/admin/products/${product.id}` : "/admin/products")}>Cancel</Button>
        <Button type="submit" loading={isSubmitting}>{product ? "Save changes" : "Add product"}</Button>
      </FormActions>
      {dialog}
    </form>
  );
}
