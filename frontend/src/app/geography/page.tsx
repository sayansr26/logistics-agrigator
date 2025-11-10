"use client";

import { useState, useEffect } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useGetAreasQuery,
  useGetPincodesQuery,
  useToggleStateStatusMutation,
  useToggleCityStatusMutation,
  useToggleAreaStatusMutation,
  useTogglePincodeStatusMutation,
} from "@/store/api/endpoints/geoApi";
import {
  Map,
  Search,
  Plus,
  Edit,
  Trash2,
  MoreHorizontal,
  Loader2,
  AlertCircle,
  MapPin,
  Building2,
  Navigation,
  Hash,
  ChevronLeft,
  ChevronRight,
  Calculator,
} from "lucide-react";
import { DistanceCalculator } from "@/components/geography/distance-calculator";

export default function GeographyPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Administration" },
    { title: "Geography Management" },
  ];

  // Active tab state
  const [activeTab, setActiveTab] = useState("states");

  // Distance calculator state
  const [showDistanceCalculator, setShowDistanceCalculator] = useState(false);

  // States tab state
  const [statesSearchTerm, setStatesSearchTerm] = useState("");
  const [statesPage, setStatesPage] = useState(1);

  // Cities tab state
  const [citiesSearchTerm, setCitiesSearchTerm] = useState("");
  const [selectedStateForCities, setSelectedStateForCities] =
    useState<string>("");
  const [citiesPage, setCitiesPage] = useState(1);

  // Areas tab state
  const [areasSearchTerm, setAreasSearchTerm] = useState("");
  const [selectedStateForAreas, setSelectedStateForAreas] =
    useState<string>("");
  const [selectedCityForAreas, setSelectedCityForAreas] = useState<string>("");
  const [areasPage, setAreasPage] = useState(1);

  // Pincodes tab state
  const [pincodesSearchTerm, setPincodesSearchTerm] = useState("");
  const [selectedStateForPincodes, setSelectedStateForPincodes] =
    useState<string>("");
  const [selectedCityForPincodes, setSelectedCityForPincodes] =
    useState<string>("");
  const [pincodesPage, setPincodesPage] = useState(1);

  // Modal states
  const [showAddStateModal, setShowAddStateModal] = useState(false);
  const [showEditStateModal, setShowEditStateModal] = useState(false);
  const [showDeleteStateDialog, setShowDeleteStateDialog] = useState(false);
  const [selectedStateForEdit, setSelectedStateForEdit] = useState<any>(null);
  const [selectedStateForDelete, setSelectedStateForDelete] =
    useState<any>(null);

  const itemsPerPage = 10;

  // RTK Query - Fetch data
  const {
    data: statesData,
    isLoading: statesLoading,
    error: statesError,
    refetch: refetchStates,
  } = useGetStatesQuery();

  const {
    data: citiesData,
    isLoading: citiesLoading,
    error: citiesError,
    refetch: refetchCities,
  } = useGetCitiesQuery(
    selectedStateForCities
      ? {
          stateId: selectedStateForCities,
          page: citiesPage,
          limit: itemsPerPage,
        }
      : { page: citiesPage, limit: itemsPerPage },
  );

  const {
    data: areasData,
    isLoading: areasLoading,
    error: areasError,
    refetch: refetchAreas,
  } = useGetAreasQuery(
    selectedCityForAreas
      ? { cityId: selectedCityForAreas, page: areasPage, limit: itemsPerPage }
      : { page: areasPage, limit: itemsPerPage },
  );

  // Pincodes query with optional filters
  const {
    data: pincodesData,
    isLoading: pincodesLoading,
    error: pincodesError,
    refetch: refetchPincodes,
  } = useGetPincodesQuery(
    selectedCityForPincodes
      ? {
          cityId: selectedCityForPincodes,
          page: pincodesPage,
          limit: itemsPerPage,
        }
      : selectedStateForPincodes
        ? {
            stateId: selectedStateForPincodes,
            page: pincodesPage,
            limit: itemsPerPage,
          }
        : { page: pincodesPage, limit: itemsPerPage }, // Fetch all pincodes if no filter
  );

  // RTK Query - Mutations for toggle status
  const [toggleStateStatus] = useToggleStateStatusMutation();
  const [toggleCityStatus] = useToggleCityStatusMutation();
  const [toggleAreaStatus] = useToggleAreaStatusMutation();
  const [togglePincodeStatus] = useTogglePincodeStatusMutation();

  // Confirmation dialog state
  const [showToggleConfirmDialog, setShowToggleConfirmDialog] = useState(false);
  const [toggleEntity, setToggleEntity] = useState<{
    type: "state" | "city" | "area" | "pincode";
    id: string;
    name: string;
    currentStatus: boolean;
  } | null>(null);

  // Extract data - backend returns array directly in data field
  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const areas = areasData?.data || [];
  const pincodes = pincodesData?.data || [];

  // Get totals from pagination metadata (not from array length!)
  const totalStates = states.length; // States doesn't paginate, so use array length
  const activeStates = states.filter((s: any) => s.status).length;
  const inactiveStates = totalStates - activeStates;

  const totalCities = citiesData?.meta?.pagination?.total || cities.length;
  const activeCities =
    citiesData?.meta?.activeCount !== undefined
      ? citiesData.meta.activeCount
      : cities.filter((c: any) => c.status).length;

  const totalAreas = areasData?.meta?.pagination?.total || areas.length;
  const activeAreas =
    areasData?.meta?.activeCount !== undefined
      ? areasData.meta.activeCount
      : areas.filter((a: any) => a.status).length;

  const totalPincodes =
    pincodesData?.meta?.pagination?.total || pincodes.length;
  const activePincodes =
    pincodesData?.meta?.activeCount !== undefined
      ? pincodesData.meta.activeCount
      : pincodes.filter((p: any) => p.status).length;

  // Filtered states for search
  const filteredStates = states.filter(
    (state: any) =>
      state.name.toLowerCase().includes(statesSearchTerm.toLowerCase()) ||
      state.code.toLowerCase().includes(statesSearchTerm.toLowerCase()),
  );

  // Filtered cities for search
  const filteredCities = cities.filter(
    (city: any) =>
      city.name.toLowerCase().includes(citiesSearchTerm.toLowerCase()) ||
      city.state?.name.toLowerCase().includes(citiesSearchTerm.toLowerCase()),
  );

  // Filtered areas for search
  const filteredAreas = areas.filter(
    (area: any) =>
      area.name.toLowerCase().includes(areasSearchTerm.toLowerCase()) ||
      area.city?.name.toLowerCase().includes(areasSearchTerm.toLowerCase()),
  );

  // Filtered pincodes for search
  const filteredPincodes = pincodes.filter(
    (pincode: any) =>
      pincode.code.toLowerCase().includes(pincodesSearchTerm.toLowerCase()) ||
      pincode.city?.name
        .toLowerCase()
        .includes(pincodesSearchTerm.toLowerCase()) ||
      pincode.state?.name
        .toLowerCase()
        .includes(pincodesSearchTerm.toLowerCase()),
  );

  // Pagination for states
  const statesStartIndex = (statesPage - 1) * itemsPerPage;
  const statesEndIndex = statesStartIndex + itemsPerPage;
  const paginatedStates = filteredStates.slice(
    statesStartIndex,
    statesEndIndex,
  );
  const statesTotalPages = Math.ceil(filteredStates.length / itemsPerPage);

  // Toggle status handlers
  const handleToggleClick = (
    type: "state" | "city" | "area" | "pincode",
    id: string,
    name: string,
    currentStatus: boolean,
  ) => {
    setToggleEntity({ type, id, name, currentStatus });
    setShowToggleConfirmDialog(true);
  };

  const handleConfirmToggle = async () => {
    if (!toggleEntity) return;

    try {
      const { type, id } = toggleEntity;

      switch (type) {
        case "state":
          await toggleStateStatus(id).unwrap();
          break;
        case "city":
          await toggleCityStatus(id).unwrap();
          break;
        case "area":
          await toggleAreaStatus(id).unwrap();
          break;
        case "pincode":
          await togglePincodeStatus(id).unwrap();
          break;
      }

      // Close dialog
      setShowToggleConfirmDialog(false);
      setToggleEntity(null);
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  // Loading state
  const isLoading =
    (statesLoading && activeTab === "states") ||
    (citiesLoading && activeTab === "cities") ||
    (areasLoading && activeTab === "areas") ||
    (pincodesLoading && activeTab === "pincodes");

  if (isLoading) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <div className="text-center space-y-4">
              <Loader2 className="h-12 w-12 animate-spin text-blue-600 mx-auto" />
              <p className="text-muted-foreground">
                Loading geographical data...
              </p>
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  // Error state
  const currentError =
    (statesError && activeTab === "states") ||
    (citiesError && activeTab === "cities") ||
    (areasError && activeTab === "areas") ||
    (pincodesError && activeTab === "pincodes");

  if (currentError) {
    return (
      <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-center h-96">
            <Card className="w-full max-w-md">
              <CardContent className="pt-6">
                <div className="text-center space-y-4">
                  <AlertCircle className="h-12 w-12 text-red-600 mx-auto" />
                  <h3 className="text-lg font-semibold">Failed to Load Data</h3>
                  <p className="text-sm text-muted-foreground">
                    An error occurred while fetching geographical data
                  </p>
                  <Button
                    onClick={() => {
                      if (activeTab === "states") refetchStates();
                      if (activeTab === "cities") refetchCities();
                      if (activeTab === "areas") refetchAreas();
                      if (activeTab === "pincodes") refetchPincodes();
                    }}
                  >
                    Try Again
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-3xl font-bold text-foreground">
              Geography Management
            </h1>
            <p className="text-muted-foreground">
              Manage states, cities, areas, and pincodes across India
            </p>
          </div>
          <Button
            onClick={() => setShowDistanceCalculator(true)}
            variant="outline"
          >
            <Calculator className="mr-2 h-4 w-4" />
            Distance Calculator
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <MapPin className="h-8 w-8 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total States
                  </p>
                  <p className="text-2xl font-bold">{totalStates}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeStates} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Building2 className="h-8 w-8 text-green-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Cities
                  </p>
                  <p className="text-2xl font-bold">{totalCities}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeCities} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Navigation className="h-8 w-8 text-purple-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Areas
                  </p>
                  <p className="text-2xl font-bold">{totalAreas}</p>
                  <p className="text-xs text-muted-foreground">
                    {activeAreas} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <Hash className="h-8 w-8 text-orange-600" />
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Pincodes
                  </p>
                  <p className="text-2xl font-bold">{totalPincodes}</p>
                  <p className="text-xs text-muted-foreground">
                    {activePincodes} active
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-6"
        >
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="states">States</TabsTrigger>
            <TabsTrigger value="cities">Cities</TabsTrigger>
            <TabsTrigger value="areas">Areas</TabsTrigger>
            <TabsTrigger value="pincodes">Pincodes</TabsTrigger>
          </TabsList>

          {/* States Tab */}
          <TabsContent value="states" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <MapPin className="h-5 w-5" />
                      <span>States Management</span>
                    </CardTitle>
                    <CardDescription>
                      Manage states across India
                    </CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search states..."
                      value={statesSearchTerm}
                      onChange={(e) => setStatesSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>State Name</TableHead>
                        <TableHead>Code</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedStates.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <p className="text-muted-foreground">
                              No states found
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        paginatedStates.map((state: any) => (
                          <TableRow key={state.id}>
                            <TableCell className="font-medium">
                              {state.name}
                            </TableCell>
                            <TableCell>{state.code}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`state-${state.id}`}
                                  checked={state.status}
                                  onCheckedChange={() =>
                                    handleToggleClick(
                                      "state",
                                      state.id,
                                      state.name,
                                      state.status,
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {state.status ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {statesTotalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Showing {statesStartIndex + 1} to{" "}
                      {Math.min(statesEndIndex, filteredStates.length)} of{" "}
                      {filteredStates.length} states
                    </p>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatesPage(statesPage - 1)}
                        disabled={statesPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm">
                        Page {statesPage} of {statesTotalPages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setStatesPage(statesPage + 1)}
                        disabled={statesPage === statesTotalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cities Tab */}
          <TabsContent value="cities" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Building2 className="h-5 w-5" />
                      <span>Cities Management</span>
                    </CardTitle>
                    <CardDescription>
                      Manage cities across all states
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Search cities..."
                    value={citiesSearchTerm}
                    onChange={(e) => setCitiesSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>City Name</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cities.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <p className="text-muted-foreground">
                              No cities found
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredCities.map((city: any) => (
                          <TableRow key={city.id}>
                            <TableCell className="font-medium">
                              {city.name}
                            </TableCell>
                            <TableCell>
                              {city.state?.name || city.stateId}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`city-${city.id}`}
                                  checked={city.status}
                                  onCheckedChange={() =>
                                    handleToggleClick(
                                      "city",
                                      city.id,
                                      city.name,
                                      city.status,
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {city.status ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {citiesData?.meta?.pagination &&
                  citiesData.meta.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(citiesPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(
                          citiesPage * itemsPerPage,
                          citiesData.meta.pagination.total,
                        )}{" "}
                        of {citiesData.meta.pagination.total} cities
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCitiesPage(citiesPage - 1)}
                          disabled={citiesPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Page {citiesPage} of{" "}
                          {citiesData.meta.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCitiesPage(citiesPage + 1)}
                          disabled={
                            citiesPage === citiesData.meta.pagination.totalPages
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Areas Tab */}
          <TabsContent value="areas" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Navigation className="h-5 w-5" />
                      <span>Areas Management</span>
                    </CardTitle>
                    <CardDescription>
                      Manage areas within cities
                    </CardDescription>
                  </div>
                  <Input
                    placeholder="Search areas..."
                    value={areasSearchTerm}
                    onChange={(e) => setAreasSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Area Name</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {areas.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={3} className="text-center py-8">
                            <p className="text-muted-foreground">
                              No areas found
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredAreas.map((area: any) => (
                          <TableRow key={area.id}>
                            <TableCell className="font-medium">
                              {area.name}
                            </TableCell>
                            <TableCell>
                              {area.city?.name || area.cityId}
                            </TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`area-${area.id}`}
                                  checked={area.status}
                                  onCheckedChange={() =>
                                    handleToggleClick(
                                      "area",
                                      area.id,
                                      area.name,
                                      area.status,
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {area.status ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {areasData?.meta?.pagination &&
                  areasData.meta.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(areasPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(
                          areasPage * itemsPerPage,
                          areasData.meta.pagination.total,
                        )}{" "}
                        of {areasData.meta.pagination.total} areas
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAreasPage(areasPage - 1)}
                          disabled={areasPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Page {areasPage} of{" "}
                          {areasData.meta.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAreasPage(areasPage + 1)}
                          disabled={
                            areasPage === areasData.meta.pagination.totalPages
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pincodes Tab */}
          <TabsContent value="pincodes" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center space-x-2">
                      <Hash className="h-5 w-5" />
                      <span>Pincodes View</span>
                    </CardTitle>
                    <CardDescription>View pincodes (read-only)</CardDescription>
                  </div>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search pincodes..."
                      value={pincodesSearchTerm}
                      onChange={(e) => setPincodesSearchTerm(e.target.value)}
                      className="pl-10 w-64"
                    />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Pincode</TableHead>
                        <TableHead>Area</TableHead>
                        <TableHead>City</TableHead>
                        <TableHead>State</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {pincodes.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            <p className="text-muted-foreground">
                              No pincodes found
                            </p>
                          </TableCell>
                        </TableRow>
                      ) : (
                        filteredPincodes.map((pincode: any) => (
                          <TableRow key={pincode.id}>
                            <TableCell className="font-medium">
                              {pincode.code}
                            </TableCell>
                            <TableCell>{pincode.area?.name || "-"}</TableCell>
                            <TableCell>{pincode.city?.name}</TableCell>
                            <TableCell>{pincode.state?.name}</TableCell>
                            <TableCell>
                              <div className="flex items-center space-x-2">
                                <Switch
                                  id={`pincode-${pincode.id}`}
                                  checked={pincode.status}
                                  onCheckedChange={() =>
                                    handleToggleClick(
                                      "pincode",
                                      pincode.id,
                                      pincode.code,
                                      pincode.status,
                                    )
                                  }
                                />
                                <span className="text-sm text-muted-foreground">
                                  {pincode.status ? "Active" : "Inactive"}
                                </span>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>

                {/* Pagination */}
                {pincodesData?.meta?.pagination &&
                  pincodesData.meta.pagination.totalPages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <p className="text-sm text-muted-foreground">
                        Showing {(pincodesPage - 1) * itemsPerPage + 1} to{" "}
                        {Math.min(
                          pincodesPage * itemsPerPage,
                          pincodesData.meta.pagination.total,
                        )}{" "}
                        of {pincodesData.meta.pagination.total} pincodes
                      </p>
                      <div className="flex items-center space-x-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPincodesPage(pincodesPage - 1)}
                          disabled={pincodesPage === 1}
                        >
                          <ChevronLeft className="h-4 w-4" />
                        </Button>
                        <span className="text-sm">
                          Page {pincodesPage} of{" "}
                          {pincodesData.meta.pagination.totalPages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setPincodesPage(pincodesPage + 1)}
                          disabled={
                            pincodesPage ===
                            pincodesData.meta.pagination.totalPages
                          }
                        >
                          <ChevronRight className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Add State Modal */}
        <Dialog open={showAddStateModal} onOpenChange={setShowAddStateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Add New State</DialogTitle>
              <DialogDescription>
                Create a new state in the system
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="stateName">State Name</Label>
                <Input id="stateName" placeholder="Enter state name" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="stateCode">State Code</Label>
                <Input
                  id="stateCode"
                  placeholder="Enter state code (e.g., MH)"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowAddStateModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement create state API call
                  setShowAddStateModal(false);
                }}
              >
                Create State
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit State Modal */}
        <Dialog open={showEditStateModal} onOpenChange={setShowEditStateModal}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit State</DialogTitle>
              <DialogDescription>Update state information</DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="editStateName">State Name</Label>
                <Input
                  id="editStateName"
                  defaultValue={selectedStateForEdit?.name}
                  placeholder="Enter state name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="editStateCode">State Code</Label>
                <Input
                  id="editStateCode"
                  defaultValue={selectedStateForEdit?.code}
                  placeholder="Enter state code"
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowEditStateModal(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={() => {
                  // TODO: Implement update state API call
                  setShowEditStateModal(false);
                }}
              >
                Update State
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete State Dialog */}
        <Dialog
          open={showDeleteStateDialog}
          onOpenChange={setShowDeleteStateDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete State</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedStateForDelete?.name}
                "? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setShowDeleteStateDialog(false)}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={() => {
                  // TODO: Implement delete state API call
                  setShowDeleteStateDialog(false);
                }}
              >
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Toggle Status Confirmation Dialog */}
        <Dialog
          open={showToggleConfirmDialog}
          onOpenChange={setShowToggleConfirmDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Status Change</DialogTitle>
              <DialogDescription>
                Are you sure you want to{" "}
                {toggleEntity?.currentStatus ? "deactivate" : "activate"}{" "}
                <span className="font-semibold">{toggleEntity?.name}</span>?
                {toggleEntity?.currentStatus && (
                  <span className="block mt-2 text-orange-600">
                    Deactivating this {toggleEntity?.type} may affect dependent
                    entities and serviceability.
                  </span>
                )}
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowToggleConfirmDialog(false);
                  setToggleEntity(null);
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={handleConfirmToggle}
                variant={
                  toggleEntity?.currentStatus ? "destructive" : "default"
                }
              >
                {toggleEntity?.currentStatus ? "Deactivate" : "Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Distance Calculator Modal */}
        <DistanceCalculator
          open={showDistanceCalculator}
          onOpenChange={setShowDistanceCalculator}
        />
      </div>
    </DashboardLayout>
  );
}
