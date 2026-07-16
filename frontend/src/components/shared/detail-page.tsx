"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ArrowLeft, MoreVertical, Edit, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Detail page header
interface DetailHeaderProps {
  title: string;
  subtitle?: string;
  description?: string;
  badges?: ReactNode;
  backHref?: string;
  backLabel?: string;
  status?: {
    label: string;
    variant: "default" | "success" | "warning" | "destructive";
  };
  actions?: ReactNode;
  onEdit?: () => void;
  onDelete?: () => void;
  editHref?: string;
  canEdit?: boolean;
  canDelete?: boolean;
}

export function DetailHeader({
  title,
  subtitle,
  description,
  badges,
  backHref,
  backLabel = "Back",
  status,
  actions,
  onEdit,
  onDelete,
  editHref,
  canEdit = true,
  canDelete = false,
}: DetailHeaderProps) {
  const router = useRouter();

  const statusVariantClass = {
    default: "bg-gray-100 text-gray-800",
    success: "bg-green-100 text-green-800",
    warning: "bg-yellow-100 text-yellow-800",
    destructive: "bg-red-100 text-red-800",
  };

  return (
    <div className="flex items-start justify-between">
      <div className="space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
          {status && (
            <Badge className={statusVariantClass[status.variant]}>
              {status.label}
            </Badge>
          )}
          {badges}
        </div>
        {subtitle && <p className="text-muted-foreground">{subtitle}</p>}
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {(canEdit || canDelete) && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="icon">
                <MoreVertical className="h-4 w-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuLabel>Actions</DropdownMenuLabel>
              <DropdownMenuSeparator />
              {canEdit && (
                <DropdownMenuItem
                  onClick={() => {
                    if (editHref) router.push(editHref);
                    else if (onEdit) onEdit();
                  }}
                >
                  <Edit className="h-4 w-4 mr-2" />
                  Edit
                </DropdownMenuItem>
              )}
              {canDelete && (
                <>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={onDelete}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="h-4 w-4 mr-2" />
                    Delete
                  </DropdownMenuItem>
                </>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}

// Detail section card
interface DetailSectionProps {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function DetailSection({
  title,
  children,
  actions,
}: DetailSectionProps) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg">{title}</CardTitle>
          {actions}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

// Key-value item for detail displays
interface DetailItemProps {
  label: string;
  value: ReactNode;
  className?: string;
  mono?: boolean;
}

export function DetailItem({ label, value, className, mono }: DetailItemProps) {
  return (
    <div className={cn("space-y-1", className)}>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={cn("font-medium", mono && "font-mono")}>{value || "—"}</p>
    </div>
  );
}

// Grid for detail items
interface DetailGridProps {
  children: ReactNode;
  columns?: 2 | 3 | 4;
}

export function DetailGrid({ children, columns = 2 }: DetailGridProps) {
  const columnClass = {
    2: "grid-cols-1 md:grid-cols-2",
    3: "grid-cols-1 md:grid-cols-2 lg:grid-cols-3",
    4: "grid-cols-1 md:grid-cols-2 lg:grid-cols-4",
  };

  return (
    <div className={cn("grid gap-4", columnClass[columns])}>{children}</div>
  );
}
