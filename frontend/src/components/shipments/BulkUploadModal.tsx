"use client";

import React, { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Upload,
  FileText,
  X,
  CheckCircle,
  AlertCircle,
  Download,
  MapPin,
  Package,
} from "lucide-react";

interface PickupAddress {
  id: string;
  name: string;
  address: string;
  city: string;
  state: string;
  pincode: string;
  contactPerson: string;
  phone: string;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUpload: (_file: File, _pickupAddress: string) => void;
}

const mockPickupAddresses: PickupAddress[] = [
  {
    id: "startup-sample-5005",
    name: "StartUP-Sample-5005",
    address: "west gorakh park gali no-3 shahdara",
    city: "Delhi",
    state: "Delhi",
    pincode: "110032",
    contactPerson: "John Doe",
    phone: "+91 98765 43210",
  },
  {
    id: "warehouse-mumbai",
    name: "Warehouse Mumbai",
    address: "Andheri Industrial Area, MIDC",
    city: "Mumbai",
    state: "Maharashtra",
    pincode: "400058",
    contactPerson: "Jane Smith",
    phone: "+91 98765 43211",
  },
  {
    id: "warehouse-delhi",
    name: "Warehouse Delhi",
    address: "Okhla Industrial Area, Phase 1",
    city: "Delhi",
    state: "Delhi",
    pincode: "110020",
    contactPerson: "Mike Johnson",
    phone: "+91 98765 43212",
  },
];

