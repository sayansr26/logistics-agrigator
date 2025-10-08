"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Globe,
  MapPin,
  CheckCircle,
  XCircle,
  Clock,
  Edit,
  Trash2,
  Package,
  Truck,
  Navigation,
  Settings,
} from "lucide-react";

function getStatusColor(status) {
  switch (status) {
    case "active":
      return "bg-green-100 text-green-800";
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "inactive":
      return <XCircle className="h-4 w-4 text-gray-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getZoneTypeIcon(type) {
  switch (type) {
    case "pickup":
      return <Package className="h-5 w-5 text-blue-600" />;
    case "delivery":
      return <Truck className="h-5 w-5 text-green-600" />;
    case "both":
      return <Navigation className="h-5 w-5 text-purple-600" />;
    default:
      return <MapPin className="h-5 w-5 text-gray-600" />;
  }
}

export function ZoneCard({
  zone,
  onSelect,
  onEdit,
  onDelete,
  onManageRates,
  className,
}) {
  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              {getZoneTypeIcon(zone.type)}
            </div>
            <div>
              <div className="font-medium">{zone.name}</div>
              <div className="text-sm text-muted-foreground">
                {zone.code} • {zone.pincodes.length} pincodes •{" "}
                {zone.cities.length} cities
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              {getStatusIcon(zone.status)}
              <Badge className={getStatusColor(zone.status)}>
                {zone.status}
              </Badge>
            </div>
            <div className="flex items-center space-x-1">
              {onEdit && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onEdit(zone)}
                  className="h-8 w-8"
                >
                  <Edit className="h-4 w-4" />
                </Button>
              )}
              {onDelete && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(zone)}
                  className="h-8 w-8 text-red-600 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Zone Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm font-medium">Coverage</div>
            <div className="text-sm text-muted-foreground">
              {zone.coverage.area} sq km •{" "}
              {zone.coverage.population.toLocaleString()} people
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Service Type</div>
            <div className="text-sm text-muted-foreground capitalize">
              {zone.type} • {zone.coverage.density} density
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Partner Rate</div>
            <div className="text-sm text-muted-foreground">
              ₹{zone.partnerRates[0]?.rate || 0} per shipment
            </div>
          </div>
        </div>

        {/* Pincodes Preview */}
        <div className="flex flex-wrap gap-1 mb-4">
          {zone.pincodes.slice(0, 5).map((pincode) => (
            <Badge key={pincode} variant="outline" className="text-xs">
              {pincode}
            </Badge>
          ))}
          {zone.pincodes.length > 5 && (
            <Badge variant="outline" className="text-xs">
              +{zone.pincodes.length - 5} more
            </Badge>
          )}
        </div>

        {/* Restrictions */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4 text-sm">
            <span>
              Weight:{" "}
              {zone.restrictions.weightLimit
                ? `${zone.restrictions.weightLimit}kg`
                : "No limit"}
            </span>
            <span>
              Hazardous:{" "}
              {zone.restrictions.hazardousAllowed ? "Allowed" : "Not allowed"}
            </span>
            <span>
              Fragile:{" "}
              {zone.restrictions.fragileAllowed ? "Allowed" : "Not allowed"}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(zone.updatedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-2 mt-4">
          {onSelect && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelect(zone)}
              className="flex-1"
            >
              <Globe className="mr-2 h-4 w-4" />
              View Details
            </Button>
          )}
          {onManageRates && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onManageRates(zone)}
              className="flex-1"
            >
              <Settings className="mr-2 h-4 w-4" />
              Manage Rates
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
