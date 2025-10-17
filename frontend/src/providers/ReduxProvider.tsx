"use client";

import React from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { AuthHydration } from "@/components/AuthHydration";

interface ReduxProviderProps {
  children: React.ReactNode;
}

/**
 * Redux Provider Component
 *
 * Wraps the application with Redux store provider.
 * Must be a client component to use Redux hooks.
 *
 * Includes AuthHydration component to restore authentication
 * state from localStorage on client-side mount.
 */
export function ReduxProvider({ children }: ReduxProviderProps) {
  return (
    <Provider store={store}>
      <AuthHydration />
      {children}
    </Provider>
  );
}
