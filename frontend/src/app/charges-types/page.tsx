"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  PageHeader,
  PageContainer,
  StatsCard,
  StatsGrid,
} from "@/components/shared";
import {
  useGetChargesTypesQuery,
  useCreateChargesTypeMutation,
  useUpdateChargesTypeMutation,
  useDeleteChargesTypeMutation,
  type ChargesType,
} from "@/store/api/endpoints/chargesTypeApi";
import {
  useGetPartnersQuery,
  type Partner,
} from "@/store/api/endpoints/partnersApi";
import {
  IndianRupee,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
  Loader2,
} from "lucide-react";

export default function ChargesTypesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [partnerFilter, setPartnerFilter] = useState<string>("all");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedChargesType, setSelectedChargesType] =
    useState<ChargesType | null>(null);
  const [formData, setFormData] = useState({
    partnerId: "",
    name: "",
    isActive: true,
  });

  // Fetch charges types
  const {
    data: chargesTypesData,
    isLoading,
    error,
  } = useGetChargesTypesQuery({
    search: searchTerm || undefined,
    partnerId: partnerFilter === "all" ? undefined : partnerFilter,
  });

  // Fetch partners for dropdown
  const { data: partnersData } = useGetPartnersQuery({
    isActive: true,
    limit: 100,
  });

  const [createChargesType, { isLoading: isCreating }] =
    useCreateChargesTypeMutation();
  const [updateChargesType, { isLoading: isUpdating }] =
    useUpdateChargesTypeMutation();
  const [deleteChargesType, { isLoading: isDeleting }] =
    useDeleteChargesTypeMutation();

  const chargesTypes = chargesTypesData?.data || [];
  const partners = partnersData?.data?.partners || [];
  const activeCount = chargesTypes.filter((c) => c.isActive).length;
  const inactiveCount = chargesTypes.filter((c) => !c.isActive).length;

  const handleCreate = async () => {
    try {
      await createChargesType({
        partnerId: formData.partnerId,
        name: formData.name,
        isActive: formData.isActive,
      }).unwrap();
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error creating charges type:", error);
    }
  };

  const handleEdit = (chargesType: ChargesType) => {
    setSelectedChargesType(chargesType);
    setFormData({
      partnerId: chargesType.partnerId,
      name: chargesType.name,
      isActive: chargesType.isActive,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!selectedChargesType) return;
    try {
      await updateChargesType({
        id: selectedChargesType.id,
        data: {
          name: formData.name,
          isActive: formData.isActive,
        },
      }).unwrap();
      setShowEditDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error updating charges type:", error);
    }
  };

  const handleDelete = (chargesType: ChargesType) => {
    setSelectedChargesType(chargesType);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedChargesType) return;
    try {
      await deleteChargesType(selectedChargesType.id).unwrap();
      setShowDeleteDialog(false);
      setSelectedChargesType(null);
    } catch (error) {
      console.error("Error deleting charges type:", error);
    }
  };

  const resetForm = () => {
    setFormData({ partnerId: "", name: "", isActive: true });
    setSelectedChargesType(null);
  };

  const getPartnerName = (partnerId: string) => {
    const partner = partners.find((p) => p.id === partnerId);
    return partner?.displayName || partner?.name || "Unknown";
  };

  return (
    <DashboardLayout>
      <PageContainer>
        {/* Page Header */}
        <PageHeader
          title="Charges Types"
          description="Manage partner-specific charge types (e.g., Freight, COD, Handling)"
          primaryAction={{
            label: "Create Charges Type",
            onClick: () => setShowCreateDialog(true),
          }}
        />

        {/* Statistics Cards */}
        <StatsGrid columns={3}>
          <StatsCard
            title="Total Charges Types"
            value={chargesTypes.length}
            icon={IndianRupee}
            iconColor="text-blue-600"
            isLoading={isLoading}
          />
          <StatsCard
            title="Active"
            value={activeCount}
            icon={CheckCircle}
            iconColor="text-green-600"
            isLoading={isLoading}
          />
          <StatsCard
            title="Inactive"
            value={inactiveCount}
            icon={XCircle}
            iconColor="text-gray-600"
            isLoading={isLoading}
          />
        </StatsGrid>

        {/* Filters */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
                <Input
                  placeholder="Search charges types..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
              <Select value={partnerFilter} onValueChange={setPartnerFilter}>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Filter by Partner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Partners</SelectItem>
                  {partners.map((partner) => (
                    <SelectItem key={partner.id} value={partner.id}>
                      {partner.displayName || partner.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Partner</TableHead>
                  <TableHead>Charge Type Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : error ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="text-center text-destructive py-8"
                    >
                      Error loading charges types
                    </TableCell>
                  </TableRow>
                ) : chargesTypes.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-8">
                      <IndianRupee className="h-12 w-12 mx-auto mb-2 text-muted-foreground opacity-50" />
                      <p className="text-muted-foreground">
                        No charges types found
                      </p>
                      <Button
                        className="mt-4"
                        onClick={() => setShowCreateDialog(true)}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Create First Charges Type
                      </Button>
                    </TableCell>
                  </TableRow>
                ) : (
                  chargesTypes.map((chargesType) => (
                    <TableRow key={chargesType.id}>
                      <TableCell className="font-medium">
                        {chargesType.partner?.displayName ||
                          chargesType.partner?.name ||
                          getPartnerName(chargesType.partnerId)}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          <IndianRupee className="h-3 w-3 mr-1" />
                          {chargesType.name}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {chargesType.isActive ? (
                          <Badge className="bg-green-100 text-green-800">
                            <CheckCircle className="h-3 w-3 mr-1" />
                            Active
                          </Badge>
                        ) : (
                          <Badge className="bg-red-100 text-red-800">
                            <XCircle className="h-3 w-3 mr-1" />
                            Inactive
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(chargesType.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(chargesType)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(chargesType)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Create Dialog */}
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create Charges Type</DialogTitle>
              <DialogDescription>
                Create a new charge type for a partner
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="partner">Partner</Label>
                <Select
                  value={formData.partnerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, partnerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a partner" />
                  </SelectTrigger>
                  <SelectContent>
                    {partners.map((partner) => (
                      <SelectItem key={partner.id} value={partner.id}>
                        {partner.displayName || partner.name} ({partner.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="name">Charge Type Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Freight, COD, Handling"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
                <Label htmlFor="isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowCreateDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleCreate} disabled={isCreating}>
                {isCreating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Create
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Edit Dialog */}
        <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Charges Type</DialogTitle>
              <DialogDescription>
                Update charge type configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Partner</Label>
                <Input
                  value={getPartnerName(formData.partnerId)}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label htmlFor="edit-name">Charge Type Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., Freight, COD, Handling"
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="edit-isActive"
                  checked={formData.isActive}
                  onChange={(e) =>
                    setFormData({ ...formData, isActive: e.target.checked })
                  }
                />
                <Label htmlFor="edit-isActive">Active</Label>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowEditDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button onClick={handleUpdate} disabled={isUpdating}>
                {isUpdating && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Update
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Delete Confirmation Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Delete Charges Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedChargesType?.name}"
                for{" "}
                {selectedChargesType &&
                  getPartnerName(selectedChargesType.partnerId)}
                ? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedChargesType(null);
                }}
              >
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={confirmDelete}
                disabled={isDeleting}
              >
                {isDeleting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </PageContainer>
    </DashboardLayout>
  );
}
