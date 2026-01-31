"use client";

import React, { useState } from "react";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
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
  DollarSign,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
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

  // Fetch charges types with optional partner filter
  const {
    data: chargesTypesData,
    isLoading,
    error,
    refetch,
  } = useGetChargesTypesQuery({
    search: searchTerm || undefined,
    partnerId: partnerFilter === "all" ? undefined : partnerFilter,
  });

  // Fetch partners for dropdown
  const { data: partnersData } = useGetPartnersQuery({
    isActive: true,
    limit: 100,
  });

  const [createChargesType] = useCreateChargesTypeMutation();
  const [updateChargesType] = useUpdateChargesTypeMutation();
  const [deleteChargesType] = useDeleteChargesTypeMutation();

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
    setFormData({
      partnerId: "",
      name: "",
      isActive: true,
    });
    setSelectedChargesType(null);
  };

  const getPartnerName = (partnerId: string) => {
    const partner = partnersData?.data?.partners?.find(
      (p) => p.id === partnerId,
    );
    return partner?.displayName || partner?.name || "Unknown Partner";
  };

  return (
    <DashboardLayout
      breadcrumbs={[{ title: "Home", href: "/" }, { title: "Charges Types" }]}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Charges Types</h1>
            <p className="text-muted-foreground">
              Manage partner-specific charge types (e.g., Generic expect
              geological )
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Charges Type
          </Button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center space-x-2 flex-1">
            <Search className="h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search charges types..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
          <Select value={partnerFilter} onValueChange={setPartnerFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="Filter by Partner" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Partners</SelectItem>
              {partnersData?.data?.partners?.map((partner) => (
                <SelectItem key={partner.id} value={partner.id}>
                  {partner.displayName || partner.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <div className="rounded-md border">
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
                  <TableCell colSpan={5} className="text-center">
                    Loading...
                  </TableCell>
                </TableRow>
              ) : error ? (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="text-center text-destructive"
                  >
                    Error loading charges types
                  </TableCell>
                </TableRow>
              ) : !chargesTypesData?.data ||
                chargesTypesData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No charges types found
                  </TableCell>
                </TableRow>
              ) : (
                chargesTypesData.data.map((chargesType) => (
                  <TableRow key={chargesType.id}>
                    <TableCell className="font-medium">
                      {chargesType.partner?.displayName ||
                        chargesType.partner?.name ||
                        getPartnerName(chargesType.partnerId)}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        <DollarSign className="h-3 w-3 mr-1" />
                        {chargesType.name}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {chargesType.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
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
        </div>

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
                    {partnersData?.data?.partners?.map((partner) => (
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
                  placeholder="e.g., Freight Charge expect geological"
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
              <Button onClick={handleCreate}>Create</Button>
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
                  placeholder="e.g., Freight Charge expect geological"
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
              <Button onClick={handleUpdate}>Update</Button>
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
              <Button variant="destructive" onClick={confirmDelete}>
                Delete
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </DashboardLayout>
  );
}
