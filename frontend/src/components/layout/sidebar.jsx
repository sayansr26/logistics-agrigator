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
  IndianRupee,
  Briefcase,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useRole } from "@/hooks/useRole";

// Navigation structure with role-based filtering
const getNavigationSections = () => {
  const { user } = useAuth();
  const { hasPermission, canAccessResource } = usePermission();
  const { hasRole, isSystemAdmin } = useRole();

  // Filter function to check if user can see menu item
  const canSeeMenuItem = (item) => {
    // Check permission if specified
    if (item.permission) {
      const [module, action, scope] = item.permission.split(":");
      return canAccessResource(module, action, scope || "own");
    }

    // Check roles if specified
    if (item.roles) {
      return hasRole(item.roles);
    }

    // Default to true if no restrictions
    return true;
  };

  // Filter sections and items based on permissions
  const sections = [
    {
      title: "Core Operations",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: Home,
          // Everyone can see dashboard
        },
        {
          title: "Shipments",
          href: "/shipments",
          icon: Package,
          badge: "89",
          permission: "shipment:list:own",
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Service Management",
      items: [
        {
          title: "Service Management",
          href: "/services",
          icon: Settings,
          permission: "partner:read:own",
        },
        {
          title: "Zone Management",
          href: "/zones",
          icon: Globe,
          permission: "partner:read:own",
        },
        {
          title: "Charges Management",
          href: "/charges",
          icon: IndianRupee,
          permission: "billing:list:own",
          roles: ["superadmin", "admin", "accounts", "customer_account"],
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Finance & Billing",
      items: [
        {
          title: "Wallet & Billing",
          href: "/wallet",
          icon: CreditCard,
          permission: "wallet:read:own",
        },
        {
          title: "Remittance",
          href: "/remittance",
          icon: CreditCard,
          permission: "billing:manage:own",
          roles: ["superadmin", "admin", "accounts", "customer_account"],
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Administration",
      items: [
        {
          title: "User Management",
          href: "/users",
          icon: Users,
          permission: "user:list:all",
          roles: ["superadmin", "admin"],
        },
        {
          title: "Client Management",
          href: "/clients",
          icon: Briefcase,
          permission: "client:list:all",
          roles: ["superadmin"],
        },
        {
          title: "Courier Partners",
          href: "/partners",
          icon: Truck,
          permission: "partner:list:all",
          roles: ["superadmin", "admin", "client"],
        },
        {
          title: "Outlets",
          href: "/outlets",
          icon: Store,
          permission: "customer:list:own",
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Reports & Analytics",
      items: [
        {
          title: "Analytics & Reports",
          href: "/reports",
          icon: BarChart3,
          permission: "analytics:read:own",
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Integration & Support",
      items: [
        {
          title: "Platform Integration",
          href: "/platforms",
          icon: Globe,
          permission: "platform:read:own",
        },
        {
          title: "Disputes & Support",
          href: "/support",
          icon: AlertTriangle,
          badge: "3",
          permission: "support:list:own",
        },
      ].filter(canSeeMenuItem),
    },
  ];

  // Filter out empty sections
  return sections.filter((section) => section.items.length > 0);
};

const bottomNavItems = [
  // Bottom nav items removed - notifications moved to header
  // Settings and Support already exist in main navigation
];

export function Sidebar({ className }) {
  const pathname = usePathname();
  const navigationSections = getNavigationSections();

  return (
    <div className={cn("flex-1 overflow-y-auto overflow-x-hidden", className)}>
      <div className="space-y-3 py-3">
        {/* Main Navigation - Section Based */}
        <div className="px-3">
          <div className="space-y-3">
            {navigationSections.map((section, index) => (
              <div key={section.title}>
                {/* Section Header */}
                <div className="px-2 mb-1.5">
                  <h3 className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {section.title}
                  </h3>
                </div>
                {/* Section Items */}
                <div className="space-y-0.5">
                  {section.items.map((item) => (
                    <NavItemComponent
                      key={item.href}
                      item={item}
                      pathname={pathname}
                    />
                  ))}
                </div>
                {/* Separator between sections (except last one) */}
                {index < navigationSections.length - 1 && (
                  <Separator className="mt-3" />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Bottom navigation removed - items moved to appropriate locations */}
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
      className="w-full justify-start h-8 text-sm px-2"
      asChild
    >
      <Link href={item.href}>
        <item.icon className="mr-2 h-3.5 w-3.5" />
        <span className="truncate">{item.title}</span>
        {item.badge && (
          <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] text-primary-foreground">
            {item.badge}
          </span>
        )}
      </Link>
    </Button>
  );
}
