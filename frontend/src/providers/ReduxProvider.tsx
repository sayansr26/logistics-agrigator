"use client";

import React from "react";
import { Provider } from "react-redux";
import { store } from "@/store";

interface ReduxProviderProps {
  children: React.ReactNode;
}

/**
 * Redux Provider Component
 *
 * Wraps the application with Redux store provider.
 * Must be a client component to use Redux hooks.
 */
export function ReduxProvider({ children }: ReduxProviderProps) {
  return <Provider store={store}>{children}</Provider>;
}
