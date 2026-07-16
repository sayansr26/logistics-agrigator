"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useSelector } from "react-redux";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useGetMyAddressesQuery,
  useCreateMyAddressMutation,
  useUpdateMyAddressMutation,
  useDeleteMyAddressMutation,
  useGetOutletQuery,
  useGetOutletAddressesQuery,
  useCreateOutletAddressMutation,
  useUpdateOutletAddressMutation,
  useDeleteOutletAddressMutation,
} from "@/store/api/endpoints/outletApi";
import type {
  OutletAddress,
  CreateAddressRequest,
  UpdateAddressRequest,
} from "@/store/api/endpoints/outletApi";
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useSearchPincodesQuery,
  useGetPincodeDetailsQuery,
} from "@/store/api/endpoints/geoApi";
import { selectUser } from "@/store/slices/authSlice";
import {
  MapPin,
  Plus,
  Edit,
  Trash2,
  Loader2,
  AlertCircle,
  Phone,
  Mail,
  Home,
  Package,
  RotateCcw,
} from "lucide-react";

function AddressesPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const user = useSelector(selectUser);
  const role = user?.role || "";

  const isAdmin = role === "admin" || role === "superadmin";
  const outletId = searchParams.get("outletId") || "";

  // Outlet info query (admin only) — must be before breadcrumbs
  const { data: outletData } = useGetOutletQuery(outletId, {
    skip: !isAdmin || !outletId,
  });
  const outletName = outletData?.data?.outlet?.name || outletId;

  // Breadcrumbs
  const customBreadcrumbs = isAdmin
    ? [
        { title: "Dashboard", href: "/dashboard" },
        { title: "Outlets", href: "/outlets" },
        ...(outletName && outletName !== outletId
          ? [{ title: outletName }]
          : []),
        { title: "Addresses" },
      ]
    : [{ title: "Dashboard", href: "/dashboard" }, { title: "My Addresses" }];

  // State management
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<OutletAddress | null>(
    null,
  );

  // Form state
  const [formData, setFormData] = useState<CreateAddressRequest>({
    label: "",
    addressType: "GENERAL",
    name: "",
    phone: "",
    email: "",
    addressLine1: "",
    addressLine2: "",
    landmark: "",
    city: "",
    state: "",
    pincode: "",
    country: "India",
    isDefaultPickup: false,
    isDefaultReturn: false,
  });

  // Geo autocomplete state
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [pincodeSearch, setPincodeSearch] = useState("");
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showPincodeSuggestions, setShowPincodeSuggestions] = useState(false);

  // Geo autocomplete hooks
  const { data: statesData } = useGetStatesQuery();
  const { data: citiesData } = useGetCitiesQuery(
    { stateId: selectedStateId! },
    { skip: !selectedStateId },
  );
  const { data: pincodeDetailsData } = useGetPincodeDetailsQuery(
    pincodeSearch,
    { skip: !pincodeSearch || pincodeSearch.length !== 6 },
  );
  const { data: pincodesSearchData } = useSearchPincodesQuery(
    { code: pincodeSearch },
    { skip: !pincodeSearch || pincodeSearch.length < 3 },
  );

  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const pincodeSuggestions = pincodesSearchData?.data || [];

  // Auto-fill city/state when 6-digit pincode resolves
  useEffect(() => {
    if (pincodeDetailsData?.data) {
      const { pincode: pincodeInfo, hierarchy } = pincodeDetailsData.data;
      const stateName = hierarchy?.state?.name || "";
      const cityName =
        hierarchy?.city?.name ||
        pincodeInfo?.district ||
        pincodeInfo?.areaName ||
        "";

      if (stateName || cityName) {
        setFormData((prev) => ({
          ...prev,
          state: stateName || prev.state,
          city: cityName || prev.city,
        }));
        const stateId = hierarchy?.state?.id || pincodeInfo?.stateId;
        if (stateId) setSelectedStateId(stateId);
      }
      setShowPincodeSuggestions(false);
    }
  }, [pincodeDetailsData]);

  // --- Admin hooks ---
  const {
    data: adminAddressesData,
    isLoading: adminLoading,
    isError: adminError,
    refetch: adminRefetch,
  } = useGetOutletAddressesQuery(outletId, {
    skip: !isAdmin || !outletId,
  });
  const [createOutletAddress, { isLoading: isAdminCreating }] =
    useCreateOutletAddressMutation();
  const [updateOutletAddress, { isLoading: isAdminUpdating }] =
    useUpdateOutletAddressMutation();
  const [deleteOutletAddress, { isLoading: isAdminDeleting }] =
    useDeleteOutletAddressMutation();

  // --- Outlet hooks ---
  const {
    data: outletAddressesData,
    isLoading: outletLoading,
    isError: outletError,
    refetch: outletRefetch,
  } = useGetMyAddressesQuery(undefined, {
    skip: isAdmin,
  });
  const [createMyAddress, { isLoading: isOutletCreating }] =
    useCreateMyAddressMutation();
  const [updateMyAddress, { isLoading: isOutletUpdating }] =
    useUpdateMyAddressMutation();
  const [deleteMyAddress, { isLoading: isOutletDeleting }] =
    useDeleteMyAddressMutation();

  // Resolved values
  const isLoading = isAdmin ? adminLoading : outletLoading;
  const isError = isAdmin ? adminError : outletError;
  const refetch = isAdmin ? adminRefetch : outletRefetch;
  const isCreating = isAdmin ? isAdminCreating : isOutletCreating;
  const isUpdating = isAdmin ? isAdminUpdating : isOutletUpdating;
  const isDeleting = isAdmin ? isAdminDeleting : isOutletDeleting;

  const addressesData = isAdmin ? adminAddressesData : outletAddressesData;
  const addresses = addressesData?.data?.addresses || [];

  // Reset form
  const resetForm = () => {
    setFormData({
      label: "",
      addressType: "GENERAL",
      name: "",
      phone: "",
      email: "",
      addressLine1: "",
      addressLine2: "",
      landmark: "",
      city: "",
      state: "",
      pincode: "",
      country: "India",
      isDefaultPickup: false,
      isDefaultReturn: false,
    });
    setPincodeSearch("");
    setSelectedStateId(null);
    setShowPincodeSuggestions(false);
    setShowCitySuggestions(false);
    setShowStateSuggestions(false);
  };

  // Handle input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  // Handle create
  const handleCreate = async () => {
    try {
      if (isAdmin) {
        await createOutletAddress({ outletId, data: formData }).unwrap();
      } else {
        await createMyAddress(formData).unwrap();
      }
      setShowCreateDialog(false);
      resetForm();
      refetch();
    } catch (err) {
      console.error("Failed to create address:", err);
    }
  };

  // Handle edit click
  const handleEditClick = (address: OutletAddress) => {
    setSelectedAddress(address);
    setFormData({
      label: address.label,
      addressType: address.addressType as "GENERAL" | "PICKUP" | "RETURN",
      name: address.name,
      phone: address.phone,
      email: address.email || "",
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || "",
      landmark: address.landmark || "",
      city: address.city,
      state: address.state,
      pincode: address.pincode,
      country: address.country,
      isDefaultPickup: address.isDefaultPickup,
      isDefaultReturn: address.isDefaultReturn,
    });
    setShowEditDialog(true);
  };

  // Handle update
  const handleUpdate = async () => {
    if (!selectedAddress) return;
    try {
      if (isAdmin) {
        await updateOutletAddress({
          outletId,
          addressId: selectedAddress.id,
          data: formData as UpdateAddressRequest,
        }).unwrap();
      } else {
        await updateMyAddress({
          addressId: selectedAddress.id,
          data: formData as UpdateAddressRequest,
        }).unwrap();
      }
      setShowEditDialog(false);
      setSelectedAddress(null);
      resetForm();
      refetch();
    } catch (err) {
      console.error("Failed to update address:", err);
    }
  };

  // Handle delete click
  const handleDeleteClick = (address: OutletAddress) => {
    setSelectedAddress(address);
    setShowDeleteDialog(true);
  };

  // Handle delete confirm
  const handleDeleteConfirm = async () => {
    if (!selectedAddress) return;
    try {
      if (isAdmin) {
        await deleteOutletAddress({
          outletId,
          addressId: selectedAddress.id,
        }).unwrap();
      } else {
        await deleteMyAddress(selectedAddress.id).unwrap();
      }
      setShowDeleteDialog(false);
      setSelectedAddress(null);
      refetch();
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  // Get address type badge color
  const getAddressTypeBadge = (type: string) => {
    switch (type) {
      case "PICKUP":
        return <Badge className="bg-blue-500">Pickup</Badge>;
      case "RETURN":
        return <Badge className="bg-orange-500">Return</Badge>;
      default:
        return <Badge variant="secondary">General</Badge>;
    }
  };

  // Admin with no outletId — show empty state
  if (isAdmin && !outletId) {
    return (
      <DashboardLayout
        customBreadcrumbs={[
          { title: "Dashboard", href: "/dashboard" },
          { title: "Outlets", href: "/outlets" },
          { title: "Addresses" },
        ]}
      >
        <div className="space-y-6">
          <div className="flex flex-col items-center justify-center py-16">
            <Card className="w-full max-w-md">
              <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <MapPin className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">Select an outlet first</p>
                <p className="text-sm text-center mt-1">
                  You must select an outlet to manage its addresses.
                </p>
                <Button
                  onClick={() => router.push("/outlets")}
                  className="mt-6 gap-2"
                >
                  Go to Outlets
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  const pageTitle = isAdmin
    ? `Manage Addresses for ${outletName}`
    : "My Addresses";

  const pageDescription = isAdmin
    ? `Viewing pickup and delivery addresses for this outlet`
    : "Manage your pickup and delivery addresses";

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <MapPin className="h-6 w-6 text-primary" />
              {pageTitle}
            </h1>
            <p className="text-muted-foreground">{pageDescription}</p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Address
          </Button>
        </div>

        {/* Content */}
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : isError ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-red-500">
              <AlertCircle className="h-8 w-8 mb-2" />
              <p>Failed to load addresses</p>
              <Button
                variant="outline"
                onClick={() => refetch()}
                className="mt-4"
              >
                Retry
              </Button>
            </CardContent>
          </Card>
        ) : addresses.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <MapPin className="h-12 w-12 mb-4 opacity-50" />
              <p className="text-lg font-medium">No addresses found</p>
              <p className="text-sm">Add the first address to get started</p>
              <Button
                onClick={() => setShowCreateDialog(true)}
                className="mt-4"
              >
                <Plus className="h-4 w-4 mr-2" />
                Add Address
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {addresses.map((address: OutletAddress) => (
              <Card key={address.id} className="relative">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <CardTitle className="text-lg flex items-center gap-2">
                        <Home className="h-4 w-4" />
                        {address.label}
                      </CardTitle>
                      <div className="flex gap-1">
                        {getAddressTypeBadge(address.addressType)}
                        {address.isDefaultPickup && (
                          <Badge variant="outline" className="text-xs">
                            <Package className="h-3 w-3 mr-1" />
                            Default Pickup
                          </Badge>
                        )}
                        {address.isDefaultReturn && (
                          <Badge variant="outline" className="text-xs">
                            <RotateCcw className="h-3 w-3 mr-1" />
                            Default Return
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleEditClick(address)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => handleDeleteClick(address)}
                        className="text-red-500 hover:text-red-600"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p className="font-medium">{address.name}</p>
                  <p className="text-muted-foreground">
                    {address.addressLine1}
                    {address.addressLine2 && `, ${address.addressLine2}`}
                  </p>
                  {address.landmark && (
                    <p className="text-muted-foreground">
                      Near: {address.landmark}
                    </p>
                  )}
                  <p className="text-muted-foreground">
                    {address.city}, {address.state} - {address.pincode}
                  </p>
                  <div className="flex flex-col gap-1 pt-2 border-t">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {address.phone}
                    </span>
                    {address.email && (
                      <span className="flex items-center gap-1">
                        <Mail className="h-3 w-3" />
                        {address.email}
                      </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog
        open={showCreateDialog || showEditDialog}
        onOpenChange={(open) => {
          if (!open) {
            setShowCreateDialog(false);
            setShowEditDialog(false);
            setSelectedAddress(null);
            resetForm();
          }
        }}
      >
        <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              {showEditDialog ? "Edit Address" : "Add New Address"}
            </DialogTitle>
            <DialogDescription>
              {showEditDialog
                ? "Update the address details below"
                : "Fill in the address details below"}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="label">Label *</Label>
                <Input
                  id="label"
                  name="label"
                  value={formData.label}
                  onChange={handleInputChange}
                  placeholder="e.g., Main Warehouse"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addressType">Type</Label>
                <Select
                  value={formData.addressType}
                  onValueChange={(value) =>
                    setFormData((prev) => ({
                      ...prev,
                      addressType: value as "GENERAL" | "PICKUP" | "RETURN",
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GENERAL">General</SelectItem>
                    <SelectItem value="PICKUP">Pickup</SelectItem>
                    <SelectItem value="RETURN">Return</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="name">Contact Name *</Label>
                <Input
                  id="name"
                  name="name"
                  value={formData.name}
                  onChange={handleInputChange}
                  placeholder="Contact person name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">Phone *</Label>
                <Input
                  id="phone"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  placeholder="+919876543210"
                />
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="email@example.com (optional)"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="addressLine1">Address Line 1 *</Label>
              <Input
                id="addressLine1"
                name="addressLine1"
                value={formData.addressLine1}
                onChange={handleInputChange}
                placeholder="Street address, building name"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="addressLine2">Address Line 2</Label>
              <Input
                id="addressLine2"
                name="addressLine2"
                value={formData.addressLine2}
                onChange={handleInputChange}
                placeholder="Floor, suite, unit (optional)"
              />
            </div>

            <div className="grid gap-2">
              <Label htmlFor="landmark">Landmark</Label>
              <Input
                id="landmark"
                name="landmark"
                value={formData.landmark}
                onChange={handleInputChange}
                placeholder="Nearby landmark (optional)"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              {/* Pincode with autocomplete */}
              <div className="grid gap-2 relative">
                <Label htmlFor="pincode">Pincode *</Label>
                <Input
                  id="pincode"
                  value={formData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setFormData((prev) => ({ ...prev, pincode: value }));
                    setPincodeSearch(value);
                    setShowPincodeSuggestions(
                      value.length >= 3 && value.length < 6,
                    );
                  }}
                  onFocus={() =>
                    setShowPincodeSuggestions(
                      formData.pincode.length >= 3 &&
                        formData.pincode.length < 6,
                    )
                  }
                  onBlur={() =>
                    setTimeout(() => setShowPincodeSuggestions(false), 200)
                  }
                  placeholder="XXXXXX"
                  maxLength={6}
                />
                {showPincodeSuggestions && pincodeSuggestions.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {pincodeSuggestions.map((p: any) => (
                      <button
                        key={p.id}
                        type="button"
                        className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                        onClick={() => {
                          setFormData((prev) => ({ ...prev, pincode: p.code }));
                          setPincodeSearch(p.code);
                          setShowPincodeSuggestions(false);
                        }}
                      >
                        <span className="font-medium">{p.code}</span>
                        {p.areaName && (
                          <span className="text-muted-foreground ml-2">
                            - {p.areaName}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* City with autocomplete */}
              <div className="grid gap-2 relative">
                <Label htmlFor="city">City *</Label>
                <Input
                  id="city"
                  value={formData.city}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, city: e.target.value }));
                    setShowCitySuggestions(true);
                  }}
                  onFocus={() => setShowCitySuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowCitySuggestions(false), 200)
                  }
                  placeholder="City"
                />
                {showCitySuggestions && cities.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {cities
                      .filter(
                        (c: any) =>
                          !formData.city ||
                          c.name
                            .toLowerCase()
                            .includes(formData.city.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, city: c.name }));
                            setShowCitySuggestions(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>

              {/* State with autocomplete */}
              <div className="grid gap-2 relative">
                <Label htmlFor="state">State *</Label>
                <Input
                  id="state"
                  value={formData.state}
                  onChange={(e) => {
                    setFormData((prev) => ({ ...prev, state: e.target.value }));
                    setShowStateSuggestions(true);
                  }}
                  onFocus={() => setShowStateSuggestions(true)}
                  onBlur={() =>
                    setTimeout(() => setShowStateSuggestions(false), 200)
                  }
                  placeholder="State"
                />
                {showStateSuggestions && states.length > 0 && (
                  <div className="absolute top-full left-0 right-0 z-50 mt-1 max-h-48 overflow-y-auto rounded-md border bg-popover shadow-md">
                    {states
                      .filter(
                        (s: any) =>
                          !formData.state ||
                          s.name
                            .toLowerCase()
                            .includes(formData.state.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setFormData((prev) => ({ ...prev, state: s.name }));
                            setSelectedStateId(s.id);
                            setShowStateSuggestions(false);
                          }}
                        >
                          {s.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-6 pt-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefaultPickup"
                  checked={formData.isDefaultPickup}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm">Set as default pickup</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  name="isDefaultReturn"
                  checked={formData.isDefaultReturn}
                  onChange={handleInputChange}
                  className="rounded"
                />
                <span className="text-sm">Set as default return</span>
              </label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setShowEditDialog(false);
                setSelectedAddress(null);
                resetForm();
              }}
            >
              Cancel
            </Button>
            <Button
              onClick={showEditDialog ? handleUpdate : handleCreate}
              disabled={
                isCreating ||
                isUpdating ||
                !formData.label ||
                !formData.name ||
                !formData.phone ||
                !formData.addressLine1 ||
                !formData.city ||
                !formData.state ||
                !formData.pincode
              }
            >
              {(isCreating || isUpdating) && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {showEditDialog ? "Update" : "Add"} Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Address
            </DialogTitle>
            <DialogDescription>
              Are you sure you want to delete &quot;{selectedAddress?.label}
              &quot;? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
            >
              {isDeleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}

export default function AddressesPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      }
    >
      <AddressesPageContent />
    </Suspense>
  );
}
