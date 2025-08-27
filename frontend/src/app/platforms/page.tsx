"use client";

import { DashboardLayout } from "@/components/layout/dashboard-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Globe,
  Building,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Plus,
  Settings,
  RefreshCw,
  ExternalLink,
  Key,
  Webhook,
  BarChart3,
  Package,
  DollarSign,
  Clock,
  Trash2,
  ShoppingCart,
  X,
  Store,
  Hash,
} from "lucide-react";
import { useState } from "react";

// Types for platform integration
interface Channel {
  id: string;
  name: string;
  type: "online" | "offline" | "marketplace" | "social" | "api";
  status: "active" | "inactive" | "pending" | "error";
  ordersCount: number;
  revenue: number;
  lastSync: string;
  settings: ChannelSettings;
}

interface ChannelSettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  orderStatusMapping: Record<string, string>;
  customFields: Record<string, any>;
}

interface Platform {
  id: string;
  name: string;
  type: "shopify" | "woocommerce" | "api" | "webhook" | "multi-channel";
  status: "connected" | "disconnected" | "error" | "pending";
  lastSync: string;
  ordersCount: number;
  revenue: number;
  accessToken: string;
  outlet: string;
  apiKey?: string;
  webhookUrl?: string;
  settings: PlatformSettings;
  channels: Channel[];
}

interface PlatformSettings {
  autoSync: boolean;
  syncInterval: number; // minutes
  webhookEnabled: boolean;
  orderStatusMapping: Record<string, string>;
  multiChannelEnabled: boolean;
}

interface IntegrationStats {
  totalPlatforms: number;
  connectedPlatforms: number;
  totalChannels: number;
  activeChannels: number;
  totalOrders: number;
  totalRevenue: number;
  lastSyncTime: string;
}

function getStatusColor(status: string) {
  switch (status) {
    case "connected":
    case "active":
      return "bg-green-100 text-green-800";
    case "disconnected":
    case "inactive":
      return "bg-gray-100 text-gray-800";
    case "error":
      return "bg-red-100 text-red-800";
    case "pending":
      return "bg-yellow-100 text-yellow-800";
    default:
      return "bg-gray-100 text-gray-800";
  }
}

function getStatusIcon(status: string) {
  switch (status) {
    case "connected":
    case "active":
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    case "disconnected":
    case "inactive":
      return <XCircle className="h-4 w-4 text-gray-500" />;
    case "error":
      return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case "pending":
      return <Clock className="h-4 w-4 text-yellow-500" />;
    default:
      return <XCircle className="h-4 w-4 text-gray-500" />;
  }
}

function getPlatformIcon(type: string) {
  switch (type) {
    case "shopify":
      return <Building className="h-5 w-5 text-green-600 rounded-full" />;
    case "woocommerce":
      return <ShoppingCart className="h-5 w-5 text-blue-600 rounded-full" />;
    case "api":
      return <Key className="h-5 w-5 text-purple-600 rounded-full" />;
    case "webhook":
      return <Webhook className="h-5 w-5 text-orange-600 rounded-full" />;
    case "multi-channel":
      return <Store className="h-5 w-5 text-indigo-600 rounded-full" />;
    default:
      return <Globe className="h-5 w-5 text-gray-600" />;
  }
}

function getChannelIcon(type: string) {
  switch (type) {
    case "online":
      return <Globe className="h-4 w-4 text-blue-500" />;
    case "offline":
      return <Store className="h-4 w-4 text-green-500" />;
    case "marketplace":
      return <ShoppingCart className="h-4 w-4 text-orange-500" />;
    case "social":
      return <Hash className="h-4 w-4 text-purple-500" />;
    case "api":
      return <Key className="h-4 w-4 text-gray-500" />;
    default:
      return <Globe className="h-4 w-4 text-gray-500" />;
  }
}

