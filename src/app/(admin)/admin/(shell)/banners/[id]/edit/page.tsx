"use client";

import { useParams } from "next/navigation";
import { BannerFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <BannerFormPage id={id} />;
}
