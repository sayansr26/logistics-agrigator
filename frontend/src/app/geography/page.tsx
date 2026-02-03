"use client";

import { useState } from "react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Switch } from "@/components/ui/switch";
import {
  PageContainer,
  PageHeader,
  StatsCard,
  StatsGrid,
  DataTablePagination,
} from "@/components/shared";
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
  Search,
  Loader2,
  AlertCircle,
  MapPin,
  Building2,
  Navigation,
  Hash,
  Calculator,
} from "lucide-react";
import { DistanceCalculator } from "@/components/geography/distance-calculator";

export default function GeographyPage() {
  const [activeTab, setActiveTab] = useState("states");
  const [showDistanceCalculator, setShowDistanceCalculator] = useState(false);
  const [statesSearchTerm, setStatesSearchTerm] = useState("");
  const [citiesSearchTerm, setCitiesSearchTerm] = useState("");
  const [areasSearchTerm, setAreasSearchTerm] = useState("");
  const [pincodesSearchTerm, setPincodesSearchTerm] = useState("");
  const [statesPage, setStatesPage] = useState(1);
  const [citiesPage, setCitiesPage] = useState(1);
  const [areasPage, setAreasPage] = useState(1);
  const [pincodesPage, setPincodesPage] = useState(1);
  const [showToggleConfirmDialog, setShowToggleConfirmDialog] = useState(false);
  const [toggleEntity, setToggleEntity] = useState<{
    type: "state" | "city" | "area" | "pincode";
    id: string;
    name: string;
    currentStatus: boolean;
  } | null>(null);

  const itemsPerPage = 10;

  // RTK Query hooks
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
  } = useGetCitiesQuery({ page: citiesPage, limit: itemsPerPage });
  const {
    data: areasData,
    isLoading: areasLoading,
    error: areasError,
    refetch: refetchAreas,
  } = useGetAreasQuery({ page: areasPage, limit: itemsPerPage });
  const {
    data: pincodesData,
    isLoading: pincodesLoading,
    error: pincodesError,
    refetch: refetchPincodes,
  } = useGetPincodesQuery({ page: pincodesPage, limit: itemsPerPage });

  const [toggleStateStatus] = useToggleStateStatusMutation();
  const [toggleCityStatus] = useToggleCityStatusMutation();
  const [toggleAreaStatus] = useToggleAreaStatusMutation();
  const [togglePincodeStatus] = useTogglePincodeStatusMutation();

  // Extract data
  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const areas = areasData?.data || [];
  const pincodes = pincodesData?.data || [];

  // Stats
  const totalStates = states.length;
  const activeStates = states.filter((s: any) => s.status).length;
  const totalCities = citiesData?.meta?.pagination?.total || cities.length;
  const totalAreas = areasData?.meta?.pagination?.total || areas.length;
  const totalPincodes =
    pincodesData?.meta?.pagination?.total || pincodes.length;

  // Filtered data
  const filteredStates = states.filter(
    (s: any) =>
      s.name.toLowerCase().includes(statesSearchTerm.toLowerCase()) ||
      s.code.toLowerCase().includes(statesSearchTerm.toLowerCase()),
  );
  const filteredCities = cities.filter((c: any) =>
    c.name.toLowerCase().includes(citiesSearchTerm.toLowerCase()),
  );
  const filteredAreas = areas.filter((a: any) =>
    a.name.toLowerCase().includes(areasSearchTerm.toLowerCase()),
  );
  const filteredPincodes = pincodes.filter((p: any) =>
    p.code.toLowerCase().includes(pincodesSearchTerm.toLowerCase()),
  );

  // Pagination for states (client-side)
  const statesStartIndex = (statesPage - 1) * itemsPerPage;
  const paginatedStates = filteredStates.slice(
    statesStartIndex,
    statesStartIndex + itemsPerPage,
  );
  const statesTotalPages = Math.ceil(filteredStates.length / itemsPerPage);

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
      if (type === "state") await toggleStateStatus(id).unwrap();
      else if (type === "city") await toggleCityStatus(id).unwrap();
      else if (type === "area") await toggleAreaStatus(id).unwrap();
      else if (type === "pincode") await togglePincodeStatus(id).unwrap();
      setShowToggleConfirmDialog(false);
      setToggleEntity(null);
    } catch (error) {
      console.error("Failed to toggle status:", error);
    }
  };

  const isLoading =
    (statesLoading && activeTab === "states") ||
    (citiesLoading && activeTab === "cities") ||
    (areasLoading && activeTab === "areas") ||
    (pincodesLoading && activeTab === "pincodes");
  const currentError =
    (statesError && activeTab === "states") ||
    (citiesError && activeTab === "cities") ||
    (areasError && activeTab === "areas") ||
    (pincodesError && activeTab === "pincodes");

  if (isLoading) {
    return (
      <DashboardLayout>
        <div className="flex items-center justify-center h-96">
          <Loader2 className="h-12 w-12 animate-spin text-blue-600" />
        </div>
      </DashboardLayout>
    );
  }

  if (currentError) {
    return (
      <DashboardLayout>
        <Card>
          <CardContent className="flex flex-col items-center justify-center h-96">
            <AlertCircle className="h-12 w-12 text-red-600 mb-4" />
            <h3 className="text-lg font-semibold">Failed to Load Data</h3>
            <Button
              onClick={() => {
                refetchStates();
                refetchCities();
                refetchAreas();
                refetchPincodes();
              }}
              className="mt-4"
            >
              Try Again
            </Button>
          </CardContent>
        </Card>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <PageContainer>
        <PageHeader
          title="Geography Management"
          description="Manage states, cities, areas, and pincodes across India"
          secondaryAction={{
            label: "Distance Calculator",
            onClick: () => setShowDistanceCalculator(true),
          }}
        />

        {/* Stats */}
        <StatsGrid columns={4}>
          <StatsCard
            title="Total States"
            value={totalStates}
            icon={MapPin}
            iconColor="text-blue-600"
            description={`${activeStates} active`}
          />
          <StatsCard
            title="Total Cities"
            value={totalCities}
            icon={Building2}
            iconColor="text-green-600"
          />
          <StatsCard
            title="Total Areas"
            value={totalAreas}
            icon={Navigation}
            iconColor="text-purple-600"
          />
          <StatsCard
            title="Total Pincodes"
            value={totalPincodes}
            icon={Hash}
            iconColor="text-orange-600"
          />
        </StatsGrid>

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
          <TabsContent value="states">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <MapPin className="h-5 w-5" />
                      States Management
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
                        <TableCell
                          colSpan={3}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No states found
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
                            <div className="flex items-center gap-2">
                              <Switch
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
                {statesTotalPages > 1 && (
                  <DataTablePagination
                    currentPage={statesPage}
                    totalPages={statesTotalPages}
                    onPageChange={setStatesPage}
                    totalItems={filteredStates.length}
                    pageSize={itemsPerPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Cities Tab */}
          <TabsContent value="cities">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Cities Management
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>City Name</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCities.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No cities found
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
                            <div className="flex items-center gap-2">
                              <Switch
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
                {citiesData?.meta?.pagination?.totalPages > 1 && (
                  <DataTablePagination
                    currentPage={citiesPage}
                    totalPages={citiesData.meta.pagination.totalPages}
                    onPageChange={setCitiesPage}
                    totalItems={totalCities}
                    pageSize={itemsPerPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Areas Tab */}
          <TabsContent value="areas">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Navigation className="h-5 w-5" />
                      Areas Management
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
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Area Name</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredAreas.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={3}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No areas found
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
                            <div className="flex items-center gap-2">
                              <Switch
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
                {areasData?.meta?.pagination?.totalPages > 1 && (
                  <DataTablePagination
                    currentPage={areasPage}
                    totalPages={areasData.meta.pagination.totalPages}
                    onPageChange={setAreasPage}
                    totalItems={totalAreas}
                    pageSize={itemsPerPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Pincodes Tab */}
          <TabsContent value="pincodes">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      <Hash className="h-5 w-5" />
                      Pincodes Management
                    </CardTitle>
                    <CardDescription>Manage pincodes</CardDescription>
                  </div>
                  <Input
                    placeholder="Search pincodes..."
                    value={pincodesSearchTerm}
                    onChange={(e) => setPincodesSearchTerm(e.target.value)}
                    className="w-64"
                  />
                </div>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Pincode</TableHead>
                      <TableHead>City</TableHead>
                      <TableHead>State</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPincodes.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={4}
                          className="text-center py-8 text-muted-foreground"
                        >
                          No pincodes found
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredPincodes.map((pincode: any) => (
                        <TableRow key={pincode.id}>
                          <TableCell className="font-medium font-mono">
                            {pincode.code}
                          </TableCell>
                          <TableCell>{pincode.city?.name || "-"}</TableCell>
                          <TableCell>{pincode.state?.name || "-"}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Switch
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
                {pincodesData?.meta?.pagination?.totalPages > 1 && (
                  <DataTablePagination
                    currentPage={pincodesPage}
                    totalPages={pincodesData.meta.pagination.totalPages}
                    onPageChange={setPincodesPage}
                    totalItems={totalPincodes}
                    pageSize={itemsPerPage}
                  />
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Toggle Confirm Dialog */}
        <Dialog
          open={showToggleConfirmDialog}
          onOpenChange={setShowToggleConfirmDialog}
        >
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirm Status Change</DialogTitle>
              <DialogDescription>
                Are you sure you want to{" "}
                {toggleEntity?.currentStatus ? "deactivate" : "activate"} "
                {toggleEntity?.name}"?
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
              <Button onClick={handleConfirmToggle}>
                {toggleEntity?.currentStatus ? "Deactivate" : "Activate"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Distance Calculator */}
        <DistanceCalculator
          open={showDistanceCalculator}
          onOpenChange={setShowDistanceCalculator}
        />
      </PageContainer>
    </DashboardLayout>
  );
}
