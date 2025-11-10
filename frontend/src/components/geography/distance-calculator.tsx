"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  MapPin,
  Building2,
  Navigation,
  Hash,
  Map,
  Calculator,
  Loader2,
  AlertCircle,
  CheckCircle,
} from "lucide-react";
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useGetAreasQuery,
  useCalculateCoordinateDistanceMutation,
  useCalculatePincodeDistanceMutation,
  useCalculateCityDistanceMutation,
  useCalculateStateDistanceMutation,
  useCalculateAreaDistanceMutation,
} from "@/store/api/endpoints/geoApi";

interface DistanceCalculatorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DistanceCalculator({
  open,
  onOpenChange,
}: DistanceCalculatorProps) {
  const [calculationType, setCalculationType] = useState<string>("pincode");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<any | null>(null);

  // RTK Query mutations
  const [calculateCoordinateDistance, { isLoading: isCoordinateLoading }] =
    useCalculateCoordinateDistanceMutation();
  const [calculatePincodeDistance, { isLoading: isPincodeLoading }] =
    useCalculatePincodeDistanceMutation();
  const [calculateCityDistance, { isLoading: isCityLoading }] =
    useCalculateCityDistanceMutation();
  const [calculateStateDistance, { isLoading: isStateLoading }] =
    useCalculateStateDistanceMutation();
  const [calculateAreaDistance, { isLoading: isAreaLoading }] =
    useCalculateAreaDistanceMutation();

  const isCalculating =
    isCoordinateLoading ||
    isPincodeLoading ||
    isCityLoading ||
    isStateLoading ||
    isAreaLoading;

  // Form states
  const [fromPincode, setFromPincode] = useState("");
  const [toPincode, setToPincode] = useState("");
  const [fromStateId, setFromStateId] = useState("");
  const [toStateId, setToStateId] = useState("");
  const [fromCityId, setFromCityId] = useState("");
  const [toCityId, setToCityId] = useState("");
  const [fromAreaId, setFromAreaId] = useState("");
  const [toAreaId, setToAreaId] = useState("");
  const [fromLat, setFromLat] = useState("");
  const [fromLng, setFromLng] = useState("");
  const [toLat, setToLat] = useState("");
  const [toLng, setToLng] = useState("");

  // Fetch geographical data
  const { data: statesData } = useGetStatesQuery({ page: 1, limit: 100 });
  const { data: citiesData } = useGetCitiesQuery({
    page: 1,
    limit: 100,
    ...(fromStateId &&
      (calculationType === "city" || calculationType === "area") && {
        stateId: fromStateId,
      }),
  });
  const { data: toCitiesData } = useGetCitiesQuery({
    page: 1,
    limit: 100,
    ...(toStateId &&
      (calculationType === "city" || calculationType === "area") && {
        stateId: toStateId,
      }),
  });
  const { data: areasData } = useGetAreasQuery({
    page: 1,
    limit: 100,
    ...(fromCityId && calculationType === "area" && { cityId: fromCityId }),
  });
  const { data: toAreasData } = useGetAreasQuery({
    page: 1,
    limit: 100,
    ...(toCityId && calculationType === "area" && { cityId: toCityId }),
  });

  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const toCities = toCitiesData?.data || [];
  const areas = areasData?.data || [];
  const toAreas = toAreasData?.data || [];

  const resetForm = () => {
    setFromPincode("");
    setToPincode("");
    setFromStateId("");
    setToStateId("");
    setFromCityId("");
    setToCityId("");
    setFromAreaId("");
    setToAreaId("");
    setFromLat("");
    setFromLng("");
    setToLat("");
    setToLng("");
    setError(null);
    setResult(null);
  };

  const handleCalculate = async () => {
    setError(null);
    setResult(null);

    try {
      let response;

      switch (calculationType) {
        case "pincode":
          if (!fromPincode || !toPincode) {
            throw new Error("Please enter both pincodes");
          }
          response = await calculatePincodeDistance({
            fromPincode,
            toPincode,
          }).unwrap();
          break;

        case "city":
          if (!fromCityId || !toCityId) {
            throw new Error("Please select both cities");
          }
          response = await calculateCityDistance({
            fromCityId,
            toCityId,
          }).unwrap();
          break;

        case "state":
          if (!fromStateId || !toStateId) {
            throw new Error("Please select both states");
          }
          response = await calculateStateDistance({
            fromStateId,
            toStateId,
          }).unwrap();
          break;

        case "area":
          if (!fromAreaId || !toAreaId) {
            throw new Error("Please select both areas");
          }
          response = await calculateAreaDistance({
            fromAreaId,
            toAreaId,
          }).unwrap();
          break;

        case "coordinates":
          if (!fromLat || !fromLng || !toLat || !toLng) {
            throw new Error("Please enter all coordinates");
          }
          response = await calculateCoordinateDistance({
            from: {
              latitude: parseFloat(fromLat),
              longitude: parseFloat(fromLng),
            },
            to: { latitude: parseFloat(toLat), longitude: parseFloat(toLng) },
          }).unwrap();
          break;

        default:
          throw new Error("Invalid calculation type");
      }

      // Extract data from response
      setResult(response?.data || response);
    } catch (err: any) {
      setError(
        err?.data?.message || err.message || "Failed to calculate distance",
      );
    }
  };

  const getIcon = (type: string) => {
    switch (type) {
      case "pincode":
        return <Hash className="h-4 w-4" />;
      case "city":
        return <Building2 className="h-4 w-4" />;
      case "state":
        return <MapPin className="h-4 w-4" />;
      case "area":
        return <Navigation className="h-4 w-4" />;
      case "coordinates":
        return <Map className="h-4 w-4" />;
      default:
        return <Calculator className="h-4 w-4" />;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[600px]">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Calculator className="h-5 w-5" />
            <span>Distance Calculator</span>
          </DialogTitle>
          <DialogDescription>
            Calculate distance between geographical locations using various
            methods
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={calculationType}
          onValueChange={(value) => {
            setCalculationType(value);
            resetForm();
          }}
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="pincode">
              <Hash className="h-3 w-3 mr-1" />
              Pincode
            </TabsTrigger>
            <TabsTrigger value="city">
              <Building2 className="h-3 w-3 mr-1" />
              City
            </TabsTrigger>
            <TabsTrigger value="state">
              <MapPin className="h-3 w-3 mr-1" />
              State
            </TabsTrigger>
            <TabsTrigger value="area">
              <Navigation className="h-3 w-3 mr-1" />
              Area
            </TabsTrigger>
            <TabsTrigger value="coordinates">
              <Map className="h-3 w-3 mr-1" />
              Lat/Lng
            </TabsTrigger>
          </TabsList>

          {/* Pincode Tab */}
          <TabsContent value="pincode" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="from-pincode">From Pincode</Label>
                <Input
                  id="from-pincode"
                  placeholder="e.g., 110001"
                  value={fromPincode}
                  onChange={(e) => setFromPincode(e.target.value)}
                  maxLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="to-pincode">To Pincode</Label>
                <Input
                  id="to-pincode"
                  placeholder="e.g., 400001"
                  value={toPincode}
                  onChange={(e) => setToPincode(e.target.value)}
                  maxLength={6}
                />
              </div>
            </div>
          </TabsContent>

          {/* City Tab */}
          <TabsContent value="city" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>From State</Label>
                  <Select
                    value={fromStateId}
                    onValueChange={(value) => {
                      setFromStateId(value);
                      setFromCityId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state: any) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From City</Label>
                  <Select
                    value={fromCityId}
                    onValueChange={setFromCityId}
                    disabled={!fromStateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>To State</Label>
                  <Select
                    value={toStateId}
                    onValueChange={(value) => {
                      setToStateId(value);
                      setToCityId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state: any) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To City</Label>
                  <Select
                    value={toCityId}
                    onValueChange={setToCityId}
                    disabled={!toStateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {toCities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* State Tab */}
          <TabsContent value="state" className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>From State</Label>
                <Select value={fromStateId} onValueChange={setFromStateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state: any) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>To State</Label>
                <Select value={toStateId} onValueChange={setToStateId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select state" />
                  </SelectTrigger>
                  <SelectContent>
                    {states.map((state: any) => (
                      <SelectItem key={state.id} value={state.id}>
                        {state.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </TabsContent>

          {/* Area Tab */}
          <TabsContent value="area" className="space-y-4">
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>From State</Label>
                  <Select
                    value={fromStateId}
                    onValueChange={(value) => {
                      setFromStateId(value);
                      setFromCityId("");
                      setFromAreaId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state: any) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From City</Label>
                  <Select
                    value={fromCityId}
                    onValueChange={(value) => {
                      setFromCityId(value);
                      setFromAreaId("");
                    }}
                    disabled={!fromStateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {cities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>From Area</Label>
                  <Select
                    value={fromAreaId}
                    onValueChange={setFromAreaId}
                    disabled={!fromCityId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {areas.map((area: any) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label>To State</Label>
                  <Select
                    value={toStateId}
                    onValueChange={(value) => {
                      setToStateId(value);
                      setToCityId("");
                      setToAreaId("");
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      {states.map((state: any) => (
                        <SelectItem key={state.id} value={state.id}>
                          {state.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To City</Label>
                  <Select
                    value={toCityId}
                    onValueChange={(value) => {
                      setToCityId(value);
                      setToAreaId("");
                    }}
                    disabled={!toStateId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select city" />
                    </SelectTrigger>
                    <SelectContent>
                      {toCities.map((city: any) => (
                        <SelectItem key={city.id} value={city.id}>
                          {city.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>To Area</Label>
                  <Select
                    value={toAreaId}
                    onValueChange={setToAreaId}
                    disabled={!toCityId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select area" />
                    </SelectTrigger>
                    <SelectContent>
                      {toAreas.map((area: any) => (
                        <SelectItem key={area.id} value={area.id}>
                          {area.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Coordinates Tab */}
          <TabsContent value="coordinates" className="space-y-4">
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-medium mb-2">
                  From Coordinates
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="from-lat" className="text-xs">
                      Latitude
                    </Label>
                    <Input
                      id="from-lat"
                      placeholder="e.g., 28.6139"
                      value={fromLat}
                      onChange={(e) => setFromLat(e.target.value)}
                      type="number"
                      step="any"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="from-lng" className="text-xs">
                      Longitude
                    </Label>
                    <Input
                      id="from-lng"
                      placeholder="e.g., 77.2090"
                      value={fromLng}
                      onChange={(e) => setFromLng(e.target.value)}
                      type="number"
                      step="any"
                    />
                  </div>
                </div>
              </div>
              <div>
                <Label className="text-sm font-medium mb-2">
                  To Coordinates
                </Label>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="to-lat" className="text-xs">
                      Latitude
                    </Label>
                    <Input
                      id="to-lat"
                      placeholder="e.g., 18.9387"
                      value={toLat}
                      onChange={(e) => setToLat(e.target.value)}
                      type="number"
                      step="any"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="to-lng" className="text-xs">
                      Longitude
                    </Label>
                    <Input
                      id="to-lng"
                      placeholder="e.g., 72.8354"
                      value={toLng}
                      onChange={(e) => setToLng(e.target.value)}
                      type="number"
                      step="any"
                    />
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Result Display */}
        {result && (
          <Card className="bg-green-50 border-green-200">
            <CardContent className="pt-6">
              <div className="flex items-start space-x-3">
                <CheckCircle className="h-5 w-5 text-green-600 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-green-900 mb-2">
                    Distance Calculated
                  </h3>
                  <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance (KM):</span>
                      <span className="font-medium text-gray-900">
                        {result.distance} km
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Distance (Miles):</span>
                      <span className="font-medium text-gray-900">
                        {result.distanceMiles} miles
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Calculation Method:</span>
                      <span className="font-medium text-gray-900 capitalize">
                        {result.calculationMethod}
                      </span>
                    </div>
                    {result.cached && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Source:</span>
                        <span className="font-medium text-gray-900">
                          Cached Result
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Action Buttons */}
        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={() => {
              resetForm();
            }}
            disabled={isCalculating}
          >
            Clear
          </Button>
          <div className="space-x-2">
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isCalculating}
            >
              Close
            </Button>
            <Button onClick={handleCalculate} disabled={isCalculating}>
              {isCalculating ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Calculating...
                </>
              ) : (
                <>
                  <Calculator className="mr-2 h-4 w-4" />
                  Calculate
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
