"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import {
  ShieldCheck,
  Plus,
  RefreshCw,
  CheckCircle,
  XCircle,
  Clock,
  Truck,
  MapPin,
} from "lucide-react";

interface ULIPIntegration {
  id: string;
  ulipUserName: string;
  ulipProviderId?: string;
  isActive: boolean;
  syncStatus: string;
  lastSyncAt?: string;
  createdAt: string;
  _count: {
    vehicleVerifications: number;
    cargoTrackings: number;
    syncLogs: number;
  };
}

interface VehicleVerification {
  id: string;
  registrationNo: string;
  verificationStatus: string;
  verifiedAt?: string;
  expiryAt?: string;
  ownerName?: string;
  vehicleClass?: string;
  insuranceExpiry?: string;
  fitnessExpiry?: string;
}

export default function ULIPPage() {
  const [integrations, setIntegrations] = useState<ULIPIntegration[]>([]);
  const [verifications, setVerifications] = useState<VehicleVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [vehicleNo, setVehicleNo] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [activeTab, setActiveTab] = useState("verifications");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [intRes, verRes] = await Promise.all([
        fetch("/api/compliance/ulip"),
        fetch("/api/compliance/ulip?type=verifications"),
      ]);

      const [intData, verData] = await Promise.all([
        intRes.json(),
        verRes.json(),
      ]);

      if (intData.success) setIntegrations(intData.data.items || []);
      if (verData.success) setVerifications(verData.data.items || []);
    } catch (error) {
      console.error("Failed to fetch ULIP data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function verifyVehicle() {
    if (!vehicleNo.trim()) return;

    setVerifying(true);
    try {
      const response = await fetch("/api/compliance/ulip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "VERIFY_VEHICLE",
          ulipIntegrationId: integrations[0]?.id,
          registrationNo: vehicleNo.toUpperCase(),
        }),
      });

      const data = await response.json();
      if (data.success) {
        setVerifications((prev) => [data.data, ...prev]);
        setVehicleNo("");
      }
    } catch (error) {
      console.error("Failed to verify vehicle:", error);
    } finally {
      setVerifying(false);
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === "VERIFIED" ? "success" : status === "PENDING" ? "warning" : "danger";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">ULIP Integration</h1>
          <p className="text-muted-foreground">Unified Logistics Interface Platform - Government APIs</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Integrations</CardTitle>
            <ShieldCheck className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{integrations.length}</div>
            <p className="text-xs text-muted-foreground">Active connections</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Verified Vehicles</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {verifications.filter((v) => v.verificationStatus === "VERIFIED").length}
            </div>
            <p className="text-xs text-muted-foreground">RC verified</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Pending</CardTitle>
            <Clock className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {verifications.filter((v) => v.verificationStatus === "PENDING").length}
            </div>
            <p className="text-xs text-muted-foreground">Awaiting verification</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Active Tracking</CardTitle>
            <MapPin className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Cargo tracking active</p>
          </CardContent>
        </Card>
      </div>

      {/* Verify Vehicle */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Vehicle Verification</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Input
              placeholder="Enter vehicle number (e.g., MH12AB1234)"
              value={vehicleNo}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setVehicleNo(e.target.value.toUpperCase())}
              className="max-w-md"
            />
            <Button onClick={verifyVehicle} disabled={verifying || !vehicleNo.trim()}>
              {verifying ? "Verifying..." : "Verify Vehicle"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["verifications", "tracking", "integrations"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab === "verifications" ? "Vehicle Verifications" : tab === "tracking" ? "Cargo Tracking" : "Integrations"}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "verifications" && (
        <Card>
          <CardHeader>
            <CardTitle>Vehicle Verifications</CardTitle>
            <p className="text-sm text-muted-foreground">ULIP RC verification status for registered vehicles</p>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="py-8 text-center text-muted-foreground">Loading...</div>
            ) : verifications.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <Truck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No vehicle verifications yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Registration No</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Owner</th>
                      <th className="px-4 py-2 text-left font-medium">Vehicle Class</th>
                      <th className="px-4 py-2 text-left font-medium">Insurance Expiry</th>
                      <th className="px-4 py-2 text-left font-medium">Verified At</th>
                    </tr>
                  </thead>
                  <tbody>
                    {verifications.map((v) => (
                      <tr key={v.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{v.registrationNo}</td>
                        <td className="px-4 py-2">{getStatusBadge(v.verificationStatus)}</td>
                        <td className="px-4 py-2">{v.ownerName || "-"}</td>
                        <td className="px-4 py-2">{v.vehicleClass || "-"}</td>
                        <td className="px-4 py-2">
                          {v.insuranceExpiry ? new Date(v.insuranceExpiry).toLocaleDateString() : "-"}
                        </td>
                        <td className="px-4 py-2">
                          {v.verifiedAt ? new Date(v.verifiedAt).toLocaleString() : "-"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {activeTab === "tracking" && (
        <Card>
          <CardHeader>
            <CardTitle>Cargo Tracking</CardTitle>
            <p className="text-sm text-muted-foreground">Real-time cargo tracking via ULIP APIs</p>
          </CardHeader>
          <CardContent>
            <div className="py-8 text-center text-muted-foreground">
              <MapPin className="mx-auto mb-2 h-8 w-8 opacity-50" />
              <p>No active cargo tracking</p>
              <p className="text-sm">Start tracking from shipment details</p>
            </div>
          </CardContent>
        </Card>
      )}

      {activeTab === "integrations" && (
        <Card>
          <CardHeader>
            <CardTitle>ULIP Integrations</CardTitle>
            <p className="text-sm text-muted-foreground">Connected ULIP accounts and API credentials</p>
          </CardHeader>
          <CardContent>
            {integrations.length === 0 ? (
              <div className="py-8 text-center text-muted-foreground">
                <ShieldCheck className="mx-auto mb-2 h-8 w-8 opacity-50" />
                <p>No ULIP integrations configured</p>
                <Button variant="outline" className="mt-4">Add Integration</Button>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="px-4 py-2 text-left font-medium">Username</th>
                      <th className="px-4 py-2 text-left font-medium">Status</th>
                      <th className="px-4 py-2 text-left font-medium">Verifications</th>
                      <th className="px-4 py-2 text-left font-medium">Last Sync</th>
                    </tr>
                  </thead>
                  <tbody>
                    {integrations.map((int) => (
                      <tr key={int.id} className="border-b">
                        <td className="px-4 py-2 font-medium">{int.ulipUserName}</td>
                        <td className="px-4 py-2">
                          <Badge variant={int.isActive ? "success" : "default"}>
                            {int.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </td>
                        <td className="px-4 py-2">{int._count.vehicleVerifications}</td>
                        <td className="px-4 py-2">
                          {int.lastSyncAt ? new Date(int.lastSyncAt).toLocaleString() : "Never"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
