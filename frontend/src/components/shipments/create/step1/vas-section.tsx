"use client";

import { useState } from "react";
import { SlidersHorizontal, ChevronDown, Loader2 } from "lucide-react";
import { useGetBookingQuestionsQuery } from "@/store/api/endpoints/chargesApi";
import type { BookingQuestion } from "@/store/api/endpoints/chargesApi";
import { useShipmentFormStore } from "@/store/shipment-form-store";
import { isVasAnswered } from "@/lib/utils/vas";

/**
 * Dynamic Value Added Services section - renders one field per catalog
 * question from GET /charge-definitions/booking-questions (pre-quote, so
 * every configured question shows; Step 2 re-prices only what's actually
 * configured for the chosen partner via `requiredQuestions`).
 */
export function VasSection() {
  const [open, setOpen] = useState(false);
  const store = useShipmentFormStore();
  const { data, isLoading } = useGetBookingQuestionsQuery();
  const questions = data?.data?.questions || [];
  const answeredCount = questions.filter((q) =>
    isVasAnswered(store.vasAnswers, q.chargeCode),
  ).length;

  return (
    <div className="bg-card rounded-2xl border border-border shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full p-4 flex items-center justify-between text-left focus:outline-none hover:bg-accent transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
            <SlidersHorizontal className="h-3.5 w-3.5" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-foreground">
              Value Added Services
            </h2>
            <p className="text-[10px] text-muted-foreground font-normal">
              Insurance, packing, handling &amp; more
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {answeredCount > 0 && (
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 dark:bg-blue-950/40 dark:text-blue-400 px-2 py-0.5 rounded-full border border-blue-200 dark:border-blue-800">
              {answeredCount} selected
            </span>
          )}
          <span className="text-[10px] font-semibold text-muted-foreground bg-muted px-2 py-0.5 rounded-full border border-border">
            Optional
          </span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${open ? "rotate-180" : ""}`}
          />
        </div>
      </button>

      {open && (
        <div className="border-t border-border p-4 space-y-4 bg-muted/40">
          {isLoading ? (
            <div className="flex items-center gap-2 text-xs text-muted-foreground py-4">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading available
              services...
            </div>
          ) : questions.length === 0 ? (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No value-added services are configured yet.
            </p>
          ) : (
            questions.map((q) => (
              <VasQuestionField key={q.chargeCode} question={q} />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function VasQuestionField({ question }: { question: BookingQuestion }) {
  const store = useShipmentFormStore();
  const spec = question.question;
  const answer = store.vasAnswers[question.chargeCode];

  return (
    <div className="space-y-2 pb-3 border-b border-border last:border-0 last:pb-0">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-foreground">{question.name}</h3>
      </div>
      <p className="text-xs text-muted-foreground">{spec.label}</p>

      {spec.type === "boolean" && (
        <div className="space-y-2 text-xs pt-1">
          <div className="flex items-center gap-4">
            <label className="flex items-center cursor-pointer text-foreground font-medium">
              <input
                type="radio"
                name={`vas-${question.chargeCode}`}
                checked={answer?.value === true}
                onChange={() => store.setVasValue(question.chargeCode, true)}
                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2">Yes</span>
            </label>
            <label className="flex items-center cursor-pointer text-foreground font-medium">
              <input
                type="radio"
                name={`vas-${question.chargeCode}`}
                checked={answer?.value === false || answer?.value === undefined}
                onChange={() => store.setVasValue(question.chargeCode, false)}
                className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500"
              />
              <span className="ml-2">No</span>
            </label>
          </div>

          {answer?.value === true &&
            spec.followUp &&
            spec.followUp.length > 0 && (
              <div className="pl-1 pt-1 space-y-2">
                {spec.followUp.map((f) => (
                  <div key={f.key} className="space-y-1 max-w-xs">
                    <label className="block text-[11px] font-medium text-muted-foreground">
                      {f.label}
                    </label>
                    {f.type === "select" ? (
                      <select
                        value={String(answer?.followUpValues?.[f.key] ?? "")}
                        onChange={(e) =>
                          store.setVasFollowUp(
                            question.chargeCode,
                            f.key,
                            e.target.value,
                          )
                        }
                        className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground cursor-pointer"
                      >
                        <option value="">Select...</option>
                        {f.options?.map((opt) => (
                          <option
                            key={String(opt.value)}
                            value={String(opt.value)}
                          >
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    ) : f.type === "datetime" ? (
                      <input
                        type="datetime-local"
                        value={String(answer?.followUpValues?.[f.key] ?? "")}
                        onChange={(e) =>
                          store.setVasFollowUp(
                            question.chargeCode,
                            f.key,
                            e.target.value,
                          )
                        }
                        className="w-full text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground"
                      />
                    ) : (
                      <input
                        type={f.type === "number" ? "number" : "text"}
                        value={String(answer?.followUpValues?.[f.key] ?? "")}
                        onChange={(e) =>
                          store.setVasFollowUp(
                            question.chargeCode,
                            f.key,
                            e.target.value,
                          )
                        }
                        className="w-full text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground"
                      />
                    )}
                  </div>
                ))}
              </div>
            )}
        </div>
      )}

      {spec.type === "select" && (
        <div className="space-y-1.5 text-xs pt-1">
          {spec.options?.map((opt) => {
            const isSelected =
              String(answer?.value ?? spec.default ?? "") === String(opt.value);
            return (
              <label
                key={String(opt.value)}
                className={`flex items-start p-2.5 rounded-xl border cursor-pointer transition-colors ${
                  isSelected
                    ? "border-blue-200 dark:border-blue-800 bg-card"
                    : "border-border bg-card hover:border-primary/40"
                }`}
              >
                <input
                  type="radio"
                  name={`vas-${question.chargeCode}`}
                  checked={isSelected}
                  onChange={() =>
                    store.setVasValue(question.chargeCode, opt.value)
                  }
                  className="w-3.5 h-3.5 text-blue-600 focus:ring-blue-500 mt-0.5"
                />
                <span className="ml-2 font-medium text-foreground">
                  {opt.label}
                </span>
              </label>
            );
          })}
        </div>
      )}

      {spec.type === "datetime" && (
        <input
          type="datetime-local"
          value={String(answer?.value ?? "")}
          onChange={(e) =>
            store.setVasValue(question.chargeCode, e.target.value)
          }
          className="w-full max-w-xs text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground"
        />
      )}

      {spec.type === "number" && (
        <input
          type="number"
          value={String(answer?.value ?? "")}
          onChange={(e) =>
            store.setVasValue(question.chargeCode, e.target.value)
          }
          className="w-full max-w-xs text-xs px-3 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground"
        />
      )}
    </div>
  );
}
