"use client";

import { useParams } from "next/navigation";
import { PageHeader, NotFoundRecord } from "@/components/admin/page-parts";
import { useBreadcrumbLabel } from "@/components/admin/use-breadcrumb-label";
import { ProductForm } from "@/components/modules/products/product-form";
import { useRecord } from "@/hooks/use-resource";
import { productService } from "@/lib/services";

export default function EditProductPage() {
  const { id } = useParams<{ id: string }>();
  const product = useRecord(productService, id);
  useBreadcrumbLabel(product?.name);

  if (!product) return <NotFoundRecord what="Product" backHref="/admin/products" backLabel="Back to products" />;
  return (
    <>
      <PageHeader title={`Edit ${product.name}`} description={`Product code ${product.code}`} />
      <ProductForm key={product.id} product={product} />
    </>
  );
}
