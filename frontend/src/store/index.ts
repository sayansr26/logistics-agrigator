import { configureStore } from "@reduxjs/toolkit";
import { setupListeners } from "@reduxjs/toolkit/query";
import { baseApi } from "./api/baseApi";
import authReducer from "./slices/authSlice";
import permissionReducer from "./slices/permissionSlice";
import uiReducer from "./slices/uiSlice";
import {
  errorMiddleware,
  successMiddleware,
} from "./middleware/errorMiddleware";

export const store = configureStore({
  reducer: {
    // RTK Query API
    [baseApi.reducerPath]: baseApi.reducer,

    // Redux slices
    auth: authReducer,
    permission: permissionReducer,
    ui: uiReducer,
  },

  // Adding the api middleware enables caching, invalidation, polling,
  // and other useful features of RTK Query
  // Adding error and success middleware for global error handling and notifications
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware()
      .concat(baseApi.middleware)
      .concat(errorMiddleware)
      .concat(successMiddleware),

  // Enable Redux DevTools in development only
  devTools: process.env.NODE_ENV !== "production",
});

// Optional, but required for refetchOnFocus/refetchOnReconnect behaviors
// See `setupListeners` docs for more info
setupListeners(store.dispatch);

// Infer the `RootState` and `AppDispatch` types from the store itself
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
