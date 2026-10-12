"use client";

import { useParams } from "next/navigation";
import { OpportunityFormPage } from "@/components/modules/form-pages";

export default function EditPage() {
  const { id } = useParams<{ id: string }>();
  return <OpportunityFormPage id={id} />;
}
