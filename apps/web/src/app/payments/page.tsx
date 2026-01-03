"use client";

import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Badge, Input } from "@cjdquick/ui";
import { CreditCard, Plus, RefreshCw, Search, CheckCircle, XCircle, Clock, ArrowUpRight, Settings, Zap, Shield } from "lucide-react";

interface PaymentGateway {
  id: string;
  gatewayType: string;
  gatewayName: string;
  displayName: string;
  apiKey: string;
  mode: string;
  isActive: boolean;
  isPrimary: boolean;
  transactionFeePercent: number;
  flatFeePerTxn: number;
  healthStatus: string;
  supportsCreditCard: boolean;
  supportsUPI: boolean;
  supportsNetBanking: boolean;
  supportsWallet: boolean;
  _count?: { transactions: number };
}

interface PaymentTransaction {
  id: string;
  transactionId: string;
  orderId: string;
  amount: number;
  currency: string;
  status: string;
  paymentMethod?: string;
  customerName?: string;
  convenienceFee: number;
  createdAt: string;
  paymentGateway: { displayName: string };
}

export default function PaymentsPage() {
  const [gateways, setGateways] = useState<PaymentGateway[]>([]);
  const [transactions, setTransactions] = useState<PaymentTransaction[]>([]);
  const [availableTypes, setAvailableTypes] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("gateways");
  const [transactionSummary, setTransactionSummary] = useState({ pending: 0, processing: 0, completed: 0, failed: 0, refunded: 0 });
  const [transactionTotals, setTransactionTotals] = useState({ amount: 0, fees: 0, settled: 0, count: 0 });

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [gatewayRes, txnRes] = await Promise.all([
        fetch("/api/payments/gateway"),
        fetch("/api/payments/transactions"),
      ]);

      const [gatewayData, txnData] = await Promise.all([
        gatewayRes.json(),
        txnRes.json(),
      ]);

      if (gatewayData.success) {
        setGateways(gatewayData.data.items || []);
        setAvailableTypes(gatewayData.data.availableTypes || []);
      }
      if (txnData.success) {
        setTransactions(txnData.data.items || []);
        setTransactionSummary(txnData.data.summary || {});
        setTransactionTotals(txnData.data.totals || {});
      }
    } catch (error) {
      console.error("Failed to fetch payment data:", error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleGateway(id: string) {
    try {
      await fetch("/api/payments/gateway", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "TOGGLE_ACTIVE" }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to toggle gateway:", error);
    }
  }

  async function testConnection(id: string) {
    try {
      await fetch("/api/payments/gateway", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "TEST_CONNECTION" }),
      });
      fetchData();
    } catch (error) {
      console.error("Failed to test connection:", error);
    }
  }

  const getStatusBadge = (status: string) => {
    const variant = status === "SUCCESS" || status === "COMPLETED" ? "success" :
                   status === "PENDING" || status === "INITIATED" ? "warning" : "danger";
    return <Badge variant={variant}>{status}</Badge>;
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Payment Management</h1>
          <p className="text-muted-foreground">Configure payment gateways and manage transactions</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />Refresh
          </Button>
          <Button><Plus className="mr-2 h-4 w-4" />Add Gateway</Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Total Collected</CardTitle>
            <ArrowUpRight className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {(transactionTotals.amount / 100000).toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground">{transactionTotals.count} transactions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Net Settled</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {(transactionTotals.settled / 100000).toFixed(2)}L</div>
            <p className="text-xs text-muted-foreground">After fees & taxes</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gateway Fees</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Rs. {transactionTotals.fees.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Total fees paid</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
            <Zap className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {transactionTotals.count > 0
                ? ((transactionSummary.completed / (transactionSummary.completed + transactionSummary.failed)) * 100).toFixed(1)
                : 0}%
            </div>
            <p className="text-xs text-muted-foreground">{transactionSummary.failed} failed</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        {["gateways", "transactions"].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium capitalize ${
              activeTab === tab ? "border-b-2 border-primary text-primary" : "text-muted-foreground"
            }`}
          >
            {tab === "gateways" ? "Payment Gateways" : "Transactions"}
          </button>
        ))}
      </div>

      {activeTab === "gateways" && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configured Gateways</CardTitle>
              <p className="text-sm text-muted-foreground">Payment gateway integrations for COD and online payments</p>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="py-8 text-center text-muted-foreground">Loading...</div>
              ) : gateways.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No payment gateways configured</p>
                  <Button variant="outline" className="mt-4">Add First Gateway</Button>
                </div>
              ) : (
                <div className="grid gap-4 md:grid-cols-2">
                  {gateways.map((gateway) => (
                    <Card key={gateway.id} className="relative">
                      {gateway.isPrimary && (
                        <Badge className="absolute -top-2 right-4">Primary</Badge>
                      )}
                      <CardHeader>
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="rounded-lg bg-muted p-2">
                              <CreditCard className="h-6 w-6" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">{gateway.displayName}</CardTitle>
                              <p className="text-xs text-muted-foreground">{gateway.apiKey}</p>
                            </div>
                          </div>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <span className="text-muted-foreground">Mode:</span>
                            <Badge variant={gateway.mode === "LIVE" ? "success" : "warning"} className="ml-2">
                              {gateway.mode}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Status:</span>
                            <Badge variant={gateway.isActive ? "success" : "default"} className="ml-2">
                              {gateway.isActive ? "Active" : "Inactive"}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Health:</span>
                            <Badge variant={gateway.healthStatus === "HEALTHY" ? "success" : "warning"} className="ml-2">
                              {gateway.healthStatus}
                            </Badge>
                          </div>
                          <div>
                            <span className="text-muted-foreground">Fee:</span>
                            <span className="ml-2 font-medium">{gateway.transactionFeePercent}% + Rs.{gateway.flatFeePerTxn}</span>
                          </div>
                        </div>
                        <div className="mt-4 flex flex-wrap gap-1">
                          {gateway.supportsCreditCard && <Badge variant="info">Card</Badge>}
                          {gateway.supportsUPI && <Badge variant="info">UPI</Badge>}
                          {gateway.supportsNetBanking && <Badge variant="info">NetBanking</Badge>}
                          {gateway.supportsWallet && <Badge variant="info">Wallet</Badge>}
                        </div>
                        <div className="mt-4 flex gap-2">
                          <Button size="sm" variant="outline" onClick={() => testConnection(gateway.id)}>
                            <Zap className="mr-1 h-3 w-3" />Test
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => toggleGateway(gateway.id)}>
                            {gateway.isActive ? "Deactivate" : "Activate"}
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Available Gateways */}
          <Card>
            <CardHeader>
              <CardTitle>Available Payment Gateways</CardTitle>
              <p className="text-sm text-muted-foreground">Supported payment providers you can integrate</p>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-4">
                {availableTypes.map((type: any) => (
                  <div key={type.type} className="rounded-lg border p-4 text-center">
                    <CreditCard className="mx-auto mb-2 h-8 w-8 text-primary" />
                    <h3 className="font-medium">{type.displayName}</h3>
                    <div className="mt-2 flex flex-wrap justify-center gap-1">
                      {type.supportsUPI && <Badge variant="info">UPI</Badge>}
                      {type.supportsCreditCard && <Badge variant="info">Cards</Badge>}
                      {type.supportsQRCode && <Badge variant="info">QR</Badge>}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {activeTab === "transactions" && (
        <div className="space-y-4">
          {/* Transaction Stats */}
          <div className="grid gap-4 md:grid-cols-5">
            {[
              { label: "Pending", value: transactionSummary.pending },
              { label: "Processing", value: transactionSummary.processing, color: "text-blue-600" },
              { label: "Completed", value: transactionSummary.completed, color: "text-green-600" },
              { label: "Failed", value: transactionSummary.failed, color: "text-red-600" },
              { label: "Refunded", value: transactionSummary.refunded, color: "text-purple-600" },
            ].map((stat) => (
              <Card key={stat.label}>
                <CardContent className="pt-4">
                  <div className={`text-2xl font-bold ${stat.color || ""}`}>{stat.value}</div>
                  <p className="text-sm text-muted-foreground">{stat.label}</p>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Transactions Table */}
          <Card>
            <CardHeader>
              <CardTitle>Transactions</CardTitle>
              <p className="text-sm text-muted-foreground">All payment transactions across gateways</p>
            </CardHeader>
            <CardContent>
              {transactions.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground">
                  <CreditCard className="mx-auto mb-2 h-8 w-8 opacity-50" />
                  <p>No transactions yet</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="px-4 py-2 text-left font-medium">Transaction ID</th>
                        <th className="px-4 py-2 text-left font-medium">Gateway</th>
                        <th className="px-4 py-2 text-left font-medium">Amount</th>
                        <th className="px-4 py-2 text-left font-medium">Customer</th>
                        <th className="px-4 py-2 text-left font-medium">Method</th>
                        <th className="px-4 py-2 text-left font-medium">Status</th>
                        <th className="px-4 py-2 text-left font-medium">Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {transactions.map((txn) => (
                        <tr key={txn.id} className="border-b">
                          <td className="px-4 py-2 font-mono text-sm">{txn.transactionId}</td>
                          <td className="px-4 py-2">
                            <Badge variant="info">{txn.paymentGateway?.displayName}</Badge>
                          </td>
                          <td className="px-4 py-2">
                            <div className="font-medium">Rs. {txn.amount?.toLocaleString()}</div>
                            <div className="text-xs text-muted-foreground">Fee: Rs. {txn.convenienceFee?.toFixed(2)}</div>
                          </td>
                          <td className="px-4 py-2">{txn.customerName || "-"}</td>
                          <td className="px-4 py-2">{txn.paymentMethod || "-"}</td>
                          <td className="px-4 py-2">{getStatusBadge(txn.status)}</td>
                          <td className="px-4 py-2">{new Date(txn.createdAt).toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
