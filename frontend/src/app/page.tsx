"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Truck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to login page on app start
    router.push("/auth/login");
  }, [router]);
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="text-center space-y-4">
        <div className="flex items-center justify-center space-x-2">
          <Truck className="h-8 w-8 text-logistics-600 animate-pulse" />
          <span className="text-2xl font-bold text-foreground">
            Logistics Portal
          </span>
        </div>
        <p className="text-muted-foreground">Redirecting to login...</p>

        {/* Keep demo links accessible during development */}
        <div className="mt-8 p-4 bg-background/80 rounded-lg backdrop-blur">
          <p className="text-sm text-muted-foreground mb-2">
            Development Links:
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo/forms">Forms</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo/tables">Tables</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/demo/navigation">Navigation</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard">Dashboard</Link>
            </Button>
            <Button variant="outline" size="sm" asChild>
              <Link href="/support">Support & Disputes</Link>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
