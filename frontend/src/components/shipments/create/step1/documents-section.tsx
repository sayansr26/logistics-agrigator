"use client";

import { useState } from "react";
import { FileUp, ImageIcon, X } from "lucide-react";

/**
 * Document upload UI. Not yet wired to a backend endpoint (no document
 * upload API was part of this phase's contract) - kept as local-only state
 * so the section renders per the design without implying a broken feature.
 */
export function DocumentsSection() {
  const [invoiceFile, setInvoiceFile] = useState<File | null>(null);
  const [secondaryType, setSecondaryType] = useState("");
  const [secondaryFile, setSecondaryFile] = useState<File | null>(null);

  return (
    <div className="bg-card rounded-2xl p-5 border border-border shadow-sm space-y-4">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <div className="flex items-center gap-2">
          <FileUp className="h-4 w-4 text-blue-600" />
          <h2 className="text-sm font-bold text-foreground">
            Upload Documents
          </h2>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          Max size 20MB
        </span>
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-foreground">
          Invoice Document{" "}
          <span className="text-muted-foreground font-normal">(Optional)</span>
        </label>
        {invoiceFile ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-9 h-9 rounded-lg bg-blue-100 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center shrink-0">
                <FileUp className="h-4 w-4" />
              </div>
              <div className="truncate">
                <p className="text-xs font-bold text-foreground truncate">
                  {invoiceFile.name}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {(invoiceFile.size / 1024 / 1024).toFixed(2)} MB
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setInvoiceFile(null)}
              className="w-6 h-6 rounded-full bg-muted hover:bg-red-100 hover:text-red-600 text-muted-foreground flex items-center justify-center transition-colors"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="border-2 border-dashed border-border hover:border-blue-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-muted/40 block">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.bmp"
              onChange={(e) => setInvoiceFile(e.target.files?.[0] || null)}
            />
            <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs font-bold text-blue-600">
              Upload Invoice (PNG, JPG, JPEG, PDF, BMP)
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              or drag and drop here
            </p>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <label className="block text-xs font-semibold text-foreground">
          Secondary Document (Optional)
        </label>
        <div className="relative">
          <select
            value={secondaryType}
            onChange={(e) => setSecondaryType(e.target.value)}
            className="w-full text-xs pl-3 pr-8 py-2 rounded-xl border border-input bg-background focus:outline-none focus:border-primary font-medium text-foreground cursor-pointer"
          >
            <option value="">Select Document Type</option>
            <option value="packing_list">Packing List</option>
            <option value="eway_bill">E-Way Bill copy</option>
            <option value="declarations">Declaration Letter</option>
          </select>
        </div>

        {secondaryFile ? (
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <p className="text-xs font-bold text-foreground truncate">
              {secondaryFile.name}
            </p>
            <button
              type="button"
              onClick={() => setSecondaryFile(null)}
              className="w-6 h-6 rounded-full bg-muted hover:bg-red-100 hover:text-red-600 text-muted-foreground flex items-center justify-center"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="border-2 border-dashed border-border hover:border-blue-400 rounded-2xl p-4 text-center cursor-pointer transition-colors bg-muted/40 block">
            <input
              type="file"
              className="hidden"
              accept=".pdf,.jpg,.jpeg,.png,.bmp"
              onChange={(e) => setSecondaryFile(e.target.files?.[0] || null)}
            />
            <ImageIcon className="h-6 w-6 text-muted-foreground mx-auto mb-1.5" />
            <p className="text-xs font-bold text-blue-600">
              Upload Document (PNG, JPG, JPEG, PDF, BMP)
            </p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              or drag and drop here
            </p>
          </label>
        )}
      </div>
    </div>
  );
}
