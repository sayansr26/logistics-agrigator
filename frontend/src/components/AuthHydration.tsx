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
    console.log("[AuthHydration] Running hydration from localStorage");
    const token = localStorage.getItem("token");
    const userStr = localStorage.getItem("user");
    console.log("[AuthHydration] Token exists:", !!token);
    console.log("[AuthHydration] User exists:", !!userStr);

    // Also set cookies if we have localStorage values (for middleware)
    if (token && userStr) {
      try {
        const user = JSON.parse(userStr);
        // Set cookies for middleware authentication
        document.cookie = `token=${token}; path=/; max-age=86400; SameSite=Lax`;
        document.cookie = `userRole=${user.role}; path=/; max-age=86400; SameSite=Lax`;
        console.log("[AuthHydration] ✅ Cookies set for middleware");

        // Hydrate permissions into Redux permission slice
        if (user.permissions && Array.isArray(user.permissions)) {
          dispatch(setPermissions(user.permissions));
          console.log(
            "[AuthHydration] ✅ Permissions hydrated:",
            user.permissions.length,
            "permissions",
          );
        }
      } catch (error) {
        console.error("[AuthHydration] Error parsing user:", error);
      }
    }

    // Hydrate auth state from localStorage on mount
    dispatch(hydrate());
    console.log("[AuthHydration] Hydration dispatched");
  }, [dispatch]);

  // This component doesn't render anything
  return null;
}
