"use client";

import React, { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Eye,
  Edit,
  MoreHorizontal,
} from "lucide-react";
import { useNDRs } from "@/hooks/useNDR";
import { NDRReport } from "@/types/shipment";
import { format } from "date-fns";

interface NDRListProps {
  onViewNDR?: (ndr: NDRReport) => void;
  onEditNDR?: (ndr: NDRReport) => void;
  className?: string;
}

export function NDRList({ onViewNDR, onEditNDR, className }: NDRListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);

  const ndrFilters = useMemo(
    () => ({
      status:
        statusFilter === "all"
          ? undefined
          : (statusFilter as "pending" | "resolved" | "escalated"),
      page: currentPage,
      limit: 10,
    }),
    [statusFilter, currentPage],
  );

  const { ndrs, loading, error, pagination, refetch, updateFilters } =
    useNDRs(ndrFilters);

  const handleSearch = (value: string) => {
    setSearchTerm(value);
    // You can implement search logic here
  };

  const handleStatusFilter = (status: string) => {
    setStatusFilter(status);
    setCurrentPage(1);
    updateFilters({
      status:
        status === "all"
          ? undefined
          : (status as "pending" | "resolved" | "escalated"),
      page: 1,
    });
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    updateFilters({ page });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return (
          <Badge
            variant="outline"
            className="text-orange-600 border-orange-200"
          >
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "resolved":
        return (
          <Badge variant="outline" className="text-green-600 border-green-200">
            <CheckCircle2 className="w-3 h-3 mr-1" />
            Resolved
          </Badge>
        );
      case "escalated":
        return (
          <Badge variant="outline" className="text-red-600 border-red-200">
            <AlertCircle className="w-3 h-3 mr-1" />
            Escalated
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredNDRs = ndrs.filter(
    (ndr) =>
      ndr.shipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ndr.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ndr.description.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2">
            <RefreshCw className="h-5 w-5 animate-spin" />
            <span>Loading NDRs...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className={className}>
        <CardContent className="p-6">
          <div className="flex items-center justify-center space-x-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            <span>{error}</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center space-x-2">
            <AlertCircle className="h-5 w-5 text-orange-500" />
            <span>Non-Delivery Reports</span>
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={loading}
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search NDRs..."
                value={searchTerm}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex gap-2">
            <Select value={statusFilter} onValueChange={handleStatusFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="escalated">Escalated</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* NDR List */}
        <div className="space-y-4">
          {filteredNDRs.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p>No NDRs found</p>
            </div>
          ) : (
            filteredNDRs.map((ndr) => (
              <div
                key={ndr.id}
                className="border rounded-lg p-4 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center space-x-3 mb-2">
                      <h3 className="font-medium text-gray-900">
                        Shipment #{ndr.shipmentId}
                      </h3>
                      {getStatusBadge(ndr.status)}
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm text-gray-600">
                      <div>
                        <span className="font-medium">Reason:</span>{" "}
                        {ndr.reason}
                      </div>
                      <div>
                        <span className="font-medium">Reported:</span>{" "}
                        {format(new Date(ndr.reportedAt), "MMM dd, yyyy HH:mm")}
                      </div>
                      <div className="md:col-span-2">
                        <span className="font-medium">Description:</span>{" "}
                        <span className="text-gray-700">{ndr.description}</span>
                      </div>
                    </div>

                    {ndr.resolution && (
                      <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded text-sm">
                        <span className="font-medium text-green-800">
                          Resolution:
                        </span>{" "}
                        <span className="text-green-700">{ndr.resolution}</span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center space-x-2 ml-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => onViewNDR?.(ndr)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    {ndr.status === "pending" && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditNDR?.(ndr)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                    )}
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pagination */}
        {pagination.totalPages > 1 && (
          <div className="flex items-center justify-between mt-6">
            <div className="text-sm text-gray-500">
              Showing {(currentPage - 1) * 10 + 1} to{" "}
              {Math.min(currentPage * 10, pagination.total)} of{" "}
              {pagination.total} NDRs
            </div>
            <div className="flex space-x-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage - 1)}
                disabled={currentPage === 1}
              >
                Previous
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handlePageChange(currentPage + 1)}
                disabled={currentPage === pagination.totalPages}
              >
                Next
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
