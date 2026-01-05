"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  HeadphonesIcon,
  Plus,
  RefreshCw,
  MessageSquare,
  Clock,
  CheckCircle,
  AlertCircle,
  Search,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface SupportTicket {
  id: string;
  ticketNumber: string;
  awbNumber: string | null;
  category: string;
  subCategory: string | null;
  subject: string;
  priority: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  raisedBy?: {
    name: string;
  };
}

const STATUS_CONFIG: Record<string, { label: string; variant: string }> = {
  OPEN: { label: "Open", variant: "info" },
  IN_PROGRESS: { label: "In Progress", variant: "warning" },
  WAITING_CUSTOMER: { label: "Waiting Response", variant: "purple" },
  RESOLVED: { label: "Resolved", variant: "success" },
  CLOSED: { label: "Closed", variant: "default" },
};

const CATEGORY_LABELS: Record<string, string> = {
  DELIVERY_DELAY: "Delivery Delay",
  NDR: "Non-Delivery Report",
  POD_ISSUE: "POD Issue",
  DAMAGE: "Damage Claim",
  WEIGHT_DISPUTE: "Weight Dispute",
  PAYMENT: "Payment Issue",
  PICKUP: "Pickup Issue",
  OTHER: "Other",
};

async function fetchTickets(status?: string) {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  const res = await fetch(`/api/client/support?${params.toString()}`);
  return res.json();
}

export default function ClientSupportPage() {
  const [activeTab, setActiveTab] = useState<"open" | "resolved" | "closed">("open");
  const [searchQuery, setSearchQuery] = useState("");

  const statusFilter =
    activeTab === "open"
      ? "OPEN,IN_PROGRESS,WAITING_CUSTOMER"
      : activeTab === "resolved"
      ? "RESOLVED"
      : "CLOSED";

  const { data, isLoading, refetch } = useQuery({
    queryKey: ["client-support", activeTab],
    queryFn: () => fetchTickets(statusFilter),
  });

  const tickets: SupportTicket[] = data?.data?.items || [];
  const filteredTickets = searchQuery
    ? tickets.filter(
        (t) =>
          t.ticketNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.awbNumber?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          t.subject.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : tickets;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Support</h1>
          <p className="text-gray-600">View and manage your support tickets</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Link href="/client/support/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Raise Ticket
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <MessageSquare className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "OPEN").length}
              </p>
              <p className="text-sm text-gray-500">Open</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "IN_PROGRESS").length}
              </p>
              <p className="text-sm text-gray-500">In Progress</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <AlertCircle className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "WAITING_CUSTOMER").length}
              </p>
              <p className="text-sm text-gray-500">Awaiting Response</p>
            </div>
          </div>
        </Card>
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">
                {tickets.filter((t) => t.status === "RESOLVED").length}
              </p>
              <p className="text-sm text-gray-500">Resolved</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Tickets */}
      <Card>
        <CardHeader className="border-b">
          <div className="flex items-center justify-between">
            {/* Tabs */}
            <div className="flex gap-1">
              {[
                { key: "open", label: "Open" },
                { key: "resolved", label: "Resolved" },
                { key: "closed", label: "Closed" },
              ].map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key as any)}
                  className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                    activeTab === tab.key
                      ? "bg-primary-100 text-primary-700"
                      : "text-gray-600 hover:bg-gray-100"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Search */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search tickets..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="text-center py-12">
              <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <div className="text-center py-12">
              <HeadphonesIcon className="h-12 w-12 mx-auto text-gray-300" />
              <p className="mt-4 text-gray-500">No tickets found</p>
            </div>
          ) : (
            <div className="divide-y">
              {filteredTickets.map((ticket) => {
                const statusConfig = STATUS_CONFIG[ticket.status];
                return (
                  <Link
                    key={ticket.id}
                    href={`/client/support/${ticket.id}`}
                    className="block px-6 py-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-3">
                          <span className="font-medium text-gray-900">
                            {ticket.ticketNumber}
                          </span>
                          {ticket.awbNumber && (
                            <span className="text-sm text-gray-500">
                              AWB: {ticket.awbNumber}
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mt-1">
                          {ticket.subject}
                        </p>
                        <div className="flex items-center gap-3 mt-2 text-xs text-gray-500">
                          <span>
                            {CATEGORY_LABELS[ticket.category] || ticket.category}
                          </span>
                          <span>•</span>
                          <span>
                            Raised on{" "}
                            {new Date(ticket.createdAt).toLocaleDateString()}
                          </span>
                          {ticket.raisedBy && (
                            <>
                              <span>•</span>
                              <span>By {ticket.raisedBy.name}</span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge
                          variant={
                            ticket.priority === "URGENT"
                              ? "danger"
                              : ticket.priority === "HIGH"
                              ? "warning"
                              : "default"
                          }
                          size="sm"
                        >
                          {ticket.priority}
                        </Badge>
                        <Badge variant={statusConfig?.variant as any} size="sm">
                          {statusConfig?.label || ticket.status}
                        </Badge>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
