"use client";

import { useEffect } from "react";
import { useAppDispatch } from "@/store/hooks";
import { hydrate } from "@/store/slices/authSlice";
import { setPermissions } from "@/store/slices/permissionSlice";

/**
 * AuthHydration Component
 *
 * Hydrates Redux auth state from localStorage on client-side mount.
 * This component must be rendered in the app layout to ensure
 * authentication state persists across page refreshes.
 *
 * Why this is needed:
 * - Next.js SSR doesn't have access to localStorage
 * - Redux initialState can't read localStorage during SSR
 * - We need to hydrate auth state after client-side mount
 */
export function AuthHydration() {
  const dispatch = useAppDispatch();

  useEffect(() => {
    // Hydrate auth state from localStorage. The reducer validates token
    // expiry and owns the middleware cookies (see lib/auth/token.ts), so
    // nothing here writes document.cookie directly any more.
    dispatch(hydrate());

    // Permissions live on the stored user object (they come from the JWT).
    try {
      const userStr = localStorage.getItem("user");
      const user = userStr ? JSON.parse(userStr) : null;

      if (user?.permissions && Array.isArray(user.permissions)) {
        dispatch(setPermissions(user.permissions));
      }
    } catch (error) {
      console.error(
        "[AuthHydration] Failed to read stored permissions:",
        error,
      );
    }
  }, [dispatch]);

  // This component doesn't render anything
  return null;
}
