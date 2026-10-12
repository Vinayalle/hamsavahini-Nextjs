"use client";

import { useParams } from "next/navigation";
import { CommodityFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <CommodityFormPage id={id} />;
}
