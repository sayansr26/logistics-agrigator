"use client";

import * as React from "react";
import { useShipmentOperations } from "../../hooks/useShipments";
import type {
  CreateShipmentRequest,
  ShipmentFilters,
} from "../../types/shipment";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "../ui/card";
import { Badge } from "../ui/badge";
import { Alert, AlertDescription } from "../ui/alert";
import { Loader2, Plus, Search, Filter, Download, Package } from "lucide-react";

export function ShipmentManager() {
  const { shipments, pickups, ndr, bulkOps } = useShipmentOperations();
  const [searchTerm, setSearchTerm] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<string>("");
  const [showCreateForm, setShowCreateForm] = React.useState(false);

  // Load shipments on component mount
  React.useEffect(() => {
    shipments.getShipments();
  }, []);

  const handleSearch = () => {
    const filters: ShipmentFilters = {
      search: searchTerm,
      status: statusFilter as any,
    };
    shipments.getShipments(filters);
  };

  const handleCreateShipment = async (data: CreateShipmentRequest) => {
    const success = await shipments.createShipment(data);
    if (success) {
      setShowCreateForm(false);
      // Refresh the list
      shipments.getShipments();
    }
  };

  const handleStatusUpdate = (shipmentId: string, newStatus: string) => {
    shipments.updateShipmentStatus(shipmentId, newStatus as any);
  };

  const handleGenerateLabels = async (shipmentIds: string[]) => {
    try {
      const response = await bulkOps.generateLabels({
        shipmentIds,
        format: "pdf",
        size: "A4",
      });

      if (response.status === "success" && response.data?.downloadUrl) {
        // Open download URL
        window.open(response.data.downloadUrl, "_blank");
      }
    } catch (error) {
      console.error("Failed to generate labels:", error);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Shipment Management
          </h1>
          <p className="text-gray-600">
            Manage your shipments, pickups, and deliveries
          </p>
        </div>
        <Button
          onClick={() => setShowCreateForm(true)}
          className="flex items-center gap-2"
        >
          <Plus className="h-4 w-4" />
          Create Shipment
        </Button>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search & Filter
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Search by order ID, AWB number..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-md"
            >
              <option value="">All Status</option>
              <option value="created">Created</option>
              <option value="picked">Picked</option>
              <option value="in-transit">In Transit</option>
              <option value="delivered">Delivered</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <Button onClick={handleSearch} className="flex items-center gap-2">
              <Filter className="h-4 w-4" />
              Apply Filters
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Error Display */}
      {shipments.hasError && (
        <Alert variant="destructive">
          <AlertDescription>
            {shipments.error}
            <Button
              variant="outline"
              size="sm"
              onClick={shipments.clearError}
              className="ml-2"
            >
              Dismiss
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* Loading State */}
      {shipments.isLoading && (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading shipments...</span>
        </div>
      )}

      {/* Shipments List */}
      {!shipments.isLoading && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold">
              Shipments ({shipments.totalShipments})
            </h2>
            {shipments.shipments.length > 0 && (
              <Button
                onClick={() => {
                  const allIds = shipments.shipments.map((s) => s.id);
                  handleGenerateLabels(allIds);
                }}
                variant="outline"
                className="flex items-center gap-2"
              >
                <Download className="h-4 w-4" />
                Generate All Labels
              </Button>
            )}
          </div>

          {shipments.shipments.length === 0 ? (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-8">
                <Package className="h-12 w-12 text-gray-400" />
                <h3 className="text-lg font-medium text-gray-900 mt-4">
                  No shipments found
                </h3>
                <p className="text-gray-600">
                  Create your first shipment to get started
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-4">
              {shipments.shipments.map((shipment) => (
                <Card key={shipment.id}>
                  <CardContent className="p-6">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="text-lg font-semibold">
                            Order #{shipment.orderId}
                          </h3>
                          <Badge
                            variant={
                              shipment.status === "delivered"
                                ? "default"
                                : shipment.status === "cancelled"
                                  ? "destructive"
                                  : "secondary"
                            }
                          >
                            {shipment.status}
                          </Badge>
                        </div>
                        <p className="text-sm text-gray-600 mb-2">
                          AWB: {shipment.awbNumber}
                        </p>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-medium">From:</p>
                            <p className="text-gray-600">
                              {shipment.pickupAddress.city},{" "}
                              {shipment.pickupAddress.pincode}
                            </p>
                          </div>
                          <div>
                            <p className="font-medium">To:</p>
                            <p className="text-gray-600">
                              {shipment.deliveryAddress.city},{" "}
                              {shipment.deliveryAddress.pincode}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => shipments.getShipmentById(shipment.id)}
                        >
                          View Details
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => handleGenerateLabels([shipment.id])}
                        >
                          Generate Label
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Pagination */}
      {shipments.pagination.totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="outline"
            disabled={shipments.pagination.page === 1}
            onClick={() => {
              const filters: ShipmentFilters = {
                page: shipments.pagination.page - 1,
              };
              shipments.getShipments(filters);
            }}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600">
            Page {shipments.pagination.page} of{" "}
            {shipments.pagination.totalPages}
          </span>
          <Button
            variant="outline"
            disabled={
              shipments.pagination.page === shipments.pagination.totalPages
            }
            onClick={() => {
              const filters: ShipmentFilters = {
                page: shipments.pagination.page + 1,
              };
              shipments.getShipments(filters);
            }}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
}

// Example usage component for creating shipments
export function CreateShipmentForm({
  onSubmit,
  onCancel,
}: {
  onSubmit: (data: CreateShipmentRequest) => void;
  onCancel: () => void;
}) {
  const [formData, setFormData] = React.useState<CreateShipmentRequest>({
    orderId: "",
    pickupAddress: {
      name: "",
      phone: "",
      email: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    deliveryAddress: {
      name: "",
      phone: "",
      email: "",
      addressLine1: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
    },
    packageDetails: {
      weight: 0,
      dimensions: { length: 0, width: 0, height: 0 },
      description: "",
      value: 0,
      fragile: false,
    },
    paymentType: "PREPAID",
    serviceType: "STANDARD",
    specialInstructions: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create New Shipment</CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Order ID */}
          <div>
            <label className="block text-sm font-medium mb-1">Order ID</label>
            <Input
              value={formData.orderId}
              onChange={(e) =>
                setFormData({ ...formData, orderId: e.target.value })
              }
              required
            />
          </div>

          {/* Pickup Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Pickup Name
              </label>
              <Input
                value={formData.pickupAddress.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pickupAddress: {
                      ...formData.pickupAddress,
                      name: e.target.value,
                    },
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Pickup Phone
              </label>
              <Input
                value={formData.pickupAddress.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    pickupAddress: {
                      ...formData.pickupAddress,
                      phone: e.target.value,
                    },
                  })
                }
                required
              />
            </div>
          </div>

          {/* Delivery Address */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Delivery Name
              </label>
              <Input
                value={formData.deliveryAddress.name}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deliveryAddress: {
                      ...formData.deliveryAddress,
                      name: e.target.value,
                    },
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Delivery Phone
              </label>
              <Input
                value={formData.deliveryAddress.phone}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    deliveryAddress: {
                      ...formData.deliveryAddress,
                      phone: e.target.value,
                    },
                  })
                }
                required
              />
            </div>
          </div>

          {/* Package Details */}
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Weight (kg)
              </label>
              <Input
                type="number"
                step="0.1"
                value={formData.packageDetails.weight}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    packageDetails: {
                      ...formData.packageDetails,
                      weight: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Length (cm)
              </label>
              <Input
                type="number"
                value={formData.packageDetails.dimensions.length}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    packageDetails: {
                      ...formData.packageDetails,
                      dimensions: {
                        ...formData.packageDetails.dimensions,
                        length: parseFloat(e.target.value) || 0,
                      },
                    },
                  })
                }
                required
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Value (₹)
              </label>
              <Input
                type="number"
                value={formData.packageDetails.value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    packageDetails: {
                      ...formData.packageDetails,
                      value: parseFloat(e.target.value) || 0,
                    },
                  })
                }
                required
              />
            </div>
          </div>

          {/* Service Type */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">
                Service Type
              </label>
              <select
                value={formData.serviceType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    serviceType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="STANDARD">Standard</option>
                <option value="EXPRESS">Express</option>
                <option value="OVERNIGHT">Overnight</option>
                <option value="SAME_DAY">Same Day</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                Payment Type
              </label>
              <select
                value={formData.paymentType}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    paymentType: e.target.value as any,
                  })
                }
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="PREPAID">Prepaid</option>
                <option value="COD">Cash on Delivery</option>
                <option value="POSTPAID">Postpaid</option>
              </select>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-4">
            <Button type="submit" className="flex-1">
              Create Shipment
            </Button>
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
