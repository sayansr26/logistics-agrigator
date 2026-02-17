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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useListOutletsQuery,
  useCreateOutletMutation,
  useGetOutletQuery,
  useUpdateOutletMutation,
  useDeleteOutletMutation,
  useToggleOutletStatusMutation,
  useUpdateOutletBadgeMutation,
  useResetOutletPasswordMutation,
  useGetOutletAddressesQuery,
  useCreateOutletAddressMutation,
  useUpdateOutletAddressMutation,
  useDeleteOutletAddressMutation,
} from "@/store/api/endpoints/outletApi";
import type { OutletBadge } from "@/store/api/endpoints/outletApi";
import {
  useGetStatesQuery,
  useGetCitiesQuery,
  useSearchPincodesQuery,
  useGetPincodeDetailsQuery,
} from "@/store/api/endpoints/geoApi";
import { useAppSelector } from "@/store/hooks";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Store,
  Plus,
  Search,
  MoreHorizontal,
  Eye,
  Edit,
  Trash2,
  ChevronLeft,
  ChevronRight,
  Loader2,
  AlertCircle,
  CheckCircle,
  Copy,
  MapPin,
  Phone,
  Mail,
  Building2,
  Calendar,
  Hash,
  Power,
  KeyRound,
  Award,
} from "lucide-react";

const BADGE_CONFIG: Record<string, { label: string; className: string }> = {
  BASIC: {
    label: "Basic",
    className: "bg-gray-100 text-gray-700 border-gray-300",
  },
  BRONZE: {
    label: "Bronze",
    className: "bg-amber-100 text-amber-800 border-amber-300",
  },
  SILVER: {
    label: "Silver",
    className: "bg-slate-200 text-slate-700 border-slate-400",
  },
  GOLD: {
    label: "Gold",
    className: "bg-yellow-100 text-yellow-800 border-yellow-500",
  },
  PLATINUM: {
    label: "Platinum",
    className: "bg-violet-100 text-violet-800 border-violet-300",
  },
  DIAMOND: {
    label: "Diamond",
    className: "bg-cyan-100 text-cyan-800 border-cyan-400",
  },
};

