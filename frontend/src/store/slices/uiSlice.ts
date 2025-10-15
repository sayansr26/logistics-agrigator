import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import type { RootState } from "../index";

// Define notification interface
interface Notification {
  id: string;
  type: "success" | "error" | "warning" | "info";
  message: string;
  duration?: number; // Auto-dismiss duration in ms (null = manual dismiss)
}

// Define modal interface
interface Modal {
  id: string;
  isOpen: boolean;
  data?: any; // Optional data passed to modal
}

// Define the UI state interface
interface UIState {
  // Sidebar state
  sidebarOpen: boolean;
  sidebarCollapsed: boolean;

  // Theme
  theme: "light" | "dark" | "system";

  // Loading states
  globalLoading: boolean;
  loadingMessage: string | null;

  // Notifications/Toast
  notifications: Notification[];

  // Modals
  activeModal: Modal | null;

  // Breadcrumbs
  breadcrumbs: Array<{ label: string; href?: string }>;

  // Page title
  pageTitle: string;
}

// Initial state
const initialState: UIState = {
  sidebarOpen: true,
  sidebarCollapsed: false,
  theme: "light",
  globalLoading: false,
  loadingMessage: null,
  notifications: [],
  activeModal: null,
  breadcrumbs: [],
  pageTitle: "Dashboard",
};

// Create the UI slice
export const uiSlice = createSlice({
  name: "ui",
  initialState,

  reducers: {
    // Sidebar actions
    toggleSidebar: (state) => {
      state.sidebarOpen = !state.sidebarOpen;
    },

    setSidebarOpen: (state, action: PayloadAction<boolean>) => {
      state.sidebarOpen = action.payload;
    },

    toggleSidebarCollapsed: (state) => {
      state.sidebarCollapsed = !state.sidebarCollapsed;
    },

    setSidebarCollapsed: (state, action: PayloadAction<boolean>) => {
      state.sidebarCollapsed = action.payload;
    },

    // Theme actions
    setTheme: (state, action: PayloadAction<"light" | "dark" | "system">) => {
      state.theme = action.payload;
    },

    // Loading actions
    setGlobalLoading: (
      state,
      action: PayloadAction<{ loading: boolean; message?: string }>,
    ) => {
      state.globalLoading = action.payload.loading;
      state.loadingMessage = action.payload.message || null;
    },

    // Notification actions
    addNotification: (
      state,
      action: PayloadAction<Omit<Notification, "id">>,
    ) => {
      const notification: Notification = {
        id: `${Date.now()}-${Math.random()}`,
        ...action.payload,
      };
      state.notifications.push(notification);
    },

    removeNotification: (state, action: PayloadAction<string>) => {
      state.notifications = state.notifications.filter(
        (notification) => notification.id !== action.payload,
      );
    },

    clearNotifications: (state) => {
      state.notifications = [];
    },

    // Modal actions
    openModal: (state, action: PayloadAction<{ id: string; data?: any }>) => {
      state.activeModal = {
        id: action.payload.id,
        isOpen: true,
        data: action.payload.data,
      };
    },

    closeModal: (state) => {
      state.activeModal = null;
    },

    // Breadcrumb actions
    setBreadcrumbs: (
      state,
      action: PayloadAction<Array<{ label: string; href?: string }>>,
    ) => {
      state.breadcrumbs = action.payload;
    },

    // Page title action
    setPageTitle: (state, action: PayloadAction<string>) => {
      state.pageTitle = action.payload;
    },
  },
});

// Export actions
export const {
  toggleSidebar,
  setSidebarOpen,
  toggleSidebarCollapsed,
  setSidebarCollapsed,
  setTheme,
  setGlobalLoading,
  addNotification,
  removeNotification,
  clearNotifications,
  openModal,
  closeModal,
  setBreadcrumbs,
  setPageTitle,
} = uiSlice.actions;

// Export selectors
export const selectSidebarOpen = (state: RootState) => state.ui.sidebarOpen;
export const selectSidebarCollapsed = (state: RootState) =>
  state.ui.sidebarCollapsed;
export const selectTheme = (state: RootState) => state.ui.theme;
export const selectGlobalLoading = (state: RootState) => state.ui.globalLoading;
export const selectLoadingMessage = (state: RootState) =>
  state.ui.loadingMessage;
export const selectNotifications = (state: RootState) => state.ui.notifications;
export const selectActiveModal = (state: RootState) => state.ui.activeModal;
export const selectBreadcrumbs = (state: RootState) => state.ui.breadcrumbs;
export const selectPageTitle = (state: RootState) => state.ui.pageTitle;

// Export reducer
export default uiSlice.reducer;
