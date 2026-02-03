"use client";

import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Upload,
  Download,
  FileSpreadsheet,
  CheckCircle,
  XCircle,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useDropzone } from "react-dropzone";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";

// RTK Query
import {
  useImportPartnerPincodesMutation,
  useLazyDownloadPincodeTemplateQuery,
} from "@/store/api/endpoints/partnerPincodesApi";

interface PincodeImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partnerId: string;
  partnerName: string;
  onSuccess: () => void;
}

interface ImportResult {
  partnerId: string;
  partnerName: string;
  imported: Array<{
    row: number;
    pincodeCode: string;
    assignmentId: string;
  }>;
  errors: Array<{
    row: number;
    pincodeCode: string;
    error: string;
  }>;
  summary: {
    total: number;
    imported: number;
    failed: number;
  };
}

export function PincodeImportDialog({
  open,
  onOpenChange,
  partnerId,
  partnerName,
  onSuccess,
}: PincodeImportDialogProps) {
  const [file, setFile] = useState<File | null>(null);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);

  // Mutations
  const [importPincodes] = useImportPartnerPincodesMutation();
  const [downloadTemplate] = useLazyDownloadPincodeTemplateQuery();

  // Download template
  const handleDownloadTemplate = async () => {
    try {
      const result = await downloadTemplate();
      if (result.data) {
        const url = window.URL.createObjectURL(new Blob([result.data]));
        const a = document.createElement("a");
        a.href = url;
        a.download = "pincode-import-template.xlsx";
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
      }
    } catch (error: any) {
      console.error("Failed to download template:", error);
      setImportError("Failed to download template. Please try again.");
    }
  };

  // Handle dropzone
  const onDrop = useCallback((acceptedFiles: File[]) => {
    const uploadedFile = acceptedFiles[0];
    if (uploadedFile) {
      // Validate file type
      const validTypes = [
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "application/vnd.ms-excel",
      ];
      if (!validTypes.includes(uploadedFile.type)) {
        setImportError("Please upload a valid Excel file (.xlsx or .xls)");
        return;
      }
      // Validate file size (5MB max)
      const maxSize = 5 * 1024 * 1024;
      if (uploadedFile.size > maxSize) {
        setImportError("File size exceeds 5MB limit");
        return;
      }

      setFile(uploadedFile);
      setImportResult(null);
      setImportError(null);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [
        ".xlsx",
      ],
      "application/vnd.ms-excel": [".xls"],
    },
    maxFiles: 1,
    multiple: false,
  });

  // Handle import
  const handleImport = async () => {
    if (!file) {
      setImportError("Please select a file to import");
      return;
    }

    setIsImporting(true);
    setImportError(null);
    setImportResult(null);

    try {
      const result = await importPincodes({
        partnerId,
        file,
      }).unwrap();

      setImportResult(result);
      if (result.summary.failed === 0) {
        // Auto-close on success
        setTimeout(() => {
          onSuccess();
          handleClose();
        }, 2000);
      }
    } catch (error: any) {
      setImportError(
        error?.data?.error?.message || "Failed to import pincodes",
      );
    } finally {
      setIsImporting(false);
    }
  };

  const handleClose = () => {
    setFile(null);
    setImportResult(null);
    setImportError(null);
    onOpenChange(false);
  };

  const resetAndClose = () => {
    setFile(null);
    setImportResult(null);
    setImportError(null);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-4xl max-h-[85vh]">
        <DialogHeader>
          <DialogTitle>Import Pincodes from Excel</DialogTitle>
          <DialogDescription>
            Download the template, fill in your pincode data, and upload it to
            bulk assign pincodes to {partnerName}.
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[calc(85vh-200px)] pr-4">
          <div className="space-y-6 py-4">
            {/* Step 1: Download Template */}
            <div className="space-y-3">
              <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-blue-50 flex items-center justify-center">
                    <Download className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <p className="font-medium">Step 1: Download Template</p>
                    <p className="text-sm text-muted-foreground">
                      Download the Excel template and fill in your pincode data
                    </p>
                  </div>
                </div>
                <Button variant="outline" onClick={handleDownloadTemplate}>
                  <Download className="mr-2 h-4 w-4" />
                  Download Template
                </Button>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="space-y-3">
              <p className="font-medium">Step 2: Upload Filled File</p>
              {!file ? (
                <div
                  {...getRootProps()}
                  className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                    isDragActive
                      ? "border-primary bg-primary/5"
                      : "border-muted hover:bg-muted/50"
                  }`}
                >
                  <input {...getInputProps()} />
                  <Upload className="h-10 w-10 mx-auto mb-3 text-muted-foreground" />
                  <p className="text-sm text-muted-foreground mb-1">
                    Drag & drop Excel file here, or click to browse
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Supports .xlsx and .xls files (max 5MB)
                  </p>
                </div>
              ) : (
                <div className="flex items-center justify-between p-4 border rounded-lg bg-muted/30">
                  <div className="flex items-center gap-3 flex-1">
                    <FileSpreadsheet className="h-8 w-8 text-blue-600" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{file.name}</p>
                      <p className="text-sm text-muted-foreground">
                        {(file.size / 1024).toFixed(1)} KB
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setFile(null)}
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>

            {/* Import Result */}
            {importResult && (
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 border rounded-lg">
                  <div>
                    <p className="font-medium">Import Complete</p>
                    <p className="text-sm text-muted-foreground">
                      {importResult.summary.imported} of{" "}
                      {importResult.summary.total} pincodes imported
                      successfully
                    </p>
                  </div>
                  <Badge
                    variant={
                      importResult.summary.failed === 0
                        ? "default"
                        : importResult.summary.imported === 0
                          ? "destructive"
                          : "secondary"
                    }
                    className="text-sm"
                  >
                    {importResult.summary.failed === 0
                      ? "All successful"
                      : importResult.summary.imported === 0
                        ? "All failed"
                        : `${importResult.summary.failed} failed`}
                  </Badge>
                </div>

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-3 bg-red-50 border-b">
                      <p className="text-sm font-medium text-red-800">
                        {importResult.errors.length} rows failed to import
                      </p>
                    </div>
                    <ScrollArea className="h-40 p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="pb-2 font-medium">Row</th>
                            <th className="pb-2 font-medium">Pincode</th>
                            <th className="pb-2 font-medium">Error</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.errors.map((error, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{error.row}</td>
                              <td className="py-2 font-mono">
                                {error.pincodeCode}
                              </td>
                              <td className="py-2 text-red-600">
                                {error.error}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}

                {/* Imported Successfully */}
                {importResult.imported.length > 0 && (
                  <div className="border rounded-lg">
                    <div className="p-3 bg-green-50 border-b">
                      <p className="text-sm font-medium text-green-800">
                        {importResult.imported.length} pincodes imported
                        successfully
                      </p>
                    </div>
                    <ScrollArea className="h-32 p-3">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-left border-b">
                            <th className="pb-2 font-medium">Row</th>
                            <th className="pb-2 font-medium">Pincode</th>
                            <th className="pb-2 font-medium">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {importResult.imported.map((item, index) => (
                            <tr key={index} className="border-b">
                              <td className="py-2">{item.row}</td>
                              <td className="py-2 font-mono">
                                {item.pincodeCode}
                              </td>
                              <td className="py-2">
                                <CheckCircle className="inline h-4 w-4 text-green-600 mr-1" />
                                Imported
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </ScrollArea>
                  </div>
                )}
              </div>
            )}

            {/* Error Message */}
            {importError && (
              <div className="flex items-center gap-2 p-3 bg-red-50 text-red-700 rounded-md">
                <AlertCircle className="h-5 w-5 flex-shrink-0" />
                <p className="text-sm">{importError}</p>
              </div>
            )}
          </div>
        </ScrollArea>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isImporting}
          >
            {file && importResult ? "Close" : "Cancel"}
          </Button>
          <Button onClick={handleImport} disabled={!file || isImporting}>
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : file && importResult ? (
              "Import Again"
            ) : (
              <>
                <Upload className="mr-2 h-4 w-4" />
                Import Pincodes
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
