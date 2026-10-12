"use client";

import { useParams } from "next/navigation";
import { CareerFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <CareerFormPage id={id} />;
}
