"use client";

import { useParams } from "next/navigation";
import { LocationFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <LocationFormPage id={id} />;
}
