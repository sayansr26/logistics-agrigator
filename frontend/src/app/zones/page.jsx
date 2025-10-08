"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Globe,
  MapPin,
  CheckCircle,
  XCircle,
  Plus,
  Settings,
  RefreshCw,
  Edit,
  Trash2,
  Search,
  Map,
  Navigation,
  Truck,
  Package,
  DollarSign,
  Clock,
} from "lucide-react";
import { useState } from "react";
import { useRouter } from "next/navigation";

function getStatusColor(status) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "inactive":
      return <XCircle className="h-4 w-4 text-gray-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getZoneTypeIcon(type) {
  switch (type) {
    case "pickup":
      return <Package className="h-5 w-5 text-blue-600" />;
    case "delivery":
      return <Truck className="h-5 w-5 text-green-600" />;
    case "both":
      return <Navigation className="h-5 w-5 text-purple-600" />;
    default:
      return <MapPin className="h-5 w-5 text-gray-600" />;
  }
}

export default function ZonesPage() {
  const router = useRouter();
  const [zones, setZones] = useState([]);
  const [selectedZone, setSelectedZone] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");

  // Calculate stats dynamically
  const zoneStats = {
    totalZones: zones.length,
    activeZones: zones.filter((z) => z.status === "active").length,
    pickupZones: zones.filter((z) => z.type === "pickup" || z.type === "both")
      .length,
    deliveryZones: zones.filter(
      (z) => z.type === "delivery" || z.type === "both",
    ).length,
    totalPincodes: zones.reduce((sum, z) => sum + z.pincodes.length, 0),
    totalCities: zones.reduce((sum, z) => sum + z.cities.length, 0),
    averageRate:
      zones.length > 0
        ? zones.reduce((sum, z) => sum + (z.partnerRates[0]?.rate || 0), 0) /
          zones.length
        : 0,
  };

  // Filter zones based on search and filters
  const filteredZones = zones.filter((zone) => {
    const matchesSearch =
      zone.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
      zone.pincodes.some((p) => p.includes(searchTerm)) ||
      zone.cities.some((c) =>
        c.toLowerCase().includes(searchTerm.toLowerCase()),
      );

    const matchesType = filterType === "all" || zone.type === filterType;
    const matchesStatus =
      filterStatus === "all" || zone.status === filterStatus;

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleZoneSelect = (zone) => {
    setSelectedZone(zone);
  };

  const handleSyncZones = () => {
    // TODO: Implement zone sync logic
    console.log("Syncing zones...");
  };

  const handleRemoveZone = (zoneId) => {
    setZones((prev) => prev.filter((z) => z.id !== zoneId));
    if (selectedZone?.id === zoneId) {
      setSelectedZone(null);
    }
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[{ title: "Zone Management", href: "/zones" }]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Zone Management
            </h1>
            <p className="text-muted-foreground">
              Manage delivery zones, pincode coverage, and partner rates for
              efficient logistics operations.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm" onClick={handleSyncZones}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync Zones
            </Button>
            <Button size="sm" onClick={() => router.push("/zones/create")}>
              <Plus className="mr-2 h-4 w-4" />
              Add Zone
            </Button>
          </div>
        </div>

        {/* Zone Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Zones</CardTitle>
              <Globe className="h-5 w-5 text-muted-foreground text-blue-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zoneStats.totalZones}</div>
              <p className="text-xs text-muted-foreground">
                {zoneStats.activeZones} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Coverage</CardTitle>
              <MapPin className="h-5 w-5 text-muted-foreground text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {zoneStats.totalPincodes.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                {zoneStats.totalCities} cities
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Service Types
              </CardTitle>
              <Navigation className="h-5 w-5 text-muted-foreground text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{zoneStats.pickupZones}</div>
              <p className="text-xs text-muted-foreground">
                {zoneStats.deliveryZones} delivery zones
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Avg. Rate</CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ₹{zoneStats.averageRate.toFixed(0)}
              </div>
              <p className="text-xs text-muted-foreground">Per shipment</p>
            </CardContent>
          </Card>
        </div>

        {/* Search and Filters */}
        <Card>
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search zones by name, code, pincode, or city..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="flex gap-2">
                <Select value={filterType} onValueChange={setFilterType}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Service Type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="pickup">Pickup</SelectItem>
                    <SelectItem value="delivery">Delivery</SelectItem>
                    <SelectItem value="both">Both</SelectItem>
                  </SelectContent>
                </Select>
                <Select value={filterStatus} onValueChange={setFilterStatus}>
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Zones List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Zones ({filteredZones.length})</CardTitle>
                  <CardDescription>
                    {zones.length === 0
                      ? "No zones configured yet. Add your first zone to get started."
                      : "Manage delivery zones and their coverage areas"}
                  </CardDescription>
                </div>
                {zones.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {zones.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No zones configured
                  </p>
                  <p className="text-sm mb-4">
                    Create your first delivery zone to start managing coverage
                    areas and partner rates.
                  </p>
                  <Button onClick={() => router.push("/zones/create")}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Zone
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {filteredZones.map((zone) => (
                    <div key={zone.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            {getZoneTypeIcon(zone.type)}
                          </div>
                          <div>
                            <div className="font-medium">{zone.name}</div>
                            <div className="text-sm text-muted-foreground">
                              {zone.code} • {zone.pincodes.length} pincodes •{" "}
                              {zone.cities.length} cities
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(zone.status)}
                            <Badge className={getStatusColor(zone.status)}>
                              {zone.status}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              router.push(`/zones/${zone.id}/edit`)
                            }
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemoveZone(zone.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Zone Details */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div>
                          <div className="text-sm font-medium">Coverage</div>
                          <div className="text-sm text-muted-foreground">
                            {zone.coverage.area} sq km •{" "}
                            {zone.coverage.population.toLocaleString()} people
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            Service Type
                          </div>
                          <div className="text-sm text-muted-foreground capitalize">
                            {zone.type} • {zone.coverage.density} density
                          </div>
                        </div>
                        <div>
                          <div className="text-sm font-medium">
                            Partner Rate
                          </div>
                          <div className="text-sm text-muted-foreground">
                            ₹{zone.partnerRates[0]?.rate || 0} per shipment
                          </div>
                        </div>
                      </div>

                      {/* Pincodes Preview */}
                      <div className="flex flex-wrap gap-1 mb-4">
                        {zone.pincodes.slice(0, 5).map((pincode) => (
                          <Badge
                            key={pincode}
                            variant="outline"
                            className="text-xs"
                          >
                            {pincode}
                          </Badge>
                        ))}
                        {zone.pincodes.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{zone.pincodes.length - 5} more
                          </Badge>
                        )}
                      </div>

                      {/* Restrictions */}
                      <div className="flex items-center justify-between pt-4 border-t">
                        <div className="flex items-center space-x-4 text-sm">
                          <span>
                            Weight:{" "}
                            {zone.restrictions.weightLimit
                              ? `${zone.restrictions.weightLimit}kg`
                              : "No limit"}
                          </span>
                          <span>
                            Hazardous:{" "}
                            {zone.restrictions.hazardousAllowed
                              ? "Allowed"
                              : "Not allowed"}
                          </span>
                          <span>
                            Fragile:{" "}
                            {zone.restrictions.fragileAllowed
                              ? "Allowed"
                              : "Not allowed"}
                          </span>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Updated:{" "}
                          {new Date(zone.updatedAt).toLocaleDateString()}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Zone Details */}
          <Card>
            <CardHeader>
              <CardTitle>Zone Details</CardTitle>
              <CardDescription>
                {selectedZone
                  ? "View and manage zone configuration"
                  : "Select a zone to view details"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedZone ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-12 h-12 bg-muted rounded-lg flex items-center justify-center">
                      {getZoneTypeIcon(selectedZone.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedZone.name}</h3>
                      <p className="text-sm text-muted-foreground">
                        {selectedZone.code} • {selectedZone.type} zone
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(selectedZone.status)}
                        <Badge className={getStatusColor(selectedZone.status)}>
                          {selectedZone.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Coverage</Label>
                      <div className="text-sm mt-1">
                        <div>{selectedZone.pincodes.length} pincodes</div>
                        <div>{selectedZone.cities.length} cities</div>
                        <div>{selectedZone.states.length} states</div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Area Details
                      </Label>
                      <div className="text-sm mt-1">
                        <div>{selectedZone.coverage.area} sq km</div>
                        <div>
                          {selectedZone.coverage.population.toLocaleString()}{" "}
                          population
                        </div>
                        <div className="capitalize">
                          {selectedZone.coverage.density} density
                        </div>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Partner Rates
                      </Label>
                      <div className="space-y-2 mt-1">
                        {selectedZone.partnerRates.map((rate) => (
                          <div
                            key={rate.partnerId}
                            className="flex justify-between text-sm"
                          >
                            <span>{rate.partnerName}</span>
                            <span className="font-medium">₹{rate.rate}</span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Restrictions
                      </Label>
                      <div className="text-sm mt-1 space-y-1">
                        <div>
                          Weight:{" "}
                          {selectedZone.restrictions.weightLimit
                            ? `${selectedZone.restrictions.weightLimit}kg`
                            : "No limit"}
                        </div>
                        <div>
                          Hazardous:{" "}
                          {selectedZone.restrictions.hazardousAllowed
                            ? "Allowed"
                            : "Not allowed"}
                        </div>
                        <div>
                          Fragile:{" "}
                          {selectedZone.restrictions.fragileAllowed
                            ? "Allowed"
                            : "Not allowed"}
                        </div>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-2">
                    <Button
                      className="w-full"
                      size="sm"
                      onClick={() =>
                        router.push(`/zones/${selectedZone.id}/edit`)
                      }
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit Zone
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <Map className="mr-2 h-4 w-4" />
                      View Map
                    </Button>
                    <Button variant="outline" className="w-full" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Manage Rates
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {zones.length === 0
                      ? "Add a zone to get started"
                      : "Select a zone to view details"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
