"use client";

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
  Shield,
  Building,
  CreditCard,
  Globe,
  AlertTriangle,
  MapPin,
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string;
  children?: NavItem[];
}

const navigationItems: NavItem[] = [
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
  {
    title: "Orders",
    href: "/orders",
    icon: FileText,
    children: [
      { title: "All Orders", href: "/orders", icon: FileText },
      { title: "Platform Orders", href: "/orders/platform", icon: FileText },
      { title: "Manual Orders", href: "/orders/manual", icon: FileText },
      { title: "Order History", href: "/orders/history", icon: FileText },
    ],
  },
  {
    title: "Wallet & Billing",
    href: "/wallet",
    icon: CreditCard,
    children: [
      { title: "Wallet Balance", href: "/wallet", icon: CreditCard },
      { title: "Transactions", href: "/wallet/transactions", icon: CreditCard },
      { title: "Invoices", href: "/wallet/invoices", icon: FileText },
      { title: "Settlements", href: "/wallet/settlements", icon: CreditCard },
      { title: "GST Reports", href: "/wallet/gst", icon: FileText },
    ],
  },
  {
    title: "Disputes & Support",
    href: "/disputes",
    icon: AlertTriangle,
    badge: "3",
    children: [
      { title: "All Disputes", href: "/disputes", icon: AlertTriangle },
      { title: "Create Ticket", href: "/disputes/create", icon: AlertTriangle },
      {
        title: "Weight Disputes",
        href: "/disputes/weight",
        icon: AlertTriangle,
      },
      {
        title: "Delivery Issues",
        href: "/disputes/delivery",
        icon: AlertTriangle,
      },
      { title: "Knowledge Base", href: "/disputes/kb", icon: HelpCircle },
    ],
  },
  {
    title: "Platform Integration",
    href: "/platforms",
    icon: Globe,
    children: [
      { title: "Connected Platforms", href: "/platforms", icon: Globe },
      { title: "Shopify", href: "/platforms/shopify", icon: Building },
      { title: "WooCommerce", href: "/platforms/woocommerce", icon: Building },
      { title: "API Integration", href: "/platforms/api", icon: Shield },
      { title: "Webhooks", href: "/platforms/webhooks", icon: Globe },
    ],
  },
  {
    title: "Analytics & Reports",
    href: "/analytics",
    icon: BarChart3,
    children: [
      { title: "Dashboard Overview", href: "/analytics", icon: BarChart3 },
      {
        title: "Performance Reports",
        href: "/analytics/performance",
        icon: BarChart3,
      },
      { title: "Cost Analysis", href: "/analytics/costs", icon: CreditCard },
      {
        title: "Partner Performance",
        href: "/analytics/partners",
        icon: Truck,
      },
      { title: "Custom Reports", href: "/analytics/custom", icon: FileText },
    ],
  },
  {
    title: "Courier Partners",
    href: "/partners",
    icon: Truck,
    children: [
      { title: "All Partners", href: "/partners", icon: Truck },
      { title: "Rate Cards", href: "/partners/rates", icon: CreditCard },
      {
        title: "Serviceability",
        href: "/partners/serviceability",
        icon: MapPin,
      },
      { title: "Performance", href: "/partners/performance", icon: BarChart3 },
    ],
  },
  {
    title: "User Management",
    href: "/users",
    icon: Users,
    children: [
      { title: "All Users", href: "/users", icon: Users },
      { title: "Add User", href: "/users/add", icon: Users },
      { title: "Roles & Permissions", href: "/users/roles", icon: Shield },
      { title: "Client Accounts", href: "/users/clients", icon: Building },
    ],
  },
];

const bottomNavItems: NavItem[] = [
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
    children: [
      { title: "Profile Settings", href: "/settings/profile", icon: Settings },
      { title: "Company Settings", href: "/settings/company", icon: Building },
      { title: "API Keys", href: "/settings/api", icon: Shield },
      {
        title: "Billing Settings",
        href: "/settings/billing",
        icon: CreditCard,
      },
    ],
  },
  {
    title: "Help & Support",
    href: "/support",
    icon: HelpCircle,
    children: [
      { title: "Contact Support", href: "/support/contact", icon: HelpCircle },
      { title: "Documentation", href: "/support/docs", icon: FileText },
      { title: "API Reference", href: "/support/api", icon: Shield },
      { title: "System Status", href: "/support/status", icon: Bell },
    ],
  },
];

export function Sidebar({ className }: SidebarProps) {
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
                level={0}
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
                level={0}
              />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

interface NavItemComponentProps {
  item: NavItem;
  pathname: string;
  level: number;
}

function NavItemComponent({ item, pathname, level }: NavItemComponentProps) {
  const isActive =
    pathname === item.href || pathname.startsWith(item.href + "/");
  const hasChildren = item.children && item.children.length > 0;
  const isExpanded = isActive && hasChildren;

  return (
    <div>
      <Button
        variant={isActive ? "secondary" : "ghost"}
        className={cn(
          "w-full justify-start",
          level > 0 && "ml-4 w-[calc(100%-1rem)]",
        )}
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

      {/* Render children if expanded */}
      {isExpanded && hasChildren && (
        <div className="mt-1 space-y-1">
          {item.children!.map((child) => (
            <NavItemComponent
              key={child.href}
              item={child}
              pathname={pathname}
              level={level + 1}
            />
          ))}
        </div>
      )}
    </div>
  );
}
