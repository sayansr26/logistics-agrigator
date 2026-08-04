"use client";

import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SearchableSelectOption {
  id: string;
}

interface SearchableSelectProps<T extends SearchableSelectOption> {
  /** Full option list (already fetched); filtering happens client-side against `getOptionText`. */
  options: T[];
  /** Currently selected option, if any — drives the closed-state display text. */
  value: T | null;
  onSelect: (option: T) => void;
  /** Text used both for client-side filtering and as the default rendered row. */
  getOptionText: (option: T) => string;
  /** Custom row renderer; falls back to `getOptionText`. */
  renderOption?: (option: T, highlighted: boolean) => ReactNode;
  /** Text shown in the input while closed and nothing is being typed. */
  getDisplayText?: (option: T) => string;
  placeholder?: string;
  icon?: ReactNode;
  disabled?: boolean;
  loading?: boolean;
  noResults?: ReactNode;
  className?: string;
  /** Fires on every keystroke — wire to a debounced server search for large lists. */
  onQueryChange?: (query: string) => void;
  inputId?: string;
}

/**
 * Generic autocomplete: text input + absolutely-positioned filtered dropdown.
 * Modeled on the hand-rolled idiom in app/addresses/page.tsx (input + onBlur
 * 200ms close delay), styled with shadcn tokens for the booking wizard.
 */
export function SearchableSelect<T extends SearchableSelectOption>({
  options,
  value,
  onSelect,
  getOptionText,
  renderOption,
  getDisplayText,
  placeholder = "Search or select...",
  icon,
  disabled,
  loading,
  noResults,
  className,
  onQueryChange,
  inputId,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlight, setHighlight] = useState(0);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (closeTimer.current) clearTimeout(closeTimer.current);
    };
  }, []);

  const filtered = query
    ? options.filter((o) =>
        getOptionText(o).toLowerCase().includes(query.toLowerCase()),
      )
    : options;

  const displayValue = value ? (getDisplayText || getOptionText)(value) : "";

  function openList() {
    if (disabled) return;
    setOpen(true);
    setHighlight(0);
  }

  function closeList() {
    closeTimer.current = setTimeout(() => {
      setOpen(false);
      setQuery("");
    }, 200);
  }

  function cancelClose() {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }

  function pick(opt: T) {
    cancelClose();
    onSelect(opt);
    setQuery("");
    setOpen(false);
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "Enter") {
        e.preventDefault();
        openList();
      }
      return;
    }
    if (e.key === "Escape") {
      e.preventDefault();
      cancelClose();
      setOpen(false);
      setQuery("");
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setHighlight((h) => Math.min(h + 1, filtered.length - 1));
      return;
    }
    if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlight((h) => Math.max(h - 1, 0));
      return;
    }
    if (e.key === "Enter") {
      e.preventDefault();
      const opt = filtered[highlight];
      if (opt) pick(opt);
    }
  }

  return (
    <div className={cn("relative", className)}>
      {icon && (
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none [&>svg]:h-3.5 [&>svg]:w-3.5">
          {icon}
        </span>
      )}
      <input
        id={inputId}
        type="text"
        disabled={disabled}
        value={open ? query : displayValue}
        placeholder={placeholder}
        onFocus={() => {
          openList();
          setQuery("");
        }}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setHighlight(0);
          onQueryChange?.(e.target.value);
        }}
        onBlur={closeList}
        onKeyDown={handleKeyDown}
        className={cn(
          "w-full text-xs py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary font-medium text-foreground placeholder:text-muted-foreground disabled:opacity-50 disabled:cursor-not-allowed",
          icon ? "pl-9" : "pl-3",
          "pr-8",
        )}
      />
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground animate-spin pointer-events-none" />
      ) : (
        <ChevronDown className="h-3.5 w-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
      )}

      {open && (
        <div
          className="absolute left-0 right-0 top-full mt-1 bg-popover border border-border rounded-xl shadow-xl z-30 max-h-56 overflow-y-auto divide-y divide-border"
          onMouseDown={(e) => e.preventDefault()}
        >
          {filtered.length === 0 ? (
            <div className="px-3 py-3 text-xs text-muted-foreground">
              {noResults || "No results found"}
            </div>
          ) : (
            filtered.map((opt, idx) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => pick(opt)}
                onMouseEnter={() => setHighlight(idx)}
                className={cn(
                  "w-full px-3 py-2 text-left text-xs hover:bg-accent hover:text-accent-foreground transition-colors",
                  idx === highlight && "bg-accent text-accent-foreground",
                  value?.id === opt.id && "font-semibold",
                )}
              >
                {renderOption
                  ? renderOption(opt, idx === highlight)
                  : getOptionText(opt)}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
