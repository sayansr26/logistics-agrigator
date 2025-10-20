"use client";

import React from "react";
import Link from "next/link";
import { useAuth } from "@/hooks/useAuth";
import { usePermission } from "@/hooks/usePermission";
import { useRole } from "@/hooks/useRole";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Sidebar } from "./sidebar";
import { cn } from "@/lib/utils";
import {
  Truck,
  Package,
  User,
  Menu,
  Settings,
  LogOut,
  Bell,
} from "lucide-react";

export function Header({ className }) {
  const { user, logout } = useAuth();
  const { canAccessResource } = usePermission();
  const { getRoleBadgeColor, getRoleDisplayName } = useRole();

  // Check permissions for quick actions
  const canCreateShipment = canAccessResource("shipment", "create", "own");
  const canTrackShipment = canAccessResource("shipment", "read", "own");

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
        {/* Logo Section - Fixed width matching sidebar */}
        <div className="hidden md:flex md:w-64 flex-shrink-0 items-center px-6 border-r">
          <Link href="/dashboard" className="flex items-center space-x-2">
            <Truck className="h-6 w-6 text-logistics-600" />
            <h2 className="text-lg font-semibold tracking-tight">
              Logistics Portal
            </h2>
          </Link>
        </div>

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
              <SheetContent side="left" className="w-64 p-0">
                <Sidebar />
              </SheetContent>
            </Sheet>

            {/* Desktop Quick Actions - Compact (Role-based) */}
            <div className="hidden md:flex items-center space-x-2">
              {canCreateShipment && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/shipments/create">
                    <Package className="h-4 w-4 mr-2" />
                    <span className="hidden lg:inline">Create Shipment</span>
                  </Link>
                </Button>
              )}
              {canTrackShipment && (
                <Button variant="ghost" size="sm" asChild>
                  <Link href="/shipments/track">
                    <Truck className="h-4 w-4 mr-2" />
                    <span className="hidden lg:inline">Track</span>
                  </Link>
                </Button>
              )}
            </div>
          </div>

          {/* Right side */}
          <div className="flex items-center space-x-2">
            {/* Notifications */}
            <Button
              variant="ghost"
              size="icon"
              className="relative h-8 w-8"
              asChild
            >
              <Link href="/notifications">
                <Bell className="h-4 w-4" />
                <span className="sr-only">Notifications</span>
                {/* Notification badge */}
                <span className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-red-500 text-[10px] font-medium text-white flex items-center justify-center">
                  5
                </span>
              </Link>
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
                      {user?.email ? user.email[0].toUpperCase() : "U"}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {[user?.firstName, user?.lastName]
                        .filter(Boolean)
                        .join(" ") ||
                        user?.email ||
                        "User"}
                    </p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {user?.email || "user@logistics.com"}
                    </p>
                    {user?.role && (
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getRoleBadgeColor(user.role)}`}
                        >
                          {getRoleDisplayName(user.role)}
                        </span>
                      </div>
                    )}
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
