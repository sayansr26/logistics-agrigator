"use client";

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

/**
 * Entry point for the edit wizard, mirroring /shipments/create — the real
 * first step lives at ./details.
 */
export default function EditShipmentEntryPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  useEffect(() => {
    if (id) router.replace(`/shipments/${id}/edit/details`);
  }, [router, id]);

  return null;
}
