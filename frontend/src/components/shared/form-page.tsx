"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { ArrowLeft, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

// Form page wrapper
interface FormPageProps {
  title: string;
  description?: string;
  backHref: string;
  backLabel?: string;
  children: ReactNode;
  onSubmit: (e: React.FormEvent) => void;
  isSubmitting?: boolean;
  submitLabel?: string;
  cancelLabel?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl" | "2xl";
}

export function FormPage({
  title,
  description,
  backHref,
  backLabel = "Back",
  children,
  onSubmit,
  isSubmitting = false,
  submitLabel = "Save",
  cancelLabel = "Cancel",
  maxWidth = "2xl",
}: FormPageProps) {
  const router = useRouter();

  const maxWidthClass = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-xl",
    "2xl": "max-w-2xl",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <Link
          href={backHref}
          className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="mr-1 h-4 w-4" />
          {backLabel}
        </Link>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        {description && <p className="text-muted-foreground">{description}</p>}
      </div>

      {/* Form */}
      <form
        onSubmit={onSubmit}
        className={cn("space-y-6", maxWidthClass[maxWidth])}
      >
        {children}

        {/* Footer */}
        <div className="flex items-center gap-4 pt-4 border-t">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {submitLabel}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => router.push(backHref)}
          >
            {cancelLabel}
          </Button>
        </div>
      </form>
    </div>
  );
}

// Form section grouping
interface FormSectionProps {
  title: string;
  description?: string;
  children: ReactNode;
}

export function FormSection({
  title,
  description,
  children,
}: FormSectionProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

// Form field wrapper
interface FormFieldProps {
  label: string;
  required?: boolean;
  error?: string;
  children: ReactNode;
}

export function FormField({
  label,
  required,
  error,
  children,
}: FormFieldProps) {
  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </label>
      {children}
      {error && <p className="text-sm text-red-500">{error}</p>}
    </div>
  );
}
