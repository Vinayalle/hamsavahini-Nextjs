"use client";

import { useParams } from "next/navigation";
import { PostFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <PostFormPage id={id} />;
}