export default function OutletsPage() {
  const customBreadcrumbs = [
    { title: "Home", href: "/" },
    { title: "Outlet Management" },
  ];

  // Get current user from auth state
  const { user } = useAppSelector((state) => state.auth);
  const canCreateOutlet = ["superadmin", "admin"].includes(user?.role || "");

  // State management
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showViewDialog, setShowViewDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [selectedOutletId, setSelectedOutletId] = useState<string | null>(null);
  const [temporaryPassword, setTemporaryPassword] = useState("");
  const [createdOutletEmail, setCreatedOutletEmail] = useState("");
  const [passwordCopied, setPasswordCopied] = useState(false);
  const itemsPerPage = 10;

  // Form state for creating outlet
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    companyName: "",
    category: "",
    tanPan: "",
    gst: "",
  });

  // Edit form state
  const [editFormData, setEditFormData] = useState({
    name: "",
    phone: "",
    companyName: "",
    category: "",
    tanPan: "",
    gst: "",
    badge: "BASIC" as string,
    isActive: true,
  });

  // Outlet actions state
  const [showDeleteOutletDialog, setShowDeleteOutletDialog] = useState(false);
  const [showResetPasswordDialog, setShowResetPasswordDialog] = useState(false);
  const [showToggleStatusDialog, setShowToggleStatusDialog] = useState(false);
  const [outletToDelete, setOutletToDelete] = useState<any>(null);
  const [outletToResetPassword, setOutletToResetPassword] = useState<any>(null);
  const [outletToToggleStatus, setOutletToToggleStatus] = useState<any>(null);

  // Badge management state
  const [showBadgeDialog, setShowBadgeDialog] = useState(false);
  const [outletToUpdateBadge, setOutletToUpdateBadge] = useState<any>(null);
  const [selectedBadge, setSelectedBadge] = useState<string>("BASIC");

  // Address management state
  const [showAddAddressDialog, setShowAddAddressDialog] = useState(false);
  const [showEditAddressDialog, setShowEditAddressDialog] = useState(false);
  const [showDeleteAddressDialog, setShowDeleteAddressDialog] = useState(false);
  const [selectedAddress, setSelectedAddress] = useState<any>(null);
  const [addressFormData, setAddressFormData] = useState({
    label: "",
    addressType: "HOME",
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
    isDefault: false,
  });

  // Geo autocomplete state
  const [selectedStateId, setSelectedStateId] = useState<string | null>(null);
  const [pincodeSearch, setPincodeSearch] = useState("");
  const [showStateSuggestions, setShowStateSuggestions] = useState(false);
  const [showCitySuggestions, setShowCitySuggestions] = useState(false);
  const [showPincodeSuggestions, setShowPincodeSuggestions] = useState(false);

  // RTK Query - Fetch outlets from API
  const {
    data: outletsData,
    isLoading,
    isError,
    refetch,
  } = useListOutletsQuery({
    page: currentPage,
    limit: itemsPerPage,
    search: searchTerm || undefined,
  });

  // RTK Query - Create outlet mutation
  const [createOutlet, { isLoading: isCreating }] = useCreateOutletMutation();

  // RTK Query - Get single outlet for view/edit
  const { data: selectedOutletData, isLoading: isLoadingOutlet } =
    useGetOutletQuery(selectedOutletId!, {
      skip: !selectedOutletId,
    });

  // RTK Query - Get outlet addresses
  const { data: addressesData, isLoading: isLoadingAddresses } =
    useGetOutletAddressesQuery(selectedOutletId!, {
      skip: !selectedOutletId || !showViewDialog,
    });

  // RTK Query - Geo data for autocomplete
  const { data: statesData } = useGetStatesQuery();
  const { data: citiesData } = useGetCitiesQuery(
    { stateId: selectedStateId! },
    { skip: !selectedStateId },
  );
  const { data: pincodeDetailsData } = useGetPincodeDetailsQuery(
    pincodeSearch,
    {
      skip: !pincodeSearch || pincodeSearch.length !== 6,
    },
  );
  const { data: pincodesSearchData } = useSearchPincodesQuery(
    { code: pincodeSearch },
    { skip: !pincodeSearch || pincodeSearch.length < 3 },
  );

  // RTK Query - Update outlet mutation
  const [updateOutlet, { isLoading: isUpdating }] = useUpdateOutletMutation();

  // RTK Query - Address mutations
  const [createAddress, { isLoading: isCreatingAddress }] =
    useCreateOutletAddressMutation();
  const [updateAddress, { isLoading: isUpdatingAddress }] =
    useUpdateOutletAddressMutation();
  const [deleteAddress, { isLoading: isDeletingAddress }] =
    useDeleteOutletAddressMutation();

  // RTK Query - Outlet action mutations
  const [deleteOutlet, { isLoading: isDeletingOutlet }] =
    useDeleteOutletMutation();
  const [toggleOutletStatus, { isLoading: isTogglingStatus }] =
    useToggleOutletStatusMutation();
  const [updateOutletBadge, { isLoading: isUpdatingBadge }] =
    useUpdateOutletBadgeMutation();
  const [resetOutletPassword, { isLoading: isResettingPassword }] =
    useResetOutletPasswordMutation();

  const outlets = outletsData?.data?.outlets || [];
  const pagination = outletsData?.data?.pagination;
  const totalPages = pagination?.totalPages || 1;
  const selectedOutlet = selectedOutletData?.data?.outlet;
  const outletAddresses = addressesData?.data?.addresses || [];

  // Extract geo data (API returns arrays directly in data)
  const states = statesData?.data || [];
  const cities = citiesData?.data || [];
  const pincodeSuggestions = pincodesSearchData?.data || [];

  // Populate edit form when outlet is loaded
  useEffect(() => {
    if (selectedOutlet && showEditDialog) {
      setEditFormData({
        name: selectedOutlet.name || "",
        phone: selectedOutlet.phone || "",
        companyName: selectedOutlet.companyName || "",
        category: selectedOutlet.category || "",
        tanPan: selectedOutlet.tanPan || "",
        gst: selectedOutlet.gst || "",
        badge: selectedOutlet.badge || "BASIC",
        isActive: selectedOutlet.isActive ?? true,
      });
    }
  }, [selectedOutlet, showEditDialog]);

  // Populate address form when address is selected for editing
  useEffect(() => {
    if (selectedAddress && showEditAddressDialog) {
      setAddressFormData({
        label: selectedAddress.label || "",
        addressType: selectedAddress.addressType || "HOME",
        name: selectedAddress.name || "",
        phone: selectedAddress.phone || "",
        email: selectedAddress.email || "",
        addressLine1: selectedAddress.addressLine1 || "",
        addressLine2: selectedAddress.addressLine2 || "",
        landmark: selectedAddress.landmark || "",
        city: selectedAddress.city || "",
        state: selectedAddress.state || "",
        pincode: selectedAddress.pincode || "",
        country: selectedAddress.country || "India",
        isDefault:
          selectedAddress.isDefaultPickup || selectedAddress.isDefault || false,
      });
      // Set pincode search for potential lookup
      setPincodeSearch(selectedAddress.pincode || "");
    }
  }, [selectedAddress, showEditAddressDialog]);

  // Auto-fill city and state when pincode details are loaded
  useEffect(() => {
    if (pincodeDetailsData?.data) {
      const { pincode: pincodeInfo, hierarchy } = pincodeDetailsData.data;
      // Get state name from hierarchy
      const stateName = hierarchy?.state?.name || "";
      // Get city name from hierarchy or pincode district
      const cityName =
        hierarchy?.city?.name ||
        pincodeInfo?.district ||
        pincodeInfo?.areaName ||
        "";

      if (stateName || cityName) {
        setAddressFormData((prev) => ({
          ...prev,
          state: stateName || prev.state,
          city: cityName || prev.city,
        }));
        // Set state ID for city filtering
        const stateId = hierarchy?.state?.id || pincodeInfo?.stateId;
        if (stateId) {
          setSelectedStateId(stateId);
        }
      }
      setShowPincodeSuggestions(false);
    }
  }, [pincodeDetailsData]);

  // Handle form input change
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle edit form input change
  const handleEditInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setEditFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle create outlet
  const handleCreateOutlet = async () => {
    try {
      const result = await createOutlet({
        name: formData.name,
        email: formData.email,
        phone: formData.phone,
        companyName: formData.companyName || undefined,
        category: formData.category || undefined,
        tanPan: formData.tanPan || undefined,
        gst: formData.gst || undefined,
      }).unwrap();

      // Show password dialog
      setTemporaryPassword(result.data.temporaryPassword || "");
      setCreatedOutletEmail(formData.email);
      setShowCreateDialog(false);
      setShowPasswordDialog(true);

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        companyName: "",
        category: "",
        tanPan: "",
        gst: "",
      });

      // Refresh list
      refetch();
    } catch (err) {
      console.error("Failed to create outlet:", err);
    }
  };

  // Handle update outlet
  const handleUpdateOutlet = async () => {
    if (!selectedOutletId) return;

    try {
      await updateOutlet({
        id: selectedOutletId,
        data: {
          name: editFormData.name,
          phone: editFormData.phone,
          companyName: editFormData.companyName || undefined,
          category: editFormData.category || undefined,
          tanPan: editFormData.tanPan || undefined,
          gst: editFormData.gst || undefined,
          badge: editFormData.badge as OutletBadge,
          isActive: editFormData.isActive,
        },
      }).unwrap();

      setShowEditDialog(false);
      setSelectedOutletId(null);
      refetch();
    } catch (err) {
      console.error("Failed to update outlet:", err);
    }
  };

  // Handle view outlet
  const handleViewOutlet = (outletId: string) => {
    setSelectedOutletId(outletId);
    setShowViewDialog(true);
  };

  // Handle edit outlet
  const handleEditOutlet = (outletId: string) => {
    setSelectedOutletId(outletId);
    setShowEditDialog(true);
  };

  // Close modals
  const closeViewDialog = () => {
    setShowViewDialog(false);
    setSelectedOutletId(null);
  };

  const closeEditDialog = () => {
    setShowEditDialog(false);
    setSelectedOutletId(null);
  };

  // Handle add address
  const handleAddAddress = () => {
    setAddressFormData({
      label: "",
      addressType: "HOME",
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
      isDefault: false,
    });
    setShowAddAddressDialog(true);
  };

  // Handle edit address
  const handleEditAddress = (address: any) => {
    setSelectedAddress(address);
    setShowEditAddressDialog(true);
  };

  // Handle delete address click
  const handleDeleteAddressClick = (address: any) => {
    setSelectedAddress(address);
    setShowDeleteAddressDialog(true);
  };

  // Handle outlet delete click
  const handleDeleteOutletClick = (outlet: any) => {
    setOutletToDelete(outlet);
    setShowDeleteOutletDialog(true);
  };

  // Handle confirm delete outlet
  const handleConfirmDeleteOutlet = async () => {
    if (!outletToDelete) return;

    try {
      await deleteOutlet(outletToDelete.id).unwrap();
      setShowDeleteOutletDialog(false);
      setOutletToDelete(null);
      refetch();
    } catch (err) {
      console.error("Failed to delete outlet:", err);
    }
  };

  // Handle toggle outlet status click
  const handleToggleStatusClick = (outlet: any) => {
    setOutletToToggleStatus(outlet);
    setShowToggleStatusDialog(true);
  };

  // Handle confirm toggle outlet status
  const handleConfirmToggleStatus = async () => {
    if (!outletToToggleStatus) return;

    try {
      await toggleOutletStatus({
        id: outletToToggleStatus.id,
        isActive: !outletToToggleStatus.isActive,
      }).unwrap();
      setShowToggleStatusDialog(false);
      setOutletToToggleStatus(null);
      refetch();
    } catch (err) {
      console.error("Failed to toggle outlet status:", err);
    }
  };

  // Handle change badge click
  const handleChangeBadgeClick = (outlet: any) => {
    setOutletToUpdateBadge(outlet);
    setSelectedBadge(outlet.badge || "BASIC");
    setShowBadgeDialog(true);
  };

  // Handle confirm update badge
  const handleConfirmUpdateBadge = async () => {
    if (!outletToUpdateBadge || !selectedBadge) return;

    try {
      await updateOutletBadge({
        id: outletToUpdateBadge.id,
        badge: selectedBadge as OutletBadge,
      }).unwrap();
      setShowBadgeDialog(false);
      setOutletToUpdateBadge(null);
      refetch();
    } catch (err) {
      console.error("Failed to update outlet badge:", err);
    }
  };

  // Handle reset password click
  const handleResetPasswordClick = (outlet: any) => {
    setOutletToResetPassword(outlet);
    setShowResetPasswordDialog(true);
  };

  // Handle confirm reset password
  const handleConfirmResetPassword = async () => {
    if (!outletToResetPassword) return;

    try {
      const result = await resetOutletPassword(
        outletToResetPassword.id,
      ).unwrap();
      setTemporaryPassword(result.data.temporaryPassword);
      setCreatedOutletEmail(outletToResetPassword.email);
      setShowResetPasswordDialog(false);
      setOutletToResetPassword(null);
      setShowPasswordDialog(true);
    } catch (err) {
      console.error("Failed to reset password:", err);
    }
  };

  // Handle address form input change
  const handleAddressInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setAddressFormData((prev) => ({ ...prev, [name]: value }));
  };

  // Handle create address
  const handleCreateAddress = async () => {
    if (!selectedOutletId) return;

    try {
      await createAddress({
        outletId: selectedOutletId,
        data: {
          label: addressFormData.label,
          addressType: addressFormData.addressType as
            | "HOME"
            | "WORK"
            | "OTHER"
            | "GENERAL"
            | "PICKUP"
            | "RETURN",
          name: addressFormData.name,
          phone: addressFormData.phone,
          email: addressFormData.email || undefined,
          addressLine1: addressFormData.addressLine1,
          addressLine2: addressFormData.addressLine2 || undefined,
          landmark: addressFormData.landmark || undefined,
          city: addressFormData.city,
          state: addressFormData.state,
          pincode: addressFormData.pincode,
          country: addressFormData.country,
          isDefaultPickup: addressFormData.isDefault,
          isDefaultReturn: false,
        },
      }).unwrap();

      setShowAddAddressDialog(false);
    } catch (err) {
      console.error("Failed to create address:", err);
    }
  };

  // Handle update address
  const handleUpdateAddress = async () => {
    if (!selectedOutletId || !selectedAddress) return;

    try {
      await updateAddress({
        outletId: selectedOutletId,
        addressId: selectedAddress.id,
        data: {
          label: addressFormData.label,
          addressType: addressFormData.addressType as
            | "HOME"
            | "WORK"
            | "OTHER"
            | "GENERAL"
            | "PICKUP"
            | "RETURN",
          name: addressFormData.name,
          phone: addressFormData.phone,
          email: addressFormData.email || undefined,
          addressLine1: addressFormData.addressLine1,
          addressLine2: addressFormData.addressLine2 || undefined,
          landmark: addressFormData.landmark || undefined,
          city: addressFormData.city,
          state: addressFormData.state,
          pincode: addressFormData.pincode,
          country: addressFormData.country,
          isDefaultPickup: addressFormData.isDefault,
          isDefaultReturn: false,
        },
      }).unwrap();

      setShowEditAddressDialog(false);
      setSelectedAddress(null);
    } catch (err) {
      console.error("Failed to update address:", err);
    }
  };

  // Handle delete address
  const handleDeleteAddress = async () => {
    if (!selectedOutletId || !selectedAddress) return;

    try {
      await deleteAddress({
        outletId: selectedOutletId,
        addressId: selectedAddress.id,
      }).unwrap();

      setShowDeleteAddressDialog(false);
      setSelectedAddress(null);
    } catch (err) {
      console.error("Failed to delete address:", err);
    }
  };

  // Close address dialogs
  const closeEditAddressDialog = () => {
    setShowEditAddressDialog(false);
    setSelectedAddress(null);
  };

  // Copy password to clipboard
  const handleCopyPassword = () => {
    navigator.clipboard.writeText(temporaryPassword);
    setPasswordCopied(true);
    setTimeout(() => setPasswordCopied(false), 2000);
  };

  // Format date
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-IN", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <Store className="h-6 w-6 text-primary" />
              Outlet Management
            </h1>
            <p className="text-muted-foreground">
              Create and manage outlet portal users
            </p>
          </div>
          {canCreateOutlet && (
            <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Create Outlet
            </Button>
          )}
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Outlets
              </CardTitle>
              <Store className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{pagination?.total || 0}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {outlets.filter((o: any) => o.isActive).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {outlets.filter((o: any) => !o.isActive).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main Content */}
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <CardTitle>Outlets</CardTitle>
                <CardDescription>
                  Manage outlet users and their access
                </CardDescription>
              </div>
              <div className="relative w-full sm:w-64">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search outlets..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="pl-9"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : isError ? (
              <div className="flex flex-col items-center justify-center py-12 text-red-500">
                <AlertCircle className="h-8 w-8 mb-2" />
                <p>Failed to load outlets</p>
                <Button
                  variant="outline"
                  onClick={() => refetch()}
                  className="mt-4"
                >
                  Retry
                </Button>
              </div>
            ) : outlets.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                <Store className="h-12 w-12 mb-4 opacity-50" />
                <p className="text-lg font-medium">No outlets found</p>
                <p className="text-sm">
                  Create your first outlet to get started
                </p>
                <Button
                  onClick={() => setShowCreateDialog(true)}
                  className="mt-4"
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Create Outlet
                </Button>
              </div>
            ) : (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Outlet</TableHead>
                      <TableHead>Contact</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>Addresses</TableHead>
                      <TableHead>Badge</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Created</TableHead>
                      <TableHead className="w-[50px]"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {outlets.map((outlet: any) => (
                      <TableRow key={outlet.id}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                              <Store className="h-5 w-5 text-primary" />
                            </div>
                            <div>
                              <p className="font-medium">{outlet.name}</p>
                              <p className="text-sm text-muted-foreground">
                                {outlet.email}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <Phone className="h-3 w-3" />
                            {outlet.phone}
                          </div>
                        </TableCell>
                        <TableCell>
                          {outlet.companyName ? (
                            <div className="flex items-center gap-1 text-sm">
                              <Building2 className="h-3 w-3" />
                              {outlet.companyName}
                            </div>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1 text-sm">
                            <MapPin className="h-3 w-3" />
                            {outlet._count?.addresses || 0}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant="outline"
                            className={
                              BADGE_CONFIG[outlet.badge || "BASIC"]?.className
                            }
                          >
                            {BADGE_CONFIG[outlet.badge || "BASIC"]?.label ||
                              "Basic"}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={outlet.isActive ? "default" : "secondary"}
                            className={outlet.isActive ? "bg-green-500" : ""}
                          >
                            {outlet.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {formatDate(outlet.createdAt)}
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreHorizontal className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Actions</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleViewOutlet(outlet.id)}
                              >
                                <Eye className="h-4 w-4 mr-2" />
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleEditOutlet(outlet.id)}
                              >
                                <Edit className="h-4 w-4 mr-2" />
                                Edit
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleToggleStatusClick(outlet)}
                              >
                                <Power className="h-4 w-4 mr-2" />
                                {outlet.isActive ? "Deactivate" : "Activate"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleResetPasswordClick(outlet)}
                              >
                                <KeyRound className="h-4 w-4 mr-2" />
                                Reset Password
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleChangeBadgeClick(outlet)}
                              >
                                <Award className="h-4 w-4 mr-2" />
                                Change Badge
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                onClick={() => handleDeleteOutletClick(outlet)}
                                className="text-red-600 focus:text-red-600 focus:bg-red-50 dark:focus:bg-red-950"
                              >
                                <Trash2 className="h-4 w-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-4">
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((p) => Math.max(1, p - 1))
                        }
                        disabled={currentPage === 1}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() =>
                          setCurrentPage((p) => Math.min(totalPages, p + 1))
                        }
                        disabled={currentPage === totalPages}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Create Outlet Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5" />
              Create New Outlet
            </DialogTitle>
            <DialogDescription>
              Add a new outlet portal user. A temporary password will be
              generated.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                placeholder="Outlet name"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email *</Label>
              <Input
                id="email"
                name="email"
                type="email"
                value={formData.email}
                onChange={handleInputChange}
                placeholder="outlet@example.com"
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
            <div className="grid gap-2">
              <Label htmlFor="companyName">Company Name</Label>
              <Input
                id="companyName"
                name="companyName"
                value={formData.companyName}
                onChange={handleInputChange}
                placeholder="Company name (optional)"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Input
                  id="category"
                  name="category"
                  value={formData.category}
                  onChange={handleInputChange}
                  placeholder="e.g., Retail"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tanPan">TAN/PAN</Label>
                <Input
                  id="tanPan"
                  name="tanPan"
                  value={formData.tanPan}
                  onChange={handleInputChange}
                  placeholder="TAN or PAN number"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="gst">GST Number</Label>
              <Input
                id="gst"
                name="gst"
                value={formData.gst}
                onChange={handleInputChange}
                placeholder="GST number"
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateOutlet}
              disabled={
                isCreating ||
                !formData.name ||
                !formData.email ||
                !formData.phone
              }
            >
              {isCreating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Create Outlet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Outlet Dialog */}
      <Dialog open={showViewDialog} onOpenChange={closeViewDialog}>
        <DialogContent className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Store className="h-5 w-5 text-primary" />
              Outlet Details
            </DialogTitle>
          </DialogHeader>
          {isLoadingOutlet ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : selectedOutlet ? (
            <div className="space-y-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-lg">
                    {selectedOutlet.name}
                  </h3>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant="outline"
                      className={
                        BADGE_CONFIG[selectedOutlet.badge || "BASIC"]?.className
                      }
                    >
                      {BADGE_CONFIG[selectedOutlet.badge || "BASIC"]?.label ||
                        "Basic"}
                    </Badge>
                    <Badge
                      variant={
                        selectedOutlet.isActive ? "default" : "secondary"
                      }
                      className={selectedOutlet.isActive ? "bg-green-500" : ""}
                    >
                      {selectedOutlet.isActive ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOutlet.email}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <span>{selectedOutlet.phone}</span>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Company Info */}
              <div className="space-y-3">
                <h4 className="font-medium flex items-center gap-2">
                  <Building2 className="h-4 w-4" />
                  Company Information
                </h4>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Company Name</span>
                    <p className="font-medium">
                      {selectedOutlet.companyName || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Category</span>
                    <p className="font-medium">
                      {selectedOutlet.category || "—"}
                    </p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">GST Number</span>
                    <p className="font-medium">{selectedOutlet.gst || "—"}</p>
                  </div>
                  <div>
                    <span className="text-muted-foreground">TAN/PAN</span>
                    <p className="font-medium">
                      {selectedOutlet.tanPan || "—"}
                    </p>
                  </div>
                </div>
              </div>

              <Separator />

              {/* Addresses */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium flex items-center gap-2">
                    <MapPin className="h-4 w-4" />
                    Addresses ({outletAddresses.length})
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleAddAddress}
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Add Address
                  </Button>
                </div>
                {isLoadingAddresses ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : outletAddresses.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No addresses added yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {outletAddresses.map((addr: any) => (
                      <div
                        key={addr.id}
                        className="rounded-lg border p-3 text-sm space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{addr.label}</span>
                            <Badge variant="secondary" className="text-xs">
                              {addr.addressType || "Home"}
                            </Badge>
                          </div>
                          {(addr.isDefaultPickup || addr.isDefault) && (
                            <Badge className="text-xs bg-green-500">
                              Default
                            </Badge>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-muted-foreground">
                            {addr.name} • {addr.phone}
                          </p>
                          <p className="text-muted-foreground">
                            {addr.addressLine1}
                            {addr.addressLine2 && `, ${addr.addressLine2}`}
                          </p>
                          <p className="text-muted-foreground">
                            {addr.city}, {addr.state} - {addr.pincode}
                          </p>
                        </div>
                        <div className="flex justify-end gap-2 pt-2 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditAddress(addr)}
                          >
                            <Edit className="h-3 w-3 mr-1" />
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-red-600 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-950"
                            onClick={() => handleDeleteAddressClick(addr)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Separator />

              {/* Metadata */}
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Calendar className="h-4 w-4" />
                  <span>
                    Created: {formatDateTime(selectedOutlet.createdAt)}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-muted-foreground">
                  <Hash className="h-4 w-4" />
                  <span className="truncate">ID: {selectedOutlet.id}</span>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-center text-muted-foreground py-8">
              Outlet not found
            </p>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeViewDialog}>
              Close
            </Button>
            <Button
              onClick={() => {
                closeViewDialog();
                if (selectedOutlet) handleEditOutlet(selectedOutlet.id);
              }}
            >
              <Edit className="h-4 w-4 mr-2" />
              Edit
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Outlet Dialog */}
      <Dialog open={showEditDialog} onOpenChange={closeEditDialog}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Outlet
            </DialogTitle>
            <DialogDescription>
              Update outlet information. Email cannot be changed.
            </DialogDescription>
          </DialogHeader>
          {isLoadingOutlet ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="edit-name">Name *</Label>
                <Input
                  id="edit-name"
                  name="name"
                  value={editFormData.name}
                  onChange={handleEditInputChange}
                  placeholder="Outlet name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-email">Email</Label>
                <Input
                  id="edit-email"
                  value={selectedOutlet?.email || ""}
                  disabled
                  className="bg-muted"
                />
                <p className="text-xs text-muted-foreground">
                  Email cannot be changed after creation
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-phone">Phone *</Label>
                <Input
                  id="edit-phone"
                  name="phone"
                  value={editFormData.phone}
                  onChange={handleEditInputChange}
                  placeholder="+919876543210"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-companyName">Company Name</Label>
                <Input
                  id="edit-companyName"
                  name="companyName"
                  value={editFormData.companyName}
                  onChange={handleEditInputChange}
                  placeholder="Company name (optional)"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="edit-category">Category</Label>
                  <Input
                    id="edit-category"
                    name="category"
                    value={editFormData.category}
                    onChange={handleEditInputChange}
                    placeholder="e.g., Retail"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="edit-tanPan">TAN/PAN</Label>
                  <Input
                    id="edit-tanPan"
                    name="tanPan"
                    value={editFormData.tanPan}
                    onChange={handleEditInputChange}
                    placeholder="TAN or PAN number"
                  />
                </div>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="edit-gst">GST Number</Label>
                <Input
                  id="edit-gst"
                  name="gst"
                  value={editFormData.gst}
                  onChange={handleEditInputChange}
                  placeholder="GST number"
                />
              </div>
              {canCreateOutlet && (
                <div className="grid gap-2">
                  <Label htmlFor="edit-badge">Badge Tier</Label>
                  <Select
                    value={editFormData.badge}
                    onValueChange={(value) =>
                      setEditFormData((prev) => ({ ...prev, badge: value }))
                    }
                  >
                    <SelectTrigger id="edit-badge">
                      <SelectValue placeholder="Select badge" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(BADGE_CONFIG).map(([key, config]) => (
                        <SelectItem key={key} value={key}>
                          {config.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
              <div className="flex items-center justify-between rounded-lg border p-4">
                <div className="space-y-0.5">
                  <Label>Active Status</Label>
                  <p className="text-sm text-muted-foreground">
                    Inactive outlets cannot log in
                  </p>
                </div>
                <Switch
                  id="outlet-active-status"
                  checked={editFormData.isActive}
                  onCheckedChange={(checked) =>
                    setEditFormData((prev) => ({ ...prev, isActive: checked }))
                  }
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeEditDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateOutlet}
              disabled={isUpdating || !editFormData.name || !editFormData.phone}
            >
              {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Password Display Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-[450px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-5 w-5" />
              Outlet Created Successfully
            </DialogTitle>
            <DialogDescription>
              Save the temporary password below. It will not be shown again.
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-amber-800 dark:text-amber-200">
                <AlertCircle className="h-5 w-5" />
                <span className="font-medium">
                  Important: Save this password
                </span>
              </div>
              <div className="space-y-2">
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  Email:{" "}
                  <span className="font-medium">{createdOutletEmail}</span>
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded bg-background px-3 py-2 text-sm font-mono border dark:border-border">
                    {temporaryPassword}
                  </code>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyPassword}
                    className="shrink-0"
                  >
                    {passwordCopied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Share this password with the outlet user. They should change it
                after first login.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => setShowPasswordDialog(false)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Address Dialog */}
      <Dialog
        open={showAddAddressDialog}
        onOpenChange={setShowAddAddressDialog}
      >
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Add New Address
            </DialogTitle>
            <DialogDescription>
              Add a new address for this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-addr-label">Label *</Label>
                <Input
                  id="new-addr-label"
                  name="label"
                  value={addressFormData.label}
                  onChange={handleAddressInputChange}
                  placeholder="e.g., Main Warehouse"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-addr-type">Type</Label>
                <select
                  id="new-addr-type"
                  name="addressType"
                  value={addressFormData.addressType}
                  onChange={(e) =>
                    setAddressFormData((prev) => ({
                      ...prev,
                      addressType: e.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="new-addr-name">Contact Name *</Label>
                <Input
                  id="new-addr-name"
                  name="name"
                  value={addressFormData.name}
                  onChange={handleAddressInputChange}
                  placeholder="Contact person name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="new-addr-phone">Phone *</Label>
                <Input
                  id="new-addr-phone"
                  name="phone"
                  value={addressFormData.phone}
                  onChange={handleAddressInputChange}
                  placeholder="+91XXXXXXXXXX"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-addr-email">Email</Label>
              <Input
                id="new-addr-email"
                name="email"
                type="email"
                value={addressFormData.email}
                onChange={handleAddressInputChange}
                placeholder="contact@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-addr-line1">Address Line 1 *</Label>
              <Input
                id="new-addr-line1"
                name="addressLine1"
                value={addressFormData.addressLine1}
                onChange={handleAddressInputChange}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-addr-line2">Address Line 2</Label>
              <Input
                id="new-addr-line2"
                name="addressLine2"
                value={addressFormData.addressLine2}
                onChange={handleAddressInputChange}
                placeholder="Apt, suite, building (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="new-addr-landmark">Landmark</Label>
              <Input
                id="new-addr-landmark"
                name="landmark"
                value={addressFormData.landmark}
                onChange={handleAddressInputChange}
                placeholder="Near landmark (optional)"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 relative">
                <Label htmlFor="new-addr-pincode">Pincode *</Label>
                <Input
                  id="new-addr-pincode"
                  name="pincode"
                  value={addressFormData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setAddressFormData((prev) => ({ ...prev, pincode: value }));
                    setPincodeSearch(value);
                    setShowPincodeSuggestions(
                      value.length >= 3 && value.length < 6,
                    );
                  }}
                  onFocus={() =>
                    setShowPincodeSuggestions(
                      addressFormData.pincode.length >= 3 &&
                        addressFormData.pincode.length < 6,
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
                          setAddressFormData((prev) => ({
                            ...prev,
                            pincode: p.code,
                          }));
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
              <div className="grid gap-2 relative">
                <Label htmlFor="new-addr-city">City *</Label>
                <Input
                  id="new-addr-city"
                  name="city"
                  value={addressFormData.city}
                  onChange={(e) => {
                    setAddressFormData((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }));
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
                          !addressFormData.city ||
                          c.name
                            .toLowerCase()
                            .includes(addressFormData.city.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setAddressFormData((prev) => ({
                              ...prev,
                              city: c.name,
                            }));
                            setShowCitySuggestions(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2 relative">
                <Label htmlFor="new-addr-state">State *</Label>
                <Input
                  id="new-addr-state"
                  name="state"
                  value={addressFormData.state}
                  onChange={(e) => {
                    setAddressFormData((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }));
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
                          !addressFormData.state ||
                          s.name
                            .toLowerCase()
                            .includes(addressFormData.state.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setAddressFormData((prev) => ({
                              ...prev,
                              state: s.name,
                            }));
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
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="new-addr-default"
                checked={addressFormData.isDefault}
                onCheckedChange={(checked) =>
                  setAddressFormData((prev) => ({
                    ...prev,
                    isDefault: checked,
                  }))
                }
              />
              <Label htmlFor="new-addr-default" className="text-sm">
                Set as default address
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowAddAddressDialog(false)}
            >
              Cancel
            </Button>
            <Button
              onClick={handleCreateAddress}
              disabled={
                isCreatingAddress ||
                !addressFormData.label ||
                !addressFormData.name ||
                !addressFormData.phone ||
                !addressFormData.addressLine1 ||
                !addressFormData.city ||
                !addressFormData.state ||
                !addressFormData.pincode
              }
            >
              {isCreatingAddress && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Add Address
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Address Dialog */}
      <Dialog
        open={showEditAddressDialog}
        onOpenChange={closeEditAddressDialog}
      >
        <DialogContent className="sm:max-w-[550px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Edit Address
            </DialogTitle>
            <DialogDescription>
              Update the address information for this outlet.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addr-label">Label *</Label>
                <Input
                  id="addr-label"
                  name="label"
                  value={addressFormData.label}
                  onChange={handleAddressInputChange}
                  placeholder="e.g., Main Warehouse"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-type">Type</Label>
                <select
                  id="addr-type"
                  name="addressType"
                  value={addressFormData.addressType}
                  onChange={(e) =>
                    setAddressFormData((prev) => ({
                      ...prev,
                      addressType: e.target.value,
                    }))
                  }
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  <option value="HOME">Home</option>
                  <option value="WORK">Work</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="addr-name">Contact Name *</Label>
                <Input
                  id="addr-name"
                  name="name"
                  value={addressFormData.name}
                  onChange={handleAddressInputChange}
                  placeholder="Contact person name"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="addr-phone">Phone *</Label>
                <Input
                  id="addr-phone"
                  name="phone"
                  value={addressFormData.phone}
                  onChange={handleAddressInputChange}
                  placeholder="+91XXXXXXXXXX"
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-email">Email</Label>
              <Input
                id="addr-email"
                name="email"
                type="email"
                value={addressFormData.email}
                onChange={handleAddressInputChange}
                placeholder="contact@example.com"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-line1">Address Line 1 *</Label>
              <Input
                id="addr-line1"
                name="addressLine1"
                value={addressFormData.addressLine1}
                onChange={handleAddressInputChange}
                placeholder="Street address"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-line2">Address Line 2</Label>
              <Input
                id="addr-line2"
                name="addressLine2"
                value={addressFormData.addressLine2}
                onChange={handleAddressInputChange}
                placeholder="Apt, suite, building (optional)"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="addr-landmark">Landmark</Label>
              <Input
                id="addr-landmark"
                name="landmark"
                value={addressFormData.landmark}
                onChange={handleAddressInputChange}
                placeholder="Near landmark (optional)"
              />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div className="grid gap-2 relative">
                <Label htmlFor="addr-pincode">Pincode *</Label>
                <Input
                  id="addr-pincode"
                  name="pincode"
                  value={addressFormData.pincode}
                  onChange={(e) => {
                    const value = e.target.value.replace(/\D/g, "").slice(0, 6);
                    setAddressFormData((prev) => ({ ...prev, pincode: value }));
                    setPincodeSearch(value);
                    setShowPincodeSuggestions(
                      value.length >= 3 && value.length < 6,
                    );
                  }}
                  onFocus={() =>
                    setShowPincodeSuggestions(
                      addressFormData.pincode.length >= 3 &&
                        addressFormData.pincode.length < 6,
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
                          setAddressFormData((prev) => ({
                            ...prev,
                            pincode: p.code,
                          }));
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
              <div className="grid gap-2 relative">
                <Label htmlFor="addr-city">City *</Label>
                <Input
                  id="addr-city"
                  name="city"
                  value={addressFormData.city}
                  onChange={(e) => {
                    setAddressFormData((prev) => ({
                      ...prev,
                      city: e.target.value,
                    }));
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
                          !addressFormData.city ||
                          c.name
                            .toLowerCase()
                            .includes(addressFormData.city.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((c: any) => (
                        <button
                          key={c.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setAddressFormData((prev) => ({
                              ...prev,
                              city: c.name,
                            }));
                            setShowCitySuggestions(false);
                          }}
                        >
                          {c.name}
                        </button>
                      ))}
                  </div>
                )}
              </div>
              <div className="grid gap-2 relative">
                <Label htmlFor="addr-state">State *</Label>
                <Input
                  id="addr-state"
                  name="state"
                  value={addressFormData.state}
                  onChange={(e) => {
                    setAddressFormData((prev) => ({
                      ...prev,
                      state: e.target.value,
                    }));
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
                          !addressFormData.state ||
                          s.name
                            .toLowerCase()
                            .includes(addressFormData.state.toLowerCase()),
                      )
                      .slice(0, 10)
                      .map((s: any) => (
                        <button
                          key={s.id}
                          type="button"
                          className="w-full px-3 py-2 text-left text-sm hover:bg-accent hover:text-accent-foreground"
                          onClick={() => {
                            setAddressFormData((prev) => ({
                              ...prev,
                              state: s.name,
                            }));
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
            <div className="flex items-center gap-2 pt-2">
              <Switch
                id="addr-default"
                checked={addressFormData.isDefault}
                onCheckedChange={(checked) =>
                  setAddressFormData((prev) => ({
                    ...prev,
                    isDefault: checked,
                  }))
                }
              />
              <Label htmlFor="addr-default" className="text-sm">
                Set as default address
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeEditAddressDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleUpdateAddress}
              disabled={
                isUpdatingAddress ||
                !addressFormData.label ||
                !addressFormData.name ||
                !addressFormData.phone ||
                !addressFormData.addressLine1 ||
                !addressFormData.city ||
                !addressFormData.state ||
                !addressFormData.pincode
              }
            >
              {isUpdatingAddress && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Address Confirmation */}
      <AlertDialog
        open={showDeleteAddressDialog}
        onOpenChange={setShowDeleteAddressDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Address</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the address "
              {selectedAddress?.label}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteAddress}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletingAddress}
            >
              {isDeletingAddress && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Outlet Confirmation */}
      <AlertDialog
        open={showDeleteOutletDialog}
        onOpenChange={setShowDeleteOutletDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <Trash2 className="h-5 w-5" />
              Delete Outlet
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the outlet "{outletToDelete?.name}
              "? This will deactivate the outlet and all associated addresses.
              The outlet user will no longer be able to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmDeleteOutlet}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeletingOutlet}
            >
              {isDeletingOutlet && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Delete Outlet
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reset Password Confirmation */}
      <AlertDialog
        open={showResetPasswordDialog}
        onOpenChange={setShowResetPasswordDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <KeyRound className="h-5 w-5" />
              Reset Password
            </AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to reset the password for "
              {outletToResetPassword?.name}"? A new temporary password will be
              generated and shown to you. The outlet user will need to use this
              new password to log in.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmResetPassword}
              disabled={isResettingPassword}
            >
              {isResettingPassword && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Reset Password
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Toggle Status Confirmation */}
      <AlertDialog
        open={showToggleStatusDialog}
        onOpenChange={setShowToggleStatusDialog}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Power className="h-5 w-5" />
              {outletToToggleStatus?.isActive ? "Deactivate" : "Activate"}{" "}
              Outlet
            </AlertDialogTitle>
            <AlertDialogDescription>
              {outletToToggleStatus?.isActive ? (
                <>
                  Are you sure you want to deactivate "
                  {outletToToggleStatus?.name}"? The outlet user will not be
                  able to log in until reactivated.
                </>
              ) : (
                <>
                  Are you sure you want to activate "
                  {outletToToggleStatus?.name}"? The outlet user will be able to
                  log in and access the portal.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmToggleStatus}
              disabled={isTogglingStatus}
              className={
                outletToToggleStatus?.isActive
                  ? "bg-orange-600 hover:bg-orange-700"
                  : "bg-green-600 hover:bg-green-700"
              }
            >
              {isTogglingStatus && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              {outletToToggleStatus?.isActive ? "Deactivate" : "Activate"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Change Badge Dialog */}
      <Dialog open={showBadgeDialog} onOpenChange={setShowBadgeDialog}>
        <DialogContent className="sm:max-w-[400px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Award className="h-5 w-5" />
              Change Outlet Badge
            </DialogTitle>
            <DialogDescription>
              Select a new badge tier for &quot;{outletToUpdateBadge?.name}
              &quot;
            </DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <div className="grid gap-2">
              <Label>Badge Tier</Label>
              <Select value={selectedBadge} onValueChange={setSelectedBadge}>
                <SelectTrigger>
                  <SelectValue placeholder="Select badge" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(BADGE_CONFIG).map(([key, config]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2">
                        {config.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedBadge && (
                <div className="flex items-center gap-2 mt-2">
                  <span className="text-sm text-muted-foreground">
                    Preview:
                  </span>
                  <Badge
                    variant="outline"
                    className={BADGE_CONFIG[selectedBadge]?.className}
                  >
                    {BADGE_CONFIG[selectedBadge]?.label}
                  </Badge>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowBadgeDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleConfirmUpdateBadge}
              disabled={
                isUpdatingBadge ||
                selectedBadge === (outletToUpdateBadge?.badge || "BASIC")
              }
            >
              {isUpdatingBadge && (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              )}
              Update Badge
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
