"use client";

import { useEffect, useState } from "react";
import {
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CreditInfo {
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  status: string;
  paymentTerms: string;
  overdueAmount: number;
  lastPaymentDate: string;
  lastPaymentAmount: number;
}

interface Transaction {
  id: string;
  date: string;
  type: "PURCHASE" | "PAYMENT" | "CREDIT_NOTE" | "DEBIT_NOTE";
  reference: string;
  amount: number;
  balance: number;
}

export default function B2BCreditPage() {
  const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCreditInfo();
  }, []);

  const fetchCreditInfo = async () => {
    try {
      const response = await fetch("/api/v1/b2b/credit");
      if (response.ok) {
        const result = await response.json();
        setCreditInfo(result.credit);
        setTransactions(result.transactions || []);
      }
    } catch (error) {
      console.error("Failed to fetch credit info:", error);
    } finally {
      setLoading(false);
    }
  };

  // Mock data for demonstration
  const mockCreditInfo: CreditInfo = creditInfo || {
    creditLimit: 1000000,
    creditUsed: 450000,
    creditAvailable: 550000,
    status: "AVAILABLE",
    paymentTerms: "NET_30",
    overdueAmount: 0,
    lastPaymentDate: "2024-01-10",
    lastPaymentAmount: 150000,
  };

  const mockTransactions: Transaction[] = transactions.length > 0 ? transactions : [
    { id: "1", date: "2024-01-14", type: "PURCHASE", reference: "B2B-2024-0156", amount: -145000, balance: 450000 },
    { id: "2", date: "2024-01-12", type: "PURCHASE", reference: "B2B-2024-0155", amount: -272000, balance: 305000 },
    { id: "3", date: "2024-01-10", type: "PAYMENT", reference: "PAY-2024-0089", amount: 150000, balance: 33000 },
    { id: "4", date: "2024-01-08", type: "PURCHASE", reference: "B2B-2024-0154", amount: -88500, balance: 183000 },
    { id: "5", date: "2024-01-05", type: "CREDIT_NOTE", reference: "CN-2024-0012", amount: 25000, balance: 94500 },
  ];

  const creditUsedPercent = (mockCreditInfo.creditUsed / mockCreditInfo.creditLimit) * 100;

  const getStatusBadge = (status: string) => {
    const configs: Record<string, { color: string; icon: React.ElementType }> = {
      AVAILABLE: { color: "bg-green-100 text-green-800", icon: CheckCircle },
      EXCEEDED: { color: "bg-red-100 text-red-800", icon: AlertTriangle },
      ON_HOLD: { color: "bg-yellow-100 text-yellow-800", icon: Clock },
      BLOCKED: { color: "bg-red-100 text-red-800", icon: AlertTriangle },
    };
    const config = configs[status] || configs.AVAILABLE;
    const Icon = config.icon;
    return (
      <Badge className={`${config.color} flex items-center gap-1`}>
        <Icon className="h-3 w-3" />
        {status.replace("_", " ")}
      </Badge>
    );
  };

  const getTransactionIcon = (type: string) => {
    if (type === "PAYMENT" || type === "CREDIT_NOTE") {
      return <ArrowDownRight className="h-4 w-4 text-green-500" />;
    }
    return <ArrowUpRight className="h-4 w-4 text-red-500" />;
  };

  const formatPaymentTerms = (terms: string) => {
    const termMap: Record<string, string> = {
      IMMEDIATE: "Immediate Payment",
      NET_7: "Net 7 Days",
      NET_15: "Net 15 Days",
      NET_30: "Net 30 Days",
      NET_45: "Net 45 Days",
      NET_60: "Net 60 Days",
    };
    return termMap[terms] || terms;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Credit & Payments</h1>
        <p className="text-gray-500">Manage your credit account and view transaction history</p>
      </div>

      {/* Credit Overview */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Credit Limit Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle>Credit Overview</CardTitle>
                <CardDescription>Your current credit status</CardDescription>
              </div>
              {getStatusBadge(mockCreditInfo.status)}
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid gap-6 sm:grid-cols-3">
              <div className="text-center p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-500">Credit Limit</p>
                <p className="text-2xl font-bold">
                  {mockCreditInfo.creditLimit.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="text-center p-4 bg-red-50 rounded-lg">
                <p className="text-sm text-gray-500">Credit Used</p>
                <p className="text-2xl font-bold text-red-600">
                  {mockCreditInfo.creditUsed.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
              <div className="text-center p-4 bg-green-50 rounded-lg">
                <p className="text-sm text-gray-500">Available</p>
                <p className="text-2xl font-bold text-green-600">
                  {mockCreditInfo.creditAvailable.toLocaleString("en-IN", {
                    style: "currency",
                    currency: "INR",
                    maximumFractionDigits: 0,
                  })}
                </p>
              </div>
            </div>

            <div>
              <div className="flex justify-between text-sm mb-2">
                <span className="text-gray-500">Credit Utilization</span>
                <span className="font-medium">{creditUsedPercent.toFixed(1)}%</span>
              </div>
              <Progress value={creditUsedPercent} className="h-3" />
              <p className="text-xs text-gray-500 mt-2">
                {creditUsedPercent > 80
                  ? "Credit utilization is high. Consider making a payment."
                  : "Credit utilization is healthy."}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Payment Info Card */}
        <Card>
          <CardHeader>
            <CardTitle>Payment Info</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex justify-between items-center p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-xs text-gray-500">Payment Terms</p>
                <p className="font-medium">{formatPaymentTerms(mockCreditInfo.paymentTerms)}</p>
              </div>
              <Clock className="h-5 w-5 text-gray-400" />
            </div>

            {mockCreditInfo.overdueAmount > 0 ? (
              <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg border border-red-200">
                <div>
                  <p className="text-xs text-red-600">Overdue Amount</p>
                  <p className="font-medium text-red-700">
                    {mockCreditInfo.overdueAmount.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
                  </p>
                </div>
                <AlertTriangle className="h-5 w-5 text-red-500" />
              </div>
            ) : (
              <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                <div>
                  <p className="text-xs text-green-600">Payment Status</p>
                  <p className="font-medium text-green-700">No Overdue</p>
                </div>
                <CheckCircle className="h-5 w-5 text-green-500" />
              </div>
            )}

            <div className="p-3 bg-blue-50 rounded-lg">
              <p className="text-xs text-gray-500">Last Payment</p>
              <p className="font-medium">
                {mockCreditInfo.lastPaymentAmount.toLocaleString("en-IN", {
                  style: "currency",
                  currency: "INR",
                })}
              </p>
              <p className="text-xs text-gray-500">{mockCreditInfo.lastPaymentDate}</p>
            </div>

            <Button className="w-full" variant="outline">
              <CreditCard className="h-4 w-4 mr-2" />
              Make Payment
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Transaction History</CardTitle>
          <CardDescription>Recent credit account activity</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Reference</TableHead>
                <TableHead className="text-right">Amount</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {mockTransactions.map((txn) => (
                <TableRow key={txn.id}>
                  <TableCell>{txn.date}</TableCell>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getTransactionIcon(txn.type)}
                      <span className="capitalize">
                        {txn.type.replace("_", " ").toLowerCase()}
                      </span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-sm">{txn.reference}</TableCell>
                  <TableCell
                    className={`text-right font-medium ${
                      txn.amount > 0 ? "text-green-600" : "text-red-600"
                    }`}
                  >
                    {txn.amount > 0 ? "+" : ""}
                    {txn.amount.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
                  </TableCell>
                  <TableCell className="text-right">
                    {txn.balance.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                    })}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
