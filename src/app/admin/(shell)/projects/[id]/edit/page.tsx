"use client";

import { useParams } from "next/navigation";
import { ProjectFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <ProjectFormPage id={id} />;
}
