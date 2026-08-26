/**
 * Top-level navigation via a synthesised form POST.
 *
 * CCAvenue (and other non-seamless gateways) are not a JS checkout modal -
 * the browser has to leave the SPA entirely and POST an encrypted payload
 * (`encRequest`, `access_code`) straight to the gateway's hosted page. There
 * is no fetch/XHR equivalent for a cross-origin top-level POST navigation,
 * so this builds a real `<form>`, appends it to the document, and submits
 * it.
 *
 * MUST be called from a user-gesture call stack (e.g. directly inside a
 * click handler's synchronous continuation, or the `.then()`/`.unwrap()`
 * chain immediately following one) - Safari and popup blockers can refuse a
 * `submit()` that they can't trace back to a user gesture.
 */
export function postRedirect(
  url: string,
  fields: Record<string, string>,
): void {
  if (typeof window === "undefined") return;

  const form = document.createElement("form");
  form.method = "POST";
  form.action = url;
  // Deliberately not setting target="_blank" / a named target - this must
  // navigate the current top-level document away to the gateway, not open
  // a new tab/window.

  for (const [name, value] of Object.entries(fields)) {
    const input = document.createElement("input");
    input.type = "hidden";
    input.name = name;
    input.value = value;
    form.appendChild(input);
  }

  // Do NOT remove the form before submit() - some browsers abort the
  // navigation if the form is detached from the document first.
  document.body.appendChild(form);
  form.submit();
}
