"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";
import {
  Breadcrumb,
  BreadcrumbItem as UIBreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Home, ChevronRight } from "lucide-react";

interface BreadcrumbNavProps {
  className?: string;
  customBreadcrumbs?: Crumb[];
}

interface Crumb {
  title: string;
  href?: string;
}

// Route mapping for better breadcrumb titles
const routeMap: Record<string, string> = {
  "": "Home",
  dashboard: "Dashboard",
  shipments: "Shipments",
  customers: "Customers",
  analytics: "Analytics",
  integrations: "Integrations",
  settings: "Settings",
  notifications: "Notifications",
  support: "Support",
  help: "Help",
  demo: "Demo",
  forms: "Forms",
  tables: "Tables",
  navigation: "Navigation",
  create: "Create",
  edit: "Edit",
  track: "Track",
  bulk: "Bulk Upload",
  add: "Add New",
  groups: "Groups",
  performance: "Performance",
  reports: "Reports",
  costs: "Cost Analysis",
  ecommerce: "E-commerce",
  couriers: "Courier Partners",
  api: "API Keys",
  shopify: "Shopify",
  woocommerce: "WooCommerce",
  amazon: "Amazon",
};

function generateBreadcrumbs(pathname: string): Crumb[] {
  const segments = pathname.split("/").filter(Boolean);
  const breadcrumbs: Crumb[] = [];

  // Always start with Dashboard
  breadcrumbs.push({ title: "Dashboard", href: "/dashboard" });

  // Build breadcrumbs from path segments
  let currentPath = "";
  segments.forEach((segment, index) => {
    currentPath += `/${segment}`;
    const title =
      routeMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

    // Don't add href for the last item (current page)
    const isLast = index === segments.length - 1;
    breadcrumbs.push({
      title,
      href: isLast ? undefined : currentPath,
    });
  });

  return breadcrumbs;
}

export function BreadcrumbNav({
  className,
  customBreadcrumbs,
}: BreadcrumbNavProps) {
  const pathname = usePathname();

  // Use custom breadcrumbs if provided, otherwise generate from pathname
  const breadcrumbs = customBreadcrumbs || generateBreadcrumbs(pathname);

  // Don't show breadcrumbs on home page
  if (pathname === "/" && !customBreadcrumbs) {
    return null;
  }

  return (
    <Breadcrumb className={className}>
      <BreadcrumbList>
        {breadcrumbs.map((item, index) => {
          const isLast = index === breadcrumbs.length - 1;

          return (
            <div key={index} className="flex items-center">
              <UIBreadcrumbItem>
                {item.href && !isLast ? (
                  <BreadcrumbLink asChild>
                    <Link href={item.href} className="flex items-center">
                      {index === 0 && <Home className="mr-1 h-4 w-4" />}
                      {item.title}
                    </Link>
                  </BreadcrumbLink>
                ) : (
                  <BreadcrumbPage className="flex items-center">
                    {index === 0 && <Home className="mr-1 h-4 w-4" />}
                    {item.title}
                  </BreadcrumbPage>
                )}
              </UIBreadcrumbItem>
              {!isLast && (
                <BreadcrumbSeparator>
                  <ChevronRight className="h-4 w-4" />
                </BreadcrumbSeparator>
              )}
            </div>
          );
        })}
      </BreadcrumbList>
    </Breadcrumb>
  );
}
