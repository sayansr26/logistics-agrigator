"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Code sample with a copy button and optional language tabs.
 *
 * Intentionally dependency-free — no syntax highlighter is installed and
 * `next.config.js` disables type/lint checks during builds, which makes a new
 * dependency an easy way to break the build without noticing. Colour comes
 * from a tiny token pass over the text instead.
 */

export interface CodeSample {
  label: string;
  language: string;
  code: string;
}

/** Minimal, deliberately conservative token colouring for curl/JSON/JS/Python. */
function highlight(code: string): React.ReactNode[] {
  const pattern =
    /("(?:[^"\\]|\\.)*")|(\b\d+(?:\.\d+)?\b)|(#.*$|\/\/.*$)|(\b(?:const|let|var|async|await|function|import|from|return|if|else|new|class|def|print|True|False|None|null|true|false)\b)|(\b(?:curl|POST|GET|PATCH|DELETE|PUT)\b)/gm;

  const nodes: React.ReactNode[] = [];
  let last = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  while ((match = pattern.exec(code)) !== null) {
    if (match.index > last) nodes.push(code.slice(last, match.index));

    const [text, str, num, comment, keyword, verb] = match;
    let className = "";
    if (str) className = "text-emerald-600 dark:text-emerald-400";
    else if (num) className = "text-amber-600 dark:text-amber-400";
    else if (comment) className = "text-muted-foreground italic";
    else if (keyword) className = "text-violet-600 dark:text-violet-400";
    else if (verb) className = "text-sky-600 dark:text-sky-400 font-semibold";

    nodes.push(
      <span key={key++} className={className}>
        {text}
      </span>,
    );
    last = match.index + text.length;
  }

  if (last < code.length) nodes.push(code.slice(last));
  return nodes;
}

export function CodeBlock({
  samples,
  className,
}: {
  samples: CodeSample[];
  className?: string;
}) {
  const [active, setActive] = useState(0);
  const [copied, setCopied] = useState(false);

  const sample = samples[active] ?? samples[0];
  if (!sample) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(sample.code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      // Clipboard can be unavailable (insecure origin, denied permission);
      // the code is selectable either way.
    }
  };

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-muted/40 dark:bg-muted/20",
        className,
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b bg-muted/60 px-2 py-1 dark:bg-muted/30">
        <div className="flex flex-wrap items-center gap-1">
          {samples.map((s, i) => (
            <button
              key={s.label}
              type="button"
              onClick={() => setActive(i)}
              className={cn(
                "rounded px-2.5 py-1 text-xs font-medium transition-colors",
                i === active
                  ? "bg-background text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {s.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={copy}
          aria-label="Copy code"
          className="flex shrink-0 items-center gap-1 rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5" /> Copied
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" /> Copy
            </>
          )}
        </button>
      </div>

      <pre className="overflow-x-auto p-4 text-xs leading-relaxed">
        <code className="font-mono">{highlight(sample.code)}</code>
      </pre>
    </div>
  );
}

/** Coloured pill for an HTTP verb. */
export function MethodBadge({ method }: { method: string }) {
  const colors: Record<string, string> = {
    GET: "bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300",
    POST: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
    PATCH: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    PUT: "bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300",
    DELETE: "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300",
  };

  return (
    <span
      className={cn(
        "inline-flex shrink-0 rounded px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-wide",
        colors[method] || "bg-muted text-muted-foreground",
      )}
    >
      {method}
    </span>
  );
}
