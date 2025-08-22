"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import Link from "next/link";
import { cn } from "@/lib/utils";
import {
  Navigation,
  Menu,
  Layers,
  Smartphone,
  Monitor,
  Home,
  ChevronRight,
  ArrowRight,
  Check,
  Package,
} from "lucide-react";

const navigationFeatures = [
  {
    title: "Responsive Sidebar",
    description: "Collapsible sidebar that adapts to mobile with sheet overlay",
    icon: Menu,
    status: "implemented",
  },
  {
    title: "Multi-level Navigation",
    description: "Hierarchical navigation with expandable menu items",
    icon: Layers,
    status: "implemented",
  },
  {
    title: "Navigation Menu",
    description: "Dropdown navigation menus with rich content",
    icon: Navigation,
    status: "implemented",
  },
  {
    title: "Breadcrumb Navigation",
    description: "Auto-generated breadcrumbs based on current route",
    icon: ArrowRight,
    status: "implemented",
  },
  {
    title: "Mobile Responsive",
    description: "Touch-friendly navigation for mobile devices",
    icon: Smartphone,
    status: "implemented",
  },
  {
    title: "Desktop Optimized",
    description: "Fixed sidebar layout for desktop productivity",
    icon: Monitor,
    status: "implemented",
  },
];

const breadcrumbExamples = [
  {
    title: "Simple Path",
    breadcrumbs: [{ title: "Home", href: "/" }, { title: "Dashboard" }],
  },
  {
    title: "Deep Navigation",
    breadcrumbs: [
      { title: "Home", href: "/" },
      { title: "Shipments", href: "/shipments" },
      { title: "Create", href: "/shipments/create" },
      { title: "Bulk Upload" },
    ],
  },
  {
    title: "Analytics Path",
    breadcrumbs: [
      { title: "Home", href: "/" },
      { title: "Analytics", href: "/analytics" },
      { title: "Performance" },
    ],
  },
];

