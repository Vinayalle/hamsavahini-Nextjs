"use client";

import { PageHeader } from "@/components/admin/page-parts";
import { ProductForm } from "@/components/modules/products/product-form";

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add Product" description="Create a new catalogue product. Save as draft until it is ready to publish." />
      <ProductForm />
    </>
  );
}
