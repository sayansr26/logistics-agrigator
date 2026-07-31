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
import { Skeleton } from "@/components/ui/skeleton";
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
  label?: string;
  name: string;
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  phone: string;
  email?: string;
}

interface BulkUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  /** Uploads the file; should reject with an Error carrying a server message */
  onUpload: (_file: File) => Promise<void>;
  /** Downloads the canonical CSV template from the backend */
  onDownloadTemplate: (_pickupAddress?: PickupAddress) => Promise<void> | void;
  /** Pickup addresses used to prefill the template (optional) */
  pickupAddresses?: PickupAddress[];
  isLoadingAddresses?: boolean;
}

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

export function BulkUploadModal({
  isOpen,
  onClose,
  onUpload,
  onDownloadTemplate,
  pickupAddresses = [],
  isLoadingAddresses = false,
}: BulkUploadModalProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [pickupAddressId, setPickupAddressId] = useState<string>("");
  const [isUploading, setIsUploading] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const [uploadSuccess, setUploadSuccess] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetMessages = () => {
    setUploadSuccess(false);
    setUploadMessage("");
  };

  const handleFileSelect = (file: File) => {
    resetMessages();

    const lastDot = file.name.lastIndexOf(".");
    const extension =
      lastDot === -1 ? "" : file.name.slice(lastDot).toLowerCase();

    if (!ALLOWED_EXTENSIONS.includes(extension)) {
      setUploadMessage(
        `Unsupported file type. Allowed formats: ${ALLOWED_EXTENSIONS.join(", ")}`,
      );
      return;
    }

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadMessage("File too large. Maximum size is 10MB.");
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

  const closeAndReset = () => {
    setSelectedFile(null);
    setPickupAddressId("");
    resetMessages();
    onClose();
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setUploadMessage("Please select a file to upload.");
      return;
    }

    setIsUploading(true);
    resetMessages();

    try {
      await onUpload(selectedFile);

      setUploadSuccess(true);
      setUploadMessage(`Successfully processed ${selectedFile.name}`);

      setTimeout(() => {
        closeAndReset();
      }, 1500);
    } catch (error) {
      // Surface the real server message rather than a generic string
      setUploadSuccess(false);
      setUploadMessage(
        error instanceof Error
          ? error.message
          : "Upload failed. Please try again.",
      );
    } finally {
      setIsUploading(false);
    }
  };

  const selectedAddress = pickupAddresses.find(
    (addr) => addr.id === pickupAddressId,
  );

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && closeAndReset()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center space-x-2">
            <Package className="h-5 w-5" />
            <span>Bulk Shipment Upload</span>
          </DialogTitle>
          <DialogDescription>
            Upload a CSV or Excel file containing shipment details. Each row
            carries its own pickup and delivery address.
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
                onClick={() => onDownloadTemplate(selectedAddress)}
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
                    onClick={() => {
                      setSelectedFile(null);
                      resetMessages();
                    }}
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
                      Supports CSV and Excel files (max 10MB, 1000 rows)
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
                    <li>• Maximum file size: 10MB, up to 1000 rows</li>
                    <li>
                      • Phone numbers must be valid 10-digit Indian mobiles
                    </li>
                    <li>• COD rows must include a COD Amount</li>
                    <li>• Download the template for the exact columns</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* Pickup address - used only to prefill the downloaded template,
              since the uploaded file carries a pickup address per row. */}
          <div className="space-y-4">
            <div>
              <Label className="text-base font-medium">
                Prefill Template Pickup Address
              </Label>
              <p className="text-sm text-muted-foreground mt-1">
                Optional. Choose a warehouse to prefill the pickup columns in
                the downloaded template.
              </p>
            </div>

            {isLoadingAddresses ? (
              <Skeleton className="h-10 w-full" />
            ) : pickupAddresses.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No saved pickup addresses found. Fill the pickup columns in the
                template manually.
              </p>
            ) : (
              <Select
                value={pickupAddressId}
                onValueChange={setPickupAddressId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Choose pickup address" />
                </SelectTrigger>
                <SelectContent>
                  {pickupAddresses.map((address) => (
                    <SelectItem key={address.id} value={address.id}>
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4" />
                        <span>{address.label || address.name}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {selectedAddress && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <MapPin className="h-4 w-4 text-gray-600" />
                    <span className="font-medium">
                      {selectedAddress.label || selectedAddress.name}
                    </span>
                  </div>
                  <div className="text-sm text-gray-600 space-y-1">
                    <p>{selectedAddress.addressLine1}</p>
                    <p>
                      {selectedAddress.city}, {selectedAddress.state} -{" "}
                      {selectedAddress.pincode}
                    </p>
                    <p>
                      Contact: {selectedAddress.name} ({selectedAddress.phone})
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
                    variant={selectedFile ? "default" : "secondary"}
                    className="ml-2"
                  >
                    {selectedFile ? "Ready to Upload" : "Incomplete"}
                  </Badge>
                </div>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex space-x-2">
          <Button
            variant="outline"
            onClick={closeAndReset}
            disabled={isUploading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isUploading}
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

export type { PickupAddress };
