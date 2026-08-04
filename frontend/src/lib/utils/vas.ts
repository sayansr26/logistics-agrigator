import type { BookingQuestion } from "@/store/api/endpoints/chargesApi";
import type { VasSelection } from "@/store/api/endpoints/shipmentApi";

/**
 * Per-question answer captured by the wizard's VAS section.
 *
 * `value` holds the primary answer (boolean / select value / number /
 * datetime string). `followUpValues` holds any nested follow-up field
 * values (e.g. LOADING_FLOOR's `floor` select), keyed by follow-up `key`.
 */
export interface VasAnswer {
  value: unknown;
  followUpValues?: Record<string, unknown>;
}

export type VasAnswers = Record<string, VasAnswer>;

/**
 * Builds the `vasSelections` array the /quotes and /shipments endpoints
 * expect, from the wizard's local answer map + the booking-question specs.
 *
 * Rules (per charges-engine v3 contract):
 * - Unanswered questions are omitted entirely.
 * - Boolean questions left at `false` are omitted (no charge, nothing to
 *   price) - only explicit "yes" answers are sent.
 * - Boolean questions WITH follow-up fields, answered "yes", are sent as
 *   `{ enabled: true, <followUpKey>: value, ... }`.
 * - Everything else (select/number/datetime, or a boolean with no
 *   follow-up) is sent as the scalar answer.
 */
export function buildVasSelections(
  questions: BookingQuestion[],
  answers: VasAnswers,
): VasSelection[] {
  const out: VasSelection[] = [];

  for (const q of questions) {
    const answer = answers[q.chargeCode];
    if (!answer || answer.value === undefined || answer.value === null) {
      continue;
    }
    if (answer.value === "") continue;

    const spec = q.question;

    if (spec.type === "boolean") {
      if (answer.value !== true) continue; // false / unanswered -> omit

      if (spec.followUp && spec.followUp.length > 0) {
        const followUpObj: Record<string, unknown> = { enabled: true };
        let hasFollowUp = false;
        for (const f of spec.followUp) {
          const v = answer.followUpValues?.[f.key];
          if (v !== undefined && v !== null && v !== "") {
            followUpObj[f.key] = v;
            hasFollowUp = true;
          }
        }
        out.push({
          chargeCode: q.chargeCode,
          answer: hasFollowUp ? followUpObj : true,
        });
      } else {
        out.push({ chargeCode: q.chargeCode, answer: true });
      }
      continue;
    }

    out.push({
      chargeCode: q.chargeCode,
      answer: answer.value as VasSelection["answer"],
    });
  }

  // Joi caps vasSelections at 20 items.
  return out.slice(0, 20);
}

/** True if the given question has a non-empty answer recorded. */
export function isVasAnswered(
  answers: VasAnswers,
  chargeCode: string,
): boolean {
  const a = answers[chargeCode];
  return !!a && a.value !== undefined && a.value !== null && a.value !== "";
}
