"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { DashboardLayout } from "@/components/layout/dashboard-layout.jsx";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  mockDisputes,
  mockSupportTickets,
  getDisputeStatusColor,
  getTicketPriorityColor,
  getTicketStatusColor,
  formatDate,
} from "@/lib/mock-data";
import {
  HelpCircle,
  MessageSquare,
  Search,
  Filter,
  MoreHorizontal,
  Eye,
  Edit,
  MessageCircle,
  Clock,
  AlertTriangle,
  CheckCircle,
  Plus,
  Download,
  RefreshCw,
} from "lucide-react";

export default function SupportPage() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("disputes");
  const [searchTerm, setSearchTerm] = useState("");

  const customBreadcrumbs = [
    { title: "Dashboard", href: "/dashboard" },
    { title: "Support & Disputes" },
  ];

  // Filter disputes based on search term
  const filteredDisputes = mockDisputes.filter(
    (dispute) =>
      dispute.trackingNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.reason.toLowerCase().includes(searchTerm.toLowerCase()) ||
      dispute.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Filter support tickets based on search term
  const filteredSupportTickets = mockSupportTickets.filter(
    (ticket) =>
      ticket.ticketNumber.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.customerName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      ticket.status.toLowerCase().includes(searchTerm.toLowerCase()),
  );

  // Calculate support statistics
  const totalDisputes = mockDisputes.length;
  const openDisputes = mockDisputes.filter((d) => d.status === "open").length;
  const resolvedDisputes = mockDisputes.filter(
    (d) => d.status === "resolved",
  ).length;
  const totalTickets = mockSupportTickets.length;

  return (
    <DashboardLayout customBreadcrumbs={customBreadcrumbs}>
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center space-x-2">
              <HelpCircle className="h-8 w-8 text-logistics-600" />
              <span>Support & Disputes</span>
            </h1>
            <p className="text-muted-foreground mt-2">
              Manage customer disputes, support tickets, and resolution
              workflows
            </p>
            {/* <div className="flex items-center space-x-2 mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/support/disputes")}
                className="text-xs"
              >
                View All Disputes
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push("/support/disputes/dispute-1")}
                className="text-xs"
              >
                View Sample Dispute
              </Button>
            </div> */}
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" size="sm">
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
            <Button
              size="sm"
              className="bg-blue-600 hover:bg-blue-700"
              onClick={() => router.push("/support/new-ticket")}
            >
              <Plus className="h-4 w-4 mr-2" />
              New Ticket
            </Button>
          </div>
        </div>

        {/* Action Buttons */}
        {/* <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center space-y-2 p-4"
            onClick={() => setActiveTab("disputes")}
          >
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <span className="font-medium">All Disputes</span>
            <span className="text-sm text-muted-foreground">View & manage</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center space-y-2 p-4"
            onClick={() => setActiveTab("support")}
          >
            <MessageSquare className="h-8 w-8 text-blue-600" />
            <span className="font-medium">Support Tickets</span>
            <span className="text-sm text-muted-foreground">Handle inquiries</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center space-y-2 p-4"
          >
            <Plus className="h-8 w-8 text-green-600" />
            <span className="font-medium">Create Ticket</span>
            <span className="text-sm text-muted-foreground">New support request</span>
          </Button>
          
          <Button 
            variant="outline" 
            className="h-24 flex flex-col items-center justify-center space-y-2 p-4"
          >
            <HelpCircle className="h-8 w-8 text-purple-600" />
            <span className="font-medium">Knowledge Base</span>
            <span className="text-sm text-muted-foreground">FAQs & guides</span>
          </Button>
        </div> */}

        {/* Tab Navigation */}
        <div className="flex items-center justify-between">
          <div className="flex space-x-4">
            <Button
              variant={activeTab === "disputes" ? "default" : "outline"}
              onClick={() => setActiveTab("disputes")}
              className="flex items-center space-x-2"
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Disputes</span>
            </Button>
            <Button
              variant={activeTab === "support" ? "default" : "outline"}
              onClick={() => setActiveTab("support")}
              className="flex items-center space-x-2"
            >
              <MessageSquare className="h-4 w-4" />
              <span>Support Tickets</span>
            </Button>
          </div>
          <div className="flex items-center space-x-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder={`Search ${activeTab}...`}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 w-64"
              />
            </div>
            <Button variant="outline" size="sm">
              <Filter className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm">
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-red-100 rounded-full flex items-center justify-center">
                  <AlertTriangle className="h-6 w-6 text-red-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Total Disputes
                  </p>
                  <p className="text-2xl font-bold text-red-600">
                    {totalDisputes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-yellow-100 rounded-full flex items-center justify-center">
                  <Clock className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Open Disputes
                  </p>
                  <p className="text-2xl font-bold text-yellow-600">
                    {openDisputes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-green-100 rounded-full flex items-center justify-center">
                  <CheckCircle className="h-6 w-6 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Resolved Disputes
                  </p>
                  <p className="text-2xl font-bold text-green-600">
                    {resolvedDisputes}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center space-x-2">
                <div className="h-12 w-12 bg-blue-100 rounded-full flex items-center justify-center">
                  <MessageSquare className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">
                    Support Tickets
                  </p>
                  <p className="text-2xl font-bold text-blue-600">
                    {totalTickets}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Content Card */}
        <Card>
          <CardHeader>
            <div>
              <CardTitle className="flex items-center space-x-2">
                {activeTab === "disputes" ? (
                  <>
                    <AlertTriangle className="h-5 w-5" />
                    <span>Dispute Management</span>
                  </>
                ) : (
                  <>
                    <MessageSquare className="h-5 w-5" />
                    <span>Support Ticket System</span>
                  </>
                )}
              </CardTitle>
              <CardDescription>
                {activeTab === "disputes"
                  ? "Track and resolve customer disputes and delivery issues"
                  : "Manage customer support requests and inquiries"}
              </CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            {activeTab === "disputes" ? (
              <DisputesTable
                disputes={filteredDisputes}
                searchTerm={searchTerm}
                router={router}
              />
            ) : (
              <SupportTicketsTable
                tickets={filteredSupportTickets}
                searchTerm={searchTerm}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
}

function DisputesTable({ disputes, searchTerm, router }) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered disputes for "${searchTerm}"`
          : "Recent customer disputes and delivery issues"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Dispute ID</TableHead>
          <TableHead>Tracking Details</TableHead>
          {/* <TableHead>Customer</TableHead> */}
          <TableHead>Issue Type</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Last Updated</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {disputes.map((dispute) => (
          <TableRow
            key={dispute.id}
            className="cursor-pointer hover:bg-gray-50"
            onClick={() => router.push(`/support/disputes/${dispute.id}`)}
          >
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">#{dispute.disputeNumber}</div>
                <div className="text-muted-foreground">
                  {dispute.trackingNumber}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">
                  {dispute.origin} → {dispute.destination}
                </div>
                <div className="text-muted-foreground">
                  Courier: {dispute.courierPartner}
                </div>
              </div>
            </TableCell>
            {/* <TableCell>
              <div className="text-sm">
                <div className="font-medium">{dispute.customerName}</div>
                <div className="text-muted-foreground">
                  {dispute.customerEmail}
                </div>
                <div className="text-muted-foreground">
                  {dispute.customerPhone}
                </div>
              </div>
            </TableCell> */}
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">{dispute.issueType}</div>
                <div className="text-muted-foreground max-w-xs">
                  {dispute.reason}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge className={getDisputeStatusColor(dispute.status)}>
                {dispute.status}
              </Badge>
            </TableCell>
            <TableCell className="text-sm">
              {formatDate(dispute.createdAt)}
            </TableCell>
            <TableCell className="text-sm">
              {formatDate(dispute.lastUpdated)}
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/support/disputes/${dispute.id}`)
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Details
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Status
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Contact Customer
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Mark Resolved
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function SupportTicketsTable({ tickets, searchTerm }) {
  return (
    <Table>
      <TableCaption>
        {searchTerm
          ? `Filtered support tickets for "${searchTerm}"`
          : "Customer support tickets and inquiries"}
      </TableCaption>
      <TableHeader>
        <TableRow>
          <TableHead>Ticket</TableHead>
          <TableHead>Customer</TableHead>
          <TableHead>Subject</TableHead>
          <TableHead>Priority</TableHead>
          <TableHead>Status</TableHead>
          <TableHead>Category</TableHead>
          <TableHead>Created</TableHead>
          <TableHead>Response Time</TableHead>
          <TableHead className="text-right">Actions</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {tickets.map((ticket) => (
          <TableRow key={ticket.id}>
            <TableCell className="font-medium">
              #{ticket.ticketNumber}
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">{ticket.customerName}</div>
                <div className="text-muted-foreground">
                  {ticket.customerEmail}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <div className="text-sm max-w-xs">
                <div className="font-medium">{ticket.subject}</div>
                <div className="text-muted-foreground line-clamp-2">
                  {ticket.description}
                </div>
              </div>
            </TableCell>
            <TableCell>
              <Badge
                variant="outline"
                className={getTicketPriorityColor(ticket.priority)}
              >
                {ticket.priority}
              </Badge>
            </TableCell>
            <TableCell>
              <Badge className={getTicketStatusColor(ticket.status)}>
                {ticket.status}
              </Badge>
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">{ticket.category}</div>
                <div className="text-muted-foreground">
                  {ticket.subcategory}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-sm">
              {formatDate(ticket.createdAt)}
            </TableCell>
            <TableCell>
              <div className="text-sm">
                <div className="font-medium">
                  {ticket.responseTime ? `${ticket.responseTime}h` : "-"}
                </div>
                <div className="text-muted-foreground">
                  {ticket.lastResponse
                    ? formatDate(ticket.lastResponse)
                    : "No response"}
                </div>
              </div>
            </TableCell>
            <TableCell className="text-right">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="h-8 w-8 p-0">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuLabel>Actions</DropdownMenuLabel>
                  <DropdownMenuItem>
                    <Eye className="mr-2 h-4 w-4" />
                    View Ticket
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <MessageCircle className="mr-2 h-4 w-4" />
                    Reply
                  </DropdownMenuItem>
                  <DropdownMenuItem>
                    <Edit className="mr-2 h-4 w-4" />
                    Update Status
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-green-600">
                    <CheckCircle className="mr-2 h-4 w-4" />
                    Close Ticket
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
