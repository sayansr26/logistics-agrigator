"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  NavigationMenu,
  NavigationMenuContent,
  NavigationMenuItem,
  NavigationMenuLink,
  NavigationMenuList,
  NavigationMenuTrigger,
} from "@/components/ui/navigation-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import {
  Truck,
  Package,
  DollarSign,
  HelpCircle,
  MessageSquare,
  User,
  Menu,
  Settings,
  LogOut,
  AlertTriangle,
  Search,
} from "lucide-react";

// HeaderProps: { className?: string }
const quickActions = [
  {
    title: "Create Shipment",
    href: "/shipments/create",
    description: "Create a new shipment quickly",
    icon: Package,
  },
  {
    title: "Bulk Upload",
    href: "/shipments/bulk",
    description: "Upload multiple shipments via CSV/Excel",
    icon: Package,
  },
  {
    title: "Track Shipment",
    href: "/shipments/track",
    description: "Track existing shipments by AWB or Order ID",
    icon: Truck,
  },
  {
    title: "NDR Management",
    href: "/shipments/ndr",
    description: "Manage non-delivery reports",
    icon: AlertTriangle,
  },
  {
    title: "Create Dispute",
    href: "/disputes/create",
    description: "Raise a dispute or support ticket",
    icon: AlertTriangle,
  },
  {
    title: "Wallet Balance",
    href: "/wallet",
    description: "Check wallet balance and transactions",
    icon: DollarSign,
  },
];

const integrations = [
  {
    title: "Shopify",
    href: "/platforms/shopify",
    description: "Connect and manage your Shopify store",
    status: "connected",
  },
  {
    title: "WooCommerce",
    href: "/platforms/woocommerce",
    description: "Integrate with WooCommerce platform",
    status: "available",
  },
  {
    title: "Custom API",
    href: "/platforms/api",
    description: "Custom API integration for your platform",
    status: "available",
  },
  {
    title: "Webhooks",
    href: "/platforms/webhooks",
    description: "Manage webhook configurations",
    status: "available",
  },
  {
    title: "Courier Partners",
    href: "/partners",
    description: "View and manage courier partner integrations",
    status: "connected",
  },
  {
    title: "Rate Calculator",
    href: "/partners/rates",
    description: "Check shipping rates across partners",
    status: "available",
  },
];

export function Header({ className }) {
  const { user, logout } = useAuth();

  const handleLogout = () => {
    logout();
    // The logout function in useAuthStore should automatically redirect to login
  };

  return (
    <header
      className={cn(
        "border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 sticky top-0 z-50",
        className,
      )}
    >
      <div className="flex h-14 items-center">
        {/* Sidebar space placeholder on desktop */}
        <div className="hidden md:block md:w-72 flex-shrink-0" />

        {/* Header content */}
        <div className="container flex items-center justify-between w-full">
          <div className="flex items-center">
            {/* Mobile Menu */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden mr-4">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Toggle menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0">
                <Sidebar />
              </SheetContent>
            </Sheet>

            {/* Desktop Navigation */}
            <NavigationMenu className="hidden md:flex">
              <NavigationMenuList>
                <NavigationMenuItem>
                  <NavigationMenuTrigger>Quick Actions</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid gap-3 p-6 md:w-[400px] lg:w-[500px] lg:grid-cols-[.75fr_1fr]">
                      <li className="row-span-3">
                        <NavigationMenuLink asChild>
                          <Link
                            className="flex h-full w-full select-none flex-col justify-end rounded-md bg-gradient-to-b from-muted/50 to-muted p-6 no-underline outline-none focus:shadow-md"
                            href="/dashboard"
                          >
                            <Package className="h-6 w-6" />
                            <div className="mb-2 mt-4 text-lg font-medium">
                              Dashboard
                            </div>
                            <p className="text-sm leading-tight text-muted-foreground">
                              Overview of your logistics operations and key
                              metrics.
                            </p>
                          </Link>
                        </NavigationMenuLink>
                      </li>
                      {quickActions.map((action) => (
                        <ListItem
                          key={action.title}
                          title={action.title}
                          href={action.href}
                        >
                          {action.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuTrigger>Integrations</NavigationMenuTrigger>
                  <NavigationMenuContent>
                    <ul className="grid w-[400px] gap-3 p-4 md:w-[500px] md:grid-cols-2 lg:w-[600px]">
                      {integrations.map((integration) => (
                        <ListItem
                          key={integration.title}
                          title={
                            <div className="flex items-center justify-between">
                              <span>{integration.title}</span>
                              <Badge
                                variant={
                                  integration.status === "connected"
                                    ? "default"
                                    : "secondary"
                                }
                                className="text-xs"
                              >
                                {integration.status.replace("_", " ")}
                              </Badge>
                            </div>
                          }
                          href={integration.href}
                        >
                          {integration.description}
                        </ListItem>
                      ))}
                    </ul>
                  </NavigationMenuContent>
                </NavigationMenuItem>

                <NavigationMenuItem>
                  <NavigationMenuLink asChild>
                    <Link
                      href="/help"
                      className="group inline-flex h-10 w-max items-center justify-center rounded-md bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:pointer-events-none disabled:opacity-50 data-[active]:bg-accent/50 data-[state=open]:bg-accent/50"
                    >
                      <HelpCircle className="mr-2 h-4 w-4" />
                      Help
                    </Link>
                  </NavigationMenuLink>
                </NavigationMenuItem>
              </NavigationMenuList>
            </NavigationMenu>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-4">
            {/* Search */}
            <Button
              variant="ghost"
              size="icon"
              className="hidden md:inline-flex"
            >
              <Search className="h-4 w-4" />
              <span className="sr-only">Search</span>
            </Button>

            {/* Notifications */}
            <Button variant="ghost" size="icon" className="relative">
              <MessageSquare className="h-4 w-4" />
              <Badge className="absolute -top-1 -right-1 h-5 w-5 flex items-center justify-center p-0 text-xs">
                3
              </Badge>
              <span className="sr-only">Notifications</span>
            </Button>

            {/* User Menu */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-8 w-8 rounded-full"
                >
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>
                      {user?.name
                        ? user.name
                            .split(" ")
                            .map((n) => n[0])
                            .join("")
                            .toUpperCase()
                        : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user?.name || "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || "user@logistics.com"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link href="/profile">
                    <User className="mr-2 h-4 w-4" />
                    <span>Profile</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link href="/settings">
                    <Settings className="mr-2 h-4 w-4" />
                    <span>Settings</span>
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout}>
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Log out</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </div>
    </header>
  );
}

// ListItem props: { className?, title, children, href, ...props }
const ListItem = ({ className, title, children, href, ...props }) => {
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
