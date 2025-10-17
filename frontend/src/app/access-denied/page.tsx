"use client";

import { useSearchParams } from "next/navigation";
import { AccessDenied } from "@/components/guards/AccessDenied";

export default function AccessDeniedPage() {
  const searchParams = useSearchParams();
  const requiredRoles = searchParams.get("required");
  const fromPath = searchParams.get("from");

  return (
    <AccessDenied
      requiredRole={requiredRoles}
      customMessage={
        fromPath ? `You don't have permission to access ${fromPath}` : undefined
      }
      fullPage
      showSupport
      showUserInfo
      backUrl={fromPath || "/dashboard"}
    />
  );
}
