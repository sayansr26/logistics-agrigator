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
  PackagePlus,
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
  LucideIcon,
  IndianRupee,
  Briefcase,
  Map,
  MapPin,
  Store,
  ScrollText,
  Tag,
  Wallet,
} from "lucide-react";
import { usePermission } from "@/hooks/usePermission";
import { useRole } from "@/hooks/useRole";

// Navigation structure with role-based filtering
const getNavigationSections = () => {
  const { hasPermission, canAccessResource } = usePermission();
  const { hasRole, isSystemAdmin } = useRole();

  // Filter function to check if user can see menu item
  const canSeeMenuItem = (item) => {
    // If roles are specified, check roles FIRST (strict role requirement)
    // This ensures outlet-only items don't show for superadmin
    if (item.roles && item.roles.length > 0) {
      const roleMatch = hasRole(item.roles);
      if (!roleMatch) {
        return false;
      }
    }

    // Check permission if specified
    if (item.permission) {
      const [module, action, scope] = item.permission.split(":");
      return canAccessResource(module, action, scope || "own");
    }

    // Default to true if no restrictions
    return true;
  };

  // Filter sections and items based on permissions
  const sections = [
    {
      title: "Operations",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: Home,
          disabled: false,
        },
        {
          title: "Shipments",
          href: "/shipments",
          icon: Package,
          roles: ["superadmin", "admin", "outlet"],
          disabled: false,
        },
        {
          title: "Create Shipment",
          href: "/shipments/create",
          icon: PackagePlus,
          roles: ["superadmin", "admin", "outlet"],
          disabled: false,
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Partner Management",
      items: [
        {
          title: "Courier Partners",
          href: "/partners",
          icon: Truck,
          permission: "partner:list:all",
          roles: ["superadmin", "admin", "client"],
          disabled: false,
        },
        {
          title: "Zone Management",
          href: "/zones",
          icon: Globe,
          permission: "partner:read:own",
          roles: ["superadmin", "admin", "operations"],
          disabled: false,
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Configuration",
      items: [
        {
          title: "Charges Types",
          href: "/charges-types",
          icon: IndianRupee,
          permission: "partner:read:own",
          roles: ["superadmin", "admin", "operations"],
          disabled: false,
        },
        {
          title: "Pincode Types",
          href: "/pincode-types",
          icon: MapPin,
          permission: "partner:read:own",
          roles: ["superadmin", "admin", "operations"],
          disabled: false,
        },
        {
          title: "Charges Management",
          href: "/charges",
          icon: CreditCard,
          permission: "partner:manage:all",
          roles: ["superadmin", "admin"],
          disabled: false,
        },
        {
          title: "Discount Packages",
          href: "/charge-discount-packages",
          icon: Tag,
          permission: "partner:manage:all",
          roles: ["superadmin", "admin"],
          disabled: false,
        },
        {
          title: "Geography",
          href: "/geography",
          icon: Map,
          roles: ["superadmin"],
          disabled: false,
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
          disabled: false,
        },
        {
          title: "Outlet Management",
          href: "/outlets",
          icon: Store,
          permission: "user:read:parent",
          roles: ["superadmin", "admin", "client"],
          disabled: false,
        },
        {
          title: "Audit Logs",
          href: "/audit-logs",
          icon: ScrollText,
          roles: ["superadmin", "admin", "client"],
          disabled: false,
        },
        {
          title: "Wallet",
          href: "/wallet",
          icon: Wallet,
          roles: ["superadmin", "admin", "accounts", "client", "outlet"],
          disabled: false,
        },
      ].filter(canSeeMenuItem),
    },
    {
      title: "My Account",
      items: [
        {
          title: "My Addresses",
          href: "/addresses",
          icon: MapPin,
          permission: "user:read:own",
          roles: ["outlet"],
          disabled: false,
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

  // Handle disabled items
  if (item.disabled) {
    return (
      <div className="relative group">
        <Button
          variant="ghost"
          className="w-full justify-start h-8 text-sm px-2 opacity-50 cursor-not-allowed"
          disabled
        >
          <item.icon className="mr-2 h-3.5 w-3.5" />
          <span className="truncate">{item.title}</span>
          {item.badge && (
            <span className="ml-auto flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-muted text-[10px] text-muted-foreground">
              {item.badge}
            </span>
          )}
        </Button>
        {/* Tooltip for disabled items - positioned at bottom */}
        {item.tooltip && (
          <div className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-md opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-50 whitespace-nowrap border border-border">
            <div className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-popover border-l border-t border-border rotate-45"></div>
            {item.tooltip}
          </div>
        )}
      </div>
    );
  }

  // Regular active items
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