export function BulkUploadModal({
  isOpen,
  onClose,
  onUpload,
}: BulkUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pickupAddress, setPickupAddress] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (file: File) => {
    const allowedTypes = [
      "text/csv",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    ];

    if (!allowedTypes.includes(file.type)) {
      alert("Please select a valid CSV or Excel file");
      return;
    }
    setSelectedFile(file);
  };

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileSelect(e.target.files[0]);
    }
  };

  const handleUpload = async () => {
    if (!selectedFile || !pickupAddress) {
      alert("Please select both a file and pickup address");
      return;
    }

    setIsUploading(true);
    try {
      await onUpload(selectedFile, pickupAddress);
      // Show success message
      setUploadSuccess(true);
      setUploadMessage(
        `Successfully uploaded ${selectedFile.name} with ${selectedAddress?.name || "selected"} pickup address`,
      );

      // Reset form after showing success
      setTimeout(() => {
        setSelectedFile(null);
        setPickupAddress("");
        setUploadSuccess(false);
        setUploadMessage("");
        onClose();
      }, 2000);
    } catch (error) {
      // TODO: Implement proper error logging
      setUploadSuccess(false);
      setUploadMessage("Upload failed. Please try again.");
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    // Create a sample CSV template
    const csvContent = `Order ID,Customer Name,Phone,Email,Address,City,State,Pincode,Product Description,Weight (kg),Length (cm),Width (cm),Height (cm),Declared Value,Payment Mode
ORD-001,John Doe,+91 98765 43210,john@example.com,123 Main St,Mumbai,Maharashtra,400001,Electronics,2.5,30,20,15,5000,Prepaid
ORD-002,Jane Smith,+91 98765 43211,jane@example.com,456 Oak Ave,Delhi,Delhi,110001,Clothing,1.0,25,15,10,2000,COD`;

    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "bulk_shipment_template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  const selectedAddress = mockPickupAddresses.find(
    (addr) => addr.id === pickupAddress,
  );

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Bulk Shipment Upload</span>
          </DialogTitle>
          <DialogDescription>
            Upload CSV or Excel file with shipment details and select pickup
            address
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Success/Error Alert */}
          {uploadSuccess && (
            <Alert>
              <CheckCircle className="h-4 w-4" />
              <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
          )}

          {!uploadSuccess && uploadMessage && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{uploadMessage}</AlertDescription>
            </Alert>
          )}

          {/* File Upload Section */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label className="text-base font-medium">Upload File</Label>
              <Button
                variant="outline"
                size="sm"
                onClick={downloadTemplate}
                className="flex items-center space-x-2"
              >
                <Download className="h-4 w-4" />
                <span>Download Template</span>
              </Button>
            </div>

            <div
              className={`border-2 border-dashed rounded-lg p-6 text-center transition-colors ${
                dragActive
                  ? "border-blue-500 bg-blue-50"
                  : selectedFile
                    ? "border-green-500 bg-green-50"
                    : "border-gray-300 hover:border-gray-400"
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              {selectedFile ? (
                <div className="space-y-2">
                  <CheckCircle className="h-8 w-8 text-green-600 mx-auto" />
                  <div>
                    <p className="font-medium text-green-900">
                      {selectedFile.name}
                    </p>
                    <p className="text-sm text-green-700">
                      {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFile(null)}
                    className="mt-2"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Remove File
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Upload className="h-8 w-8 text-gray-400 mx-auto" />
                  <div>
                    <p className="font-medium text-gray-900">
                      Drop your file here or click to browse
                    </p>
                    <p className="text-sm text-gray-500">
                      Supports CSV and Excel files (max 10MB)
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    onClick={() => fileInputRef.current?.click()}
                    className="mt-2"
                  >
                    Choose File
                  </Button>
                </div>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileInputChange}
              className="hidden"
            />

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-start space-x-2">
                <FileText className="h-4 w-4 text-blue-600 mt-0.5" />
                <div className="text-sm text-blue-800">
                  <p className="font-medium">File Requirements:</p>
                  <ul className="mt-1 space-y-1">
                    <li>• CSV or Excel format (.csv, .xlsx, .xls)</li>
                    <li>• Maximum file size: 10MB</li>
                    <li>
                      • Required columns: Order ID, Customer Name, Phone,
                      Address, etc.
                    </li>
                    <li>• Download template for correct format</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pickup Address Selection */}
          <div className="space-y-4">
            <Label className="text-base font-medium">
              Select Pickup Address
            </Label>

            <Select value={pickupAddress} onValueChange={setPickupAddress}>
              <SelectTrigger>
                <SelectValue placeholder="Choose pickup address" />
              </SelectTrigger>
              <SelectContent>
                {mockPickupAddresses.map((address) => (
                  <SelectItem key={address.id} value={address.id}>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>{address.name}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {selectedAddress && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">{selectedAddress.name}</span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{selectedAddress.address}</p>
                    <p>
                      {selectedAddress.city}, {selectedAddress.state} -{" "}
                      {selectedAddress.pincode}
                    </p>
                    <p>
                      Contact: {selectedAddress.contactPerson} (
                      {selectedAddress.phone})
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>

          <Separator />

          {/* Upload Summary */}
          <div className="space-y-3">
            <Label className="text-base font-medium">Upload Summary</Label>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-600">File:</span>
                  <span className="ml-2 font-medium">
                    {selectedFile ? selectedFile.name : "No file selected"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Pickup Address:</span>
                  <span className="ml-2 font-medium">
                    {selectedAddress ? selectedAddress.name : "Not selected"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">File Size:</span>
                  <span className="ml-2 font-medium">
                    {selectedFile
                      ? `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`
                      : "N/A"}
                  </span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>
                  <Badge
                    variant={
                      selectedFile && pickupAddress ? "default" : "secondary"
                    }
                    className="ml-2"
                  >
                    {selectedFile && pickupAddress
                      ? "Ready to Upload"
                      : "Incomplete"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button variant="outline" onClick={onClose} disabled={isUploading}>
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || !pickupAddress || isUploading}
            className="bg-blue-600 hover:bg-blue-700"
          >
            {isUploading ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2" />
                Uploading...
              </>
            ) : (
              <>
                <Upload className="h-4 w-4 mr-2" />
                Upload Shipments
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
