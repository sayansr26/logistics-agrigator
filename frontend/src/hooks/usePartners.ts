import { useState, useEffect } from "react";
import { partnersApiService } from "@/services";
import { Partner, PartnerListApiResponse } from "@/types/partner";
import { useAuthStore } from "@/store/auth-store";

interface UsePartnersOptions {
  isActive?: boolean;
  supportsCOD?: boolean;
  supportsReverse?: boolean;
}

interface UsePartnersReturn {
  partners: Partner[];
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

export function usePartners(
  options: UsePartnersOptions = {},
): UsePartnersReturn {
  const [partners, setPartners] = useState<Partner[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { accessToken, isAuthenticated } = useAuthStore();

  const fetchPartners = async () => {
    if (!isAuthenticated || !accessToken) {
      setError("Authentication required");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Set the access token in the partners API service
      partnersApiService.setAccessToken(accessToken);

      // Only pass filters if they are explicitly set
      const filters: any = {};
      if (options.isActive !== undefined) filters.isActive = options.isActive;
      if (options.supportsCOD !== undefined)
        filters.supportsCOD = options.supportsCOD;
      if (options.supportsReverse !== undefined)
        filters.supportsReverse = options.supportsReverse;

      const response: PartnerListApiResponse =
        await partnersApiService.getPartners(
          Object.keys(filters).length > 0 ? filters : undefined,
        );

      if (response.status === "success" && response.data) {
        console.log("Partners fetched successfully:", response.data.partners);
        console.log("Partners by status:", {
          active: response.data.partners.filter((p) => p.isActive === true),
          inactive: response.data.partners.filter((p) => p.isActive === false),
          pending: response.data.partners.filter(
            (p) => p.isActive === null || p.isActive === undefined,
          ),
        });
        setPartners(response.data.partners);
      } else {
        throw new Error(response.error?.message || "Failed to fetch partners");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch partners";
      setError(errorMessage);
      console.error("Error fetching partners:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPartners();
  }, [
    isAuthenticated,
    accessToken,
    options.isActive,
    options.supportsCOD,
    options.supportsReverse,
  ]);

  return {
    partners,
    isLoading,
    error,
    refetch: fetchPartners,
  };
}
