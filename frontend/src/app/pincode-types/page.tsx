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
  useGetPincodeTypesQuery,
  useCreatePincodeTypeMutation,
  useUpdatePincodeTypeMutation,
  useDeletePincodeTypeMutation,
  type PincodeType,
} from "@/store/api/endpoints/pincodeTypeApi";
import {
  Settings,
  Plus,
  Search,
  Edit,
  Trash2,
  CheckCircle,
  XCircle,
} from "lucide-react";

export default function PincodeTypesPage() {
  const [searchTerm, setSearchTerm] = useState("");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [selectedPincodeType, setSelectedPincodeType] =
    useState<PincodeType | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    type: "yes_no" as "yes_no" | "number",
    isActive: true,
  });

  const {
    data: pincodeTypesData,
    isLoading,
    error,
    refetch,
  } = useGetPincodeTypesQuery({
    search: searchTerm || undefined,
  });

  const [createPincodeType] = useCreatePincodeTypeMutation();
  const [updatePincodeType] = useUpdatePincodeTypeMutation();
  const [deletePincodeType] = useDeletePincodeTypeMutation();

  const handleCreate = async () => {
    try {
      await createPincodeType({
        name: formData.name,
        type: formData.type,
        isActive: formData.isActive,
      }).unwrap();
      setShowCreateDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error creating pincode type:", error);
    }
  };

  const handleEdit = (pincodeType: PincodeType) => {
    setSelectedPincodeType(pincodeType);
    setFormData({
      name: pincodeType.name,
      type: pincodeType.type,
      isActive: pincodeType.isActive,
    });
    setShowEditDialog(true);
  };

  const handleUpdate = async () => {
    if (!selectedPincodeType) return;
    try {
      await updatePincodeType({
        id: selectedPincodeType.id,
        data: {
          name: formData.name,
          type: formData.type,
          isActive: formData.isActive,
        },
      }).unwrap();
      setShowEditDialog(false);
      resetForm();
    } catch (error) {
      console.error("Error updating pincode type:", error);
    }
  };

  const handleDelete = (pincodeType: PincodeType) => {
    setSelectedPincodeType(pincodeType);
    setShowDeleteDialog(true);
  };

  const confirmDelete = async () => {
    if (!selectedPincodeType) return;
    try {
      await deletePincodeType(selectedPincodeType.id).unwrap();
      setShowDeleteDialog(false);
      setSelectedPincodeType(null);
    } catch (error) {
      console.error("Error deleting pincode type:", error);
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      type: "yes_no",
      isActive: true,
    });
    setSelectedPincodeType(null);
  };

  return (
    <DashboardLayout
      breadcrumbs={[{ title: "Home", href: "/" }, { title: "Pincode Types" }]}
    >
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold">Pincode Types</h1>
            <p className="text-muted-foreground">
              Manage pincode type configurations (yes/no or number types)
            </p>
          </div>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Pincode Type
          </Button>
        </div>

        {/* Search */}
        <div className="flex items-center space-x-2">
          <Search className="h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search pincode types..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="max-w-sm"
          />
        </div>

        {/* Table */}
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
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
                    Error loading pincode types
                  </TableCell>
                </TableRow>
              ) : !pincodeTypesData?.data ||
                pincodeTypesData.data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center">
                    No pincode types found
                  </TableCell>
                </TableRow>
              ) : (
                pincodeTypesData.data.map((pincodeType) => (
                  <TableRow key={pincodeType.id}>
                    <TableCell className="font-medium">
                      {pincodeType.name}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{pincodeType.type}</Badge>
                    </TableCell>
                    <TableCell>
                      {pincodeType.isActive ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <XCircle className="h-4 w-4 text-red-500" />
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(pincodeType.createdAt).toLocaleDateString()}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(pincodeType)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(pincodeType)}
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
              <DialogTitle>Create Pincode Type</DialogTitle>
              <DialogDescription>
                Create a new pincode type configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., COD, Max Weight"
                />
              </div>
              <div>
                <Label htmlFor="type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "yes_no" | "number") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
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
              <DialogTitle>Edit Pincode Type</DialogTitle>
              <DialogDescription>
                Update pincode type configuration
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="edit-name">Name</Label>
                <Input
                  id="edit-name"
                  value={formData.name}
                  onChange={(e) =>
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="e.g., COD, Max Weight"
                />
              </div>
              <div>
                <Label htmlFor="edit-type">Type</Label>
                <Select
                  value={formData.type}
                  onValueChange={(value: "yes_no" | "number") =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="yes_no">Yes/No</SelectItem>
                    <SelectItem value="number">Number</SelectItem>
                  </SelectContent>
                </Select>
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
              <DialogTitle>Delete Pincode Type</DialogTitle>
              <DialogDescription>
                Are you sure you want to delete "{selectedPincodeType?.name}"?
                This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteDialog(false);
                  setSelectedPincodeType(null);
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
