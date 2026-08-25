"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { UpdatePaymentProviderRequest } from "@/store/api/endpoints/paymentApi";

/**
 * Write-only secret editor.
 *
 * `value` is NEVER the real stored secret - the backend only ever exposes a
 * masked preview (or nothing at all, for webhook secrets). `value` only ever
 * holds what the operator is actively retyping.
 */
export interface SecretFieldState {
  editing: boolean;
  value: string;
}

export const EMPTY_SECRET_STATE: SecretFieldState = {
  editing: false,
  value: "",
};

interface SecretFieldProps {
  label: string;
  hint?: string;
  maskedValue: string | null;
  isSet: boolean;
  state: SecretFieldState;
  onChange: (next: SecretFieldState) => void;
  required?: boolean;
  /** keyId is public - show it in full instead of masking as a password field. */
  revealable?: boolean;
  placeholder?: string;
}

export function SecretField({
  label,
  hint,
  maskedValue,
  isSet,
  state,
  onChange,
  required,
  revealable = false,
  placeholder,
}: SecretFieldProps) {
  const id = useId();
  const { editing, value } = state;

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Label htmlFor={id} className="text-sm">
          {label}
          {required && <span className="ml-0.5 text-destructive">*</span>}
        </Label>

        {editing ? (
          <Badge
            variant="outline"
            className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300"
          >
            Will be replaced on save
          </Badge>
        ) : isSet ? (
          <Badge
            variant="outline"
            className="border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
          >
            Saved
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="border-red-300 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950 dark:text-red-300"
          >
            Not configured
          </Badge>
        )}
      </div>

      <div className="flex items-center gap-2">
        {isSet && !editing ? (
          <>
            <Input
              id={id}
              readOnly
              value={maskedValue ?? "••••••••••••"}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onChange({ editing: true, value: "" })}
            >
              Change
            </Button>
          </>
        ) : editing ? (
          <>
            <Input
              id={id}
              type={revealable ? "text" : "password"}
              autoComplete="off"
              value={value}
              placeholder={placeholder}
              onChange={(e) =>
                onChange({ editing: true, value: e.target.value })
              }
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onChange({ editing: false, value: "" })}
            >
              Cancel
            </Button>
          </>
        ) : (
          // Not configured yet - there is nothing to protect, so the field is
          // directly typable. The first keystroke flips `editing` to true via
          // onChange below (buildSecretPayload only picks up editing fields).
          <Input
            id={id}
            type={revealable ? "text" : "password"}
            autoComplete="off"
            value={value}
            placeholder={placeholder ?? "Not configured"}
            onChange={(e) => onChange({ editing: true, value: e.target.value })}
          />
        )}
      </div>

      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

/**
 * Builds the credential portion of an update payload from a bag of
 * `SecretFieldState`s, keyed by the exact `UpdatePaymentProviderRequest`
 * field name (e.g. "liveKeySecret").
 *
 * Only fields the operator actually retyped (`editing && value.trim() !== ""`)
 * are emitted. This is load-bearing: a save that only changes `minAmount`
 * must never null out a working live key by round-tripping an empty/masked
 * value back to the server.
 */
export function buildSecretPayload(
  secrets: Record<string, SecretFieldState>,
): Partial<UpdatePaymentProviderRequest> {
  const payload: Record<string, string> = {};

  for (const [field, state] of Object.entries(secrets)) {
    if (state.editing && state.value.trim() !== "") {
      payload[field] = state.value.trim();
    }
  }

  return payload as Partial<UpdatePaymentProviderRequest>;
}
