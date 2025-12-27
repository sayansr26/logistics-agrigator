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
  Map,
  UserCheck,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useRole } from "@/hooks/useRole";

// Navigation structure with role-based filtering
const getNavigationSections = () => {
  const { user } = useAuth();
  const { hasPermission, canAccessResource } = usePermission();
  const { hasRole, isSystemAdmin } = useRole();

  // Check if user is an outlet user
  const isOutletUser = hasRole(["outlet_admin", "outlet_staff"]);
  const outletId = user?.outletId;

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

  // Check if outlet admin (can manage team)
  const isOutletAdmin = hasRole(["outlet_admin"]);

  // Special navigation for outlet users
  if (isOutletUser) {
    const outletSections = [
      {
        title: "Core Operations",
        items: [
          {
            title: "Dashboard",
            href: "/dashboard",
            icon: Home,
            disabled: false,
          },
          // {
          //   title: "Shipments",
          //   href: "/shipments",
          //   icon: Package,
          //   disabled: false,
          // },
        ],
      },
      {
        title: "Pricing & Services",
        items: [
          {
            title: "Zone Management",
            href: "/zones",
            icon: Globe,
            disabled: false,
          },
          {
            title: "Charge Packages",
            href: "/charges",
            icon: IndianRupee,
            disabled: false,
          },
        ],
      },
      {
        title: "Management",
        items: [
          {
            title: "Customers",
            href: outletId ? `/outlets/${outletId}/customers` : "/customers",
            icon: UserCheck,
            disabled: false,
          },
          {
            title: "Courier Partners",
            href: "/partners",
            icon: Truck,
            disabled: false,
          },
          // Team management - only for outlet_admin
          ...(isOutletAdmin && outletId ? [{
            title: "Team Management",
            href: `/outlet/team`,
            icon: Users,
            disabled: false,
          }] : []),
        ],
      },
    ];

    return outletSections.filter((section) => section.items.length > 0);
  }

  // Filter sections and items based on permissions for non-outlet users
  const sections = [
    {
      title: "Core Operations",
      items: [
        {
          title: "Dashboard",
          href: "/dashboard",
          icon: Home,
          disabled: false, // Dashboard not implemented yet
          // Everyone can see dashboard
        },
        // {
        //   title: "Shipments",
        //   href: "/shipments",
        //   icon: Package,
        //   // badge: "89",
        //   permission: "shipment:list:own",
        //   disabled: false,
        // },
      ].filter(canSeeMenuItem),
    },
    {
      title: "Pricing & Services",
      items: [
        {
          title: "Pincode Types",
          href: "/pincode-types",
          icon: Settings,
          permission: "partner:read:own",
          roles: ["superadmin", "admin"],
          disabled: false, // Active and working
        },
        {
          title: "Zone Management",
          href: "/zones",
          icon: Globe,
          permission: "partner:read:own",
          disabled: false, // Zone management is now implemented
        },
        {
          title: "Charge Packages",
          href: "/charges",
          icon: IndianRupee,
          permission: "chargePackage:manage:all",
          roles: ["superadmin", "admin", "operations"],
          disabled: false, // Implemented with new package creation flow
        },
      ].filter(canSeeMenuItem),
    },
    // {
    //   title: "Finance & Billing",
    //   items: [
    //     {
    //       title: "Wallet & Billing",
    //       href: "/wallet",
    //       icon: CreditCard,
    //       permission: "wallet:read:own",
    //       disabled: true, // Not implemented
    //       tooltip: "Coming Soon",
    //     },
    //     {
    //       title: "Remittance",
    //       href: "/remittance",
    //       icon: CreditCard,
    //       permission: "billing:manage:own",
    //       roles: ["superadmin", "admin", "accounts", "customer_account"],
    //       disabled: true, // Not implemented
    //       tooltip: "Coming Soon",
    //     },
    //   ].filter(canSeeMenuItem),
    // },
    {
      title: "Administration",
      items: [
        {
          title: "User Management",
          href: "/users",
          icon: Users,
          permission: "user:list:all",
          roles: ["superadmin", "admin"],
          disabled: false, // Working and completed
        },
        {
          title: "Customer Management",
          href: "/customers",
          icon: UserCheck,
          permission: "customer:list:all",
          roles: ["superadmin", "admin", "client"],
          disabled: false, // Working - DIRECT and OUTLET customers
        },
        {
          title: "Outlets",
          href: "/outlets",
          icon: Store,
          roles: ["superadmin", "admin", "client"],
          permission: "customer:list:own",
          disabled: false, // Outlet management for B2B customers
        },
        {
          title: "Geography",
          href: "/geography",
          icon: Map,
          roles: ["superadmin"],
          disabled: false, // Working and completed
        },
        // {
        //   title: "Client Management",
        //   href: "/clients",
        //   icon: Briefcase,
        //   permission: "client:list:all",
        //   roles: ["superadmin"],
        //   disabled: true, // Not implemented
        //   tooltip: "Coming Soon",
        // },
        {
          title: "Courier Partners",
          href: "/partners",
          icon: Truck,
          permission: "partner:list:all",
          roles: ["superadmin", "admin", "client"],
          disabled: false, // Working and completed
        },
      ].filter(canSeeMenuItem),
    },
    // {
    //   title: "Reports & Analytics",
    //   items: [
    //     {
    //       title: "Analytics & Reports",
    //       href: "/reports",
    //       icon: BarChart3,
    //       permission: "analytics:read:own",
    //       disabled: true, // Not implemented
    //       tooltip: "Coming Soon",
    //     },
    //   ].filter(canSeeMenuItem),
    // },
    // {
    //   title: "Integration & Support",
    //   items: [
    //     {
    //       title: "Platform Integration",
    //       href: "/platforms",
    //       icon: Globe,
    //       permission: "platform:read:own",
    //       disabled: true, // Not implemented
    //       tooltip: "Coming Soon",
    //     },
    //     {
    //       title: "Disputes & Support",
    //       href: "/support",
    //       icon: AlertTriangle,
    //       badge: "3",
    //       permission: "support:list:own",
    //       disabled: true, // Not implemented
    //       tooltip: "Coming Soon",
    //     },
    //   ].filter(canSeeMenuItem),
    // },
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
