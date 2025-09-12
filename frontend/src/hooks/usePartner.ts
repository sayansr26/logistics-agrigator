import { useState, useEffect } from "react";
import { partnersApiService } from "@/services";
import { Partner, PartnerResponse } from "@/types/partner";
import { useAuthStore } from "@/store/auth-store";

interface UsePartnerReturn {
  partner: Partner | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePartner(partnerId: string): UsePartnerReturn {
  const [partner, setPartner] = useState<Partner | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accessToken, isAuthenticated } = useAuthStore();

  const fetchPartner = async () => {
    if (!isAuthenticated || !accessToken || !partnerId) {
      setError("Authentication required or invalid partner ID");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Set the access token in the partners API service
      partnersApiService.setAccessToken(accessToken);

      const response: PartnerResponse =
        await partnersApiService.getPartnerById(partnerId);

      if (response.status === "success" && response.data) {
        setPartner(response.data.partner);
      } else {
        throw new Error(response.error?.message || "Failed to fetch partner");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch partner";
      setError(errorMessage);
      console.error("Error fetching partner:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (partnerId) {
      fetchPartner();
    }
  }, [isAuthenticated, accessToken, partnerId]);

  return {
    partner,
    isLoading,
    error,
    refetch: fetchPartner,
  };
}
