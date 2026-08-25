"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn } from "@/lib/utils";

const COPIED_RESET_MS = 1500;

interface CopyButtonProps {
  value: string;
  label?: string;
  size?: "icon" | "sm";
  className?: string;
}

/**
 * Copies `value` to the clipboard with a brief Copy -> Check icon swap.
 *
 * Falls back to a hidden textarea + `document.execCommand("copy")` when
 * `navigator.clipboard` is unavailable (non-secure-context dev hosts, e.g.
 * a plain-http LAN IP during local testing).
 */
export function CopyButton({
  value,
  label = "Copy",
  size = "icon",
  className,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const toast = useToast();

  const handleCopy = async () => {
    let ok = false;

    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(value);
        ok = true;
      } catch {
        ok = false;
      }
    }

    if (!ok) {
      const textarea = document.createElement("textarea");
      textarea.value = value;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.focus();
      textarea.select();
      try {
        ok = document.execCommand("copy");
      } catch {
        ok = false;
      } finally {
        document.body.removeChild(textarea);
      }
    }

    if (!ok) {
      toast.error("Couldn't copy to clipboard");
      return;
    }

    setCopied(true);
    toast.success("Copied");
    setTimeout(() => setCopied(false), COPIED_RESET_MS);
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size={size === "icon" ? "icon" : "sm"}
      onClick={handleCopy}
      className={cn(size === "icon" && "h-8 w-8", className)}
      aria-label={label}
    >
      {copied ? (
        <Check className="h-4 w-4 text-emerald-600" />
      ) : (
        <Copy className="h-4 w-4" />
      )}
      {size === "sm" && (
        <span className="ml-1.5">{copied ? "Copied" : label}</span>
      )}
    </Button>
  );
}