export default function PlatformsPage() {
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | null>(
    null,
  );
  const [showAddPlatform, setShowAddPlatform] = useState(false);
  const [showAddChannel, setShowAddChannel] = useState(false);
  const [selectedPlatformForChannel, setSelectedPlatformForChannel] = useState<
    string | null
  >(null);
  const [newPlatform, setNewPlatform] = useState({
    name: "",
    type: "" as Platform["type"],
    accessToken: "",
    outlet: "",
    status: "enable" as "enable" | "disable",
    apiKey: "",
    webhookUrl: "",
    multiChannelEnabled: false,
  });
  const [newChannel, setNewChannel] = useState({
    name: "",
    type: "" as Channel["type"],
    status: "active" as "active" | "inactive",
  });

  // Calculate stats dynamically
  const integrationStats: IntegrationStats = {
    totalPlatforms: platforms.length,
    connectedPlatforms: platforms.filter((p) => p.status === "connected")
      .length,
    totalChannels: platforms.reduce((sum, p) => sum + p.channels.length, 0),
    activeChannels: platforms.reduce(
      (sum, p) => sum + p.channels.filter((c) => c.status === "active").length,
      0,
    ),
    totalOrders: platforms.reduce((sum, p) => sum + p.ordersCount, 0),
    totalRevenue: platforms.reduce((sum, p) => sum + p.revenue, 0),
    lastSyncTime:
      platforms.length > 0
        ? platforms.reduce(
            (latest, p) =>
              new Date(p.lastSync) > new Date(latest) ? p.lastSync : latest,
            platforms[0].lastSync,
          )
        : new Date().toISOString(),
  };

  const handlePlatformSelect = (platform: Platform) => {
    setSelectedPlatform(platform);
  };

  const handleSyncPlatform = (_platformId: string) => {
    // TODO: Implement platform sync logic
    // console.log(`Syncing platform: ${platformId}`);
  };

  const handleRemovePlatform = (platformId: string) => {
    setPlatforms((prev) => prev.filter((p) => p.id !== platformId));
    if (selectedPlatform?.id === platformId) {
      setSelectedPlatform(null);
    }
  };

  const handleAddPlatform = () => {
    if (
      !newPlatform.name ||
      !newPlatform.type ||
      !newPlatform.accessToken ||
      !newPlatform.outlet
    )
      return;

    const platform: Platform = {
      id: `${newPlatform.type}-${Date.now()}`,
      name: newPlatform.name,
      type: newPlatform.type,
      status: "pending",
      lastSync: new Date().toISOString(),
      ordersCount: 0,
      revenue: 0,
      accessToken: newPlatform.accessToken,
      outlet: newPlatform.outlet,
      apiKey: newPlatform.apiKey || undefined,
      webhookUrl: newPlatform.webhookUrl || undefined,
      settings: {
        autoSync: false,
        syncInterval: 30,
        webhookEnabled: !!newPlatform.webhookUrl,
        orderStatusMapping: {},
        multiChannelEnabled: newPlatform.multiChannelEnabled,
      },
      channels: [],
    };

    setPlatforms((prev) => [...prev, platform]);
    setNewPlatform({
      name: "",
      type: "" as Platform["type"],
      accessToken: "",
      outlet: "",
      status: "enable" as "enable" | "disable",
      apiKey: "",
      webhookUrl: "",
      multiChannelEnabled: false,
    });
    setShowAddPlatform(false);
  };

  const handleAddChannel = () => {
    if (!selectedPlatformForChannel || !newChannel.name || !newChannel.type)
      return;

    const channel: Channel = {
      id: `${newChannel.type}-${Date.now()}`,
      name: newChannel.name,
      type: newChannel.type,
      status: newChannel.status,
      ordersCount: 0,
      revenue: 0,
      lastSync: new Date().toISOString(),
      settings: {
        autoSync: false,
        syncInterval: 30,
        orderStatusMapping: {},
        customFields: {},
      },
    };

    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === selectedPlatformForChannel
          ? { ...p, channels: [...p.channels, channel] }
          : p,
      ),
    );

    setNewChannel({
      name: "",
      type: "" as Channel["type"],
      status: "active" as "active" | "inactive",
    });
    setShowAddChannel(false);
    setSelectedPlatformForChannel(null);
  };

  const handleRemoveChannel = (platformId: string, channelId: string) => {
    setPlatforms((prev) =>
      prev.map((p) =>
        p.id === platformId
          ? { ...p, channels: p.channels.filter((c) => c.id !== channelId) }
          : p,
      ),
    );
  };

  const resetNewPlatform = () => {
    setNewPlatform({
      name: "",
      type: "" as Platform["type"],
      accessToken: "",
      outlet: "",
      status: "enable" as "enable" | "disable",
      apiKey: "",
      webhookUrl: "",
      multiChannelEnabled: false,
    });
  };

  const resetNewChannel = () => {
    setNewChannel({
      name: "",
      type: "" as Channel["type"],
      status: "active" as "active" | "inactive",
    });
  };

  return (
    <DashboardLayout
      customBreadcrumbs={[
        { title: "Platform Integration", href: "/platforms" },
      ]}
    >
      <div className="space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">
              Platform Integration
            </h1>
            <p className="text-muted-foreground">
              Connect and manage your e-commerce platforms, APIs, and webhooks
              for seamless order synchronization with multi-channel support.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <RefreshCw className="mr-2 h-4 w-4" />
              Sync All
            </Button>
            <Button size="sm" onClick={() => setShowAddPlatform(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Add Platform
            </Button>
          </div>
        </div>

        {/* Integration Stats */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium ">
                Total Platforms
              </CardTitle>
              <Globe className="h-5 w-5 text-muted-foreground text-red-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {integrationStats.totalPlatforms}
              </div>
              <p className="text-xs text-muted-foreground">
                {integrationStats.connectedPlatforms} connected
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Channels
              </CardTitle>
              <Store className="h-5 w-5 text-muted-foreground text-blue-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {integrationStats.totalChannels}
              </div>
              <p className="text-xs text-muted-foreground">
                {integrationStats.activeChannels} active
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Orders
              </CardTitle>
              <Package className="h-5 w-5 text-muted-foreground text-red-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {integrationStats.totalOrders.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                Across all platforms
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Revenue
              </CardTitle>
              <DollarSign className="h-5 w-5 text-muted-foreground text-red-500 rounded-full" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                ${integrationStats.totalRevenue.toLocaleString()}
              </div>
              <p className="text-xs text-muted-foreground">
                From integrated platforms
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Add Platform Modal */}
        {showAddPlatform && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Platform</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddPlatform(false);
                    resetNewPlatform();
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Configure a new platform integration with multi-channel support
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="platform-name">Channel</Label>
                <Input
                  id="platform-name"
                  placeholder="Enter channel name"
                  value={newPlatform.name}
                  onChange={(e) =>
                    setNewPlatform((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="platform-type">Platform Type</Label>
                <Select
                  value={newPlatform.type}
                  onValueChange={(value: Platform["type"]) =>
                    setNewPlatform((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select platform type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shopify">
                      <div className="flex items-center space-x-2">
                        <Building className="h-4 w-4 text-green-600" />
                        <span>Shopify</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="woocommerce">
                      <div className="flex items-center space-x-2">
                        <ShoppingCart className="h-4 w-4 text-blue-600" />
                        <span>WooCommerce</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="api">
                      <div className="flex items-center space-x-2">
                        <Key className="h-4 w-4 text-purple-600" />
                        <span>API Integration</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="webhook">
                      <div className="flex items-center space-x-2">
                        <Webhook className="h-4 w-4 text-orange-600" />
                        <span>Webhooks</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="multi-channel">
                      <div className="flex items-center space-x-2">
                        <Store className="h-4 w-4 text-indigo-600" />
                        <span>Multi-Channel Platform</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {newPlatform.type && (
                <div className="space-y-4">
                  <Separator />
                  <div className="text-sm font-medium">
                    Platform Configuration
                  </div>

                  <div>
                    <Label htmlFor="access-token">Access Token *</Label>
                    <Input
                      id="access-token"
                      placeholder="Enter access token"
                      value={newPlatform.accessToken}
                      onChange={(e) =>
                        setNewPlatform((prev) => ({
                          ...prev,
                          accessToken: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="outlet">Outlet *</Label>
                    <Input
                      id="outlet"
                      placeholder="Enter outlet/store identifier"
                      value={newPlatform.outlet}
                      onChange={(e) =>
                        setNewPlatform((prev) => ({
                          ...prev,
                          outlet: e.target.value,
                        }))
                      }
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="platform-status">Status</Label>
                    <Select
                      value={newPlatform.status || "enable"}
                      onValueChange={(value: "enable" | "disable") =>
                        setNewPlatform((prev) => ({ ...prev, status: value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select status" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="enable">
                          <div className="flex items-center space-x-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            <span>Enable</span>
                          </div>
                        </SelectItem>
                        <SelectItem value="disable">
                          <div className="flex items-center space-x-2">
                            <XCircle className="h-4 w-4 text-red-600" />
                            <span>Disable</span>
                          </div>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {newPlatform.type === "multi-channel" && (
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        id="multi-channel-enabled"
                        checked={newPlatform.multiChannelEnabled}
                        onChange={(e) =>
                          setNewPlatform((prev) => ({
                            ...prev,
                            multiChannelEnabled: e.target.checked,
                          }))
                        }
                        className="rounded"
                      />
                      <Label htmlFor="multi-channel-enabled">
                        Enable Multi-Channel Support
                      </Label>
                    </div>
                  )}

                  {newPlatform.type === "api" && (
                    <div>
                      <Label htmlFor="api-key">API Key (Optional)</Label>
                      <Input
                        id="api-key"
                        placeholder="Enter API key if required"
                        value={newPlatform.apiKey}
                        onChange={(e) =>
                          setNewPlatform((prev) => ({
                            ...prev,
                            apiKey: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}

                  {(newPlatform.type === "shopify" ||
                    newPlatform.type === "woocommerce" ||
                    newPlatform.type === "webhook") && (
                    <div>
                      <Label htmlFor="webhook-url">
                        Webhook URL (Optional)
                      </Label>
                      <Input
                        id="webhook-url"
                        placeholder="Enter webhook URL if required"
                        value={newPlatform.webhookUrl}
                        onChange={(e) =>
                          setNewPlatform((prev) => ({
                            ...prev,
                            webhookUrl: e.target.value,
                          }))
                        }
                      />
                    </div>
                  )}
                </div>
              )}

              <div className="flex space-x-2 pt-4">
                <Button
                  className="flex-1"
                  onClick={handleAddPlatform}
                  disabled={
                    !newPlatform.name ||
                    !newPlatform.type ||
                    !newPlatform.accessToken ||
                    !newPlatform.outlet
                  }
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Platform
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddPlatform(false);
                    resetNewPlatform();
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Add Channel Modal */}
        {showAddChannel && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Add New Channel</CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setShowAddChannel(false);
                    resetNewChannel();
                    setSelectedPlatformForChannel(null);
                  }}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <CardDescription>
                Add a new sales channel to your platform
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="channel-name">Channel Name</Label>
                <Input
                  id="channel-name"
                  placeholder="Enter channel name"
                  value={newChannel.name}
                  onChange={(e) =>
                    setNewChannel((prev) => ({
                      ...prev,
                      name: e.target.value,
                    }))
                  }
                />
              </div>

              <div>
                <Label htmlFor="channel-type">Channel Type</Label>
                <Select
                  value={newChannel.type}
                  onValueChange={(value: Channel["type"]) =>
                    setNewChannel((prev) => ({ ...prev, type: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select channel type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="online">
                      <div className="flex items-center space-x-2">
                        <Globe className="h-4 w-4 text-blue-500" />
                        <span>Online Store</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="offline">
                      <div className="flex items-center space-x-2">
                        <Store className="h-4 w-4 text-green-500" />
                        <span>Offline Store</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="marketplace">
                      <div className="flex items-center space-x-2">
                        <ShoppingCart className="h-4 w-4 text-orange-500" />
                        <span>Marketplace</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="social">
                      <div className="flex items-center space-x-2">
                        <Hash className="h-4 w-4 text-purple-500" />
                        <span>Social Media</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="api">
                      <div className="flex items-center space-x-2">
                        <Key className="h-4 w-4 text-gray-500" />
                        <span>API Integration</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="channel-status">Status</Label>
                <Select
                  value={newChannel.status}
                  onValueChange={(value: "active" | "inactive") =>
                    setNewChannel((prev) => ({ ...prev, status: value }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <div className="flex items-center space-x-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Active</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="inactive">
                      <div className="flex items-center space-x-2">
                        <XCircle className="h-4 w-4 text-red-600" />
                        <span>Inactive</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="flex space-x-2 pt-4">
                <Button
                  className="flex-1"
                  onClick={handleAddChannel}
                  disabled={!newChannel.name || !newChannel.type}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Channel
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowAddChannel(false);
                    resetNewChannel();
                    setSelectedPlatformForChannel(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Platforms List */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Connected Platforms</CardTitle>
                  <CardDescription>
                    {platforms.length === 0
                      ? "No platforms connected yet. Add your first platform to get started."
                      : "Manage your e-commerce platform integrations and API connections"}
                  </CardDescription>
                </div>
                {platforms.length > 0 && (
                  <Button variant="outline" size="sm">
                    <Settings className="mr-2 h-4 w-4" />
                    Settings
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {platforms.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Globe className="h-16 w-16 mx-auto mb-4 opacity-50" />
                  <p className="text-lg font-medium mb-2">
                    No platforms connected
                  </p>
                  <p className="text-sm mb-4">
                    Connect your first platform to start syncing orders and
                    managing integrations.
                  </p>
                  <Button onClick={() => setShowAddPlatform(true)}>
                    <Plus className="mr-2 h-4 w-4" />
                    Add Your First Platform
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  {platforms.map((platform) => (
                    <div key={platform.id} className="border rounded-lg p-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-muted rounded-lg flex items-center justify-center">
                            {getPlatformIcon(platform.type)}
                          </div>
                          <div>
                            <div className="font-medium">{platform.name}</div>
                            <div className="text-sm text-muted-foreground capitalize">
                              {platform.type} • {platform.channels.length}{" "}
                              channels
                            </div>
                          </div>
                        </div>
                        <div className="flex items-center space-x-2">
                          <div className="flex items-center space-x-2">
                            {getStatusIcon(platform.status)}
                            <Badge className={getStatusColor(platform.status)}>
                              {platform.status}
                            </Badge>
                          </div>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handlePlatformSelect(platform)}
                          >
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleRemovePlatform(platform.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>

                      {/* Channels List */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <h4 className="text-sm font-medium">Channels</h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedPlatformForChannel(platform.id);
                              setShowAddChannel(true);
                            }}
                          >
                            <Plus className="mr-2 h-3 w-3" />
                            Add Channel
                          </Button>
                        </div>

                        {platform.channels.length === 0 ? (
                          <div className="text-center py-4 text-muted-foreground border rounded">
                            <p className="text-sm">No channels configured</p>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setSelectedPlatformForChannel(platform.id);
                                setShowAddChannel(true);
                              }}
                            >
                              Add First Channel
                            </Button>
                          </div>
                        ) : (
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {platform.channels.map((channel) => (
                              <div
                                key={channel.id}
                                className="flex items-center justify-between p-3 border rounded-lg bg-muted/30"
                              >
                                <div className="flex items-center space-x-2">
                                  {getChannelIcon(channel.type)}
                                  <div>
                                    <div className="text-sm font-medium">
                                      {channel.name}
                                    </div>
                                    <div className="text-xs text-muted-foreground capitalize">
                                      {channel.type}
                                    </div>
                                  </div>
                                </div>
                                <div className="flex items-center space-x-2">
                                  <Badge
                                    className={getStatusColor(channel.status)}
                                  >
                                    {channel.status}
                                  </Badge>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() =>
                                      handleRemoveChannel(
                                        platform.id,
                                        channel.id,
                                      )
                                    }
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                      {/* Platform Stats */}
                      <div className="flex items-center justify-between mt-4 pt-4 border-t">
                        <div className="flex items-center space-x-4 text-sm">
                          <span>
                            Orders: {platform.ordersCount.toLocaleString()}
                          </span>
                          <span>
                            Revenue: ${platform.revenue.toLocaleString()}
                          </span>
                          <span>
                            Last Sync:{" "}
                            {new Date(platform.lastSync).toLocaleTimeString()}
                          </span>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleSyncPlatform(platform.id)}
                        >
                          <RefreshCw className="mr-2 h-3 w-3" />
                          Sync
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Platform Details */}
          <Card>
            <CardHeader>
              <CardTitle>Platform Details</CardTitle>
              <CardDescription>
                {selectedPlatform
                  ? "View and manage platform settings"
                  : "Select a platform to view details"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {selectedPlatform ? (
                <div className="space-y-4">
                  <div className="flex items-center space-x-3">
                    <div className="w-15 h-15 bg-muted rounded-lg flex items-center justify-center">
                      {getPlatformIcon(selectedPlatform.type)}
                    </div>
                    <div>
                      <h3 className="font-semibold">{selectedPlatform.name}</h3>
                      <p className="text-sm text-muted-foreground capitalize">
                        {selectedPlatform.type} Integration
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <div>
                      <Label className="text-sm font-medium">Status</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        {getStatusIcon(selectedPlatform.status)}
                        <Badge
                          className={getStatusColor(selectedPlatform.status)}
                        >
                          {selectedPlatform.status}
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Channels</Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Badge variant="outline">
                          {selectedPlatform.channels.length} channels
                        </Badge>
                        <Badge variant="outline">
                          {
                            selectedPlatform.channels.filter(
                              (c) => c.status === "active",
                            ).length
                          }{" "}
                          active
                        </Badge>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Last Sync</Label>
                      <p className="text-sm mt-1">
                        {new Date(selectedPlatform.lastSync).toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Orders Count
                      </Label>
                      <p className="text-sm mt-1 font-medium">
                        {selectedPlatform.ordersCount.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Revenue</Label>
                      <p className="text-sm mt-1 font-medium">
                        ${selectedPlatform.revenue.toLocaleString()}
                      </p>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">
                        Access Token
                      </Label>
                      <div className="flex items-center space-x-2 mt-1">
                        <Input
                          value={selectedPlatform.accessToken}
                          readOnly
                          className="text-xs font-mono"
                        />
                        <Button variant="ghost" size="icon">
                          <Key className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>

                    <div>
                      <Label className="text-sm font-medium">Outlet</Label>
                      <p className="text-sm mt-1 font-medium">
                        {selectedPlatform.outlet}
                      </p>
                    </div>

                    {selectedPlatform.apiKey && (
                      <div>
                        <Label className="text-sm font-medium">API Key</Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            value={selectedPlatform.apiKey}
                            readOnly
                            className="text-xs font-mono"
                          />
                          <Button variant="ghost" size="icon">
                            <Key className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}

                    {selectedPlatform.webhookUrl && (
                      <div>
                        <Label className="text-sm font-medium">
                          Webhook URL
                        </Label>
                        <div className="flex items-center space-x-2 mt-1">
                          <Input
                            value={selectedPlatform.webhookUrl}
                            readOnly
                            className="text-xs font-mono"
                          />
                          <Button variant="ghost" size="icon">
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>

                  <Separator />

                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">Settings</h4>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Auto Sync</span>
                        <Badge
                          variant={
                            selectedPlatform.settings.autoSync
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedPlatform.settings.autoSync
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Sync Interval</span>
                        <span className="text-sm font-medium">
                          {selectedPlatform.settings.syncInterval} min
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Webhooks</span>
                        <Badge
                          variant={
                            selectedPlatform.settings.webhookEnabled
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedPlatform.settings.webhookEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">Multi-Channel</span>
                        <Badge
                          variant={
                            selectedPlatform.settings.multiChannelEnabled
                              ? "default"
                              : "secondary"
                          }
                        >
                          {selectedPlatform.settings.multiChannelEnabled
                            ? "Enabled"
                            : "Disabled"}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="flex space-x-2">
                    <Button className="flex-1" size="sm">
                      <Settings className="mr-2 h-4 w-4" />
                      Configure
                    </Button>
                    <Button variant="outline" className="flex-1" size="sm">
                      <BarChart3 className="mr-2 h-4 w-4" />
                      Analytics
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Globe className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">
                    {platforms.length === 0
                      ? "Add a platform to get started"
                      : "Select a platform to view details"}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </DashboardLayout>
  );
}
