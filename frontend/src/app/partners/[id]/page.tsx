"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import {
  Star,
  MapPin,
  Clock,
  DollarSign,
  Phone,
  Mail,
  Globe,
  Package,
  TrendingUp,
  Users,
  Calendar,
  Edit,
  ExternalLink,
  Truck,
  Award,
  Activity,
} from "lucide-react";
import {
  mockPartners,
  formatCurrency,
  formatDate,
  getPartnerStatusColor,
  getPartnerTypeColor,
  getRatingColor,
  formatRating,
} from "@/lib/mock-data";

export default function PartnerDetailPage() {
  const router = useRouter();
  const params = useParams();
  const partnerId = params.id as string;
  const [partner, setPartner] = useState<any>(null);

  useEffect(() => {
    const foundPartner = mockPartners.find((p) => p.id === partnerId);
    if (foundPartner) {
      setPartner(foundPartner);
    }
  }, [partnerId]);

  const handleEdit = () => {
    router.push(`/partners/${partnerId}/edit`);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "active":
        return <div className="w-3 h-3 bg-green-500 rounded-full"></div>;
      case "inactive":
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
      case "suspended":
        return <div className="w-3 h-3 bg-red-500 rounded-full"></div>;
      case "pending":
        return <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>;
      default:
        return <div className="w-3 h-3 bg-gray-500 rounded-full"></div>;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case "courier":
        return <Truck className="h-4 w-4 text-blue-600" />;
      case "logistics":
        return <Package className="h-4 w-4 text-green-600" />;
      case "warehouse":
        return <Award className="h-4 w-4 text-purple-600" />;
      case "customs":
        return <Activity className="h-4 w-4 text-orange-600" />;
      default:
        return <Package className="h-4 w-4 text-gray-600" />;
    }
  };

  if (!partner) {
    return (
      <DashboardLayout>
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading partner details...</p>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            {/* <Button
              variant="ghost"
              size="sm"
              onClick={handleBack}
              className="hover:bg-gray-100"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Partners
            </Button> */}
            <div>
              <h1 className="text-3xl font-bold text-foreground">
                {partner.name}
              </h1>
              <p className="text-muted-foreground">
                Partner details and performance metrics
              </p>
            </div>
          </div>
          <Button
            onClick={handleEdit}
            className="bg-blue-600 hover:bg-blue-700"
          >
            <Edit className="h-4 w-4 mr-2" />
            Edit Partner
          </Button>
        </div>

        {/* Partner Overview */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-4">
                <Avatar className="h-20 w-20 ring-4 ring-gray-100">
                  <AvatarImage src={partner.logo} alt={partner.name} />
                  <AvatarFallback className="bg-gradient-to-br from-blue-100 to-blue-200 text-blue-700 text-2xl font-bold">
                    {partner.name
                      .split(" ")
                      .map((n: string) => n[0])
                      .join("")}
                  </AvatarFallback>
                </Avatar>
                <div className="space-y-2">
                  <div className="flex items-center space-x-3">
                    <h2 className="text-2xl font-bold text-foreground">
                      {partner.name}
                    </h2>
                    <Badge
                      className={`${getPartnerTypeColor(partner.type)} text-sm`}
                    >
                      {getTypeIcon(partner.type)}
                      <span className="ml-2 capitalize">{partner.type}</span>
                    </Badge>
                    <Badge
                      className={`${getPartnerStatusColor(partner.status)} text-sm`}
                    >
                      {getStatusIcon(partner.status)}
                      <span className="ml-2 capitalize">{partner.status}</span>
                    </Badge>
                  </div>
                  <div className="flex items-center space-x-6 text-sm text-muted-foreground">
                    <div className="flex items-center space-x-2">
                      <Clock className="h-4 w-4" />
                      <span>{partner.deliveryTime}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <MapPin className="h-4 w-4" />
                      <span>{partner.coverage.join(", ")}</span>
                    </div>
                    <div className="flex items-center space-x-2">
                      <Calendar className="h-4 w-4" />
                      <span>Since {formatDate(partner.contractStartDate)}</span>
                    </div>
                  </div>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-center space-x-1 mb-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-5 w-5 ${
                        star <= partner.rating
                          ? `${getRatingColor(partner.rating)} fill-current`
                          : "text-gray-300"
                      }`}
                    />
                  ))}
                </div>
                <p
                  className={`text-lg font-semibold ${getRatingColor(partner.rating)}`}
                >
                  {formatRating(partner.rating)}
                </p>
              </div>
            </div>
          </CardHeader>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left Column - Performance Metrics */}
          <div className="lg:col-span-2 space-y-6">
            {/* Performance Overview */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <TrendingUp className="h-5 w-5 text-green-600" />
                  <span>Performance Overview</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-blue-600 mb-2">
                      {partner.performance.totalShipments.toLocaleString()}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Total Shipments
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-600 mb-2">
                      {partner.performance.successRate}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Success Rate
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-purple-600 mb-2">
                      {partner.performance.avgDeliveryTime}
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Avg Delivery (Days)
                    </p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-orange-600 mb-2">
                      {partner.performance.customerSatisfaction}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Customer Satisfaction
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Rating Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Star className="h-5 w-5 text-yellow-600" />
                  <span>Rating Breakdown</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-16">5 Stars</span>
                    <Progress value={80} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      80%
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-16">4 Stars</span>
                    <Progress value={15} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      15%
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-16">3 Stars</span>
                    <Progress value={3} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      3%
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-16">2 Stars</span>
                    <Progress value={1} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      1%
                    </span>
                  </div>
                  <div className="flex items-center space-x-3">
                    <span className="text-sm font-medium w-16">1 Star</span>
                    <Progress value={1} className="flex-1" />
                    <span className="text-sm text-muted-foreground w-12">
                      1%
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Coverage & Services */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <MapPin className="h-5 w-5 text-green-600" />
                  <span>Coverage & Services</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h4 className="font-semibold mb-3">Coverage Areas</h4>
                  <div className="flex flex-wrap gap-2">
                    {partner.coverage.map((area: string) => (
                      <Badge
                        key={area}
                        variant="outline"
                        className="bg-blue-50 text-blue-700 border-blue-200"
                      >
                        {area}
                      </Badge>
                    ))}
                  </div>
                </div>
                <Separator />
                <div>
                  <h4 className="font-semibold mb-3">Services Offered</h4>
                  <div className="flex flex-wrap gap-2">
                    {partner.services.map((service: string) => (
                      <Badge
                        key={service}
                        variant="outline"
                        className="bg-green-50 text-green-700 border-green-200"
                      >
                        {service}
                      </Badge>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pricing Structure */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <DollarSign className="h-5 w-5 text-yellow-600" />
                  <span>Pricing Structure</span>
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="text-center p-4 bg-blue-50 rounded-lg">
                    <div className="text-2xl font-bold text-blue-600 mb-2">
                      {formatCurrency(partner.pricing.baseRate)}
                    </div>
                    <p className="text-sm text-muted-foreground">Base Rate</p>
                  </div>
                  <div className="text-center p-4 bg-green-50 rounded-lg">
                    <div className="text-2xl font-bold text-green-600 mb-2">
                      {formatCurrency(partner.pricing.perKgRate)}
                    </div>
                    <p className="text-sm text-muted-foreground">Per KG Rate</p>
                  </div>
                  <div className="text-center p-4 bg-orange-50 rounded-lg">
                    <div className="text-2xl font-bold text-orange-600 mb-2">
                      {partner.pricing.fuelSurcharge}%
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Fuel Surcharge
                    </p>
                  </div>
                </div>

                <div className="mt-6">
                  <h4 className="font-semibold mb-3">Zone-based Rates</h4>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {Object.entries(partner.pricing.zoneRates).map(
                      ([zone, rate]) => (
                        <div
                          key={zone}
                          className="text-center p-3 bg-gray-50 rounded-lg"
                        >
                          <div className="font-semibold text-gray-900">
                            {zone}
                          </div>
                          <div className="text-sm text-muted-foreground">
                            {formatCurrency(rate as number)}
                          </div>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right Column - Contact & Contract Info */}
          <div className="space-y-6">
            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Phone className="h-5 w-5 text-purple-600" />
                  <span>Contact Information</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-3">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{partner.contact.email}</p>
                    <p className="text-sm text-muted-foreground">Email</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="font-medium">{partner.contact.phone}</p>
                    <p className="text-sm text-muted-foreground">Phone</p>
                  </div>
                </div>
                <div className="flex items-start space-x-3">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div>
                    <p className="font-medium">{partner.contact.address}</p>
                    <p className="text-sm text-muted-foreground">Address</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <a
                      href={partner.contact.website}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-medium text-blue-600 hover:text-blue-800 flex items-center space-x-2"
                    >
                      <span>Visit Website</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    <p className="text-sm text-muted-foreground">Website</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contract Information */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Calendar className="h-5 w-5 text-indigo-600" />
                  <span>Contract Details</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">
                    Contract Start
                  </p>
                  <p className="font-medium">
                    {formatDate(partner.contractStartDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Contract End</p>
                  <p className="font-medium">
                    {formatDate(partner.contractEndDate)}
                  </p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Last Updated</p>
                  <p className="font-medium">
                    {formatDate(partner.lastUpdated)}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Quick Actions */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Activity className="h-5 w-5 text-blue-600" />
                  <span>Quick Actions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button variant="outline" className="w-full justify-start">
                  <Package className="h-4 w-4 mr-2" />
                  View Shipments
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  Performance Report
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Users className="h-4 w-4 mr-2" />
                  Contact Support
                </Button>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
