import { useCallback, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import {
  setGlobalLoading,
  selectGlobalLoading,
  selectLoadingMessage,
} from "@/store/slices/uiSlice";

/**
 * Hook for managing global loading states
 *
 * @example
 * ```tsx
 * const { isLoading, loadingMessage, startLoading, stopLoading } = useLoading();
 *
 * const handleSubmit = async () => {
 *   startLoading('Saving changes...');
 *   try {
 *     await saveData();
 *   } finally {
 *     stopLoading();
 *   }
 * };
 * ```
 */
export const useLoading = () => {
  const dispatch = useAppDispatch();
  const isLoading = useAppSelector(selectGlobalLoading);
  const loadingMessage = useAppSelector(selectLoadingMessage);

  const startLoading = useCallback(
    (message?: string) => {
      dispatch(setGlobalLoading({ loading: true, message }));
    },
    [dispatch],
  );

  const stopLoading = useCallback(() => {
    dispatch(setGlobalLoading({ loading: false }));
  }, [dispatch]);

  return {
    isLoading,
    loadingMessage,
    startLoading,
    stopLoading,
  };
};

/**
 * Hook for creating scoped loading states (not global)
 *
 * @example
 * ```tsx
 * const { isLoading, withLoading } = useScopedLoading();
 *
 * const handleAction = withLoading(async () => {
 *   await performAction();
 * });
 *
 * return <Button onClick={handleAction} disabled={isLoading}>Submit</Button>
 * ```
 */
export const useScopedLoading = () => {
  const [isLoading, setIsLoading] = useState(false);

  const withLoading = useCallback(
    async <T>(asyncFn: () => Promise<T>): Promise<T> => {
      setIsLoading(true);
      try {
        return await asyncFn();
      } finally {
        setIsLoading(false);
      }
    },
    [],
  );

  return {
    isLoading,
    withLoading,
    setIsLoading,
  };
};
