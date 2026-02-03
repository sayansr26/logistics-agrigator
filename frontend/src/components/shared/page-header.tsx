"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus } from "lucide-react";

interface PageHeaderProps {
  title: string;
  description?: string;
  backHref?: string;
  backLabel?: string;
  actions?: ReactNode;
  primaryAction?: {
    label: string;
    href?: string;
    onClick?: () => void;
    icon?: ReactNode;
  };
}

export function PageHeader({
  title,
  description,
  backHref,
  backLabel = "Back",
  actions,
  primaryAction,
}: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between">
      <div className="space-y-1">
        {backHref && (
          <Link
            href={backHref}
            className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-2"
          >
            <ArrowLeft className="mr-1 h-4 w-4" />
            {backLabel}
          </Link>
        )}
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>
      <div className="flex items-center gap-2">
        {actions}
        {primaryAction &&
          (primaryAction.href ? (
            <Button asChild>
              <Link href={primaryAction.href}>
                {primaryAction.icon || <Plus className="mr-2 h-4 w-4" />}
                {primaryAction.label}
              </Link>
            </Button>
          ) : (
            <Button onClick={primaryAction.onClick}>
              {primaryAction.icon || <Plus className="mr-2 h-4 w-4" />}
              {primaryAction.label}
            </Button>
          ))}
      </div>
    </div>
  );
}
