"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function CreateShipmentPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/shipments/create/docket");
  }, [router]);

  return null;
}
