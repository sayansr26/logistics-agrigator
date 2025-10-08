"use client";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  TrendingUp,
  Package,
  Settings,
  CheckCircle,
  XCircle,
  Edit,
  Trash2,
  IndianRupee,
  Percent,
  Calculator,
  Clock,
} from "lucide-react";

function getChargeTypeIcon(type) {
  switch (type) {
    case "fsc":
      return <TrendingUp className="h-5 w-5 text-blue-600" />;
    case "handling":
      return <Package className="h-5 w-5 text-green-600" />;
    case "fuel":
      return <TrendingUp className="h-5 w-5 text-orange-600" />;
    case "service":
      return <Settings className="h-5 w-5 text-purple-600" />;
    default:
      return <Calculator className="h-5 w-5 text-gray-600" />;
  }
}

function getChargeTypeColor(type) {
  switch (type) {
    case "fsc":
      return "bg-blue-100 text-blue-800";
    case "handling":
      return "bg-green-100 text-green-800";
    case "fuel":
      return "bg-orange-100 text-orange-800";
    case "service":
      return "bg-purple-100 text-purple-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusColor(status) {
  switch (status) {
    case true:
      return "bg-green-100 text-green-800";
    case false:
      return "bg-red-100 text-red-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status) {
  switch (status) {
    case true:
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case false:
      return <XCircle className="h-4 w-4 text-red-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

export function ChargeCard({ charge, onSelect, onEdit, onDelete, isSelected }) {
  const handleCardClick = () => {
    onSelect(charge);
  };

  const handleEditClick = (e) => {
    e.stopPropagation();
    onEdit(charge);
  };

  const handleDeleteClick = (e) => {
    e.stopPropagation();
    onDelete(charge.id);
  };

  return (
    <Card
      className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
        isSelected ? "ring-2 ring-primary shadow-md" : ""
      }`}
      onClick={handleCardClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
              {getChargeTypeIcon(charge.type)}
            </div>
            <div>
              <div className="font-medium capitalize">{charge.type}</div>
              <div className="text-sm text-muted-foreground">
                {charge.customerId} • {charge.chargeType}
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <div className="flex items-center space-x-2">
              {getStatusIcon(charge.status)}
              <Badge className={getStatusColor(charge.status)}>
                {charge.status ? "Active" : "Inactive"}
              </Badge>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleEditClick}
              className="h-8 w-8"
            >
              <Edit className="h-4 w-4" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleDeleteClick}
              className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Charge Details */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <div className="text-sm font-medium">Charge Value</div>
            <div className="text-sm text-muted-foreground flex items-center">
              <IndianRupee className="h-3 w-3 mr-1" />
              {charge.value} {charge.chargeType === "percentage" ? "%" : ""}
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Weight Range</div>
            <div className="text-sm text-muted-foreground">
              {charge.minKg}kg - {charge.maxKg}kg
            </div>
          </div>
          <div>
            <div className="text-sm font-medium">Value Range</div>
            <div className="text-sm text-muted-foreground">
              ₹{charge.minValue} - ₹{charge.maxValue}
            </div>
          </div>
        </div>

        {/* Charge Type Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Badge className={getChargeTypeColor(charge.type)}>
              {charge.type.toUpperCase()}
            </Badge>
            {charge.otherChargeType && (
              <Badge variant="outline" className="text-xs">
                {charge.otherChargeType}
              </Badge>
            )}
          </div>
          <div className="text-xs text-muted-foreground flex items-center">
            <Clock className="h-3 w-3 mr-1" />
            {new Date(charge.updatedAt).toLocaleDateString()}
          </div>
        </div>

        {/* Additional Info */}
        <div className="flex items-center justify-between pt-4 border-t">
          <div className="flex items-center space-x-4 text-sm">
            <span className="flex items-center">
              <Percent className="h-3 w-3 mr-1" />
              {charge.chargeType === "percentage" ? "Percentage" : "Fixed"} Rate
            </span>
            <span className="flex items-center">
              <Calculator className="h-3 w-3 mr-1" />
              {charge.chargeType === "percentage"
                ? `${charge.value}%`
                : `₹${charge.value}`}
            </span>
          </div>
          <div className="text-xs text-muted-foreground">
            Updated: {new Date(charge.updatedAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
