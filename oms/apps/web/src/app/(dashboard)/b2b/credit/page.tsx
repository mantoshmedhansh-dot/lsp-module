"use client";

import { useState, useEffect, useCallback } from "react";
import { useSession } from "next-auth/react";
import {
  Plus,
  Search,
  CreditCard,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  Users,
  DollarSign,
  RefreshCw,
  Eye,
  ArrowUpRight,
  ArrowDownRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { format } from "date-fns";

interface CreditTransaction {
  id: string;
  transactionNo: string;
  type: string;
  amount: number;
  balanceBefore: number;
  balanceAfter: number;
  orderId: string | null;
  paymentRef: string | null;
  invoiceNo: string | null;
  remarks: string | null;
  createdAt: string;
  customer: {
    id: string;
    code: string;
    name: string;
  };
}

interface CreditSummary {
  creditEnabledCustomers: number;
  totalCreditLimit: number;
  totalCreditUsed: number;
  totalCreditAvailable: number;
  overdueCustomers: number;
  utilizationPercent: number;
}

interface Customer {
  id: string;
  code: string;
  name: string;
  creditEnabled: boolean;
  creditLimit: number;
  creditUsed: number;
  creditAvailable: number;
  creditStatus: string;
}

interface CustomerCredit {
  customer: Customer;
  transactions: CreditTransaction[];
  aging: {
    current: number;
    days1to30: number;
    days31to60: number;
    days61to90: number;
    over90: number;
  };
  totalOverdue: number;
}

const transactionTypes = [
  { value: "UTILIZATION", label: "Credit Utilization", color: "text-red-600" },
  { value: "PAYMENT", label: "Payment Received", color: "text-green-600" },
  { value: "CREDIT_NOTE", label: "Credit Note", color: "text-blue-600" },
  { value: "ADJUSTMENT", label: "Adjustment", color: "text-orange-600" },
  { value: "REVERSAL", label: "Reversal", color: "text-purple-600" },
];

const statusColors: Record<string, string> = {
  AVAILABLE: "bg-green-100 text-green-800",
  EXCEEDED: "bg-red-100 text-red-800",
  BLOCKED: "bg-gray-100 text-gray-800",
  ON_HOLD: "bg-yellow-100 text-yellow-800",
};

export default function CreditManagementPage() {
  const { data: session } = useSession();
  const [transactions, setTransactions] = useState<CreditTransaction[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [summary, setSummary] = useState<CreditSummary | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [selectedCustomer, setSelectedCustomer] = useState<CustomerCredit | null>(null);
  const [activeTab, setActiveTab] = useState("transactions");

  // Form state
  const [formData, setFormData] = useState({
    customerId: "",
    type: "PAYMENT",
    amount: "",
    paymentRef: "",
    invoiceNo: "",
    remarks: "",
  });

  const canManage = ["SUPER_ADMIN", "ADMIN", "MANAGER"].includes(
    session?.user?.role || ""
  );

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);
      const [creditRes, customersRes] = await Promise.all([
        fetch("/api/v1/credit?limit=50"),
        fetch("/api/v1/customers?creditEnabled=true&limit=100"),
      ]);

      if (creditRes.ok) {
        const data = await creditRes.json();
        setTransactions(data.transactions || []);
        setSummary(data.summary);
      }

      if (customersRes.ok) {
        const data = await customersRes.json();
        const customersWithCredit = (data.data || []).map((c: Customer) => ({
          ...c,
          creditLimit: Number(c.creditLimit),
          creditUsed: Number(c.creditUsed),
          creditAvailable: Number(c.creditAvailable),
        }));
        setCustomers(customersWithCredit);
      }
    } catch (error) {
      console.error("Error fetching data:", error);
      toast.error("Failed to load credit data");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    try {
      const response = await fetch("/api/v1/credit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customerId: formData.customerId,
          type: formData.type,
          amount: parseFloat(formData.amount),
          paymentRef: formData.paymentRef || null,
          invoiceNo: formData.invoiceNo || null,
          remarks: formData.remarks || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create transaction");
      }

      toast.success("Transaction recorded successfully");
      setIsDialogOpen(false);
      setFormData({
        customerId: "",
        type: "PAYMENT",
        amount: "",
        paymentRef: "",
        invoiceNo: "",
        remarks: "",
      });
      fetchData();
    } catch (error) {
      console.error("Error creating transaction:", error);
      toast.error(
        error instanceof Error ? error.message : "Failed to create transaction"
      );
    }
  }

  async function viewCustomerCredit(customerId: string) {
    try {
      const response = await fetch(`/api/v1/credit/customers/${customerId}`);
      if (!response.ok) throw new Error("Failed to fetch customer credit");
      const data = await response.json();
      setSelectedCustomer(data);
      setIsDetailDialogOpen(true);
    } catch (error) {
      console.error("Error fetching customer credit:", error);
      toast.error("Failed to load customer credit details");
    }
  }

  function getTransactionColor(type: string) {
    const t = transactionTypes.find((tt) => tt.value === type);
    return t?.color || "text-gray-600";
  }

  function getTransactionIcon(type: string) {
    switch (type) {
      case "UTILIZATION":
        return <ArrowUpRight className="h-4 w-4 text-red-500" />;
      case "PAYMENT":
      case "CREDIT_NOTE":
      case "REVERSAL":
        return <ArrowDownRight className="h-4 w-4 text-green-500" />;
      default:
        return <DollarSign className="h-4 w-4 text-gray-500" />;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Credit Management</h1>
          <p className="text-muted-foreground">
            Manage B2B customer credit and payment tracking
          </p>
        </div>
        {canManage && (
          <Button onClick={() => setIsDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Record Transaction
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Credit Limit</CardTitle>
            <CreditCard className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {summary?.totalCreditLimit.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }) || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              {summary?.creditEnabledCustomers || 0} customers with credit
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credit Utilized</CardTitle>
            <TrendingUp className="h-4 w-4 text-red-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {summary?.totalCreditUsed.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }) || "0"}
            </div>
            <div className="flex items-center gap-2 mt-1">
              <Progress value={summary?.utilizationPercent || 0} className="h-2" />
              <span className="text-xs text-muted-foreground">
                {summary?.utilizationPercent || 0}%
              </span>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Available Credit</CardTitle>
            <TrendingDown className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {summary?.totalCreditAvailable.toLocaleString("en-IN", {
                style: "currency",
                currency: "INR",
                maximumFractionDigits: 0,
              }) || "0"}
            </div>
            <p className="text-xs text-muted-foreground">
              Remaining credit capacity
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Accounts</CardTitle>
            <AlertTriangle className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">
              {summary?.overdueCustomers || 0}
            </div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="transactions">Recent Transactions</TabsTrigger>
          <TabsTrigger value="customers">Customer Credit</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Credit Transactions</CardTitle>
                  <CardDescription>Recent credit movements</CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : transactions.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <CreditCard className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">No transactions recorded</p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Transaction No</TableHead>
                      <TableHead>Customer</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Amount</TableHead>
                      <TableHead className="text-right">Balance After</TableHead>
                      <TableHead>Reference</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {transactions.map((tx) => (
                      <TableRow key={tx.id}>
                        <TableCell>
                          <Badge variant="outline" className="font-mono">
                            {tx.transactionNo}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="font-medium">{tx.customer.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {tx.customer.code}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            {getTransactionIcon(tx.type)}
                            <span className={getTransactionColor(tx.type)}>
                              {transactionTypes.find((t) => t.value === tx.type)?.label ||
                                tx.type}
                            </span>
                          </div>
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          <span
                            className={
                              tx.type === "UTILIZATION"
                                ? "text-red-600"
                                : "text-green-600"
                            }
                          >
                            {tx.type === "UTILIZATION" ? "+" : "-"}
                            {tx.amount.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                            })}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          {tx.balanceAfter.toLocaleString("en-IN", {
                            style: "currency",
                            currency: "INR",
                          })}
                        </TableCell>
                        <TableCell>
                          {tx.paymentRef || tx.invoiceNo || tx.orderId || "-"}
                        </TableCell>
                        <TableCell>
                          {format(new Date(tx.createdAt), "dd MMM yyyy HH:mm")}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="customers">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Customer Credit Status</CardTitle>
                  <CardDescription>
                    {customers.length} customers with credit enabled
                  </CardDescription>
                </div>
                <Button variant="outline" size="sm" onClick={fetchData}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="flex justify-center py-8">Loading...</div>
              ) : customers.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-8 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-muted-foreground">
                    No customers with credit enabled
                  </p>
                </div>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Customer</TableHead>
                      <TableHead className="text-right">Credit Limit</TableHead>
                      <TableHead className="text-right">Used</TableHead>
                      <TableHead className="text-right">Available</TableHead>
                      <TableHead>Utilization</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {customers.map((customer) => {
                      const utilizationPercent =
                        customer.creditLimit > 0
                          ? Math.round(
                              (customer.creditUsed / customer.creditLimit) * 100
                            )
                          : 0;

                      return (
                        <TableRow key={customer.id}>
                          <TableCell>
                            <div className="font-medium">{customer.name}</div>
                            <div className="text-xs text-muted-foreground">
                              {customer.code}
                            </div>
                          </TableCell>
                          <TableCell className="text-right">
                            {customer.creditLimit.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })}
                          </TableCell>
                          <TableCell className="text-right text-red-600">
                            {customer.creditUsed.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })}
                          </TableCell>
                          <TableCell className="text-right text-green-600">
                            {customer.creditAvailable.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                              maximumFractionDigits: 0,
                            })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Progress
                                value={utilizationPercent}
                                className="h-2 w-20"
                              />
                              <span className="text-xs text-muted-foreground">
                                {utilizationPercent}%
                              </span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <Badge className={statusColors[customer.creditStatus]}>
                              {customer.creditStatus}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => viewCustomerCredit(customer.id)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Record Transaction Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Record Credit Transaction</DialogTitle>
            <DialogDescription>
              Record a payment, credit note, or adjustment for a customer.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label>Customer *</Label>
                <Select
                  value={formData.customerId}
                  onValueChange={(value) =>
                    setFormData({ ...formData, customerId: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select customer" />
                  </SelectTrigger>
                  <SelectContent>
                    {customers.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.code} - {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Transaction Type *</Label>
                  <Select
                    value={formData.type}
                    onValueChange={(value) =>
                      setFormData({ ...formData, type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {transactionTypes.map((t) => (
                        <SelectItem key={t.value} value={t.value}>
                          {t.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Amount *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    value={formData.amount}
                    onChange={(e) =>
                      setFormData({ ...formData, amount: e.target.value })
                    }
                    placeholder="0.00"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Payment Reference</Label>
                  <Input
                    value={formData.paymentRef}
                    onChange={(e) =>
                      setFormData({ ...formData, paymentRef: e.target.value })
                    }
                    placeholder="e.g., CHQ-12345"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Invoice No</Label>
                  <Input
                    value={formData.invoiceNo}
                    onChange={(e) =>
                      setFormData({ ...formData, invoiceNo: e.target.value })
                    }
                    placeholder="e.g., INV-2024-001"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Remarks</Label>
                <Input
                  value={formData.remarks}
                  onChange={(e) =>
                    setFormData({ ...formData, remarks: e.target.value })
                  }
                  placeholder="Transaction notes..."
                />
              </div>
            </div>

            <DialogFooter className="mt-6">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button type="submit">Record Transaction</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Customer Credit Detail Dialog */}
      <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Credit Details - {selectedCustomer?.customer.name}
            </DialogTitle>
            <DialogDescription>
              {selectedCustomer?.customer.code}
            </DialogDescription>
          </DialogHeader>

          {selectedCustomer && (
            <div className="space-y-6">
              {/* Credit Summary */}
              <div className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 bg-muted rounded-lg">
                  <div className="text-sm text-muted-foreground">Credit Limit</div>
                  <div className="text-xl font-bold">
                    {selectedCustomer.customer.creditLimit.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="text-center p-4 bg-red-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Used</div>
                  <div className="text-xl font-bold text-red-600">
                    {selectedCustomer.customer.creditUsed.toLocaleString("en-IN", {
                      style: "currency",
                      currency: "INR",
                      maximumFractionDigits: 0,
                    })}
                  </div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-sm text-muted-foreground">Available</div>
                  <div className="text-xl font-bold text-green-600">
                    {selectedCustomer.customer.creditAvailable.toLocaleString(
                      "en-IN",
                      {
                        style: "currency",
                        currency: "INR",
                        maximumFractionDigits: 0,
                      }
                    )}
                  </div>
                </div>
              </div>

              {/* Aging Buckets */}
              {selectedCustomer.totalOverdue > 0 && (
                <div className="space-y-2">
                  <h4 className="font-medium">Aging Analysis</h4>
                  <div className="grid grid-cols-5 gap-2 text-sm">
                    <div className="text-center p-2 bg-green-50 rounded">
                      <div className="text-muted-foreground">Current</div>
                      <div className="font-medium">
                        {selectedCustomer.aging.current.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-yellow-50 rounded">
                      <div className="text-muted-foreground">1-30 days</div>
                      <div className="font-medium">
                        {selectedCustomer.aging.days1to30.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-orange-50 rounded">
                      <div className="text-muted-foreground">31-60 days</div>
                      <div className="font-medium">
                        {selectedCustomer.aging.days31to60.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-red-50 rounded">
                      <div className="text-muted-foreground">61-90 days</div>
                      <div className="font-medium">
                        {selectedCustomer.aging.days61to90.toFixed(0)}
                      </div>
                    </div>
                    <div className="text-center p-2 bg-red-100 rounded">
                      <div className="text-muted-foreground">&gt;90 days</div>
                      <div className="font-medium">
                        {selectedCustomer.aging.over90.toFixed(0)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Recent Transactions */}
              <div className="space-y-2">
                <h4 className="font-medium">Recent Transactions</h4>
                <div className="max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedCustomer.transactions.map((tx) => (
                        <TableRow key={tx.id}>
                          <TableCell>
                            {format(new Date(tx.createdAt), "dd MMM yyyy")}
                          </TableCell>
                          <TableCell className={getTransactionColor(tx.type)}>
                            {transactionTypes.find((t) => t.value === tx.type)?.label ||
                              tx.type}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.amount.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                            })}
                          </TableCell>
                          <TableCell className="text-right">
                            {tx.balanceAfter.toLocaleString("en-IN", {
                              style: "currency",
                              currency: "INR",
                            })}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsDetailDialogOpen(false)}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
