"use client";

import React, { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertCircle,
  Plus,
  BarChart3,
  List,
  Calendar,
  Filter,
} from "lucide-react";
import { NDRForm } from "@/components/ndr/NDRForm";
import { NDRList } from "@/components/ndr/NDRList";
import { NDRStats } from "@/components/ndr/NDRStats";
import { NDRStatusUpdate } from "@/components/ndr/NDRStatusUpdate";
import { useNDRManagement } from "@/hooks/useNDR";
import { NDRReport } from "@/types/shipment";

export default function NDRPage() {
  const [activeTab, setActiveTab] = useState("list");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [selectedNDR, setSelectedNDR] = useState<NDRReport | null>(null);
  const [showStatusUpdate, setShowStatusUpdate] = useState(false);

  const {
    ndrs,
    stats,
    loading,
    error,
    pagination,
    fetchNDRs,
    fetchNDRStats,
    setCurrentNDR,
    clearError,
  } = useNDRManagement();

  const handleCreateNDR = () => {
    setShowCreateForm(true);
    setActiveTab("create");
  };

  const handleViewNDR = (ndr: NDRReport) => {
    setSelectedNDR(ndr);
    setCurrentNDR(ndr);
    setActiveTab("details");
  };

  const handleEditNDR = (ndr: NDRReport) => {
    setSelectedNDR(ndr);
    setShowStatusUpdate(true);
  };

  const handleCreateSuccess = () => {
    setShowCreateForm(false);
    setActiveTab("list");
    fetchNDRs();
    fetchNDRStats();
  };

  const handleStatusUpdateSuccess = () => {
    setShowStatusUpdate(false);
    setSelectedNDR(null);
    setActiveTab("list");
    fetchNDRs();
    fetchNDRStats();
  };

  const handleCancel = () => {
    setShowCreateForm(false);
    setShowStatusUpdate(false);
    setSelectedNDR(null);
    setActiveTab("list");
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Non-Delivery Reports
          </h1>
          <p className="text-gray-600 mt-1">
            Manage and track non-delivery reports for shipments
          </p>
        </div>
        <div className="flex space-x-3">
          <Button
            variant="outline"
            onClick={() => fetchNDRStats()}
            disabled={loading}
          >
            <BarChart3 className="h-4 w-4 mr-2" />
            Refresh Stats
          </Button>
          <Button onClick={handleCreateNDR}>
            <Plus className="h-4 w-4 mr-2" />
            Create NDR
          </Button>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-red-600">
                <AlertCircle className="h-5 w-5" />
                <span>{error}</span>
              </div>
              <Button variant="ghost" size="sm" onClick={clearError}>
                Dismiss
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      <Tabs
        value={activeTab}
        onValueChange={setActiveTab}
        className="space-y-6"
      >
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="list" className="flex items-center space-x-2">
            <List className="h-4 w-4" />
            <span>NDR List</span>
          </TabsTrigger>
          <TabsTrigger value="stats" className="flex items-center space-x-2">
            <BarChart3 className="h-4 w-4" />
            <span>Statistics</span>
          </TabsTrigger>
          <TabsTrigger value="create" className="flex items-center space-x-2">
            <Plus className="h-4 w-4" />
            <span>Create NDR</span>
          </TabsTrigger>
          <TabsTrigger value="details" className="flex items-center space-x-2">
            <AlertCircle className="h-4 w-4" />
            <span>NDR Details</span>
          </TabsTrigger>
        </TabsList>

        {/* NDR List Tab */}
        <TabsContent value="list">
          <NDRList onViewNDR={handleViewNDR} onEditNDR={handleEditNDR} />
        </TabsContent>

        {/* Statistics Tab */}
        <TabsContent value="stats">
          <NDRStats />
        </TabsContent>

        {/* Create NDR Tab */}
        <TabsContent value="create">
          <NDRForm onSuccess={handleCreateSuccess} onCancel={handleCancel} />
        </TabsContent>

        {/* NDR Details Tab */}
        <TabsContent value="details">
          {selectedNDR ? (
            <div className="space-y-6">
              {/* NDR Details Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-500" />
                    <span>NDR Details</span>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Shipment ID
                        </label>
                        <p className="text-lg font-semibold text-gray-900">
                          {selectedNDR.shipmentId}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Reason
                        </label>
                        <p className="text-gray-900">{selectedNDR.reason}</p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Status
                        </label>
                        <div className="mt-1">
                          {selectedNDR.status === "pending" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-orange-100 text-orange-800">
                              Pending
                            </span>
                          )}
                          {selectedNDR.status === "resolved" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                              Resolved
                            </span>
                          )}
                          {selectedNDR.status === "escalated" && (
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                              Escalated
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="space-y-4">
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Reported By
                        </label>
                        <p className="text-gray-900">
                          {selectedNDR.reportedBy}
                        </p>
                      </div>
                      <div>
                        <label className="text-sm font-medium text-gray-600">
                          Reported At
                        </label>
                        <p className="text-gray-900">
                          {new Date(selectedNDR.reportedAt).toLocaleString()}
                        </p>
                      </div>
                      {selectedNDR.resolvedAt && (
                        <div>
                          <label className="text-sm font-medium text-gray-600">
                            Resolved At
                          </label>
                          <p className="text-gray-900">
                            {new Date(selectedNDR.resolvedAt).toLocaleString()}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6">
                    <label className="text-sm font-medium text-gray-600">
                      Description
                    </label>
                    <p className="mt-1 text-gray-900 bg-gray-50 p-3 rounded-md">
                      {selectedNDR.description}
                    </p>
                  </div>

                  {selectedNDR.resolution && (
                    <div className="mt-6">
                      <label className="text-sm font-medium text-gray-600">
                        Resolution
                      </label>
                      <p className="mt-1 text-gray-900 bg-green-50 p-3 rounded-md border border-green-200">
                        {selectedNDR.resolution}
                      </p>
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex justify-end space-x-3 mt-6">
                    <Button
                      variant="outline"
                      onClick={() => setActiveTab("list")}
                    >
                      Back to List
                    </Button>
                    {selectedNDR.status === "pending" && (
                      <Button onClick={() => handleEditNDR(selectedNDR)}>
                        Update Status
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Status Update Form */}
              {showStatusUpdate && (
                <NDRStatusUpdate
                  ndr={selectedNDR}
                  onSuccess={handleStatusUpdateSuccess}
                  onCancel={handleCancel}
                />
              )}
            </div>
          ) : (
            <Card>
              <CardContent className="p-6">
                <div className="text-center text-gray-500">
                  <AlertCircle className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p>No NDR selected</p>
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