export default function NavigationDemo() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Demo", href: "/demo" },
    { title: "Navigation Components" },
  ];

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center space-x-2">
            <Navigation className="h-8 w-8 text-logistics-600" />
            <h1 className="text-3xl font-bold text-foreground">
              Navigation Components
            </h1>
          </div>
          <p className="text-muted-foreground max-w-2xl mx-auto">
            Complete navigation system with sidebar, header navigation,
            breadcrumbs, and mobile responsiveness
          </p>
        </div>

        {/* Features Overview */}
        <Card>
          <CardHeader>
            <CardTitle>Navigation Features</CardTitle>
            <CardDescription>
              All implemented navigation components and their capabilities
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {navigationFeatures.map((feature) => (
                <div
                  key={feature.title}
                  className="flex items-start space-x-3 p-4 border rounded-lg"
                >
                  <div className="flex-shrink-0">
                    <feature.icon className="h-5 w-5 text-logistics-600 mt-0.5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="text-sm font-medium text-foreground">
                        {feature.title}
                      </h3>
                      <Badge variant="secondary" className="ml-2">
                        <Check className="h-3 w-3 mr-1" />
                        {feature.status}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {feature.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Navigation Menu Demo */}
          <Card>
            <CardHeader>
              <CardTitle>Navigation Menu Component</CardTitle>
              <CardDescription>
                Dropdown navigation with rich content (see header for live
                example)
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <NavigationMenu>
                <NavigationMenuList>
                  <NavigationMenuItem>
                    <NavigationMenuTrigger>
                      Logistics Operations
                    </NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                        <li className="row-span-3">
                          <NavigationMenuLink asChild>
                            <div className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md">
                              <Package className="h-6 w-6" />
                              <div className="mb-2 mt-4 text-lg font-medium">
                                Shipment Hub
                              </div>
                              <p className="text-sm leading-tight text-muted-foreground">
                                Central hub for all your logistics operations
                                and shipment management.
                              </p>
                            </div>
                          </NavigationMenuLink>
                        </li>
                        <ListItem
                          title="Create Shipment"
                          href="/shipments/create"
                        >
                          Quick shipment creation with all necessary details
                        </ListItem>
                        <ListItem
                          title="Track Packages"
                          href="/shipments/track"
                        >
                          Real-time tracking for all your shipments
                        </ListItem>
                        <ListItem
                          title="Bulk Operations"
                          href="/shipments/bulk"
                        >
                          Handle multiple shipments at once
                        </ListItem>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>

                  <NavigationMenuItem>
                    <NavigationMenuTrigger>Analytics</NavigationMenuTrigger>
                    <NavigationMenuContent>
                      <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                        <ListItem
                          title="Performance Dashboard"
                          href="/analytics/performance"
                        >
                          Key performance indicators and metrics
                        </ListItem>
                        <ListItem title="Cost Analysis" href="/analytics/costs">
                          Detailed cost breakdown and optimization
                        </ListItem>
                        <ListItem
                          title="Custom Reports"
                          href="/analytics/reports"
                        >
                          Generate custom reports for your business
                        </ListItem>
                        <ListItem title="Data Export" href="/analytics/export">
                          Export data in various formats
                        </ListItem>
                      </ul>
                    </NavigationMenuContent>
                  </NavigationMenuItem>
                </NavigationMenuList>
              </NavigationMenu>

              <div className="text-sm text-muted-foreground">
                ↑ Interactive navigation menu with hover effects and rich
                content
              </div>
            </CardContent>
          </Card>

          {/* Breadcrumb Examples */}
          <Card>
            <CardHeader>
              <CardTitle>Breadcrumb Navigation</CardTitle>
              <CardDescription>
                Auto-generated breadcrumbs based on current route
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {breadcrumbExamples.map((example, index) => (
                <div key={index} className="space-y-2">
                  <h4 className="text-sm font-medium">{example.title}</h4>
                  <Breadcrumb>
                    <BreadcrumbList>
                      {example.breadcrumbs.map((item, breadcrumbIndex) => {
                        const isLast =
                          breadcrumbIndex === example.breadcrumbs.length - 1;

                        return (
                          <div
                            key={breadcrumbIndex}
                            className="flex items-center"
                          >
                            <BreadcrumbItem>
                              {item.href && !isLast ? (
                                <BreadcrumbLink asChild>
                                  <Link
                                    href={item.href}
                                    className="flex items-center"
                                  >
                                    {breadcrumbIndex === 0 && (
                                      <Home className="mr-1 h-4 w-4" />
                                    )}
                                    {item.title}
                                  </Link>
                                </BreadcrumbLink>
                              ) : (
                                <BreadcrumbPage className="flex items-center">
                                  {breadcrumbIndex === 0 && (
                                    <Home className="mr-1 h-4 w-4" />
                                  )}
                                  {item.title}
                                </BreadcrumbPage>
                              )}
                            </BreadcrumbItem>
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
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar Navigation Demo */}
        <Card>
          <CardHeader>
            <CardTitle>Sidebar Navigation</CardTitle>
            <CardDescription>
              The sidebar you see on the left demonstrates the complete
              navigation system
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Desktop Features</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Fixed sidebar layout</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Hierarchical menu structure</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Active state highlighting</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Badge notifications</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Expandable sub-menus</span>
                  </li>
                </ul>
              </div>
              <div className="space-y-4">
                <h3 className="text-lg font-semibold">Mobile Features</h3>
                <ul className="space-y-2 text-sm">
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Sheet overlay navigation</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Touch-friendly interactions</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Hamburger menu trigger</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Responsive design</span>
                  </li>
                  <li className="flex items-center space-x-2">
                    <Check className="h-4 w-4 text-green-600" />
                    <span>Swipe gestures support</span>
                  </li>
                </ul>
              </div>
            </div>

            <Separator className="my-6" />

            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-4">
                Try resizing your browser window to see the responsive behavior
              </p>
              <Button variant="outline" asChild>
                <Link href="/demo/tables">
                  View Data Tables Demo
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

const ListItem = ({
  className,
  title,
  children,
  href,
  ...props
}: {
  className?: string;
  title: string;
  children: React.ReactNode;
  href: string;
}) => {
  return (
    <li>
      <NavigationMenuLink asChild>
        <Link
          href={href}
          className={cn(
            "block select-none space-y-1 rounded-md p-3 leading-none no-underline outline-none transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground",
            className,
          )}
          {...props}
        >
          <div className="text-sm font-medium leading-none">{title}</div>
          <p className="line-clamp-2 text-sm leading-snug text-muted-foreground">
            {children}
          </p>
        </Link>
      </NavigationMenuLink>
    </li>
  );
};
