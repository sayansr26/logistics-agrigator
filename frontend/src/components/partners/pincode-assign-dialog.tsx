"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  MapPin,
  Check,
  CheckCircle,
  X,
  AlertCircle,
} from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";

// RTK Query
import { useAssignPartnerPincodeMutation } from "@/store/api/endpoints/partnerPincodesApi";
import { useLazySearchPincodesQuery as useLazyGeoSearchPincodesQuery } from "@/store/api/endpoints/geoApi";

interface PincodeType {
  id: string;
  name: string;
  type: "yes_no" | "number";
  isActive: boolean;
}

interface PincodeAssignDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  pincodeTypes: PincodeType[];
  onSuccess: () => void;
}

interface SearchResult {
  id: string;
  code: string;
}

function normalizeSearchResults(results: unknown): SearchResult[] {
  if (!Array.isArray(results)) return [];

  return results
    .filter(
      (result): result is { id: string; code: string } =>
        typeof result?.id === "string" && typeof result?.code === "string",
    )
    .map((result) => ({
      id: result.id,
      code: result.code,
    }));
}

export function PincodeAssignDialog({
  open,
  onOpenChange,
  partnerId,
  pincodeTypes,
  onSuccess,
}: PincodeAssignDialogProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedPincode, setSelectedPincode] = useState<SearchResult | null>(
    null,
  );
  const [typeValues, setTypeValues] = useState<Record<string, string>>({});
  const [showResults, setShowResults] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [activeSearchQuery, setActiveSearchQuery] = useState("");

  // Search pincodes
  const [triggerSearch, { data: searchResultsData, isFetching: isSearching }] =
    useLazyGeoSearchPincodesQuery();

  // Assign pincode mutation
  const [assignPincode, { isLoading: isAssigning }] =
    useAssignPartnerPincodeMutation();

  // Debounced search with minimum 4 characters
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearchQuery(value);

      // Clear previous timer
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }

      // Hide results if less than 4 characters
      if (value.length < 4) {
        setActiveSearchQuery("");
        setShowResults(false);
        return;
      }

      // Set debounce timer (500ms)
      debounceTimerRef.current = setTimeout(() => {
        setActiveSearchQuery(value);
        triggerSearch({ code: value });
        setShowResults(true);
      }, 500);
    },
    [triggerSearch],
  );

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const searchResults =
    activeSearchQuery === searchQuery
      ? normalizeSearchResults(searchResultsData?.data)
      : [];

  // Handle pincode selection
  const handleSelectPincode = (pincode: SearchResult) => {
    setSelectedPincode(pincode);
    setSearchQuery("");
    setShowResults(false);
    setSubmitError(null);
  };

  // Clear selection
  const handleClearSelection = () => {
    setSelectedPincode(null);
    setSearchQuery("");
    setActiveSearchQuery("");
    setShowResults(false);
    setTypeValues({});
    setSubmitError(null);
  };

  // Handle type value change
  const handleTypeValueChange = (pincodeTypeId: string, value: string) => {
    setTypeValues((prev) => ({
      ...prev,
      [pincodeTypeId]: value,
    }));
  };

  // Reset form when dialog closes
  const handleClose = () => {
    handleClearSelection();
    onOpenChange(false);
  };

  // Handle submit
  const handleSubmit = async () => {
    if (!selectedPincode) {
      setSubmitError("Please select a pincode");
      return;
    }

    // Build pincode type values array
    const pincodeTypeValues = Object.entries(typeValues).map(
      ([pincodeTypeId, value]) => ({
        pincodeTypeId,
        value,
      }),
    );

    try {
      await assignPincode({
        partnerId,
        data: {
          pincodeId: selectedPincode.id,
          pincodeTypeValues,
        },
      }).unwrap();

      onSuccess();
      handleClose();
    } catch (error: any) {
      setSubmitError(error?.data?.error?.message || "Failed to assign pincode");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle>Assign Pincode</DialogTitle>
          <DialogDescription>
            Search for a pincode and configure its type values for this partner.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[60vh]">
          <div className="space-y-4 pr-4">
            {/* Pincode Search */}
            <div className="space-y-2">
              <Label>Search Pincode *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                {selectedPincode && (
                  <button
                    type="button"
                    onClick={handleClearSelection}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
                <Input
                  placeholder="Enter 6-digit pincode (min 4 digits, e.g., 1100)"
                  value={selectedPincode ? selectedPincode.code : searchQuery}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  className={
                    selectedPincode ? "bg-green-50 pl-10 pr-10" : "pl-10 pr-10"
                  }
                  disabled={!!selectedPincode}
                />
                {isSearching && (
                  <Loader2 className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                )}
              </div>

              {/* Search Results Dropdown */}
              {showResults && searchResults.length > 0 && (
                <div className="border rounded-md shadow-lg max-h-48 overflow-auto bg-background">
                  <ScrollArea className="h-48">
                    {searchResults.map((result) => (
                      <button
                        key={result.id}
                        type="button"
                        onClick={() => handleSelectPincode(result)}
                        className="w-full px-4 py-3 text-left hover:bg-muted flex items-center gap-3 transition-colors"
                      >
                        <MapPin className="h-4 w-4 text-muted-foreground" />
                        <span className="font-mono font-medium">
                          {result.code}
                        </span>
                      </button>
                    ))}
                  </ScrollArea>
                </div>
              )}

              {showResults &&
                !isSearching &&
                activeSearchQuery === searchQuery &&
                searchResults.length === 0 && (
                  <div className="border rounded-md p-4 text-center text-sm text-muted-foreground">
                    No pincodes found matching "{searchQuery}"
                  </div>
                )}
            </div>

            {/* Selected Pincode Info */}
            {selectedPincode && (
              <div className="bg-muted p-3 rounded-md">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <div>
                    <p className="font-medium">
                      Selected: {selectedPincode.code}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      This pincode will be assigned with the following
                      configurations
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Pincode Type Values Form */}
            {selectedPincode && pincodeTypes.length > 0 && (
              <div className="space-y-4">
                <Label>Pincode Type Values</Label>
                <div className="space-y-3 border-t pt-4">
                  {pincodeTypes.map((pincodeType) => (
                    <div key={pincodeType.id} className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label
                          htmlFor={`type-${pincodeType.id}`}
                          className="flex-1"
                        >
                          <span className="font-medium">
                            {pincodeType.name}
                          </span>
                          <Badge variant="outline" className="ml-2 text-xs">
                            {pincodeType.type === "yes_no"
                              ? "Yes/No"
                              : "Number"}
                          </Badge>
                        </Label>
                      </div>

                      {pincodeType.type === "yes_no" ? (
                        <div className="flex gap-6">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              id={`${pincodeType.id}-yes`}
                              checked={typeValues[pincodeType.id] === "yes"}
                              onCheckedChange={(checked) =>
                                handleTypeValueChange(
                                  pincodeType.id,
                                  checked ? "yes" : "",
                                )
                              }
                            />
                            <Label htmlFor={`${pincodeType.id}-yes`}>Yes</Label>
                          </label>
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <Checkbox
                              id={`${pincodeType.id}-no`}
                              checked={typeValues[pincodeType.id] === "no"}
                              onCheckedChange={(checked) =>
                                handleTypeValueChange(
                                  pincodeType.id,
                                  checked ? "no" : "",
                                )
                              }
                            />
                            <Label htmlFor={`${pincodeType.id}-no`}>No</Label>
                          </label>
                        </div>
                      ) : (
                        <Input
                          type="number"
                          id={`type-${pincodeType.id}`}
                          placeholder={`Enter ${pincodeType.name} value`}
                          value={typeValues[pincodeType.id] || ""}
                          onChange={(e) =>
                            handleTypeValueChange(
                              pincodeType.id,
                              e.target.value,
                            )
                          }
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {selectedPincode && pincodeTypes.length === 0 && (
              <div className="text-center py-4 text-muted-foreground">
                No pincode types configured. Please contact administrator.
              </div>
            )}

            {/* Error Message */}
            {submitError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{submitError}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isAssigning}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!selectedPincode || isAssigning}
          >
            {isAssigning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Assign Pincode
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
