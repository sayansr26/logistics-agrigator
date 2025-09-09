"use client";

import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  Truck,
  Package,
  Users,
  BarChart3,
  Settings,
  Home,
  FileText,
  Bell,
  HelpCircle,
  CreditCard,
  Globe,
  AlertTriangle,
  Store,
  LucideIcon,
} from "lucide-react";

const navigationItems = [
  {
    title: "Dashboard",
    href: "/dashboard",
    icon: Home,
  },
  {
    title: "Shipments",
    href: "/shipments",
    icon: Package,
    badge: "89",
  },
  // {
  //   title: "Orders",
  //   href: "/orders",
  //   icon: FileText,
  //   badge: "24",
  // },
  {
    title: "Wallet & Billing",
    href: "/wallet",
    icon: CreditCard,
  },
  {
    title: "Disputes & Support",
    href: "/support",
    icon: AlertTriangle,
    badge: "3",
  },
  {
    title: "Platform Integration",
    href: "/platforms",
    icon: Globe,
  },
  {
    title: "Analytics & Reports",
    href: "/reports",
    icon: BarChart3,
  },
  {
    title: "Outlets",
    href: "/outlets",
    icon: Store,
  },
  {
    title: "Remittance",
    href: "/remittance",
    icon: CreditCard,
  },
  {
    title: "Courier Partners",
    href: "/partners",
    icon: Truck,
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
  },
];

const bottomNavItems = [
  {
    title: "Notifications",
    href: "/notifications",
    icon: Bell,
    badge: "5",
  },
  {
    title: "Account Settings",
    href: "/settings",
    icon: Settings,
  },
  {
    title: "Help & Support",
    href: "/support",
    icon: HelpCircle,
  },
];

export function Sidebar({ className }) {
  const pathname = usePathname();

  return (
    <div className={cn("pb-12 min-h-screen", className)}>
      <div className="space-y-4 py-4">
        {/* Logo */}
        <div className="px-3 py-2">
          <div className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-logistics-600" />
            <h2 className="text-lg font-semibold tracking-tight">
              Logistics Portal
            </h2>
          </div>
        </div>

        {/* Main Navigation */}
        <div className="px-3">
          <div className="space-y-1">
            {navigationItems.map((item) => (
              <NavItemComponent
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
        </div>

        <Separator className="mx-3" />

        {/* Bottom Navigation */}
        <div className="px-3">
          <div className="space-y-1">
            {bottomNavItems.map((item) => (
              <NavItemComponent
                key={item.href}
                item={item}
                pathname={pathname}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItemComponent({ item, pathname }) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");

  return (
    <Button
      variant={isActive ? "secondary" : "ghost"}
      className="w-full justify-start"
      asChild
    >
      <Link href={item.href}>
        <item.icon className="mr-2 h-4 w-4" />
        {item.title}
        {item.badge && (
          <span className="ml-auto flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </Button>
  );
}
