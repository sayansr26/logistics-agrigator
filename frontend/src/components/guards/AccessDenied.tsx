"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ShieldX,
  Lock,
  Home,
  ArrowLeft,
  AlertTriangle,
  Info,
  Mail,
  Phone,
  HelpCircle,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useRole } from "@/hooks/useRole";

interface AccessDeniedProps {
  /**
   * Required permission string (e.g., "shipment:create:own")
   */
  requiredPermission?: string;

  /**
   * Required role (e.g., "admin")
   */
  requiredRole?: string;

  /**
   * Custom message to display
   */
  customMessage?: string;

  /**
   * Whether to show contact support section
   */
  showSupport?: boolean;

  /**
   * Whether to show current user info
   */
  showUserInfo?: boolean;

  /**
   * Custom back button URL
   */
  backUrl?: string;

  /**
   * Custom back button text
   */
  backText?: string;

  /**
   * Whether to use full page layout
   */
  fullPage?: boolean;
}

/**
 * AccessDenied component
 *
 * Beautiful access denied page with helpful information and actions
 *
 * @example
 * ```tsx
 * <AccessDenied
 *   requiredPermission="user:manage:all"
 *   showSupport
 *   showUserInfo
 * />
 * ```
 */
export function AccessDenied({
  requiredPermission,
  requiredRole,
  customMessage,
  showSupport = true,
  showUserInfo = true,
  backUrl,
  backText = "Back to Dashboard",
  fullPage = false,
}: AccessDeniedProps) {
  const router = useRouter();
  const { user } = useAuth();
  const { getRoleDisplayName, getRoleBadgeColor } = useRole();

  const handleBackClick = () => {
    if (backUrl) {
      router.push(backUrl);
    } else {
      router.push("/dashboard");
    }
  };

  const handleHomeClick = () => {
    router.push("/");
  };

  const content = (
    <Card className={`${fullPage ? "max-w-2xl" : ""} mx-auto`}>
      <CardHeader className="text-center space-y-4">
        <div className="mx-auto">
          <div className="relative">
            <ShieldX className="h-20 w-20 text-red-500 mx-auto" />
            <Lock className="h-8 w-8 text-red-600 absolute bottom-0 right-0 bg-background rounded-full p-1" />
          </div>
        </div>
        <CardTitle className="text-2xl font-bold text-red-600">
          Access Denied
        </CardTitle>
        <CardDescription className="text-base">
          {customMessage || "You don't have permission to access this resource"}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Permission/Role Requirements */}
        {(requiredPermission || requiredRole) && (
          <Alert className="border-red-200 bg-red-50">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <AlertTitle className="text-red-800">Required Access</AlertTitle>
            <AlertDescription className="mt-2 space-y-2">
              {requiredPermission && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700">Permission:</span>
                  <Badge variant="destructive" className="font-mono text-xs">
                    {requiredPermission}
                  </Badge>
                </div>
              )}
              {requiredRole && (
                <div className="flex items-center gap-2">
                  <span className="text-sm text-red-700">Role:</span>
                  <Badge variant="destructive" className="text-xs">
                    {requiredRole}
                  </Badge>
                </div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Current User Info */}
        {showUserInfo && user && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Info className="h-4 w-4" />
                <span>Your Current Access</span>
              </div>
              <div className="bg-muted/50 rounded-lg p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Logged in as:</span>
                  <span className="text-sm">{user.email}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium">Your Role:</span>
                  <Badge className={getRoleBadgeColor(user.role)}>
                    {getRoleDisplayName(user.role)}
                  </Badge>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Support Section */}
        {showSupport && (
          <>
            <Separator />
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <HelpCircle className="h-4 w-4" />
                <span>Need Access?</span>
              </div>
              <div className="bg-blue-50 rounded-lg p-4 space-y-3">
                <p className="text-sm text-blue-900">
                  If you believe you should have access to this resource, please
                  contact your administrator or support team.
                </p>
                <div className="space-y-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() =>
                      (window.location.href = "mailto:support@logistics.com")
                    }
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    support@logistics.com
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full justify-start"
                    onClick={() => (window.location.href = "tel:+1234567890")}
                  >
                    <Phone className="h-4 w-4 mr-2" />
                    +1 (234) 567-890
                  </Button>
                </div>
              </div>
            </div>
          </>
        )}

        {/* What You Can Do */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-muted-foreground">
            What you can do:
          </p>
          <ul className="space-y-2 text-sm text-muted-foreground">
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Contact your administrator to request access</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Check if you're logged in with the correct account</span>
            </li>
            <li className="flex items-start gap-2">
              <span className="text-blue-500 mt-0.5">•</span>
              <span>Return to the dashboard to access available features</span>
            </li>
          </ul>
        </div>
      </CardContent>

      <CardFooter className="flex justify-center gap-3">
        <Button variant="outline" onClick={handleBackClick}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          {backText}
        </Button>
        <Button onClick={handleHomeClick}>
          <Home className="h-4 w-4 mr-2" />
          Go to Home
        </Button>
      </CardFooter>
    </Card>
  );

  if (fullPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-50 p-4">
        {content}
      </div>
    );
  }

  return content;
}

/**
 * MinimalAccessDenied component
 *
 * Smaller, inline access denied message
 *
 * @example
 * ```tsx
 * <MinimalAccessDenied message="Premium feature only" />
 * ```
 */
interface MinimalAccessDeniedProps {
  message?: string;
  showIcon?: boolean;
}

export function MinimalAccessDenied({
  message = "You don't have permission to view this",
  showIcon = true,
}: MinimalAccessDeniedProps) {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="text-center space-y-2">
        {showIcon && <Lock className="h-8 w-8 text-muted-foreground mx-auto" />}
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
