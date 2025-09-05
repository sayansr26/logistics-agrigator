"use client";

import { useAuth } from "@/hooks/useAuth";
import { UserProfile } from "@/components/auth/UserProfile";
import { Button } from "@/components/ui/button";
import {
  Truck,
  Package,
  Users,
  DollarSign,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

interface AuthenticatedLayoutProps {
  children: React.ReactNode;
}

export function AuthenticatedLayout({ children }: AuthenticatedLayoutProps) {
  const { user, isAdmin, canManageOperations, canAccessFinance } = useAuth();
  const pathname = usePathname();

  const navigation = [
    {
      name: "Dashboard",
      href: "/dashboard",
      icon: Truck,
      current: pathname === "/dashboard",
    },
    {
      name: "Shipments",
      href: "/shipments",
      icon: Package,
      current: pathname.startsWith("/shipments"),
    },
    ...(canManageOperations
      ? [
          {
            name: "Partners",
            href: "/partners",
            icon: Users,
            current: pathname.startsWith("/partners"),
          },
        ]
      : []),
    ...(canAccessFinance
      ? [
          {
            name: "Finance",
            href: "/finance",
            icon: DollarSign,
            current: pathname.startsWith("/finance"),
          },
        ]
      : []),
    ...(isAdmin
      ? [
          {
            name: "Admin",
            href: "/admin",
            icon: Shield,
            current: pathname.startsWith("/admin"),
          },
        ]
      : []),
    {
      name: "Settings",
      href: "/settings",
      icon: Settings,
      current: pathname.startsWith("/settings"),
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Truck className="h-8 w-8 text-logistics-600" />
              <h1 className="text-xl font-semibold text-gray-900">
                Logistics Portal
              </h1>
            </div>
            <UserProfile />
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar */}
        <aside className="w-64 bg-white shadow-sm min-h-screen">
          <nav className="mt-8 px-4">
            <ul className="space-y-2">
              {navigation.map((item) => (
                <li key={item.name}>
                  <Link href={item.href}>
                    <Button
                      variant={item.current ? "secondary" : "ghost"}
                      className={`w-full justify-start ${
                        item.current
                          ? "bg-gray-100 text-gray-900"
                          : "text-gray-600 hover:text-gray-900 hover:bg-gray-50"
                      }`}
                    >
                      <item.icon className="mr-3 h-5 w-5" />
                      {item.name}
                    </Button>
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
