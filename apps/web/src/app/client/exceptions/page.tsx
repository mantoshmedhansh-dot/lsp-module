"use client";

import { useState } from "react";
import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import {
  AlertTriangle,
  RefreshCw,
  AlertCircle,
  Scale,
  Package,
  FileText,
  Phone,
  Calendar,
  XCircle,
} from "lucide-react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge } from "@cjdquick/ui";

interface ExceptionStats {
  ndr: number;
  weightDisputes: number;
  damages: number;
  documentNeeded: number;
  consigneeDetails: number;
  total: number;
}

const EXCEPTION_CATEGORIES = [
  { key: "all", label: "All Exceptions", icon: AlertTriangle, count: 0 },
  { key: "ndr", label: "NDR", icon: XCircle, count: 0 },
  { key: "weight", label: "Weight Disputes", icon: Scale, count: 0 },
  { key: "damage", label: "Damages", icon: Package, count: 0 },
  { key: "document", label: "Document Needed", icon: FileText, count: 0 },
  { key: "consignee", label: "Consignee Details", icon: Phone, count: 0 },
  { key: "appointment", label: "Appointments", icon: Calendar, count: 0 },
];

async function fetchExceptionStats(): Promise<{ data: ExceptionStats }> {
  const res = await fetch("/api/client/exceptions/stats");
  return res.json();
}

export default function ClientExceptionsPage() {
  const [activeCategory, setActiveCategory] = useState("all");

  const { data: statsData, isLoading } = useQuery({
    queryKey: ["client-exceptions-stats"],
    queryFn: fetchExceptionStats,
  });

  const stats = statsData?.data || {
    ndr: 0,
    weightDisputes: 0,
    damages: 0,
    documentNeeded: 0,
    consigneeDetails: 0,
    total: 0,
  };

  // Update counts in categories
  const categories = EXCEPTION_CATEGORIES.map((cat) => ({
    ...cat,
    count:
      cat.key === "all"
        ? stats.total
        : cat.key === "ndr"
        ? stats.ndr
        : cat.key === "weight"
        ? stats.weightDisputes
        : cat.key === "damage"
        ? stats.damages
        : cat.key === "document"
        ? stats.documentNeeded
        : cat.key === "consignee"
        ? stats.consigneeDetails
        : 0,
  }));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Exceptions & NDR</h1>
          <p className="text-gray-600">
            Manage delivery exceptions and take action
          </p>
        </div>
        <Button variant="outline">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>

      {/* Alert Banner */}
      {stats.total > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-center gap-4">
          <AlertCircle className="h-6 w-6 text-amber-600" />
          <div className="flex-1">
            <p className="font-medium text-amber-800">
              You have {stats.total} pending exceptions requiring action
            </p>
            <p className="text-sm text-amber-600">
              Resolve them quickly to ensure smooth deliveries
            </p>
          </div>
        </div>
      )}

      <div className="flex gap-6">
        {/* Sidebar */}
        <div className="w-56 flex-shrink-0">
          <Card className="p-2">
            <div className="space-y-1">
              {categories.map((cat) => (
                <button
                  key={cat.key}
                  onClick={() => setActiveCategory(cat.key)}
                  className={`w-full flex items-center justify-between px-3 py-2.5 text-sm rounded-lg transition-colors ${
                    activeCategory === cat.key
                      ? "bg-primary-50 text-primary-700"
                      : "text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <cat.icon className="h-4 w-4" />
                    <span>{cat.label}</span>
                  </div>
                  {cat.count > 0 && (
                    <Badge
                      variant={activeCategory === cat.key ? "primary" : "default"}
                      size="sm"
                    >
                      {cat.count}
                    </Badge>
                  )}
                </button>
              ))}
            </div>
          </Card>
        </div>

        {/* Main Content */}
        <div className="flex-1">
          <Card>
            <CardHeader>
              <CardTitle>
                {categories.find((c) => c.key === activeCategory)?.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <RefreshCw className="h-6 w-6 animate-spin mx-auto text-gray-400" />
                </div>
              ) : (
                <div className="space-y-4">
                  {activeCategory === "all" || activeCategory === "ndr" ? (
                    <Link
                      href="/client/exceptions/ndr"
                      className="block p-4 border rounded-lg hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center">
                            <XCircle className="h-5 w-5 text-red-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Non-Delivery Reports (NDR)
                            </p>
                            <p className="text-sm text-gray-500">
                              Failed delivery attempts requiring action
                            </p>
                          </div>
                        </div>
                        <Badge variant="danger" size="sm">
                          {stats.ndr} pending
                        </Badge>
                      </div>
                    </Link>
                  ) : null}

                  {activeCategory === "all" || activeCategory === "weight" ? (
                    <Link
                      href="/client/exceptions/weight"
                      className="block p-4 border rounded-lg hover:border-primary-300 transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-amber-100 rounded-lg flex items-center justify-center">
                            <Scale className="h-5 w-5 text-amber-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Weight Disputes
                            </p>
                            <p className="text-sm text-gray-500">
                              Acknowledge or dispute measured weights
                            </p>
                          </div>
                        </div>
                        <Badge variant="warning" size="sm">
                          {stats.weightDisputes} pending
                        </Badge>
                      </div>
                    </Link>
                  ) : null}

                  {activeCategory === "all" || activeCategory === "damage" ? (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
                            <Package className="h-5 w-5 text-purple-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Damage Claims
                            </p>
                            <p className="text-sm text-gray-500">
                              Report and track damaged shipments
                            </p>
                          </div>
                        </div>
                        <Badge variant="purple" size="sm">
                          {stats.damages} pending
                        </Badge>
                      </div>
                    </div>
                  ) : null}

                  {activeCategory === "all" || activeCategory === "document" ? (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
                            <FileText className="h-5 w-5 text-blue-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Document Needed
                            </p>
                            <p className="text-sm text-gray-500">
                              Upload required documents for shipments
                            </p>
                          </div>
                        </div>
                        <Badge variant="info" size="sm">
                          {stats.documentNeeded} pending
                        </Badge>
                      </div>
                    </div>
                  ) : null}

                  {activeCategory === "all" || activeCategory === "consignee" ? (
                    <div className="p-4 border rounded-lg">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-teal-100 rounded-lg flex items-center justify-center">
                            <Phone className="h-5 w-5 text-teal-600" />
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">
                              Consignee Details Required
                            </p>
                            <p className="text-sm text-gray-500">
                              Update contact or address details
                            </p>
                          </div>
                        </div>
                        <Badge variant="default" size="sm">
                          {stats.consigneeDetails} pending
                        </Badge>
                      </div>
                    </div>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
