"use client";

import { PageHeader } from "@/components/admin/page-parts";
import { ProductForm } from "@/components/modules/products/product-form";

export default function NewProductPage() {
  return (
    <>
      <PageHeader title="Add Product" description="Add a product. It is shown on the website straight away; you can hide it later with the switch on the products list." />
      <ProductForm />
    </>
  );
}
